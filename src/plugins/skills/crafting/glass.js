// Ported from Open-RSC Core-Framework authentic/skills/crafting/Crafting.java
// (glass making and glassblowing) (AGPL-3.0)

const items = require('@2003scape/rsc-data/config/items');
const { glassblowing } = require('@2003scape/rsc-data/skills/crafting');

const FURNACE_IDS = new Set([118, 813]);
const BUCKET_ID = 21;
const PIPE_ID = 621;
const MOLTEN_GLASS_ID = 623;
const SODA_ASH_ID = 624;
const SAND_ID = 625;

// Java's glassblowing menu order: Vial, orb, Beer glass. Level and experience
// are the same as rsc-data's glassblowing table.
const MENU = [465, 611, 620].map((id) => {
    const entry = glassblowing.find((e) => e.id === id);
    return { id, level: entry.level, experience: entry.experience };
});

const LABELS = ['Vial', 'orb', 'Beer glass'];
const PLURALS = ['vials', 'orbs', 'beer glasses'];

async function onUseWithGameObject(player, gameObject, item) {
    if (
        !FURNACE_IDS.has(gameObject.id) ||
        (item.id !== SODA_ASH_ID && item.id !== SAND_ID)
    ) {
        return false;
    }

    if (!player.inventory.has(SODA_ASH_ID)) {
        player.message('@que@You need some soda ash to make glass');
        return true;
    }

    if (!player.inventory.has(SAND_ID)) {
        player.message('@que@You need some sand to make glass');
        return true;
    }

    if (player.isTired()) {
        player.message('You are too tired to craft');
        return true;
    }

    player.sendBubble(item.id);
    player.message(
        '@que@you heat the sand and soda ash in the furnace to make glass'
    );
    player.inventory.remove(SODA_ASH_ID);
    player.inventory.remove(SAND_ID);
    await player.world.sleepTicks(1);
    player.inventory.add(MOLTEN_GLASS_ID);
    player.inventory.add(BUCKET_ID);
    player.addExperience('crafting', 80);

    return true;
}

async function onUseWithInventory(player, item, target) {
    if (
        !(item.id === PIPE_ID && target.id === MOLTEN_GLASS_ID) &&
        !(item.id === MOLTEN_GLASS_ID && target.id === PIPE_ID)
    ) {
        return false;
    }

    player.message('what would you like to make?');

    const choice = await player.ask(LABELS, false);

    if (!(choice >= 0 && choice < MENU.length)) {
        return true;
    }

    const { id, level, experience } = MENU[choice];

    if (player.skills.crafting.current < level) {
        player.message(
            `You need a crafting level of ${level} to make ${PLURALS[choice]}`
        );
        return true;
    }

    if (player.isTired()) {
        player.message('You are too tired to craft');
        return true;
    }

    player.inventory.remove(MOLTEN_GLASS_ID);
    await player.world.sleepTicks(1);
    player.message(`@que@You make a ${items[id].name}`);
    player.inventory.add(id);
    player.addExperience('crafting', experience);

    return true;
}

module.exports = { onUseWithGameObject, onUseWithInventory };
