// https://classic.runescape.wiki/w/Christmas_cracker
// A pulled cracker always holds a party hat (six colours) and a prize from the miscellaneous table. rsc-data's
// rolls/cracker.json weights do not fill the 129 values rollItemDrop rolls over (hats sum to 126), so a plain roll gave
// no hat or no prize about 2% of the time; the weights are used as shares here instead.

const CRACKER_ROLLS = require('@2003scape/rsc-data/rolls/cracker');

const CHRISTMAS_CRACKER_ID = 575;

function rollTable(name, random = Math.random) {
    const table = CRACKER_ROLLS[name];
    const total = table.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = random() * total;

    for (const entry of table) {
        roll -= entry.weight;

        if (roll < 0) {
            return entry;
        }
    }

    return table[table.length - 1];
}

// [party hat, prize]
function rollCracker(random = Math.random) {
    return [rollTable('party-hat', random), rollTable('miscellaneous', random)].map((entry) => ({
        id: entry.id,
        amount: entry.amount || 1
    }));
}

async function awardWinner(player, otherPlayer) {
    for (const item of rollCracker()) {
        player.inventory.add(item);
    }

    player.message('You get the prize from the cracker');
    otherPlayer.message('The person you pull the cracker with gets the prize');
}

async function onUseWithPlayer(player, otherPlayer, item) {
    if (item.id !== CHRISTMAS_CRACKER_ID) {
        return false;
    }

    player.inventory.remove(CHRISTMAS_CRACKER_ID);
    player.sendBubble(CHRISTMAS_CRACKER_ID);
    player.message('You pull a christmas cracker');
    otherPlayer.message('You pull a christmas cracker');

    if (Math.random() >= 0.5) {
        await awardWinner(player, otherPlayer);
    } else {
        await awardWinner(otherPlayer, player);
    }

    return true;
}

module.exports = { onUseWithPlayer, rollCracker, rollTable };
