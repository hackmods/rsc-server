// Ported from Open-RSC Core-Framework authentic/misc/Cannon.java, event/rsc/impl/projectile/FireCannonEvent.java and
// the cannon pages of authentic/itemactions/InvAction.java (instruction manual, Nulodion's notes) (AGPL-3.0)
// https://classic.runescape.wiki/w/Dwarf_multicannon
//
// After Dwarf Cannon (quest key dwarfCannon -1) the Dwarf cannon base 1032 is "set down" (not within the dwarf black
// guard area 240-309 x 432-527, not on an object, not in the King Black Dragon lair, one cannon per player) as object
// 946 owned by the player; the stand 1033 makes it 947, the barrels 1034 948 and the furnace 1035 the dwarf multicannon
// 943. Cache: has_cannon, cannon_stage (1-4), cannon_x, cannon_y (the Cannon engineer replaces a cannon that is gone,
// quests/members/dwarf-cannon/cannon-engineer.js). Picking any stage up gives back its parts.
//
// "fire" (943): every tick, up to 19 shots (the Java stops on its 20th count), each one multi cannon ball 1041 from the
// pack at a living attackable NPC in view within 8 tiles of the player and in line of sight, never the one just shot
// (with a single target the cannon stops after one shot, as in the Java), picked clockwise from the west. Damage is
// 0..(ranged / 3 + 2) with a cannon ball projectile, landing the next tick, credited as ranged damage (ranged
// experience when the NPC dies, as Open-RSC's addRangeDamage). The NPC does not chase the player.
// Gap: Open-RSC stops the cannon on any player action (resetAll); here it stops when the player moves or logs out.

const GameObject = require('../../model/game-object');

const DWARF_CANNON_BASE_ID = 1032;
const DWARF_CANNON_STAND_ID = 1033;
const DWARF_CANNON_BARRELS_ID = 1034;
const DWARF_CANNON_FURNACE_ID = 1035;
const MULTI_CANNON_BALL_ID = 1041;
const NULODIONS_NOTES_ID = 1056;
const INSTRUCTION_MANUAL_ID = 1073;

const CANNON_BASE_OBJECT_ID = 946;
const CANNON_STAND_OBJECT_ID = 947;
const CANNON_BARRELS_OBJECT_ID = 948;
const CANNON_OBJECT_ID = 943;

// in set-up order
const CANNON_OBJECT_IDS = [
    CANNON_BASE_OBJECT_ID,
    CANNON_STAND_OBJECT_ID,
    CANNON_BARRELS_OBJECT_ID,
    CANNON_OBJECT_ID
];

const CANNON_PART_IDS = [
    DWARF_CANNON_BASE_ID,
    DWARF_CANNON_STAND_ID,
    DWARF_CANNON_BARRELS_ID,
    DWARF_CANNON_FURNACE_ID
];

// FireCannonEvent: "Needs source"
const MAX_DISTANCE = 8;
// the instruction manual: "will fire up to 20 rounds before stopping"
const MAX_SHOTS = 20;
const CANNON_PROJECTILE = 5;

function clearCannonCache(player) {
    delete player.cache.has_cannon;
    delete player.cache.cannon_stage;
    delete player.cache.cannon_x;
    delete player.cache.cannon_y;
}

function inBounds({ x, y }, minX, minY, maxX, maxY) {
    return x >= minX && x <= maxX && y >= minY && y <= maxY;
}

function placeObject(world, id, x, y, owner) {
    const object = new GameObject(world, { id, direction: 0, x, y });
    object.owner = owner;
    world.addEntity('gameObjects', object);
    return object;
}

async function setDownBase(player) {
    const { world } = player;

    if (player.questStages.dwarfCannon !== -1) {
        player.message("you can't set up this cannon...");
        await world.sleepTicks(3);
        player.message('...you need to complete the dwarf cannon quest');
        return;
    }

    // Point.inDwarfArea
    if (inBounds(player, 240, 432, 309, 527)) {
        player.message('it is not permitted to set up a cannon...');
        await world.sleepTicks(3);
        player.message('...this close to the dwarf black guard');
        return;
    }

    if (player.cache.has_cannon != null) {
        player.message('you cannot construct more than one cannon at a time...');
        await world.sleepTicks(3);
        player.message('if you have lost your cannon ...');
        await world.sleepTicks(3);
        player.message('...go and see the dwarf cannon engineer');
        return;
    }

    if (world.gameObjects.getAtPoint(player.x, player.y).length) {
        player.message("you can't set up the cannon here");
        return;
    }

    // no cannon in the KBD lair; "most likely authentic, but no direct proof"
    if (inBounds(player, 562, 3314, 572, 3332)) {
        player.message("you can't set up the cannon here");
        return;
    }

    if (player.walkQueue) {
        player.walkQueue.length = 0;
    }

    player.message('you place the cannon base on the ground');
    await world.sleepTicks(3);

    if (!player.inventory.has(DWARF_CANNON_BASE_ID)) {
        return;
    }

    player.inventory.remove(DWARF_CANNON_BASE_ID);

    const base = placeObject(world, CANNON_BASE_OBJECT_ID, player.x, player.y, player.username);

    player.cache.has_cannon = true;
    player.cache.cannon_x = base.x;
    player.cache.cannon_y = base.y;
    player.cache.cannon_stage = 1;
}

// the item to add on each part, the message and the next object
const ADD_PART = {
    [CANNON_BASE_OBJECT_ID]: {
        item: DWARF_CANNON_STAND_ID,
        next: CANNON_STAND_OBJECT_ID,
        stage: 2,
        message: 'you add the stand',
        notOwner: 'you can only add this stand to your own base'
    },
    [CANNON_STAND_OBJECT_ID]: {
        item: DWARF_CANNON_BARRELS_ID,
        next: CANNON_BARRELS_OBJECT_ID,
        stage: 3,
        message: 'you add the barrels',
        notOwner: 'you can only add the barrels to your own cannon'
    },
    [CANNON_BARRELS_OBJECT_ID]: {
        item: DWARF_CANNON_FURNACE_ID,
        next: CANNON_OBJECT_ID,
        stage: 4,
        message: 'you add the furnace',
        notOwner: 'you can only add the furnace to your own cannon'
    }
};

function addPart(player, gameObject, item) {
    const part = ADD_PART[gameObject.id];

    if (gameObject.owner !== player.username) {
        player.message(part.notOwner);
        return;
    }

    if (item.id !== part.item) {
        player.message("these parts don't seem to fit together");
        return;
    }

    if (!player.inventory.has(part.item)) {
        return;
    }

    player.inventory.remove(part.item);
    player.message(part.message);

    const { world } = player;
    world.removeEntity('gameObjects', gameObject);
    placeObject(world, part.next, gameObject.x, gameObject.y, player.username);
    player.cache.cannon_stage = part.stage;
}

function pickUp(player, gameObject) {
    const parts = CANNON_OBJECT_IDS.indexOf(gameObject.id) + 1;

    // sic: the barrels say "cannon base"
    player.message(gameObject.id === CANNON_BARRELS_OBJECT_ID ? 'you pick up the cannon base' : 'you pick up the cannon');
    player.message("it's really heavy");

    for (const id of CANNON_PART_IDS.slice(0, parts)) {
        player.inventory.add(id, 1);
    }

    player.world.removeEntity('gameObjects', gameObject);

    if (player.cache.has_cannon != null) {
        const stage = player.cache.cannon_stage;
        clearCannonCache(player);

        // sic: picking up the finished cannon leaves cannon_stage behind
        if (gameObject.id === CANNON_OBJECT_ID && stage != null) {
            player.cache.cannon_stage = stage;
        }
    }
}

// FireCannonEvent.MobClockwiseComparator (https://stackoverflow.com/q/6989100)
function clockwise(centerX, centerY) {
    return (a, b) => {
        const adx = a.x - centerX;
        const ady = a.y - centerY;
        const bdx = b.x - centerX;
        const bdy = b.y - centerY;

        if (adx < 0 && bdx >= 0) return -1;
        if (adx >= 0 && bdx < 0) return 1;

        if (adx === 0 && bdx === 0) {
            if (ady >= 0 || bdy >= 0) return a.y - b.y;
            return b.y - a.y;
        }

        const det = adx * bdy - bdx * ady;

        if (det < 0) return -1;
        if (det > 0) return 1;

        return adx * adx + ady * ady - (bdx * bdx + bdy * bdy);
    };
}

function isValidTarget(player, firing, npc) {
    return (
        npc !== firing.target &&
        !!npc.definition.hostility &&
        npc.skills.hits.current > 0 &&
        inBounds(
            npc,
            player.x - MAX_DISTANCE,
            player.y - MAX_DISTANCE,
            player.x + MAX_DISTANCE,
            player.y + MAX_DISTANCE
        ) &&
        player.withinLineOfSight(npc, true)
    );
}

function stopFiring(player) {
    if (player.cannonFiring) {
        player.world.clearTickTimeout(player.cannonFiring.timeout);
        player.cannonFiring = null;
    }
}

function shoot(player, npc) {
    const { world } = player;
    const maxHit = Math.floor(player.skills.ranged.base / 3) + 2;
    const damage = Math.floor(Math.random() * (maxHit + 1));

    player.sendProjectile(npc, CANNON_PROJECTILE);
    player.sendSound('shoot');

    // ProjectileEvent: the ball lands a tick later, if the target is still within 15 tiles
    world.setTickTimeout(() => {
        if (npc.skills.hits.current <= 0 || player.getDistance(npc) > 15) {
            return;
        }

        npc.damage(Math.min(damage, npc.skills.hits.current), player, 'ranged');
    }, 1);
}

// FireCannonEvent.run, once a tick
function fireTick(player) {
    const firing = player.cannonFiring;

    if (!firing) {
        return;
    }

    if (!player.loggedIn || player.x !== firing.x || player.y !== firing.y) {
        stopFiring(player);
        return;
    }

    firing.shots += 1;

    if (firing.shots >= MAX_SHOTS) {
        stopFiring(player);
        return;
    }

    if (!player.inventory.has(MULTI_CANNON_BALL_ID)) {
        player.message("you're out of ammo");
        stopFiring(player);
        return;
    }

    player.message('searching for targets');

    const targets = player.world.npcs
        .getInArea(player.x, player.y, MAX_DISTANCE)
        .filter((npc) => isValidTarget(player, firing, npc));

    if (!targets.length) {
        player.message('there are no available creatures to target');
        stopFiring(player);
        return;
    }

    player.inventory.remove(MULTI_CANNON_BALL_ID);

    targets.sort(clockwise(player.x, player.y));
    firing.target = targets[0];

    if (player.faceEntity) {
        player.faceEntity(firing.target);
    }

    shoot(player, firing.target);

    firing.timeout = player.world.setTickTimeout(() => fireTick(player), 1);
}

function fire(player) {
    if (!player.inventory.has(MULTI_CANNON_BALL_ID)) {
        player.message("you're out of ammo");
        return;
    }

    if (player.cannonFiring) {
        return;
    }

    player.cannonFiring = { shots: 0, target: null, x: player.x, y: player.y };
    player.cannonFiring.timeout = player.world.setTickTimeout(() => fireTick(player), 1);
}

async function onGameObject(player, gameObject, command) {
    if (!CANNON_OBJECT_IDS.includes(gameObject.id)) {
        return false;
    }

    const firing = gameObject.id === CANNON_OBJECT_ID && command === 'fire';

    if (gameObject.owner !== player.username) {
        if (!firing) {
            player.message("you can't pick that up, the owners still around");
        } else {
            player.message("you can't fire this cannon...");
            await player.world.sleepTicks(3);
            player.message("...it doesn't belong to you");
        }
    } else if (!firing && player.isTired()) {
        player.message('you arms are too tired to pick it up'); // sic
    } else if (firing) {
        fire(player);
    } else {
        stopFiring(player);
        pickUp(player, gameObject);
    }

    return true;
}

async function onGameObjectCommandOne(player, gameObject) {
    return onGameObject(player, gameObject, gameObject.definition.commands[0].toLowerCase());
}

async function onGameObjectCommandTwo(player, gameObject) {
    return onGameObject(player, gameObject, gameObject.definition.commands[1].toLowerCase());
}

async function onUseWithGameObject(player, gameObject, item) {
    if (ADD_PART[gameObject.id]) {
        addPart(player, gameObject, item);
        return true;
    }

    if (gameObject.id === CANNON_OBJECT_ID && item.id === MULTI_CANNON_BALL_ID) {
        player.message('the cannon loads automatically');
        return true;
    }

    return false;
}

function box(player, message) {
    // ActionSender.sendBox(player, message, true): the big box, '%' breaks a line
    player.send({ type: 'serverMessageOnTop', message });
}

async function readManual(player) {
    player.message('the manual has four pages');
    await player.world.sleepTicks(3);

    const page = await player.ask(['Constructing the cannon', 'Making ammo', 'firing the cannon', 'warrenty'], true);

    if (page === 0) {
        box(
            player,
            'Constructing the cannon% %' +
                'To construct the cannon, firstly set down Dwarf cannon base on the ground.% %' +
                'Next add the Dwarf cannon stand to the Dwarf cannon base.% %' +
                'Then add the Dwarf cannon barrels (this can be tiring work).% %' +
                'Last of all add the Dwarf cannon furnace which powers the cannon.% %' +
                'You should now have a fully set up dwarf multi cannon ready to go splat some nasty creatures.% % % %' +
                '@red@WARNING: You should be well rested before attempting to @red@lift the heavy cannon'
        );
    } else if (page === 1) {
        box(
            player,
            'Making ammo% %' +
                'The ammo for the cannon is made from steel bars.% %' +
                'Firstly you must heat up a steel bar in a furnace% %' +
                'Then pour the molten steel into a cannon ammo mould% %' +
                'You should now have a ready to fire multi cannon ball% %'
        );
    } else if (page === 2) {
        box(
            player,
            'Firing the cannon% %' +
                'The cannon will only fire when monsters are available to target.% %' +
                'If you are carrying enough ammo the multi cannon will fire up to 20 rounds before stopping.% %' +
                'The cannon will automatically target non friendly creatures.% %' +
                '@red@Warning - firing the cannon is exhausting work and can @red@leave adventurers too fatigued to carry the cannon, so @red@rest well before using'
        );
    } else if (page === 3) {
        box(
            player,
            '@red@Dwarf cannon warrenty% %' +
                'If your cannon is stolen or lost, after or during being set up, the dwarf engineer will happily replace the parts% %' +
                'However cannon parts that were given away or dropped will not be replaced for free% %' +
                'It is only possible to operate one cannon at a time% % % % % %' +
                'by order of the dwarwven black guard'
        );
    }
}

async function onInventoryCommand(player, item) {
    if (item.id === DWARF_CANNON_BASE_ID) {
        await setDownBase(player);
        return true;
    }

    if (item.id === INSTRUCTION_MANUAL_ID) {
        await readManual(player);
        return true;
    }

    if (item.id === NULODIONS_NOTES_ID) {
        player.message('the note reads....');
        box(
            player,
            'Ammo for the dwarf multi cannon must be made from steel bars% %' +
                'The bars must be heated in a furnace and used with the cannon ball mould.% %' +
                "Due to the cannon ball's extreame weight only so many can be carried before one must rest"
        );
        return true;
    }

    return false;
}

module.exports = {
    onGameObjectCommandOne,
    onGameObjectCommandTwo,
    onUseWithGameObject,
    onInventoryCommand,
    CANNON_OBJECT_IDS,
    CANNON_PART_IDS,
    clearCannonCache,
    stopFiring
};
