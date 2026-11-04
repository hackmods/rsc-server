// Ported from Open-RSC Core-Framework authentic/npcs/yanille/BartenderDragonInn.java (AGPL-3.0)
// The Dragon Inn bartender in Yanille: dragon bitter (829, 2 coins) and Greenmans ale (830, 10 coins). The barcrawl
// stop at this bar lives in the Java's AlfredGrimhandBarCrawl.java and comes with the barcrawl miniquest port.

const BARTENDER_ID = 529;
const COINS_ID = 10;
const DRAGON_BITTER_ID = 829;
const GREENMANS_ALE_ID = 830;

async function buy(player, price, give) {
    if (player.inventory.has(COINS_ID, price)) {
        give();
        player.inventory.remove(COINS_ID, price);
    } else {
        await player.say("Oh dear. I don't seem to have enough money");
    }
}

async function onTalkToNPC(player, npc) {
    if (npc.id !== BARTENDER_ID) {
        return false;
    }

    player.engage(npc);

    await npc.say('What can I get you?');
    await player.say("What's on the menu?");
    await npc.say('Dragon bitter and Greenmans ale');

    const choice = await player.ask(
        ["I'll give it a miss I think", "I'll try the dragon bitter", 'Can I have some greenmans ale?'],
        true
    );

    if (choice === 0) {
        await npc.say("Come back when you're a little thirstier");
    } else if (choice === 1) {
        await npc.say("Ok, that'll be two coins");
        await buy(player, 2, () => {
            player.message('You buy a pint of dragon bitter');
            player.inventory.add(DRAGON_BITTER_ID);
        });
    } else if (choice === 2) {
        await npc.say("Ok, that'll be ten coins");
        await buy(player, 10, () => {
            player.message('You buy a pint of ale');
            player.inventory.add(GREENMANS_ALE_ID);
        });
    }

    player.disengage();
    return true;
}

module.exports = { onTalkToNPC };
