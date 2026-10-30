// https://classic.runescape.wiki/w/Transcript:Thessalia
// ARSC: reclaim lost Bunny ears / Scythe (Classic 31 Oct 2003 update).

const { HOLIDAY_UNIQUES, ownsItem } = require('../../../holiday-drops');

const THESSALIA_ID = 59;

async function onTalkToNPC(player, npc) {
    if (npc.id !== THESSALIA_ID) {
        return false;
    }

    player.engage(npc);

    await player.say('Hello');
    await npc.say('Do you want to buy any fine clothes?');

    const granted = (player.cache && player.cache.holidayUniques) || {};
    const missing = Object.keys(HOLIDAY_UNIQUES)
        .map(Number)
        .filter((id) => granted[id] && !ownsItem(player, id));

    const options = ['What have you got?', 'No, thank you'];
    if (missing.length) {
        options.splice(1, 0, 'I lost a holiday gift');
    }

    const choice = await player.ask(options, true);

    if (choice === 0) {
        player.disengage();
        player.openShop('thessalias-fine-clothes');
        return true;
    }

    if (missing.length && choice === 1) {
        await npc.say(
            'Lucky for you I found this',
            'Try not to lose it again'
        );
        // Prefer scythe then bunny if both missing; grant one per talk
        const grantId = missing.includes(1289) ? 1289 : missing[0];
        if (player.inventory.isFull()) {
            player.message('You do not have enough room to hold it');
        } else {
            player.inventory.add(grantId);
            if (!player.cache.holidayUniques) player.cache.holidayUniques = {};
            player.cache.holidayUniques[grantId] = Date.now();
            player.message(
                grantId === 1289
                    ? 'Thessalia gives you a scythe'
                    : 'Thessalia gives you a pair of bunny ears'
            );
        }
        player.disengage();
        return true;
    }

    player.disengage();
    return true;
}

module.exports = { onTalkToNPC };
