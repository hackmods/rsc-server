// Ported from Open-RSC Core-Framework authentic/npcs/shilo/Kaleb.java (AGPL-3.0)
// Kaleb's hostel in Shilo Village: wine (1 coin), beer (2 coins), a Paramaya Rest ticket (987, 35 coins) or a pack of 5
// (175 coins). The ticket is taken by the ladder up to the dormitory (game-objects/object-tele-points.js). The Java
// tests the pack on menu index 5 of a 5-option menu, so it can never be bought there; it is index 4 here.
// "Very good sir!" is player.getText("KalebVeryGood") in AuthenticMessages_en_UK_male.properties.

const KALEB_ID = 621;
const COINS_ID = 10;
const WINE_ID = 142;
const BEER_ID = 193;
const PARAMAYA_REST_TICKET_ID = 987;

async function sell(player, npc, price, give) {
    await npc.say('Very good sir!');

    if (player.inventory.has(COINS_ID, price)) {
        player.inventory.remove(COINS_ID, price);
        give();
    } else {
        await npc.say("Sorry Bwana, you don't have enough money.");
    }
}

async function onTalkToNPC(player, npc) {
    if (npc.id !== KALEB_ID) {
        return false;
    }

    player.engage(npc);

    await player.say('Hello.');
    await npc.say('Hello Bwana,', 'What can I do for you today?');

    const choice = await player.ask(
        [
            'Can you tell me a bit about this place?',
            'Buy some wine : 1 Gold.',
            'Buy some Beer: 2 Gold.',
            'Buy a nights rest: 35 Gold',
            'Buy a pack of 5 Dorm tickets: 175 Gold'
        ],
        false
    );

    if (choice === 0) {
        await player.say('Can you tell me a bit about this place?');
        await npc.say('Of course Bwana, you look like a traveler!');
        await player.say('Yes I am actually!');
        await npc.say(
            'Well, I am a traveller myself, and I have set up this hostel',
            'for adventurers and travellers who are weary from their journey',
            'There is a dormitory upstairs if you are tired, it costs 35 gold',
            'pieces which covers the costs of laundry and cleaning.'
        );
    } else if (choice === 1) {
        await sell(player, npc, 1, () => {
            player.inventory.add(WINE_ID);
            player.message('You purchase a jug of wine.');
        });
    } else if (choice === 2) {
        await sell(player, npc, 2, () => {
            player.inventory.add(BEER_ID);
            player.message('You purchase a frothy glass of beer.');
        });
    } else if (choice === 3) {
        await sell(player, npc, 35, () => {
            player.inventory.add(PARAMAYA_REST_TICKET_ID);
            player.message('You purchase a ticket to access the dormitory.');
        });
    } else if (choice === 4) {
        await sell(player, npc, 175, () => {
            player.inventory.add(PARAMAYA_REST_TICKET_ID, 5);
            player.message('You purchase 5 tickets to access the dormitory.');
        });
    }

    player.disengage();
    return true;
}

module.exports = { onTalkToNPC };
