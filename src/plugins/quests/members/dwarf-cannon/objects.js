// Ported from Open-RSC Core-Framework authentic/quests/members/DwarfCannon.java (AGPL-3.0): the quest's railings, doors,
// watch tower ladders, goblin cave crates, the broken multicannon 994 in the shed and the dwarf remains.
// (The goblin cave entrance 982 and its mudpile 983 are rows in game-objects/object-tele-points.js.)
//
//   railings 181-186 (search, stage 1): replace one with a Railing 1042; fails 24% of the time (2-3 damage).
//     Cache railone..railsix. The other railings 193 have nothing.
//   door 194 (605,468, the cannon shed): open at stage 4 only. Door 197 at x 278 (the black guard base): stages 5, 6, -1.
//   ladder 981 (616,492) up the watch tower to (616,1435), shut at stage 0; ladder 985 back down to (616,493).
//   crates 986 (empty) and 987 (620,3313): Lollk 695 at stage 3 until saved (cache savedlollk).
//   multicannon 994 (inspect, stage 4 with the tool kit): 40% to see the damage, then a part (pipe, barrel, axle, shaft)
//     fixed 60% of the time for 5 quarter points of crafting each; all four -> cache cannon_complete.
//   dwarf remains 1046 (ground spawn at 617,1435): at stage 2 taking it sets grabed_dwarf_remains (sic); one at a time.

const LOLLK_ID = 695;

const RAILING_ID = 1042;
const DWARF_REMAINS_ID = 1046;
const TOOL_KIT_ID = 1055;

const RAILS = { 181: 'railone', 182: 'railtwo', 183: 'railthree', 184: 'railfour', 185: 'railfive', 186: 'railsix' };
const PLAIN_RAILING_ID = 193;
const SHED_DOOR_ID = 194;
const BASE_DOOR_ID = 197;

const WATCH_TOWER_LADDER_UP_ID = 981;
const WATCH_TOWER_LADDER_DOWN_ID = 985;
const EMPTY_CRATE_ID = 986;
const LOLLK_CRATE_ID = 987;
const MULTICANNON_ID = 994;

const CANNON_PARTS = ['pipe', 'barrel', 'axle', 'shaft'];

// addnpc(..., 60 seconds) as 640 ms ticks
const LOLLK_TICKS = Math.ceil(60000 / 640);

function stageOf(player) {
    return player.questStages.dwarfCannon || 0;
}

// DataConversions.random(0, 100) is inclusive
function random100() {
    return Math.floor(Math.random() * 101);
}

async function mes(player, line) {
    player.message(line);
    await player.world.sleepTicks(3);
}

async function rail(player, wallObject) {
    await mes(player, 'you search the railing');
    await mes(player, 'one railing is broken and needs to be replaced');

    const choice = await player.ask(['try to replace railing', 'leave it be'], true);

    if (choice !== 0) {
        return;
    }

    if (random100() > 75) {
        await mes(player, 'you attempt to replace the missing railing');
        await mes(player, 'but you fail and cut yourself trying');
        player.damage(2 + Math.floor(Math.random() * 2));
    } else {
        await mes(player, 'you attempt to replace the missing railing');
        await mes(player, 'you replace the railing with no problems');
        // sic: the Java neither checks for nor needs a railing in the pack
        player.inventory.remove(RAILING_ID);
        player.cache[RAILS[wallObject.id]] = true;
    }
}

async function onWallObject(player, wallObject) {
    const { id } = wallObject;

    if (id === PLAIN_RAILING_ID) {
        await mes(player, 'you search the railing');
        await mes(player, 'but find nothing of interest');
        return true;
    }

    if (RAILS[id]) {
        // other stages fall through to the Java's empty branch
        if (stageOf(player) === 1) {
            if (player.cache[RAILS[id]] != null) {
                player.message('you have already fixed this railing');
            } else {
                await rail(player, wallObject);
            }
        }

        return true;
    }

    if (id === SHED_DOOR_ID) {
        if (stageOf(player) === 4) {
            await player.enterDoor(wallObject);
        } else {
            player.message('the door is locked');
        }

        return true;
    }

    if (id === BASE_DOOR_ID && wallObject.x === 278) {
        if ([5, 6, -1].includes(stageOf(player))) {
            player.message('you go through the door');
            await player.enterDoor(wallObject);
        } else {
            player.message('the door is locked');
        }

        return true;
    }

    return false;
}

async function rescueLollk(player, crate) {
    await mes(player, 'you search the crate');
    await mes(player, 'inside you see a dwarf child tied up');
    await mes(player, 'you untie the child');

    const { world } = player;
    const lollk = world.spawnTimedNPC({ id: LOLLK_ID, x: 619, y: 3314, ticks: LOLLK_TICKS });
    // npc.say needs someone to talk to
    lollk.interlocutor = player;

    await lollk.say("thank the heavens, you saved me", "i thought i'd be goblin lunch for sure");
    await player.say('are you ok?');
    await lollk.say("i think so, i'd better run of home");
    await player.say("that's right , you get going, i'll catch up");
    await lollk.say('thanks again brave adventurer');
    await mes(player, 'the dwarf child runs off into the caverns');
    player.cache.savedlollk = true;
    world.removeEntity('npcs', lollk);
}

async function fixPart(player, part) {
    if (player.cache[part] != null) {
        player.message("you've already fixed this part of the cannon");
        return;
    }

    await mes(player, `you use your tool kit and attempt to fix the ${part}`);
    player.sendBubble(TOOL_KIT_ID);

    if (random100() > 60) {
        await mes(player, "it's too hard, you fail to fix it");
        await mes(player, 'maybe you should try again');
    } else {
        await mes(player, 'after some tinkering you manage to fix it');
        player.cache[part] = true;
        player.addExperience('crafting', 5);
    }
}

async function inspectCannon(player) {
    if (player.cache.cannon_complete != null) {
        player.message("It's a strange dwarf contraption");
        return;
    }

    player.message('you inspect the multi cannon');

    if (CANNON_PARTS.every((part) => player.cache[part] != null)) {
        player.message('the cannon seems to be in complete working order');
        await mes(player, 'lawgof will be pleased');
        player.cache.cannon_complete = true;

        for (const part of CANNON_PARTS) {
            delete player.cache[part];
        }

        return;
    }

    if (random100() > 60) {
        player.message("you try, but can't quite find the problem");
        await mes(player, 'maybe you should inspect it again');
        return;
    }

    player.message('you see that there are some damaged components');
    await mes(player, 'a pipe, a gun barrel, an axle and a shaft seem to be damaged');
    await mes(player, 'which part of the cannon will you attempt to fix?');

    const choice = await player.ask(['Pipe', 'Barrel', 'Axle', 'Shaft', 'none'], true);

    if (choice >= 0 && choice < CANNON_PARTS.length) {
        await fixPart(player, CANNON_PARTS[choice]);
    }
}

async function onGameObjectCommandOne(player, gameObject) {
    switch (gameObject.id) {
        case WATCH_TOWER_LADDER_UP_ID:
            player.message('you climb up the ladder');

            if (stageOf(player) === 0) {
                player.message('but the trap door will not open');
                return true;
            }

            player.teleport(616, 1435);
            return true;
        case WATCH_TOWER_LADDER_DOWN_ID:
            player.message('you climb down the ladder');
            player.teleport(616, 493);
            return true;
        case EMPTY_CRATE_ID:
            await mes(player, 'you search the crate');
            await mes(player, "but it's empty");
            return true;
        case LOLLK_CRATE_ID:
            // only at the quest stage and before being rescued
            if (stageOf(player) === 3 && player.cache.savedlollk == null) {
                await rescueLollk(player, gameObject);
            } else {
                await mes(player, 'you search the crate');
                await mes(player, "but it's empty");
            }

            return true;
        case MULTICANNON_ID:
            await inspectCannon(player);
            return true;
    }

    return false;
}

async function onGroundItemTake(player, groundItem) {
    if (groundItem.id !== DWARF_REMAINS_ID) {
        return false;
    }

    if (player.inventory.has(DWARF_REMAINS_ID)) {
        player.message("carrying one 'dwarfs remains' is bad enough");
        return true;
    }

    if (stageOf(player) === 2 && player.cache.grabed_dwarf_remains == null) {
        player.cache.grabed_dwarf_remains = true;
    }

    player.world.removeEntity('groundItems', groundItem);
    player.inventory.add(DWARF_REMAINS_ID, 1);
    player.sendSound('takeobject');
    return true;
}

async function onWallObjectCommandOne(player, wallObject) {
    return onWallObject(player, wallObject);
}

async function onWallObjectCommandTwo(player, wallObject) {
    return onWallObject(player, wallObject);
}

module.exports = {
    onWallObjectCommandOne,
    onWallObjectCommandTwo,
    onGameObjectCommandOne,
    onGroundItemTake
};
