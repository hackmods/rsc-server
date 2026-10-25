// Peter Panelist (src/peter-panelist.js moves him): one prize per player per hiding place.
// 1 in 5 a Christmas cracker, otherwise 1 to 100,000 coins.

const peter = require('../../peter-panelist');

const GREETINGS = [
    ['Ah, a contestant! You found the panelist!', 'Few ever do'],
    ['Order, order! The panel recognises a challenger', 'You are very good at looking'],
    ['Well well well... you actually found me', "Everyone says I'm just a story"],
    ['Shh! Not so loud', 'The other panelists will want a cut']
];

const REPEAT = [
    ['Ha! The panel has already ruled on you here', 'Find me when I turn up somewhere else'],
    ['One prize per sitting, friend', "I'll be gone in a minute or two anyway"]
];

const FAREWELLS = [
    'Tell no one where you found me. Or tell everyone, I do love an audience',
    'Now if you will excuse me, the panel is adjourned... somewhere else',
    "Don't blink, I'm about to hop"
];

function pick(list, random = Math.random) {
    return list[Math.floor(random() * list.length)];
}

async function onTalkToNPC(player, npc) {
    if (!peter.isPeter(npc)) {
        return false;
    }

    player.engage(npc);

    if (npc.rewarded.has(player.id)) {
        await npc.say(...pick(REPEAT));
        player.disengage();
        return true;
    }

    await npc.say(...pick(GREETINGS));

    const reward = peter.rollReward();

    npc.rewarded.add(player.id);

    if (reward.kind === 'cracker') {
        player.inventory.add(peter.CHRISTMAS_CRACKER_ID, 1);
        player.message('Peter Panelist hands you a Christmas cracker');
        await npc.say(
            'The panel awards you a cracker!',
            'Pull it with a friend: one of you wins the party hat'
        );
    } else {
        player.inventory.add(peter.COINS_ID, reward.amount);
        player.message(`Peter Panelist hands you ${reward.amount} coins`);

        if (reward.amount >= 100000) {
            await npc.say('UNANIMOUS! The jackpot, the whole 100,000!');
        } else if (reward.amount >= 10000) {
            await npc.say('Order, order! The panel awards you a small fortune');
        } else if (reward.amount >= 1000) {
            await npc.say('The panel is feeling generous today');
        } else {
            await npc.say('A modest prize from a modest panel');
        }
    }

    await npc.say(pick(FAREWELLS));
    player.disengage();
    return true;
}

module.exports = { onTalkToNPC };
