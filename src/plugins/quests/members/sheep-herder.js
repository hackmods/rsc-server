// Ported from Open-RSC Core-Framework authentic/quests/members/SheepHerder.java (AGPL-3.0)
// Sheep Herder (quest 33, sheepHerder). Stages: 0 not started, 1 Councillor Halgrive gave the poisoned feed, 2 Doctor
// Orbon (npcs/ardougne/doctor-orbon.js) sold the protective suit, -1 done. Four plague sheep (430-433) are nudged with
// the cattle prod (757, in Farmer Brumty's barn) into the pen on his farm north of East Ardougne, poisoned there
// (759), and their remains (758, 762, 763, 764) burnt in the cattle furnace (444). Halgrive pays 3100 coins.
//
// Herding (SheepHerder.onUseNpc): each nudge jumps the sheep a few tiles toward the pen (the direction depends on where
// the player stands, or for the 3rd and 4th sheep where the sheep stands) and it then walks back toward its spawn, so
// the player has to keep up. Next to the pen it jumps the gate. A sheep left alone for ~80 s after a nudge is removed
// and respawns at its spawn. Plague sheep never roam on their own (Open-RSC NpcBehavior.handleRoam).

const COUNCILLOR_HALGRIVE_ID = 436;
const FARMER_BRUMTY_ID = 434;
const FIRST_SHEEP_ID = 430;
const SECOND_SHEEP_ID = 431;
const THIRD_SHEEP_ID = 432;
const FOURTH_SHEEP_ID = 433;
const SHEEP_IDS = [FIRST_SHEEP_ID, SECOND_SHEEP_ID, THIRD_SHEEP_ID, FOURTH_SHEEP_ID];

const COINS_ID = 10;
const CATTLE_PROD_ID = 757;
const POISONED_ANIMAL_FEED_ID = 759;
const PROTECTIVE_JACKET_ID = 760;
const PROTECTIVE_TROUSERS_ID = 761;

// remains item and the cache flag set when they are burnt, per sheep
const REMAINS = {
    [FIRST_SHEEP_ID]: { id: 758, key: 'plagueremain1st' },
    [SECOND_SHEEP_ID]: { id: 762, key: 'plagueremain2nd' },
    [THIRD_SHEEP_ID]: { id: 763, key: 'plagueremain3th' },
    [FOURTH_SHEEP_ID]: { id: 764, key: 'plagueremain4th' }
};
const REMAINS_BY_ITEM = Object.fromEntries(
    Object.values(REMAINS).map((remains) => [remains.id, remains])
);

const GATE_ID = 443;
const OPEN_GATE_ID = 442;
const CATTLE_FURNACE_ID = 444;

// the pen: a sheep here can be poisoned (Point.inBounds(589, 543, 592, 548))
const PEN = { minX: 589, minY: 543, maxX: 592, maxY: 548 };
const PEN_DROP = [590, 546];

// RestartableDelayedEvent: 2 * 640 ms per run, removed once it ran more than 60 times without a nudge
const IDLE_TICKS = 2 * 62;

function inPen(npc) {
    return (
        npc.x >= PEN.minX &&
        npc.x <= PEN.maxX &&
        npc.y >= PEN.minY &&
        npc.y <= PEN.maxY
    );
}

function wearingProtectiveClothing(player) {
    return (
        player.inventory.isEquipped(PROTECTIVE_JACKET_ID) &&
        player.inventory.isEquipped(PROTECTIVE_TROUSERS_ID)
    );
}

function herdOf(npc) {
    if (!npc.herd) {
        npc.herd = { generation: 0, idle: 0, npc };
    }

    return npc.herd;
}

function alive(world, npc) {
    return world.npcs.getByIndex(npc.index) === npc;
}

// SheepHerder.moveNpc: the sheep jumps to (x, y). An NPC can only be moved one tile at a time to the client, so the
// sheep is respawned as a new entity there (its spawn point, wander box and respawn stay those of the original)
function moveNpc(world, npc, x, y) {
    const herd = herdOf(npc);
    const NPC = npc.constructor;
    const moved = new NPC(world, {
        id: npc.id,
        x,
        y,
        minX: npc.minX,
        maxX: npc.maxX,
        minY: npc.minY,
        maxY: npc.maxY
    });

    moved.spawnX = npc.spawnX;
    moved.spawnY = npc.spawnY;
    moved.stationary = true;
    moved.herd = herd;
    herd.npc = moved;

    npc.respawn = undefined;
    world.removeEntity('npcs', npc);
    world.addEntity('npcs', moved);

    return moved;
}

// SheepHerder.walkMob: after a hop the sheep wanders back through the waypoints (stops when it is nudged again)
async function walkBack(world, herd, generation, points) {
    for (const [x, y] of points) {
        const npc = herd.npc;

        if (herd.generation !== generation || !alive(world, npc)) {
            return;
        }

        await npc.walkToPoint(x, y);
    }
}

// the Open-RSC GameStateEvent: hop(s) 2 ticks apart, then the walk back. A new hop stops the previous walk (moveNpc
// resets the path); a nudge that does not move the sheep lets it walk on
function scatter(world, npc, { hops, path, message, player }) {
    const herd = herdOf(npc);
    herd.generation += 1;
    const generation = herd.generation;

    (async () => {
        for (let i = 0; i < hops.length; i += 1) {
            if (herd.generation !== generation || !alive(world, herd.npc)) {
                return;
            }

            if (i === 0 && message) {
                player.message(message);
            }

            moveNpc(world, herd.npc, hops[i][0], hops[i][1]);
            await world.sleepTicks(2);
        }

        await walkBack(world, herd, generation, path);
    })().catch(() => {});
}

// a nudge (re)starts the idle timer: ~80 s later an untouched sheep is removed and respawns at home
function touch(world, npc) {
    const herd = herdOf(npc);

    herd.idle += 1;

    const idle = herd.idle;

    world.setTickTimeout(() => {
        if (herd.idle === idle && alive(world, herd.npc)) {
            herd.generation += 1;
            world.removeEntity('npcs', herd.npc);
        }
    }, IDLE_TICKS);
}

async function sheepYell(player) {
    await player.world.sleepTicks(1);
    player.message('@yel@:Baaaaaaaaa!!!');
}

async function jumpIn(player, npc) {
    await sheepYell(player);
    player.message('the sheep jumps the gate into the enclosure');
    herdOf(npc).generation += 1;
    moveNpc(player.world, herdOf(npc).npc, PEN_DROP[0], PEN_DROP[1]);
}

// the start tile the sheep heads back to
function home(npc) {
    return [npc.spawnX, npc.spawnY];
}

async function nudgeFirst(player, npc) {
    const { world } = player;
    const start = home(npc);

    if (player.y >= 563) {
        scatter(world, npc, { hops: [[580, 558]], path: [start] });
    } else if (player.y >= 559) {
        scatter(world, npc, { hops: [[585, 553]], path: [[582, 555], start] });
    } else if (player.y <= 558 && player.y > 542) {
        scatter(world, npc, {
            hops: [[594, 538]],
            path: [[587, 538], [578, 546], start]
        });
    } else {
        await jumpIn(player, npc);
        return;
    }

    player.message('the sheep runs to the north');
    await sheepYell(player);
}

async function nudgeSecond(player, npc) {
    const { world } = player;
    const start = home(npc);

    if (player.y >= 559) {
        scatter(world, npc, { hops: [[585, 553]], path: [[582, 555], start] });
    } else if (player.y <= 558 && player.y > 542) {
        // Open-RSC: "intentionally add bug for authenticity" (a hop back to 585,553 first)
        scatter(world, npc, {
            hops: [[585, 553], [594, 538]],
            path: [[587, 538], [581, 542], start]
        });
    } else {
        await jumpIn(player, npc);
        return;
    }

    player.message('the sheep runs to the north');
    await sheepYell(player);
}

async function nudgeThird(player, npc) {
    const { world } = player;
    const start = home(npc);
    const east = 'the sheep runs to the east';

    if (npc.x > 618) {
        scatter(world, npc, { hops: [[614, 531]], path: [start], message: east, player });
    } else if (npc.x < 619 && npc.x > 612) {
        scatter(world, npc, {
            hops: [[604, 531]],
            path: [[614, 531], start],
            message: east,
            player
        });
    } else if (npc.x < 613 && npc.x > 602) {
        scatter(world, npc, {
            hops: [[594, 531]],
            path: [[604, 531], [614, 531], start],
            message: east,
            player
        });
    } else if (npc.x < 603 && npc.x > 592) {
        scatter(world, npc, {
            hops: [[584, 531]],
            path: [[585, 532], [589, 532], [594, 531], [604, 531], [614, 531], start],
            message: east,
            player
        });
    } else if (npc.x < 593 && npc.x > 582) {
        scatter(world, npc, {
            hops: [[579, 543]],
            path: [[589, 532], [594, 531], [604, 531], [614, 531], start],
            message: 'the sheep runs to the southeast',
            player
        });
    } else if (npc.x < 586) {
        await jumpIn(player, npc);
        return;
    }

    await sheepYell(player);
}

async function nudgeFourth(player, npc) {
    const { world } = player;
    const start = home(npc);
    const north = 'the sheep runs to the north';
    const northeast = 'the sheep runs to the northeast';

    if (npc.x === 603 && npc.y < 589) {
        scatter(world, npc, {
            hops: [[603, 595]],
            path: [start],
            message: 'the sheep runs to the south',
            player
        });
    } else if (npc.y > 589 && npc.y < 599) {
        scatter(world, npc, {
            hops: [[591, 603]],
            path: [[596, 603], [598, 599], start],
            message: 'the sheep runs to the southeast',
            player
        });
    } else if (npc.y > 598 && npc.y < 604) {
        scatter(world, npc, {
            hops: [[587, 596]],
            path: [[589, 595], [593, 595], [595, 587]],
            message: 'the sheep runs over the river to the northeast',
            player
        });
    } else if (npc.y > 583 && npc.y < 588) {
        scatter(world, npc, {
            hops: [[588, 578]],
            path: [[594, 584], [594, 586]],
            message: north,
            player
        });
    } else if (npc.y > 575 && npc.y < 585) {
        scatter(world, npc, {
            hops: [[588, 570]],
            path: [[594, 578], [595, 578]],
            message: north,
            player
        });
    } else if (npc.y > 567 && npc.y < 576) {
        scatter(world, npc, {
            hops: [[589, 562]],
            path: [[594, 567], [595, 567]],
            message: northeast,
            player
        });
    } else if (npc.y > 565 && npc.y < 568) {
        scatter(world, npc, {
            hops: [[587, 552]],
            path: [[596, 567]],
            message: northeast,
            player
        });
    } else if (npc.y > 551 && npc.y < 562) {
        scatter(world, npc, {
            hops: [[586, 547]],
            path: [[598, 557]],
            message: northeast,
            player
        });
    } else if (npc.y > 547 && npc.y < 552) {
        scatter(world, npc, {
            hops: [[586, 539]],
            path: [[588, 549]],
            message: northeast,
            player
        });
    } else if (npc.y <= 547) {
        await jumpIn(player, npc);
        return;
    }

    await sheepYell(player);
}

const NUDGES = {
    [FIRST_SHEEP_ID]: nudgeFirst,
    [SECOND_SHEEP_ID]: nudgeSecond,
    [THIRD_SHEEP_ID]: nudgeThird,
    [FOURTH_SHEEP_ID]: nudgeFourth
};

async function prod(player, npc) {
    const { world } = player;

    if (
        !wearingProtectiveClothing(player) ||
        player.questStages.sheepHerder === -1
    ) {
        player.message('@que@this sheep has the plague');
        await world.sleepTicks(3);
        player.message('@que@you better not touch it');
        await world.sleepTicks(3);
        return;
    }

    if (inPen(npc)) {
        player.message('The sheep is already in the pen');
        return;
    }

    player.message('you nudge the sheep forward');
    touch(world, npc);
    await NUDGES[npc.id](player, npc);
}

// Npc.killedBy with no damage dealt: the drops (the remains, rolls in src/arsc-drops.json) go to the player
function killSheep(player, npc) {
    const { world } = player;

    herdOf(npc).generation += 1;
    herdOf(npc).idle += 1;

    for (const drop of npc.getDrops()) {
        world.addPlayerDrop(player, drop, npc.x, npc.y);
    }

    player.sendSound('victory');
    world.removeEntity('npcs', npc);
}

async function poison(player, npc) {
    const { world } = player;

    if (!inPen(npc)) {
        player.message("@que@you can't kill the sheep out here");
        await world.sleepTicks(3);
        player.message('@que@you might spread the plague');
        await world.sleepTicks(3);
        return;
    }

    if (player.cache[REMAINS[npc.id].key]) {
        player.message('@que@You have already disposed of this sheep');
        await world.sleepTicks(3);
        player.message('@que@Find a different sheep');
        await world.sleepTicks(3);
        return;
    }

    player.message('@que@you give the sheep poisoned sheep feed');
    await world.sleepTicks(3);
    player.message('the sheep collapses to the floor and dies');
    killSheep(player, npc);
}

async function onUseWithNPC(player, npc, item) {
    if (!SHEEP_IDS.includes(npc.id)) {
        return false;
    }

    if (item.id === CATTLE_PROD_ID) {
        await prod(player, npc);
    } else if (item.id === POISONED_ANIMAL_FEED_ID) {
        await poison(player, npc);
    }

    return true;
}

async function halgrive(player, npc) {
    const { world } = player;
    const stage = player.questStages.sheepHerder || 0;

    switch (stage) {
        case 0: {
            await player.say('how are you?');
            await npc.say("I've been better");

            const menu = await player.ask(
                ["What's wrong?", "That's life for you"],
                false
            );

            if (menu === 1) {
                await player.say("that's life for you");
                break;
            }

            if (menu !== 0) {
                break;
            }

            await player.say("What's wrong?");
            await npc.say(
                'a plague has spread over west ardounge',
                "apparently it's reasonably contained",
                'but four infected sheep have escaped',
                "they're roaming free in and around east ardounge",
                'the whole city could be infected in days',
                'i need someone to gather the sheep',
                'herd them into a safe enclosure',
                'then kill the sheep',
                'their remains will also need to be disposed of safely in a furnace'
            );

            const menu2 = await player.ask(
                ['I can do that for you', "That's not a job for me"],
                false
            );

            if (menu2 === 0) {
                await player.say('i can do that for you');
                await npc.say(
                    'good, the enclosure is to the north of the city',
                    "On farmer Brumty's farm",
                    'the four sheep should still be close to it',
                    'before you go into the enclosure',
                    'make sure you have protective clothing on',
                    "otherwise you'll catch the plague"
                );
                await player.say('where do I get protective clothing?');
                await npc.say(
                    'Doctor Orbon wears it when trying to save the infected',
                    "you'll find him in the chapel",
                    'take this poisoned animal feed',
                    "give it to the four sheep and they'll peacefully fall asleep"
                );
                player.message('@que@The councillor gives you some sheep poison');
                await world.sleepTicks(3);
                player.inventory.add(POISONED_ANIMAL_FEED_ID, 1);
                player.questStages.sheepHerder = 1;
            } else if (menu2 === 1) {
                await player.say("that's not a job for me");
                await npc.say("fair enough, it's not nice work");
            }
            break;
        }
        case 1:
            await npc.say(
                'please find those four sheep as soon as you can',
                'every second counts'
            );

            if (!player.inventory.has(POISONED_ANIMAL_FEED_ID)) {
                await player.say('Some more sheep poison might be useful');
                player.message(
                    '@que@The councillor gives you some more sheep poison'
                );
                await world.sleepTicks(3);
                player.inventory.add(POISONED_ANIMAL_FEED_ID, 1);
            }
            break;
        case 2: {
            await npc.say('have you managed to dispose of those four sheep?');

            const burnt = Object.values(REMAINS).every(
                ({ key }) => player.cache[key]
            );

            if (burnt) {
                await player.say('yes i have');

                for (const key of ['plague1st', 'plague2nd', 'plague3th', 'plague4th']) {
                    delete player.cache[key];
                }

                for (const { key } of Object.values(REMAINS)) {
                    delete player.cache[key];
                }

                // SheepHerder.handleReward: no experience, 4 quest points
                player.completeQuest('sheepHerder', {
                    questPoints: 4,
                    message: 'well done, you have completed the Plaguesheep quest'
                });
                player.inventory.add(COINS_ID, 3100);
                await npc.say(
                    'here take one hundred coins to cover the price of your protective clothing'
                );
                player.message('@que@halgrive gives you 100 coins');
                await world.sleepTicks(3);
                await npc.say('and another three thousand for your efforts');
                player.message('@que@halgrive gives you another 3000 coins');
                await world.sleepTicks(3);
            } else {
                await player.say('erm not quite');
                await npc.say(
                    "not quite's not good enough",
                    'all four sheep must be captured, slain and their remains burnt'
                );
                await player.say("ok i'll get to it");

                if (!player.inventory.has(POISONED_ANIMAL_FEED_ID)) {
                    await player.say('Some more sheep poison might be useful');
                    player.message('The councillor gives you some more sheep poison');
                    player.inventory.add(POISONED_ANIMAL_FEED_ID, 1);
                }
            }
            break;
        }
        case -1:
            await player.say('hello again halgrive');
            await npc.say('well hello again traveller', 'how are you');
            await player.say('good thanks and yourself?');
            await npc.say(
                "much better now i don't have to worry about those sheep"
            );
            break;
    }
}

async function brumty(player, npc) {
    const stage = player.questStages.sheepHerder || 0;

    if (stage === 2) {
        await player.say('hello');
        await npc.say(
            'hello adventurer',
            "be careful rounding up those sheep",
            "i don't think they've wandered far",
            "but if you touch them you'll become infected as well",
            "there should be a cattle prod in the barn",
            'you can use it to herd up the sheep'
        );
    } else if (stage === -1) {
        await player.say('hello there', "i'm sorry about your sheep");
        await npc.say(
            "that's ok, it had to be done",
            'i just hope none of my other livestock becomes infected'
        );
    }
}

async function onTalkToNPC(player, npc) {
    if (npc.id !== COUNCILLOR_HALGRIVE_ID && npc.id !== FARMER_BRUMTY_ID) {
        return false;
    }

    player.engage(npc);

    if (npc.id === COUNCILLOR_HALGRIVE_ID) {
        await halgrive(player, npc);
    } else {
        await brumty(player, npc);
    }

    player.disengage();
    return true;
}

// the pen gate (443 at 588,540): protective clothing to go in, anyone may leave from x 589
async function onGameObjectCommandOne(player, gameObject) {
    if (gameObject.id !== GATE_ID) {
        return false;
    }

    const { world } = player;

    if (wearingProtectiveClothing(player) || player.x === 589) {
        player.sendSound('opendoor');
        world.setTickTimeout(() => player.sendSound('opendoor'), 5);
        player.message('you open the gate and walk through');
        world.replaceTimed('gameObjects', gameObject, OPEN_GATE_ID, 5);

        if (player.x <= 588) {
            player.teleport(589, 541, false);
        } else {
            player.teleport(588, 540, false);
        }
    } else {
        player.message('@que@this is a restricted area');
        await world.sleepTicks(3);
        player.message('@que@you cannot enter without protective clothing');
        await world.sleepTicks(3);
    }

    return true;
}

async function onUseWithGameObject(player, gameObject, item) {
    if (gameObject.id !== CATTLE_FURNACE_ID) {
        return false;
    }

    const { world } = player;
    const remains = REMAINS_BY_ITEM[item.id];

    if (!remains) {
        player.message('@que@Nothing interesting happens');
        await world.sleepTicks(3);
        return true;
    }

    if (player.questStages.sheepHerder === -1) {
        player.message('@que@You have already completed this quest');
        await world.sleepTicks(3);
        return true;
    }

    if (player.cache[remains.key]) {
        player.message('@que@You need to kill this sheep yourself');
        await world.sleepTicks(3);
        return true;
    }

    player.cache[remains.key] = true;
    player.inventory.remove(remains.id);
    player.message('@que@you put the sheep remains in the furnace');
    await world.sleepTicks(3);
    player.message('@que@the remains burn to dust');
    await world.sleepTicks(3);
    return true;
}

module.exports = {
    onTalkToNPC,
    onUseWithNPC,
    onGameObjectCommandOne,
    onUseWithGameObject,
    // for tests
    moveNpc,
    PEN
};
