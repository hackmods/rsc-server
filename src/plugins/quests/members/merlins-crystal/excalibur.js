// Ported from Open-RSC Core-Framework authentic/npcs/taverly/Lady.java and authentic/quests/members/MerlinsCrystal.java
// (AGPL-3.0): Excalibur. Stages: camelot.js.
//   The Lady of the Lake (283, by the lake south of Taverley): from stage 3 (or done) without Excalibur, "I seek the
//   sword Excalibur" sets her test (cache ladyTest): the upstairs room of the Port Sarim jeweller's.
//   The jeweller's door (wall 85 at 277,632, otherwise Grum's: npcs/port-sarim/grum.js): with the test set and stage >= 3 (or done), a beggar (286) asks for bread
//   (138). Giving it turns him into the Lady (284), who hands over Excalibur (606) and clears the test.
//   The jeweller's ladder (295 at 280,634): upstairs the Lady (285) says you are not worthy yet (the wrong way round).

const LADY_OF_THE_LAKE_ID = 283;
const LADY_GROUND_ID = 284;
const LADY_UPSTAIRS_ID = 285;
const BEGGAR_ID = 286;

const JEWELLER_DOOR = { x: 277, y: 632 };
const JEWELLER_LADDER_ID = 295;

const BREAD_ID = 138;
const EXCALIBUR_ID = 606;

// addnpc(..., 74 seconds) and the Lady's removal after 116 ticks, in 640 ms ticks
const SPAWN_TICKS = Math.ceil(74000 / 640);
const LADY_REMOVE_TICKS = 116;

function stageOf(player) {
    return player.questStages.merlinsCrystal || 0;
}

// Java: (stage >= 0 && stage < 3) || !lady_test
function testNotSet(player) {
    const stage = stageOf(player);
    return (stage >= 0 && stage < 3) || !player.cache.ladyTest;
}

function nearby(player, id, range) {
    return player.getNearbyEntitiesByID('npcs', id, range).find((npc) => player.getDistance(npc) <= range);
}

async function ladyOfTheLake(player, npc) {
    await npc.say(player.isMale() ? 'Good day to you sir' : 'Good day to you madam');

    const options = ['Who are you?', 'Good day'];
    const stage = stageOf(player);

    if ((stage >= 3 || stage === -1) && !player.inventory.has(EXCALIBUR_ID)) {
        options.push('I seek the sword Excalibur');
    }

    const option = await player.ask(options, true);

    if (option === 0) {
        await npc.say('I am the lady of the lake');
    } else if (option === 2) {
        await npc.say(
            'Aye, I have that artifact in my possesion', // sic
            'Tis very valuable and not an artifact to be given away lightly',
            'I would want to give it away only to one who is worthy and good'
        );
        await player.say('And how am I meant to prove that');
        await npc.say(
            'I will set a test for you',
            'First I need you to travel to Port Sarim',
            "Then go to the upstairs room of the jeweller's shop there"
        );
        await player.say('Ok that seems easy enough');
        player.cache.ladyTest = true;
    }
}

async function onTalkToNPC(player, npc) {
    if (npc.id !== LADY_OF_THE_LAKE_ID) {
        return false;
    }

    player.engage(npc);
    await ladyOfTheLake(player, npc);
    player.disengage();

    return true;
}

async function beggarAtTheDoor(player, door) {
    const { world } = player;

    let beggar = nearby(player, BEGGAR_ID, 5);

    if (!beggar) {
        beggar = world.spawnTimedNPC({ id: BEGGAR_ID, x: 276, y: 631, ticks: SPAWN_TICKS });
    }

    await world.sleepTicks(1);

    player.engage(beggar);
    await beggar.say('Please sir, me and my family are starving', 'Could you possibly give me a loaf of bread?');

    const opt = await player.ask(['Yes certainly', "No I don't have any bread with me"], true);
    player.disengage();

    if (opt === 0) {
        if (!player.inventory.has(BREAD_ID)) {
            await player.say("Except that I don't have any bread at the moment");
            await beggar.say('Well if you get some you know where to come');
            await player.enterDoor(door);
            world.removeEntity('npcs', beggar);
            return;
        }

        player.message('You give the bread to the beggar');
        await world.sleepTicks(3);
        player.inventory.remove(BREAD_ID);
        await beggar.say('Thankyou very much');

        if (player.cache.ladyTest) {
            player.message('The beggar has turned into the lady of the lake!');

            const lady = world.replaceEntity('npcs', beggar, LADY_GROUND_ID);
            world.setTickTimeout(() => world.removeEntity('npcs', lady), LADY_REMOVE_TICKS);

            await lady.say('Well done you have passed my test', 'Here is Excalibur, guard it well');
            player.inventory.add(EXCALIBUR_ID);
            delete player.cache.ladyTest;
        } else {
            await player.enterDoor(door);
            world.removeEntity('npcs', beggar);
        }
    } else if (opt === 1) {
        await beggar.say('Well if you get some you know where to come');
        await player.enterDoor(door);
        world.removeEntity('npcs', beggar);
    }
}

// the jeweller's door is Grum's (npcs/port-sarim/grum.js opens it); only the Lady's test makes it ours
function beggarWaits(player, wallObject) {
    return wallObject.x === JEWELLER_DOOR.x && wallObject.y === JEWELLER_DOOR.y && !testNotSet(player);
}

async function onWallObjectCommandOne(player, wallObject) {
    if (!beggarWaits(player, wallObject)) {
        return false;
    }

    await beggarAtTheDoor(player, wallObject);
    return true;
}

async function onGameObjectCommandOne(player, gameObject) {
    if (gameObject.id !== JEWELLER_LADDER_ID) {
        return false;
    }

    const { world } = player;

    player.teleport(player.x, player.y + 944);
    player.message('You climb up the ladder');

    if (testNotSet(player)) {
        return true;
    }

    await world.sleepTicks(3);

    let lady = nearby(player, LADY_UPSTAIRS_ID, 5);

    if (!lady) {
        lady = world.spawnTimedNPC({ id: LADY_UPSTAIRS_ID, x: 279, y: 1576, ticks: SPAWN_TICKS });
    }

    await world.sleepTicks(1);

    player.engage(lady);
    await player.say('Hello I am here, can I have Excalibur yet?');
    await lady.say("I don't think you are worthy enough", 'Come back when you are a better person');
    player.disengage();

    return true;
}

module.exports = { onTalkToNPC, onWallObjectCommandOne, onGameObjectCommandOne, beggarWaits };
