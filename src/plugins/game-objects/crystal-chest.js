// Ported from Open-RSC Core-Framework authentic/misc/CrystalChest.java and the key join in
// authentic/itemactions/InvUseOnItem.java (TOOTH_KEY_HALF + LOOP_KEY_HALF) (AGPL-3.0)
//
// The two halves of the key (526 tooth, 527 loop: caskets, NPC drops and this chest) join into a crystal key (525). The
// key opens the crystal chest in Taverley (object 248, 367,497): the key is used up, the chest shows open (247) for a
// moment, and the loot is always an uncut dragonstone plus one roll of the Java table below. CRYSTAL_KEY_GIVES_XP is off
// in the authentic config, so the join gives no crafting experience.
//
// rsc-data rolls/crystal-chest.json is deliberately unread: its weights and rows differ from the Java (5 raw swordfish
// instead of one raw swordfish certificate, other odds), and the Java table is the authentic replay.

const CRYSTAL_CHEST_ID = 248;
const CRYSTAL_CHEST_OPEN_ID = 247;
const CRYSTAL_KEY_ID = 525;
const TOOTH_KEY_HALF_ID = 526;
const LOOP_KEY_HALF_ID = 527;
const UNCUT_DRAGONSTONE_ID = 542;
const COINS_ID = 10;

// changeloc(obj, 1000 ms, ...): two 640 ms ticks
const OPEN_TICKS = 2;

// DataConversions.random(0, 10000) is inclusive: 10001 outcomes. Each row is [upper bound (exclusive), loot]; a roll
// of 8328 or more gives only the dragonstone.
const ROLL_SIZE = 10001;
const TABLE = [
    [26, [[402, 1]]], // rune plate mail legs
    [132, [[127, 1]]], // adamantite square shield
    [407, [[517, 30]]], // iron ore certificates
    [733, [[TOOTH_KEY_HALF_ID, 1], [COINS_ID, 750]]],
    [1084, [[408, 3]]], // runite bars
    [1451, [[LOOP_KEY_HALF_ID, 1], [COINS_ID, 750]]],
    [1874, [[162, 2], [161, 2]]], // rubies, diamonds
    [2529, [[518, 20]]], // coal certificates
    [
        3302,
        [
            [31, 50], // fire
            [32, 50], // water
            [33, 50], // air
            [34, 50], // earth
            [35, 50], // mind
            [36, 50], // body
            [38, 10], // death
            [40, 10], // nature
            [41, 10], // chaos
            [42, 10], // law
            [46, 10] // cosmic
        ]
    ],
    [4359, [[536, 1], [COINS_ID, 1000]]], // raw swordfish certificate
    [8328, [[179, 1], [COINS_ID, 2000]]] // spinach roll
];

// the loot for one roll in 0..10000 (a test passes it), always starting with the uncut dragonstone
function rollLoot(roll = Math.floor(Math.random() * ROLL_SIZE)) {
    const loot = [[UNCUT_DRAGONSTONE_ID, 1]];
    const row = TABLE.find(([bound]) => roll < bound);

    if (row) {
        loot.push(...row[1]);
    }

    return loot;
}

async function onGameObjectCommandOne(player, gameObject) {
    if (gameObject.id !== CRYSTAL_CHEST_ID) {
        return false;
    }

    player.message('the chest is locked');
    return true;
}

async function onUseWithGameObject(player, gameObject, item) {
    if (gameObject.id !== CRYSTAL_CHEST_ID || item.id !== CRYSTAL_KEY_ID) {
        return false;
    }

    if (!player.inventory.has(CRYSTAL_KEY_ID)) {
        return true;
    }

    player.inventory.remove(CRYSTAL_KEY_ID);
    player.message('you unlock the chest with your key');
    player.world.replaceTimed('gameObjects', gameObject, CRYSTAL_CHEST_OPEN_ID, OPEN_TICKS);
    player.message('You find some treasure in the chest');

    // inventory.add hands a non-stackable amount over one at a time, as the Java loop does
    for (const [id, amount] of rollLoot()) {
        player.inventory.add(id, amount);
    }

    return true;
}

async function onUseWithInventory(player, item, target) {
    const ids = [item.id, target.id];

    if (!ids.includes(TOOTH_KEY_HALF_ID) || !ids.includes(LOOP_KEY_HALF_ID)) {
        return false;
    }

    if (!player.inventory.has(TOOTH_KEY_HALF_ID) || !player.inventory.has(LOOP_KEY_HALF_ID)) {
        return true;
    }

    player.inventory.remove(TOOTH_KEY_HALF_ID);
    player.inventory.remove(LOOP_KEY_HALF_ID);
    player.message('You join the two halves of the key together');
    player.inventory.add(CRYSTAL_KEY_ID);

    return true;
}

module.exports = {
    onGameObjectCommandOne,
    onUseWithGameObject,
    onUseWithInventory,
    rollLoot,
    TABLE,
    ROLL_SIZE
};
