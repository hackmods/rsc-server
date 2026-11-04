// Ported from Open-RSC Core-Framework authentic/npcs/ardougne/east/DoctorOrbon.java (AGPL-3.0)
// Doctor Orbon (435) in the East Ardougne chapel sells the protective suit for Sheep Herder: 100 coins at stage 1 (moves
// the quest to stage 2), again at stage 2 if it is not carried. The hits cape branch is Open-RSC custom (WANT_CUSTOM_SPRITES)
// and is not ported.

const DOCTOR_ORBON_ID = 435;

const COINS_ID = 10;
const PROTECTIVE_JACKET_ID = 760;
const PROTECTIVE_TROUSERS_ID = 761;

// pays 100 coins for the suit; false when the player is short
async function buySuit(player, npc) {
    const { world } = player;

    if (player.inventory.count(COINS_ID) < 100) {
        await player.say("oops, I don't have enough money");
        await npc.say(
            "that's ok, but don't go near those sheep",
            "if you can find the money i'll be waiting here"
        );
        return false;
    }

    player.inventory.remove(COINS_ID, 100);
    player.message('@que@you give doctor orbon 100 coins');
    await world.sleepTicks(3);
    player.message('@que@doctor orbon gives you a protective suit');
    await world.sleepTicks(3);
    player.inventory.add(PROTECTIVE_TROUSERS_ID, 1);
    player.inventory.add(PROTECTIVE_JACKET_ID, 1);
    await npc.say('these will keep you safe from the plague');
    return true;
}

async function talk(player, npc) {
    const stage = player.questStages.sheepHerder || 0;

    if (stage === -1) {
        await npc.say(
            'well hello again',
            'i was so relieved when i heard you disposed of the plagued sheep',
            'Now the town is safe'
        );
        return;
    }

    if (stage === 2) {
        await player.say('hello again');
        await npc.say('have you managed to get rid of those sheep?');
        await player.say('not yet');
        await npc.say(
            'you must hurry',
            'they could have the whole town infected in days'
        );

        if (
            !player.inventory.has(PROTECTIVE_TROUSERS_ID) ||
            !player.inventory.has(PROTECTIVE_JACKET_ID)
        ) {
            await npc.say(
                "I see you don't have your protective clothing with you",
                'Would you like to buy some more?',
                'Same price as before'
            );

            const more = await player.ask(
                ["No i don't need any more", "Ok i'll take it"],
                false
            );

            if (more === 0) {
                await player.say("No I don't need any more");
            } else if (more === 1) {
                await player.say("ok i'll take it");
                await buySuit(player, npc);
            }
        }

        return;
    }

    if (stage === 1) {
        await player.say(
            'hi doctor',
            'I need to aquire some protective clothing',
            'so i can recapture some escaped sheep who have the plague'
        );
        await npc.say(
            "I'm afraid i only have one suit",
            'Which i made to keep myself safe from infected patients',
            'I could sell it to you',
            'then i could make myself another',
            "hmmm..i'll need at least 100 gold coins"
        );

        const menu = await player.ask(
            ["Sorry doc, that's too much", "Ok i'll take it"],
            false
        );

        if (menu === 0) {
            await player.say("sorry doc, that's too much");
        } else if (menu === 1) {
            await player.say("ok i'll take it");

            if (await buySuit(player, npc)) {
                player.questStages.sheepHerder = 2;
            }
        }

        return;
    }

    await player.say('hello');
    await npc.say('how do you feel?', 'no heavy flu or the shivers?');
    await player.say("no, i'm fine");
    await npc.say(
        'how about nightmares?',
        'have you had any problems with really scary nightmares?'
    );
    await player.say('no, not since i was young');
    await npc.say(
        'good good',
        'have to be carefull nowadays',
        'the plague spreads faster than a common cold'
    );

    const choice = await player.ask(
        ['The plague? tell me more', "Ok i'll be careful"],
        false
    );

    if (choice === 0) {
        await player.say('the plague? tell me more');
        await npc.say('the virus came from the west and is deadly');
        await player.say('what are the symtoms?');
        await npc.say(
            'watch out for abnormal nightmares and strong flu symtoms',
            'when you find a thick black liquid dripping from your nose and eyes',
            'then no one can save you'
        );
    } else if (choice === 1) {
        await player.say("ok I'll be careful");
        await npc.say('you do that traveller');
    }
}

async function onTalkToNPC(player, npc) {
    if (npc.id !== DOCTOR_ORBON_ID) {
        return false;
    }

    player.engage(npc);
    await talk(player, npc);
    player.disengage();
    return true;
}

module.exports = { onTalkToNPC };
