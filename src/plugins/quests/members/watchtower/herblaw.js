// The ogre potion of the Watchtower quest (the stage map is in shared.js), from authentic/skills/herblaw/Herblaw.java
// (onUseInv "Ogre potion (Watchtower quest)" and makeLiquid, AGPL-3.0). skills/herblaw.js makes the potion from the
// rsc-data tables (guam potion + jangerberries -> unfinished ogre potion, + ground bat bones -> ogre potion) without the
// Java's quest gate, so this plugin is registered ahead of it and takes the ground bat bones step and the explosions:
//   - the unfinished potion (1074: jangerberries in a vial of water) with a guam leaf or ground bat bones blows up (8 damage)
//   - the unfinished ogre potion (1052) with ground bat bones needs Herblaw 14, the Druidic Ritual done, and the Watchtower
//     quest at stage 6 or later (before that: "perhaps I shouldn't try and mix these items together"): 100 herblaw xp

const { ITEM, stageOf, give } = require('./shared');

async function explode(player, ingredientId) {
    const name = ingredientId === ITEM.GUAM_LEAF ? 'guam leaf' : 'ground bat bones';

    player.message(`You mix the liquid with the ${name}`);
    player.message('Bang!!!');
    player.damage(8);
    await player.say('Ow!');
    player.message('You mixed this ingredients incorrectly and the mixture exploded!');
    player.inventory.remove(ITEM.UNFINISHED_POTION);
    player.inventory.remove(ingredientId);
    give(player, ITEM.EMPTY_VIAL, 1);
}

async function onUseWithInventory(player, item, target) {
    const pair = (a, b) => (item.id === a && target.id === b) || (item.id === b && target.id === a);

    for (const ingredient of [ITEM.GUAM_LEAF, ITEM.GROUND_BAT_BONES]) {
        if (pair(ITEM.UNFINISHED_POTION, ingredient)) {
            await explode(player, ingredient);
            return true;
        }
    }

    if (!pair(ITEM.UNFINISHED_OGRE_POTION, ITEM.GROUND_BAT_BONES)) {
        return false;
    }

    if (player.skills.herblaw.current < 14) {
        player.message('You need to have a herblaw level of 14 or over to mix this liquid');
        return true;
    }

    if (player.questStages.druidicRitual !== -1) {
        player.message('You need to complete Druidic ritual quest first');
        return true;
    }

    const stage = stageOf(player);

    if (stage >= 0 && stage < 6) {
        await player.say('Hmmm...perhaps I shouldn\'t try and mix these items together', 'It might have unpredictable results...');
        return true;
    }

    if (!player.inventory.has(ITEM.UNFINISHED_OGRE_POTION) || !player.inventory.has(ITEM.GROUND_BAT_BONES)) {
        return true;
    }

    player.message('You mix the ground bat bones into the liquid');
    player.message('You produce a strong potion');
    player.inventory.remove(ITEM.GROUND_BAT_BONES);
    player.inventory.remove(ITEM.UNFINISHED_OGRE_POTION);
    give(player, ITEM.OGRE_POTION, 1);
    player.addExperience('herblaw', 100);

    return true;
}

module.exports = { onUseWithInventory };
