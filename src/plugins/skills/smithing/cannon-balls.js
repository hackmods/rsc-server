// Ported from Open-RSC Core-Framework authentic/skills/smithing/Smelting.java (AGPL-3.0): cannon balls
// https://classic.runescape.wiki/w/Multi_cannon_ball
//
// A steel bar 171 used on a furnace 118 (members world) with the cannon ammo mould 1057 carried makes one multi cannon
// ball 1041: smithing 30 and Dwarf Cannon complete, 100 quarter points (25 xp) of smithing with fatigue. Authentic
// settings (default.conf): no batching, and stop_skilling_fatigued 1, so a fatigued player still uses the bar but the
// ball falls to the floor without experience. Without the mould the bar is only heated.

const FURNACE_ID = 118;
const STEEL_BAR_ID = 171;
const MULTI_CANNON_BALL_ID = 1041;
const CANNON_AMMO_MOULD_ID = 1057;

async function makeCannonBall(player) {
    const { world } = player;

    if (player.skills.smithing.current < 30) {
        player.message('You need at least level 30 smithing to make cannon balls');
        return;
    }

    if (player.questStages.dwarfCannon !== -1) {
        player.message('You need to complete the dwarf cannon quest');
        return;
    }

    if (!player.inventory.has(STEEL_BAR_ID)) {
        player.message('You have no steel bars left');
        return;
    }

    player.sendBubble(MULTI_CANNON_BALL_ID);
    player.message('you heat the steel bar into a liquid state');
    await world.sleepTicks(2);
    player.message('and pour it into your cannon ball mould');
    await world.sleepTicks(2);
    player.message('you then leave it to cool for a short while');
    await world.sleepTicks(2);

    player.inventory.remove(STEEL_BAR_ID);

    // fatigued: you still make the cannon ball, it just falls to the floor
    if (player.isTired()) {
        player.message('you are too tired to lift the ammo');
        world.addPlayerDrop(player, MULTI_CANNON_BALL_ID, player.x, player.y);
        return;
    }

    player.addExperience('smithing', 100);
    player.inventory.add(MULTI_CANNON_BALL_ID);
    player.message("it's very heavy");
}

async function onUseWithGameObject(player, gameObject, item) {
    if (gameObject.id !== FURNACE_ID || item.id !== STEEL_BAR_ID || !player.world.members) {
        return false;
    }

    if (player.inventory.has(CANNON_AMMO_MOULD_ID)) {
        await makeCannonBall(player);
    } else {
        player.message('you heat the steel bar');
    }

    return true;
}

module.exports = { onUseWithGameObject };
