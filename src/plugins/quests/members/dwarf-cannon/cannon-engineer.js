// Ported from Open-RSC Core-Framework authentic/quests/members/DwarfCannon.java (AGPL-3.0): the Dwarf Cannon engineer
// (770, Nulodion) at the black guard base south of Ice Mountain, and his shop `nulodions-cannon-parts` (rsc-data
// shops.json: 3 of each cannon part, 7 instruction manuals and 7 ammo moulds; the Java AbstractShop on this class).
//
// Stage 5 he gives Nulodion's notes 1056 and the cannon ammo mould 1057 (-> 6, cache spoken_nulodion); stage 6 he
// replaces either if lost. After the quest he sells the whole cannon for 750 000 coins (one set per player: the four
// parts carried or a cannon set up, cache has_cannon) or opens his shop, and replaces a set-up cannon that is gone from
// the world (cache cannon_stage, cannon_x, cannon_y; items/multi-cannon.js).

const { CANNON_OBJECT_IDS, CANNON_PART_IDS, clearCannonCache } = require('../../../items/multi-cannon');

const CANNON_ENGINEER_ID = 770;

const COINS_ID = 10;
const NULODIONS_NOTES_ID = 1056;
const CANNON_AMMO_MOULD_ID = 1057;
const INSTRUCTION_MANUAL_ID = 1073;

const CANNON_PRICE = 750000;

async function mes(player, line) {
    player.message(line);
    await player.world.sleepTicks(3);
}

async function giveNotesAndMould(player, npc) {
    await player.say('hello there');
    await npc.say('can i help you?');
    await player.say("the Dwarf commander sent me, he's having trouble with his cannon");
    await npc.say('of course, we forgot to send the ammo mould');
    await player.say('it fires a mould?');
    await npc.say(
        "don't be silly, the ammo's made by using a mould",
        'here, take these to him, the instructions explain everthing'
    );
    await player.say("that's great, thanks");
    await npc.say('thank you adventurer, the dwarf black guard will remember this');
    await mes(player, 'the Cannon engineer gives you some notes and a mould');
    player.inventory.add(NULODIONS_NOTES_ID, 1);
    player.inventory.add(CANNON_AMMO_MOULD_ID, 1);
    player.cache.spoken_nulodion = true;
    player.questStages.dwarfCannon = 6;
}

async function replaceLost(player, npc) {
    await player.say('hello again');

    if (!player.inventory.has(NULODIONS_NOTES_ID)) {
        await player.say("i've lost the notes");
        await npc.say('here take these');
        await mes(player, 'the Cannon engineer gives you some more notes');
        player.inventory.add(NULODIONS_NOTES_ID, 1);
    }

    if (!player.inventory.has(CANNON_AMMO_MOULD_ID)) {
        await player.say("i've lost the cannon ball mould");
        await npc.say('deary me, you are trouble', 'here take this one');
        await player.say('the Cannon engineer gives you another mould'); // sic: said, not a message
        player.inventory.add(CANNON_AMMO_MOULD_ID, 1);
    }

    await npc.say('so has the commander figured out how to work the cannon?');
    await player.say("not yet, but i'm sure he will");
    await npc.say("if you can get those items to him it'll help");
}

async function buyCannon(player, npc) {
    await npc.say('ok then, but keep it quiet..');
    await npc.say("this thing's top secret");

    if (CANNON_PART_IDS.some((id) => player.inventory.has(id)) || player.cache.has_cannon !== undefined) {
        await npc.say(
            'wait a moment, our records show you already own some cannon equipment',
            "i'm afraid you can only have one set at a time"
        );
        return;
    }

    if (player.inventory.count(COINS_ID) >= CANNON_PRICE) {
        await mes(player, 'you give the Cannon engineer 750 000 coins');
        player.inventory.remove(COINS_ID, CANNON_PRICE);
        await mes(player, 'he gives you the four parts that make the cannon');

        for (const id of CANNON_PART_IDS) {
            player.inventory.add(id, 1);
        }

        await mes(player, 'a ammo mould and an instruction manual');
        player.inventory.add(CANNON_AMMO_MOULD_ID, 1);
        player.inventory.add(INSTRUCTION_MANUAL_ID, 1);
        await npc.say('there you go, you be carefull with that thing');
        await player.say('will do, take care mate');
        await npc.say('take care adventurer');
    } else {
        await player.say("oops, i don't have enough money");
        await npc.say("sorry, i can't go any lower than that");
    }
}

async function lostCannon(player, npc) {
    const { cache } = player;

    if (cache.cannon_stage !== undefined && cache.cannon_x !== undefined && cache.cannon_y !== undefined) {
        await npc.say("that's unfortunate...but don't worry, i can sort you out");

        const standing = player.world.gameObjects
            .getAtPoint(cache.cannon_x, cache.cannon_y)
            .some((object) => CANNON_OBJECT_IDS.includes(object.id));

        // does not exist or the object there is not a cannon
        if (!standing) {
            await mes(player, 'the dwarf gives you a new cannon');
            await npc.say("keep that quite or i'll be in real trouble");
            await player.say('thanks alot');
            await npc.say('no worries');

            // the parts that were set up: base, stand, barrels, furnace
            const stage = cache.cannon_stage;

            for (const id of CANNON_PART_IDS.slice(0, stage)) {
                player.inventory.add(id, 1);
            }

            clearCannonCache(player);
        } else {
            await npc.say(
                "oh dear, i'm only allowed to replace cannons...",
                '...that were stolen in action',
                "i'm sorry but you'll have to buy a new set"
            );
        }
    } else {
        await npc.say("that's unfortunate...but don't worry, i can sort you out");
        await npc.say(
            "oh dear, i'm only allowed to replace cannons...",
            '...that were stolen in action',
            "i'm sorry but you'll have to buy a new set"
        );
    }
}

async function afterQuest(player, npc) {
    await player.say('hello');
    await npc.say("hello traveller, how's things?");
    await player.say('not bad thanks, yourself?');
    await npc.say("i'm good, just working hard as usual");

    const choice = await player.ask(
        [
            'i was hoping you might sell me a cannon?',
            'well, take care of yourself then',
            'i want to know more about the cannon?',
            "i've lost my cannon"
        ],
        true
    );

    if (choice === 0) {
        await npc.say(
            'hmmm',
            "i shouldn't really, but as you helped us so much",
            'well, i could sort something out',
            "i'll warn you though, they don't come cheap"
        );
        await player.say('how much?');
        await npc.say('for the full set up.. 750 000 coins', 'or i can sell you the seperate parts for 200 000 each');
        await player.say("that's not cheap");

        const cannon = await player.ask(
            [
                "ok, i'll take a cannon please",
                'can i look at the seperate parts please',
                "sorry, that's too much for me",
                'have you any ammo or instructions to sell?'
            ],
            true
        );

        if (cannon === 0) {
            await buyCannon(player, npc);
        } else if (cannon === 1) {
            await npc.say('of course!');
            player.openShop('nulodions-cannon-parts');
        } else if (cannon === 2) {
            await npc.say("fair enough, it's too much for most of us");
        } else if (cannon === 3) {
            await npc.say('yes, of course');
            player.openShop('nulodions-cannon-parts');
        }
    } else if (choice === 2) {
        await npc.say(
            "there's only so much i can tell you adventurer",
            "we've been working on this little beauty for some time now"
        );
        await player.say('is it effective?');
        await npc.say(
            "in short bursts it's very effective, the most destructive weapon to date",
            'the cannon automatically targets monsters close by',
            'you just have to make the ammo and let rip'
        );
    } else if (choice === 3) {
        await lostCannon(player, npc);
    }
}

async function onTalkToNPC(player, npc) {
    if (npc.id !== CANNON_ENGINEER_ID) {
        return false;
    }

    switch (player.questStages.dwarfCannon || 0) {
        case 5:
            await giveNotesAndMould(player, npc);
            break;
        case 6:
            await replaceLost(player, npc);
            break;
        case -1:
            await afterQuest(player, npc);
            break;
    }

    // the Java has no line for the other stages
    return true;
}

module.exports = { onTalkToNPC };
