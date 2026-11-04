// Ported from Open-RSC authentic/npcs/catherby/ArheinGeneralShop.java (AGPL-3.0)
// Arhein (Catherby docks): trade greeting that opens the general store, and "Is that your ship?" (at Merlin's Crystal
// stage 2 it adds "Do you deliver to the fort just down the coast?": the ship is the way into Keep Le Faye,
// quests/members/merlins-crystal/keep-le-faye.js).
const exchange = require('../../../exchange'); // ARSC Grand Exchange

const ARHEIN_ID = 280;

async function shipBranch(player, npc, option) {
    if (option === 0) {
        await player.say('Do you deliver to the fort just down the coast?');
        await npc.say(
            'Yes I do have orders to deliver there from time to time',
            'I think I may have some bits and pieces for them',
            'when I leave here next actually'
        );

        const next = await player.ask(
            ['Can you drop me off on the way down please', "Aren't you worried about supplying evil knights?"],
            false
        );

        if (next === 0) {
            await player.say('can you drop me off on the way down please');
            await npc.say(
                "I don't think Sir Mordred would like that",
                'He wants as few outsiders visiting as possible',
                "I wouldn't want to lose his buisness" // sic
            );
        } else if (next === 1) {
            await player.say("Aren't you worried about supplying evil knights");
            await npc.say(
                'Hey you gotta take business where you can find it these days',
                "Besides if I didn't supply them, someone else would"
            );
        }
    } else if (option === 1) {
        await player.say('Where do you deliver to?');
        await npc.say('Oh various places up and down the coast', 'Mostly Karamja and Port Sarim');

        const next = await player.ask(
            ["I don't suppose I could get a lift anywhere?", 'Well good luck with your buisness'], // sic
            false
        );

        if (next === 0) {
            await player.say("I don't suppose I could get a lift anywhere?");
            await npc.say("I'm not quite ready to sail yet");
        } else if (next === 1) {
            await player.say('Well good luck with your business');
        }
    } else if (option === 2) {
        await player.say('Are you rich then?');
        await npc.say(
            'Business is going reasonably well',
            "I wouldn't say I was the richest of merchants ever",
            "But I'm doing reasonably well"
        );
    }
}

async function onTalkToNPC(player, npc) {
    if (npc.id !== ARHEIN_ID) {
        return false;
    }

    player.engage(npc);

    await npc.say('Hello would you like to trade');

    const choice = await exchange.ask(player, npc, ['Yes ok', 'No thankyou', 'Is that your ship?'], true);

    if (choice === exchange.CHOSEN) {
        return true; // ARSC Grand Exchange
    }

    if (choice === 0) {
        player.disengage();
        player.openShop('arheins-general');
        return true;
    }

    if (choice === 2) {
        await npc.say(
            'Yes I use it to make deliver my goods up and down the coast', // sic
            'These crates here are all ready for my next trip'
        );

        if (player.questStages.merlinsCrystal === 2) {
            const option = await player.ask(
                ['Do you deliver to the fort just down the coast?', 'Where do you deliver too?', 'Are you rich then?'],
                false
            );
            await shipBranch(player, npc, option);
        } else {
            const option = await player.ask(['Where do you deliver too?', 'Are you rich then?'], false);

            if (option >= 0) {
                await shipBranch(player, npc, option + 1);
            }
        }
    }

    player.disengage();
    return true;
}

module.exports = { onTalkToNPC };
