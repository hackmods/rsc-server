// Ported from Open-RSC Core-Framework authentic/itemactions/Cactus.java and Formulae.cutCacti (AGPL-3.0): use a knife
// on a desert cactus (35) to squeeze water into a water skin that is not full. The first non-full skin found, in the
// order mostly full (1082), mostly empty (1083), mouthful left (1084), empty (1085), goes up one step (mostly full ->
// full 1016). 24 in 101 tries fail ("You make a mistake", +4 woodcutting experience, the skin is kept); a success gives
// +100 woodcutting experience and leaves a dried cactus (1028) for 50 ticks (30 seconds).
// The Java's DesertHeatEvent, which drinks from the skins in the desert, only runs with WANT_FIXED_BROKEN_MECHANICS
// (Player.desertHeatInit): authentic RSC never drained them, so it is not ported.

const CACTUS_ID = 35;
const DRIED_CACTUS_ID = 1028;
const KNIFE_ID = 13;

const FULL_WATER_SKIN_ID = 1016;
const WATER_SKIN_MOSTLY_FULL_ID = 1082;
const WATER_SKIN_MOSTLY_EMPTY_ID = 1083;
const WATER_SKIN_MOUTHFUL_LEFT_ID = 1084;
const EMPTY_WATER_SKIN_ID = 1085;

// the order the Java tries the skins in
const SKINS = [WATER_SKIN_MOSTLY_FULL_ID, WATER_SKIN_MOSTLY_EMPTY_ID, WATER_SKIN_MOUTHFUL_LEFT_ID, EMPTY_WATER_SKIN_ID];

const REGROW_TICKS = 50; // GAME_TICK * 50
const SUCCESS_EXPERIENCE = 100;
const FAIL_EXPERIENCE = 4;

// Formulae.cutCacti: random(0, 100) > 75 is a failure
const cutFails = () => Math.floor(Math.random() * 101) > 75;

// one step fuller; each add is written out so scripts/audit/item-sources.js reads it as a source
function fillSkin(player, skin) {
    if (skin === WATER_SKIN_MOSTLY_FULL_ID) {
        player.inventory.add(FULL_WATER_SKIN_ID);
    } else if (skin === WATER_SKIN_MOSTLY_EMPTY_ID) {
        player.inventory.add(WATER_SKIN_MOSTLY_FULL_ID);
    } else if (skin === WATER_SKIN_MOUTHFUL_LEFT_ID) {
        player.inventory.add(WATER_SKIN_MOSTLY_EMPTY_ID);
    } else if (skin === EMPTY_WATER_SKIN_ID) {
        player.inventory.add(WATER_SKIN_MOUTHFUL_LEFT_ID);
    }
}

async function onUseWithGameObject(player, gameObject, item) {
    if (gameObject.id !== CACTUS_ID || item.id !== KNIFE_ID) {
        return false;
    }

    const { world } = player;

    player.message('You use your woodcutting skill to extract some water from the cactus.');
    player.sendBubble(KNIFE_ID);
    await world.sleepTicks(2);

    const skin = SKINS.find((id) => player.inventory.has(id));

    if (skin === undefined) {
        player.message('You need to have a non-full waterskin to contain the fluid.');
        return true;
    }

    if (cutFails()) {
        player.message('You make a mistake and fail to fill your waterskin.');
        player.addExperience('woodcutting', FAIL_EXPERIENCE);
        return true;
    }

    // someone else may have drained this cactus while we waited
    if (world.gameObjects.getAtPoint(gameObject.x, gameObject.y)[0] !== gameObject) {
        return true;
    }

    player.inventory.remove(skin);
    player.message('You collect some precious water in your waterskin.');
    fillSkin(player, skin);
    world.replaceTimed('gameObjects', gameObject, DRIED_CACTUS_ID, REGROW_TICKS);
    player.addExperience('woodcutting', SUCCESS_EXPERIENCE);

    return true;
}

module.exports = { onUseWithGameObject };
