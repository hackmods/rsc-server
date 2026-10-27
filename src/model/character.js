// "mob" or mobile entities. this includes characters and players.

const Entity = require('./entity');
const directions = require('./directions');
const shuffle = require('knuth-shuffle-seeded');
const wilderness = require('../wilderness');

// used to calculate a direction based on a change in coordinates. use
// deltaDirections[deltaX + 1][deltaY + 1] to get a direction number.
const deltaDirections = [
    [directions.southWest, directions.west, directions.northWest],
    [directions.south, null, directions.north],
    [directions.southEast, directions.east, directions.northEast]
];

// [ { deltaX: 0, deltaY: 1 }, ... ]
const numberDirections = [];

for (let deltaX = -1; deltaX < 2; deltaX += 1) {
    for (let deltaY = -1; deltaY < 2; deltaY += 1) {
        const directionNumber = deltaDirections[deltaX + 1][deltaY + 1];

        if (typeof directionNumber === 'number') {
            numberDirections[directionNumber] = { deltaX, deltaY };
        }
    }
}

function getDirectionNumber(deltaX, deltaY) {
    if (deltaX === 0 && deltaY === 0) {
        return 0;
    }

    return deltaDirections[deltaX + 1][deltaY + 1];
}

function getDirectionDelta(directionNumber) {
    return numberDirections[directionNumber];
}

// ARSC poison, ported from Open-RSC server/src/com/openrsc/server/event/rsc/impl/PoisonEvent.java: the event
// runs every 32 ticks, hurts for power / 10, loses 2 power per run and is cured silently once power drops below 10
const POISON_INTERVAL_TICKS = 32;
const POISON_MIN_POWER = 10;
const POISON_POWER_DECAY = 2;

// every obstacle cell of the tile is set: scenery fills it
function isTileBlocked(pathFinder, x, y) {
    if (!pathFinder || !pathFinder.obstacles) {
        return false;
    }

    const { x: ox, y: oy } = pathFinder.gameCoordsToObstacleCoords({ x, y });
    const { obstacles } = pathFinder;

    return !!(
        obstacles.get(ox, oy) &&
        obstacles.get(ox + 1, oy) &&
        obstacles.get(ox, oy + 1) &&
        obstacles.get(ox + 1, oy + 1)
    );
}

class Character extends Entity {
    constructor(world) {
        super(world);

        // direction number we're facing
        this.direction = 0;

        // the character we're fighting
        this.opponent = null;

        this.fightStage = -1;

        // the character we're talking to
        this.interlocutor = null;

        this.chasing = null;

        // can we move? certain NPCs still have conversation partners, but can
        // walk around (e.g. goblin generals in goblin diplomacy)
        this.locked = false;

        // animation IDs
        // see https://github.com/2003scape/rsc-config#configanimations
        this.animations = [];
        this.animations.length = 12;
        this.animations.fill(0, this.animations.length);

        // used to calculate who should get the drop
        // { player.id: damage }
        this.playerDamage = new Map();

        // ARSC: the parts of playerDamage dealt with ranged attacks and with
        // spells { player.id: damage }, so kills pay the right experience
        this.rangedDamage = new Map();
        this.magicDamage = new Map();

        this.isWalking = false;

        // ARSC poison: 0 when healthy, see poison()
        this.poisonPower = 0;
        this.poisonTicks = 0;
        // the player who poisoned an NPC, so a poison kill pays them
        this.poisonedBy = null;
    }

    get poisoned() {
        return this.poisonPower > 0;
    }

    // start (or restart) poison at this power. returns whether it took
    poison(power, poisonedBy = null) {
        this.poisonPower = power;
        this.poisonTicks = POISON_INTERVAL_TICKS;
        this.poisonedBy = poisonedBy;
        return true;
    }

    curePoison() {
        this.poisonPower = 0;
        this.poisonTicks = 0;
        this.poisonedBy = null;
    }

    // run every world tick
    tickPoison() {
        if (this.poisonPower <= 0) {
            return;
        }

        this.poisonTicks -= 1;

        if (this.poisonTicks > 0) {
            return;
        }

        this.poisonTicks = POISON_INTERVAL_TICKS;

        if (this.poisonPower < POISON_MIN_POWER) {
            this.curePoison();
            return;
        }

        const damage = Math.floor(this.poisonPower / 10);
        this.poisonPower -= POISON_POWER_DECAY;

        this.onPoisonDamage(damage);
        this.damage(damage, this.poisonedBy);
    }

    // hook for the message a poisoned player sees
    onPoisonDamage() {}

    lock() {
        this.locked = true;
    }

    unlock() {
        this.locked = false;
    }

    // make the character emit dialogue, usually with an NPC. automatically delay
    // between messages
    async say(...messages) {
        for (const message of messages) {
            this.broadcastChat(message, true);
            await this.world.sleepTicks(2);

            if (message.length >= 25) {
                await this.world.sleepTicks(1);
            }
        }
    }

    // returns whether or not we died
    // kind: 'melee', 'ranged' (Player#shootRanged) or 'magic' (spells)
    damage(damage, player, kind = 'melee') {
        if (player) {
            const totalDamage = this.playerDamage.get(player.id) || 0;
            this.playerDamage.set(player.id, totalDamage + damage);

            const byKind = { ranged: this.rangedDamage, magic: this.magicDamage }[kind];

            if (byKind) {
                byKind.set(player.id, (byKind.get(player.id) || 0) + damage);
            }
        }

        this.skills.hits.current -= damage;

        if (this.skills.hits.current <= 0) {
            this.die();
            return true;
        }

        this.broadcastDamage(damage);
        return false;
    }

    faceDirection(deltaX, deltaY) {
        if (this.isWalking) {
            return this.direction;
        }

        this.isWalking = true;

        const direction = getDirectionNumber(deltaX, deltaY);

        if (this.direction === direction) {
            return this.direction;
        }

        this.direction = direction;
        this.broadcastDirection();

        return this.direction;
    }

    // set our direction to face an entity (when we talk to an NPC or pick up
    // a ground item for instance)
    faceEntity(entity) {
        if (this.isWalking) {
            return this.direction;
        }

        this.isWalking = true;

        if (this.x === entity.x && this.y === entity.y) {
            if (entity.direction === 0) {
                this.direction = 0;
            } else if (entity.direction === 1) {
                this.direction = 6;
            }

            return this.direction;
        }

        let deltaX = this.x - entity.x;

        if (deltaX > 0) {
            deltaX = 1;
        } else if (deltaX < 0) {
            deltaX = -1;
        }

        let deltaY = this.y - entity.y;

        if (deltaY > 0) {
            deltaY = 1;
        } else if (deltaY < 0) {
            deltaY = -1;
        }

        const direction = deltaDirections[deltaX + 1][deltaY + 1];

        if (this.direction === direction) {
            return this.direction;
        }

        this.direction = direction;
        this.broadcastDirection();

        return this.direction;
    }

    // face and set our engager to this character, as well as busy status
    engage(character) {
        const { world } = this;

        this.lock();
        this.chasing = null;
        this.interlocutor = character;

        character.lock();
        character.chasing = null;
        character.interlocutor = this;

        const distance = this.getDistance(character);

        // characters don't talk to each other on the same tile, move the
        // interlocutor to a free tile and re-face them
        if (distance === 0) {
            const step = character.getFreeDirection();

            if (step) {
                world.setTickTimeout(() => {
                    character.walkTo(step.deltaX, step.deltaY);

                    world.setTickTimeout(() => {
                        this.faceEntity(character);
                        character.faceEntity(this);
                    }, 2);
                }, 2);
            }
        } else {
            world.setTickTimeout(() => {
                this.faceEntity(character);
                character.faceEntity(this);
            }, 2);
        }
    }

    // free both characters from busy states and conversational partner lock
    disengage() {
        this.unlock();

        if (this.interlocutor) {
            this.interlocutor.unlock();
            this.interlocutor.interlocutor = null;
            this.interlocutor = null;
        }
    }

    async attack(character) {
        if (character.opponent) {
            return false;
        }

        const { world } = this;

        this.toAttack = null;
        this.lock();

        if (this.chasing) {
            this.chasing = null;
        }

        let distance = this.getDistance(character);

        if (distance > 1.5) {
            await this.chase(character, 8);
        }

        distance = this.getDistance(character);

        if (character.opponent || distance > 1.5) {
            this.unlock();
            return false;
        }

        const deltaX = character.x - this.x;
        const deltaY = character.y - this.y;

        this.walkAction = true;

        if (!this.withinLineOfSight(character)) {
            this.walkAction = false;
            this.unlock();
            return false;
        }

        this.walkAction = false;

        if (character.constructor.name === 'Player') {
            character.message('You are under attack!');
        }

        character.lock();
        character.opponent = this;
        character.combatRounds = 0;
        character.fightStage = 1;

        if (character.walkQueue) {
            character.walkQueue.length = 0;
        } else {
            character.stepsLeft = 0;
        }

        if (character.direction !== 8) {
            world.nextTick(() => {
                if (character.opponent) {
                    character.direction = 8;
                    character.broadcastDirection();
                }
            });
        }

        this.opponent = character;
        this.combatRounds = 0;
        this.fightStage = 0;

        // Mob.startCombat: a player attacking a player is skulled (unless
        // retaliating) and both are in combat for the logout timer
        if (this.username && character.username) {
            wilderness.skullOnAttack(this, character);
            wilderness.markCombat(this, character);
        }

        if (deltaX !== 0 || deltaY !== 0) {
            world.nextTick(() => {
                this.walkTo(deltaX, deltaY);

                world.setTickTimeout(() => {
                    this.direction = 9;
                    this.broadcastDirection();
                }, 2);
            });
        } else {
            world.nextTick(() => {
                this.direction = 9;
                this.broadcastDirection();
            });
        }

        return true;
    }

    async retreat() {
        if (this.fightStage === -1 || this.retreating) {
            return;
        }

        const { world } = this;
        const opponent = this.opponent;

        this.retreating = true;
        this.unlock();
        this.fightStage = -1;

        // PVP_REATTACK_TIMER: a player who ran from a player can't be
        // attacked again in melee straight away
        if (this.username && opponent && opponent.username) {
            this.ranAwayTick = world.ticks;
            wilderness.markCombat(this, opponent);
        }

        if (opponent) {
            opponent.unlock();
            opponent.fightStage = -1;

            if (opponent.constructor.name === 'NPC' && !opponent.retreats) {
                opponent.retreatTicks = 4;

                world.setTickTimeout(() => {
                    if (!this.locked && opponent.skills.hits.current > 0) {
                        opponent.attack(this);
                    }
                }, 4);
            }
        }

        world.nextTick(() => {
            if (
                !this.isWalking &&
                this.direction >= 8 &&
                (this.walkQueue ? !this.walkQueue.length : !this.stepsLeft)
            ) {
                this.faceDirection(0, 0);
            }

            if (opponent) {
                if (opponent.direction >= 8) {
                    opponent.faceDirection(0, 0);
                }

                opponent.opponent = null;
                this.opponent = null;
            }

            this.retreating = false;
        });
    }

    // collision detection for players and NPCs to determine if next step is
    // valid
    canWalk(deltaX, deltaY) {
        // if this returns true, the character gets added to the players' moved
        // entity lists, and desyncs from the server by moving an extra tile
        if (deltaX === 0 && deltaY === 0) {
            return false;
        }

        const { pathFinder } = this.world;

        // ARSC: a player put inside blocked scenery (Open-RSC teleports onto it, e.g. the barbarian course's 2x2
        // spiked pit) may take any step until they are out; the tile's own obstacle cells would otherwise read as
        // walls on every side and trap them. Only a teleport puts anyone there.
        const trapped = isTileBlocked(pathFinder, this.x, this.y);

        if (
            !trapped &&
            !pathFinder.isValidGameStep(
                { x: this.x, y: this.y },
                { deltaX, deltaY }
            )
        ) {
            return false;
        }

        const destX = this.x + deltaX;
        const destY = this.y + deltaY;

        if (
            this.toAttack &&
            this.toAttack.x === destX &&
            this.toAttack.y === destY
        ) {
            return true;
        }

        // attackable? npcs always break our path
        const npcs = this.world.npcs.getAtPoint(destX, destY);

        for (const npc of npcs) {
            if (npc.definition.hostility && !npc.opponent) {
                return false;
            }
        }

        // we aren't allowed to finish our path on a player (but walking through
        // them is fine)
        if (
            !this.walkAction &&
            (this.stepsLeft === 0 ||
                (this.walkQueue && !this.walkQueue.length)) &&
            (this.world.players.getAtPoint(destX, destY).length ||
                this.world.npcs.getAtPoint(destX, destY).length)
        ) {
            return false;
        }

        return true;
    }

    //TODO changeDirection?
    walkTo(deltaX, deltaY) {
        if (this.isWalking) {
            return;
        }

        this.isWalking = true;

        const oldX = this.x;
        const oldY = this.y;

        this.x += deltaX;
        this.y += deltaY;

        this.direction = getDirectionNumber(oldX - this.x, oldY - this.y);
        this.broadcastMove();
    }

    getPointSteps(destX, destY, overlap = true) {
        const { world } = this;

        const steps = [];

        const path = world.pathFinder.getLineOfSight(
            { x: this.x, y: this.y },
            { x: destX, y: destY }
        );

        if (overlap) {
            path.push({ x: destX, y: destY });
        }

        let x = this.x;
        let y = this.y;

        for (const { x: stepX, y: stepY } of path) {
            if (stepX === this.x && stepY === this.y) {
                continue;
            }

            const deltaX = stepX - x;
            const deltaY = stepY - y;

            const validStep = world.pathFinder.isValidGameStep(
                { x, y },
                { deltaX, deltaY }
            );

            if (validStep) {
                steps.push({ deltaX, deltaY });
            } else {
                break;
            }

            x += deltaX;
            y += deltaY;
        }

        return steps;
    }

    async walkToPoint(destX, destY, overlap = true) {
        const { world } = this;
        const steps = this.getPointSteps(destX, destY, overlap);

        for (const { deltaX, deltaY } of steps) {
            if (
                (this.walkQueue && this.walkQueue.length) ||
                this.stepsLeft > 0
            ) {
                return;
            }

            this.walkTo(deltaX, deltaY);
            await world.sleepTicks(1);
        }
    }

    async chase(entity, range = 16, overlap = false) {
        const { world } = this;

        let ticks = 0;

        this.stepsLeft = 0;
        this.chasing = entity;

        newSteps: do {
            const destX = this.chasing.x;
            const destY = this.chasing.y;

            const steps = this.getPointSteps(destX, destY, overlap);

            ticks += 1;

            if (ticks >= 10) {
                break;
            }

            for (const { deltaX, deltaY } of steps) {
                if (ticks >= 10) {
                    break newSteps;
                }

                if (
                    !this.chasing ||
                    (this.walkQueue
                        ? this.walkQueue.length
                        : this.stepsLeft > 0) ||
                    this.chasing.getDistance(this) >= range
                ) {
                    break newSteps;
                }

                if (this.chasing.x !== destX || this.chasing.y !== destY) {
                    continue newSteps;
                }

                if (
                    this.withinWalkBounds &&
                    !this.withinWalkBounds(this.x + deltaX, this.y + deltaY)
                ) {
                    break newSteps;
                }

                if (!overlap && !this.canWalk(deltaX, deltaY)) {
                    break newSteps;
                }

                this.walkTo(deltaX, deltaY);
                await world.sleepTicks(1);

                ticks += 1;
            }
        } while (
            this.chasing &&
            (overlap
                ? this.x !== this.chasing.x || this.y !== this.chasing.y
                : this.getDistance(this.chasing) > 1.5)
        );

        this.chasing = null;
    }

    getFreeDirection(visitedTiles, random = false) {
        const directions = random
            ? shuffle(numberDirections.slice())
            : numberDirections;

        for (const { deltaX, deltaY } of directions) {
            const destX = this.x + deltaX;
            const destY = this.y + deltaY;

            if (
                (deltaX === 0 && deltaY === 0) ||
                (visitedTiles && visitedTiles.has(`${destX},${destY}`))
            ) {
                continue;
            }

            if (this.canWalk(deltaX, deltaY)) {
                return { deltaX: deltaX, deltaY: deltaY };
            }
        }
    }

    getFrontPoint() {
        const { deltaX, deltaY } = getDirectionDelta(this.direction);

        return {
            x: this.x + deltaX,
            y: this.y + deltaY
        };
    }

    getBackPoint() {
        const { deltaX, deltaY } = getDirectionDelta(this.direction);

        return {
            x: this.x - deltaX,
            y: this.y - deltaY
        };
    }

    // the kill's combat experience for the victor (NPC.die, and Player
    // processDeath for a player kill)
    rewardKill(victor) {
        const totalExperience = this.getCombatExperience();

        // ARSC: damage dealt with a bow pays ranged experience (and no
        // hits), spell damage pays nothing here (the cast already paid
        // magic experience), the rest pays the combat-style split
        // below. Open-RSC server/src/com/openrsc/server/model/entity/
        // npc/Npc.java handleXpDistribution: ranged gets the whole
        // combat experience for ranged damage (lines 765-776), mage
        // damagers only count for the loot (778-788); here the victor
        // still takes all of it, split by how they dealt the damage.
        const dealt = this.playerDamage.get(victor.id) || 0;
        const ranged = Math.min(
            this.rangedDamage.get(victor.id) || 0,
            dealt
        );
        const magic = Math.min(
            this.magicDamage.get(victor.id) || 0,
            dealt - ranged
        );
        const rangedShare = dealt > 0 ? ranged / dealt : 0;
        const meleeShare = dealt > 0 ? (dealt - ranged - magic) / dealt : 1;
        const rangedExperience = Math.floor(
            totalExperience * rangedShare
        );

        if (rangedExperience > 0) {
            victor.addExperience('ranged', rangedExperience);
        }

        const quarterExperience = Math.floor(
            (totalExperience * meleeShare) / 4
        );

        victor.addExperience('hits', quarterExperience);

        switch (victor.combatStyle) {
            case 0: // controlled
                victor.addExperience('attack', quarterExperience);
                victor.addExperience('defense', quarterExperience);
                victor.addExperience('strength', quarterExperience);
                break;
            case 1: // aggressive
                victor.addExperience('strength', quarterExperience * 3);
                break;
            case 2: // accurate
                victor.addExperience('attack', quarterExperience * 3);
                break;
            case 3: // defensive
                victor.addExperience('defense', quarterExperience * 3);
                break;
        }
    }

    getCombatExperience() {
        return this.combatLevel * 8 + 80;
    }
}

module.exports = Character;
