// The explosive compound of the Dig Site (quests/members/digsite/shared.js has the stage map), from Open-RSC Core-Framework
// authentic/skills/herblaw/Herblaw.java onUseInv "Explosive compound (Digsite quest)" (AGPL-3.0): nitroglycerin and
// ammonium nitrate make mixed chemicals (herblaw 20 xp), those and ground charcoal the even fouler mixture (25 xp), that and
// an arcenia root the explosive compound (30 xp). Each needs Herblaw 10 and the Druidic Ritual done.

const { ITEM } = require('./shared');

// [a, b, product, experience, messages]
const MIXES = [
    [
        ITEM.NITROGLYCERIN,
        ITEM.AMMONIUM_NITRATE,
        ITEM.MIXED_CHEMICALS_1,
        20,
        ['You mix the nitrate powder into the liquid', 'It has produced a foul mixture']
    ],
    [
        ITEM.GROUND_CHARCOAL,
        ITEM.MIXED_CHEMICALS_1,
        ITEM.MIXED_CHEMICALS_2,
        25,
        ['You mix the charcoal into the liquid', 'It has produced an even fouler mixture']
    ],
    [
        ITEM.ARCENIA_ROOT,
        ITEM.MIXED_CHEMICALS_2,
        ITEM.EXPLOSIVE_COMPOUND,
        30,
        ['You mix the root into the mixture', 'You produce a potentially explosive compound...']
    ]
];

async function onUseWithInventory(player, item, target) {
    const mix = MIXES.find(([a, b]) => (item.id === a && target.id === b) || (item.id === b && target.id === a));

    if (!mix) {
        return false;
    }

    const [a, b, product, experience, messages] = mix;

    if (player.skills.herblaw.current < 10) {
        player.message('You need to have a herblaw level of 10 or over to mix this liquid');
        return true;
    }

    if (player.questStages.druidicRitual !== -1) {
        player.message('You need to complete Druidic ritual quest first');
        return true;
    }

    player.addExperience('herblaw', experience);
    player.message(...messages);
    player.inventory.remove(a);
    player.inventory.remove(b);
    player.inventory.add(product);

    if (product === ITEM.EXPLOSIVE_COMPOUND) {
        await player.say('Excellent this looks just right');
    }

    return true;
}

module.exports = { onUseWithInventory };
