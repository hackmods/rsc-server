// Digging at the Dig Site (quests/members/digsite/shared.js has the stage map), from Open-RSC Core-Framework
// authentic/quests/members/digsite/DigsiteDigAreas.java (AGPL-3.0): a trowel on the soil patches 1065-1067 in the training
// area (no rules), the level 1 sites (gloves and boots worn), the level 3 sites (specimen jar, specimen brush and the level 3
// exam passed; the Talisman of Zaros is among the finds); a rock pick on the soil of the level 2 sites (level 2 exam passed);
// a rock pick on the rocks 1059 chips a cracked rock sample; the spade is refused by the workmen all over the site.
//
// deviation: the Java's training-area branch tests `selectedItem != -1 || selectedItem != -2`, always true, so it would give
// item -1 / -2 for a blank roll; blank rolls give nothing here. The think bubbles and the workman's walk away are left out.

const { SOIL_IDS, ITEM, NOTHING, NOTHING_INTEREST, rng, stageOf, give, withWorkman, findNpc, NPC, inTrainingArea, inLevel1Area, inLevel2Area, inLevel3Area, inDigsite, mes, findMessage } = require('./shared');

const ROCK = 1059;

const TRAINING_AREA_ITEMS = [
    NOTHING,
    NOTHING_INTEREST,
    ITEM.VASE,
    ITEM.BROKEN_ARROW,
    ITEM.COINS,
    ITEM.CRACKED_ROCK_SAMPLE,
    ITEM.CHARCOAL
];

const LEVEL1_ITEMS = [
    NOTHING,
    ITEM.BONES,
    ITEM.OPAL,
    ITEM.OLD_BOOT,
    ITEM.OLD_TOOTH,
    ITEM.BROKEN_GLASS,
    ITEM.COPPER_ORE,
    ITEM.ROTTEN_APPLES,
    ITEM.BUTTONS,
    ITEM.RUSTY_SWORD,
    ITEM.VASE
];

const LEVEL2_ITEMS = [
    NOTHING,
    ITEM.BONES,
    ITEM.PURPLEDYE,
    ITEM.POT,
    ITEM.CLAY,
    ITEM.BROKEN_GLASS_LVL_2,
    ITEM.RATS_TAIL,
    ITEM.BROKEN_STAFF,
    ITEM.DAMAGED_ARMOUR_2,
    ITEM.JUG,
    ITEM.OLD_BOOT
];

const LEVEL3_ITEMS = [
    NOTHING,
    ITEM.BONES,
    ITEM.DAMAGED_ARMOUR_1,
    ITEM.BROKEN_STAFF,
    ITEM.TALISMAN_OF_ZAROS,
    ITEM.BROKEN_ARROW,
    ITEM.BRONZE_SPEAR,
    ITEM.PIE_DISH,
    ITEM.BUTTONS,
    ITEM.OLD_TOOTH,
    ITEM.COINS,
    ITEM.NEEDLE,
    ITEM.CLAY,
    ITEM.IRON_THROWING_KNIFE,
    ITEM.MEDIUM_BLACK_HELMET,
    ITEM.CERAMIC_REMAINS,
    ITEM.BELT_BUCKLE,
    ITEM.OLD_BOOT,
    ITEM.PURPLEDYE
];

const GLOVES = [
    ITEM.LEATHER_GLOVES,
    ITEM.ICE_GLOVES,
    ITEM.KLANKS_GAUNTLETS,
    ITEM.STEEL_GAUNTLETS,
    ITEM.GAUNTLETS_OF_CHAOS,
    ITEM.GAUNTLETS_OF_COOKING,
    ITEM.GAUNTLETS_OF_GOLDSMITHING
];

function pick(table) {
    return table[rng.int(0, table.length - 1)];
}

// the find: its message, then the item (blank rolls give nothing). `amount` for the level 3 coins
function receive(player, item, level3) {
    const message = findMessage(item, level3);

    if (message) {
        player.message(message);
    }

    if (item === NOTHING || item === NOTHING_INTEREST) {
        return;
    }

    if (item === ITEM.COINS && level3) {
        give(player, ITEM.COINS, rng.int(0, 1) === 1 ? 5 : 10);
    } else {
        give(player, item, 1);
    }
}

function tooTired(player) {
    if (typeof player.isTired === 'function' && player.isTired()) {
        player.message('You are too tired to do any more digging');
        return true;
    }

    return false;
}

// the "Oi!" workman, with the lines in order; `lines` entries are [speaker, ...text], speaker 'w' or 'p'
async function scold(player, lines) {
    await withWorkman(player, async (workman) => {
        for (const [who, ...text] of lines) {
            await (who === 'w' ? workman : player).say(...text);
        }
    });
}

async function trowelOnSoil(player) {
    if (inTrainingArea(player)) {
        player.addExperience('mining', 50);
        await mes(player, 'You dig with the trowel...');
        receive(player, pick(TRAINING_AREA_ITEMS), false);
    }

    if (inLevel1Area(player)) {
        if (!GLOVES.some((id) => player.inventory.isEquipped(id))) {
            await scold(player, [
                ['w', 'Hey, where are your gloves ?'],
                ['p', "Err...I haven't got any"],
                ['w', 'Well get some and put them on first!']
            ]);

            return;
        }

        if (!player.inventory.isEquipped(ITEM.BOOTS)) {
            await scold(player, [['w', 'Oi, no boots!', 'No boots no digging!']]);

            return;
        }

        if (tooTired(player)) {
            return;
        }

        player.addExperience('mining', 60);
        await mes(player, 'You dig through the earth');
        receive(player, pick(LEVEL1_ITEMS), false);
    }

    if (inLevel2Area(player)) {
        await scold(player, [['w', 'Sorry, you must use a rockpick', 'To dig in a level 2 site...']]);
    }

    if (inLevel3Area(player)) {
        if (!player.inventory.has(ITEM.SPECIMEN_JAR)) {
            await scold(player, [
                ['w', "Ahem! I don't see your sample jar", 'You must carry one to be able to dig here...'],
                ['p', 'Oh, okay']
            ]);

            return;
        }

        if (!player.inventory.has(ITEM.SPECIMEN_BRUSH)) {
            await scold(player, [
                [
                    'w',
                    'Wait just a minute!',
                    "I can't let you dig here",
                    'Unless you have a specimen brush with you',
                    'Rules is rules!'
                ]
            ]);

            return;
        }

        if (stageOf(player) < 5) {
            await scold(player, [['w', "Sorry, you haven't passed level 3 earth sciences exam", "I can't let you dig here"]]);

            return;
        }

        player.addExperience('mining', 80);
        await mes(player, 'You dig through the earth');
        receive(player, pick(LEVEL3_ITEMS), true);
    }
}

async function rockPickOnSoil(player) {
    if (!inLevel2Area(player)) {
        await scold(player, [['w', 'No no, rockpicks should only be used', 'To dig in a level 2 site...']]);

        return;
    }

    if (stageOf(player) < 4) {
        await scold(player, [['w', "Sorry, you haven't passed level 2 earth sciences exam", "I can't let you dig here"]]);

        return;
    }

    if (tooTired(player)) {
        return;
    }

    player.addExperience('mining', 70);
    await mes(player, 'You dig through the earth');
    receive(player, pick(LEVEL2_ITEMS), false);
}

// doSpade: only when a workman is within 15 tiles (ifnearvisnpc); `onSoil` for the use on a patch
async function spade(player, onSoil) {
    if (!findNpc(player, NPC.WORKMAN, 15)) {
        return;
    }

    if (onSoil) {
        await scold(player, [
            ['w', 'Oi! dont use that spade!', 'What are you trying to do, destroy everything of value ?']
        ]);
    } else {
        await scold(player, [
            ['w', 'Oi! what do you think you are doing ?', "Don't you realize there are fragile specimens around here ?"]
        ]);
    }
}

async function onUseWithGameObject(player, gameObject, item) {
    if (SOIL_IDS.includes(gameObject.id)) {
        switch (item.id) {
            case ITEM.TROWEL:
                await trowelOnSoil(player);
                break;
            case ITEM.SPADE:
                await spade(player, true);
                break;
            case ITEM.ROCK_PICK:
                await rockPickOnSoil(player);
                break;
            case ITEM.PANNING_TRAY:
                await player.say("No I'd better not - it may damage the tray...");
                break;
            default:
                player.message('Nothing interesting happens');
        }

        return true;
    }

    if (gameObject.id === ROCK && item.id === ITEM.ROCK_PICK) {
        player.message('You chip at the rock with the rockpick');
        player.message('You take the pieces of cracked rock');
        give(player, ITEM.CRACKED_ROCK_SAMPLE, 1);

        return true;
    }

    return false;
}

// the spade's "Dig" anywhere on the site
async function onInventoryCommand(player, item) {
    if (item.id !== ITEM.SPADE || !inDigsite(player)) {
        return false;
    }

    await spade(player, false);

    return true;
}

module.exports = { onUseWithGameObject, onInventoryCommand };
