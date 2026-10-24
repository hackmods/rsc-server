// Ported from Open-RSC authentic/npcs/brimhaven/AlfonseTheWaiter.java (AGPL-3.0)
// Alfonse (The Shrimp and Parrot, Brimhaven): waiter greeting that opens the restaurant's fish shop.
// Skipped: the "Do you sell Gherkins?" option (Phoenix gang branch, sends you to Charlie the cook) and
// the "Alfonse winks" flag. Charlie the cook's Java (CharlieTheCook.java) opens no shop, so he is not ported here.

const ALFONSE_ID = 260;

async function onTalkToNPC(player, npc) {
    if (npc.id !== ALFONSE_ID) {
        return false;
    }

    player.engage(npc);

    await npc.say('Welcome to the shrimp and parrot', 'Would you like to order sir?');

    const choice = await player.ask(['Yes please', 'No thankyou'], true);

    if (choice === 0) {
        player.disengage();
        player.openShop('the-shrimp-and-parrot');
        return true;
    }

    player.disengage();
    return true;
}

module.exports = { onTalkToNPC };
