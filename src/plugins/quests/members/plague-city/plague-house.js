// Ported from Open-RSC Core-Framework authentic/quests/members/PlagueCity.java (Elena, the barrel, the cell gate) and
// authentic/defaults/DoorAction.java (DOOR_INFECTED_CAPTURED_ELENA 123) (AGPL-3.0). https://classic.runescape.wiki/w/Plague_City
//
// The plague house is the mossy windowless building in the south-east of West Ardougne. Its doors (123 at 637,606 and
// 635,612) are guarded by the mourner (445):
//   7   talking him round to "You don't have clearance" -> 8 (west-ardougne.js has the rest of 8-10)
//   any stage with the warrant (775): you sneak in while his back is turned (no stage change)
//   from inside (y 606-611) the door always opens; at 11 and after the quest it opens from outside too
// The stairs down (42 at 637,608) are the generic climbable.js. In the basement the barrel (456 at 639,3440) holds the
// little key (780); the key on the cell gate (457 at 637,3447) opens it (Open from outside only nags). Elena (465,
// 637,3449) is freed -> 11 (Edmond ends the quest, east-ardougne.js). Inside the cell, Open leaves (637,3447).

const ELENA_ID = 465;
const MOURNER_WEST_ARDOUGNE_ID = 445;

const WARRANT_ID = 775;
const LITTLE_KEY_ID = 780;

const PLAGUE_HOUSE_DOOR_ID = 123;
const BARREL_ID = 456;
const CELL_GATE_ID = 457;
const OPEN_GATE_ID = 181;

const CELL_EXIT = { x: 637, y: 3447 };
// Java delayedSpawnObject(..., 2000): the open gate stands for 2 s, about 3 ticks
const GATE_OPEN_TICKS = 3;

function stageOf(player) {
    return player.questStages.plagueCity || 0;
}

function setStage(player, stage) {
    player.questStages.plagueCity = stage;
}

function nearNpc(player, id, range) {
    return player.getNearbyEntitiesByID('npcs', id, range).find((npc) => !npc.locked && !npc.interlocutor);
}

async function elenaDialogue(player, npc) {
    const stage = stageOf(player);

    if (stage >= 11 || stage === -1) {
        player.message('You have already rescued Elena');
        return;
    }

    await player.say('Hi, you\'re free to go', "Your kidnappers don't seem to be about right now");
    await npc.say(
        'Thank you, Being kidnapped was so inconvenient',
        'I was on my way back to East Ardougne with some samples',
        'I want to see if I can diagnose a cure for this plague'
    );
    await player.say('Well you can leave via the manhole cover near the gate');
    await npc.say('If you go and see my father', "I'll make sure he adequately rewards you");
    setStage(player, 11);
}

async function onTalkToNPC(player, npc) {
    if (npc.id !== ELENA_ID) {
        return false;
    }

    player.engage(npc);
    await elenaDialogue(player, npc);
    player.disengage();

    return true;
}

async function noClearance(player, mourner) {
    await mourner.say(
        'Well you\'d need to apply to the head mourner',
        'Or I suppose Bravek the city warder',
        "I wouldn't get your hopes up though"
    );
    setStage(player, 8);
}

async function mournerAtTheDoor(player, mourner, wallObject) {
    await mourner.say("I'd stand away from there", 'That black cross means that house has been touched by the plague');

    if (player.inventory.has(WARRANT_ID)) {
        await player.say('I have a warrant from Bravek to enter here');
        await mourner.say('this is highly irregular', 'Please wait while I speak to the head mourner');
        player.message("You wait until the mourner's back is turned and sneak into the building");
        player.disengage();
        await player.enterDoor(wallObject);
        return;
    }

    if (stageOf(player) !== 7) {
        return;
    }

    const menu = await player.ask(
        ['but I think a kidnap victim is in here', 'I fear not a mere plague', 'thanks for the warning'],
        false
    );

    if (menu === 0) {
        await player.say('But I think a kidnap victim is in here');
        await mourner.say(
            'Sounds unlikely',
            "Even kidnappers wouldn't go in there",
            'even if someone is in there',
            "They're probably dead by now"
        );

        const menu2 = await player.ask(['Good point', 'I want to check anyway'], true);

        if (menu2 === 1) {
            await mourner.say("You don't have clearance to go in there");
            await player.say('How do I get clearance?');
            await noClearance(player, mourner);
        }
    } else if (menu === 1) {
        await player.say('I fear not a mere plague');
        await mourner.say("that's irrelevant", "You don't have clearance to go in there");
        await player.say('How do I get clearance?');
        await noClearance(player, mourner);
    } else if (menu === 2) {
        await player.say('thanks for the warning');
    }
}

async function plagueHouseDoor(player, wallObject) {
    const stage = stageOf(player);

    if (stage === 11 || stage === -1) {
        await player.enterDoor(wallObject);
        return;
    }

    // inside the house the door opens
    if (player.y > 605 && player.y < 612) {
        await player.enterDoor(wallObject);
        return;
    }

    player.message("The door won't open", 'You notice a black cross on the door');

    const mourner = nearNpc(player, MOURNER_WEST_ARDOUGNE_ID, 8);

    if (!mourner) {
        return;
    }

    player.engage(mourner);
    await mournerAtTheDoor(player, mourner, wallObject);
    player.disengage();
}

async function onWallObjectCommandOne(player, wallObject) {
    if (wallObject.id !== PLAGUE_HOUSE_DOOR_ID) {
        return false;
    }

    await plagueHouseDoor(player, wallObject);
    return true;
}

async function searchBarrel(player) {
    const stage = stageOf(player);

    if (stage >= 11 || stage === -1 || player.inventory.has(LITTLE_KEY_ID)) {
        player.message('the barrel is empty');
        return;
    }

    player.message('You find a small key in the barrel');
    player.inventory.add(LITTLE_KEY_ID);
}

async function openCellGate(player, gameObject) {
    const { world } = player;
    const stage = stageOf(player);

    if (stage >= 11 || stage === -1) {
        player.message('you go through the gate');
        await player.enterGate(gameObject, OPEN_GATE_ID);
        return;
    }

    // inside the cell: the gate opens and you step out
    if (player.y >= 3448) {
        world.replaceTimed('gameObjects', gameObject, OPEN_GATE_ID, GATE_OPEN_TICKS);
        player.message('you go through the gate');
        player.teleport(CELL_EXIT.x, CELL_EXIT.y);
        return;
    }

    if (player.inventory.has(LITTLE_KEY_ID)) {
        player.message('The gate is locked', "Why don't you use your key on the gate?");
        return;
    }

    const elena = nearNpc(player, ELENA_ID, 10);

    if (!elena) {
        player.message('Elena is currently busy');
        return;
    }

    player.engage(elena);
    await elena.say('Hey get me out of here please');
    await player.say("I would do but I don't have a key");
    await elena.say('I think there may be one around here somewhere', "I'm sure I saw them stashing it somewhere");

    const menu = await player.ask(['Have you caught the plague?', 'Ok I will look for it'], true);

    if (menu === 0) {
        await elena.say('No, I have none of the symptoms');
        await player.say('Strange I was told this house was plague infected');
        await elena.say('I suppose that was a cover up by the kidnappers');
    }

    player.disengage();
}

async function gameObjectCommand(player, gameObject) {
    if (gameObject.id === BARREL_ID) {
        await searchBarrel(player);
        return true;
    }

    if (gameObject.id === CELL_GATE_ID) {
        await openCellGate(player, gameObject);
        return true;
    }

    return false;
}

async function onGameObjectCommandOne(player, gameObject) {
    return gameObjectCommand(player, gameObject);
}

async function onGameObjectCommandTwo(player, gameObject) {
    return gameObjectCommand(player, gameObject);
}

async function onUseWithGameObject(player, gameObject, item) {
    if (gameObject.id !== CELL_GATE_ID || item.id !== LITTLE_KEY_ID) {
        return false;
    }

    player.message('you go through the gate');
    await player.enterGate(gameObject, OPEN_GATE_ID);
    return true;
}

module.exports = { onTalkToNPC, onWallObjectCommandOne, onGameObjectCommandOne, onGameObjectCommandTwo, onUseWithGameObject };
