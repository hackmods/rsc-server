// ARSC lumbridge special offers (installed by
// services/rsc-server/patches/lumbridge-special-offers.js)
// https://classic.runescape.wiki/w/Shopkeeper_(Lumbridge)

const items = require('@2003scape/rsc-data/config/items');

const SHOPKEEPER_IDS = new Set([55, 83]);
const COINS = 10;

// id: item id, price: exact price in coins, label: menu text
const OFFERS = [
    { id: 28, price: 1, label: 'Iron dagger - 1 coin' },
    {
        id: 575,
        price: 1000000,
        label: 'Christmas cracker - 1,000,000 coins'
    }
];

async function offerMenu(player, npc) {
    for (;;) {
        const choice = await player.ask(
            OFFERS.map((offer) => offer.label).concat(['No thanks'])
        );

        if (choice >= OFFERS.length) {
            return;
        }

        const offer = OFFERS[choice];

        if (!player.inventory.has(COINS, offer.price)) {
            await npc.say("Sorry, you can't afford that");
            continue;
        }

        if (player.inventory.isFull()) {
            await npc.say("You don't have room to carry that");
            continue;
        }

        player.inventory.remove(COINS, offer.price);
        player.inventory.add(offer.id);
        player.sendSound('coins');
        const name = items[offer.id].name.toLowerCase();
        player.message('You buy ' + (/^[aeiou]/.test(name) ? 'an ' : 'a ') + name);
    }
}

async function onTalkToNPC(player, npc) {
    if (!SHOPKEEPER_IDS.has(npc.id)) {
        return false;
    }

    player.engage(npc);

    await npc.say('Can I help you at all?');

    const choice = await player.ask(
        [
            'Yes please. What are you selling?',
            'Do you have any special offers?',
            'No thanks'
        ],
        true
    );

    if (choice === 0) {
        await npc.say('Take a look');
        player.disengage();
        player.openShop('lumbridge-general');
        return true;
    }

    if (choice === 1) {
        await npc.say('Certainly! Take your pick');
        await offerMenu(player, npc);
        player.disengage();
        return true;
    }

    player.disengage();
    return true;
}

module.exports = { onTalkToNPC };
