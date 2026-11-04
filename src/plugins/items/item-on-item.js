// Using one inventory item on another: the combinations of Open-RSC Core-Framework authentic/itemactions/InvUseOnItem.java
// (AGPL-3.0) that no other plugin here covers:
//  - the two halves of the crystal key (tooth 526 + loop 527) join into the crystal key (525), for the crystal chest
//    in Taverley (game-objects/crystal-chest.js). CRYSTAL_KEY_GIVES_XP is off by default: no experience;
//  - a pot of flour on swamp tar makes uncooked swamp paste (784) and gives the pot back (cook it on a fire or range:
//    skills/cooking/cooking.js);
//  - a tinderbox lights a candle (599 -> 601) or a black candle (600 -> 602);
//  - broken glass dries damp sticks in the sun (776 -> 777);
//  - chocolate dust in a bucket of milk makes chocolaty milk (770, drunk in items/quaffable.js), and snape grass in that
//    makes a hangover cure (771).
// Covered elsewhere: dyes (items/dye-mix.js, crafting/dye-cape.js, the Goblin Diplomacy armour and the Prince Ali wig),
// blamish oil (skills/herblaw.js), raw meat in water (cooking/combinations.js). Skipped: the crest fragments (Family
// Crest), and the dragon square shield halves, whose Java message is marked as not authentic.

const TOOTH_KEY_HALF_ID = 526;
const LOOP_KEY_HALF_ID = 527;
const CRYSTAL_KEY_ID = 525;
const POT_ID = 135;
const POT_OF_FLOUR_ID = 136;
const SWAMP_TAR_ID = 783;
const UNCOOKED_SWAMP_PASTE_ID = 784;
const TINDERBOX_ID = 166;
const UNLIT_CANDLE_ID = 599;
const UNLIT_BLACK_CANDLE_ID = 600;
const LIT_CANDLE_ID = 601;
const LIT_BLACK_CANDLE_ID = 602;
const DAMP_STICKS_ID = 776;
const DRY_STICKS_ID = 777;
const BROKEN_GLASS_ID = 778;
const MILK_ID = 22;
const CHOCOLATE_DUST_ID = 772;
const CHOCOLATY_MILK_ID = 770;
const SNAPE_GRASS_ID = 469;
const HANGOVER_CURE_ID = 771;

const pair = (item, target, a, b) => (item.id === a && target.id === b) || (item.id === b && target.id === a);

async function onUseWithInventory(player, item, target) {
    const { inventory } = player;

    if (pair(item, target, POT_OF_FLOUR_ID, SWAMP_TAR_ID)) {
        if (inventory.has(POT_OF_FLOUR_ID) && inventory.has(SWAMP_TAR_ID)) {
            inventory.remove(SWAMP_TAR_ID);
            inventory.remove(POT_OF_FLOUR_ID);
            inventory.add(POT_ID);
            player.message('you mix the flour with the swamp tar');
            player.message('it mixes into a paste');
            inventory.add(UNCOOKED_SWAMP_PASTE_ID);
        }

        return true;
    }

    for (const [unlit, lit] of [[UNLIT_BLACK_CANDLE_ID, LIT_BLACK_CANDLE_ID], [UNLIT_CANDLE_ID, LIT_CANDLE_ID]]) {
        if (pair(item, target, TINDERBOX_ID, unlit)) {
            if (inventory.has(unlit)) {
                inventory.remove(unlit);
                player.message('You light the candle');
                inventory.add(lit === LIT_CANDLE_ID ? LIT_CANDLE_ID : LIT_BLACK_CANDLE_ID);
            }

            return true;
        }
    }

    if (pair(item, target, BROKEN_GLASS_ID, DAMP_STICKS_ID)) {
        if (inventory.has(DAMP_STICKS_ID)) {
            inventory.remove(DAMP_STICKS_ID);
            player.message('you hold the glass to the sun');
            player.message('above the damp sticks');
            await player.world.sleepTicks(2);
            player.message('the glass acts like a lens');
            player.message('and drys the sticks out');
            inventory.add(DRY_STICKS_ID);
        }

        return true;
    }

    if (pair(item, target, MILK_ID, CHOCOLATE_DUST_ID)) {
        if (inventory.has(MILK_ID) && inventory.has(CHOCOLATE_DUST_ID)) {
            inventory.remove(MILK_ID);
            inventory.remove(CHOCOLATE_DUST_ID);
            player.message('You mix the chocolate into the bucket');
            inventory.add(CHOCOLATY_MILK_ID);
        }

        return true;
    }

    if (pair(item, target, CHOCOLATY_MILK_ID, SNAPE_GRASS_ID)) {
        if (inventory.has(CHOCOLATY_MILK_ID) && inventory.has(SNAPE_GRASS_ID)) {
            inventory.remove(CHOCOLATY_MILK_ID);
            inventory.remove(SNAPE_GRASS_ID);
            player.message('You mix the snape grass into the bucket');
            inventory.add(HANGOVER_CURE_ID);
        }

        return true;
    }

    if (pair(item, target, TOOTH_KEY_HALF_ID, LOOP_KEY_HALF_ID)) {
        if (inventory.has(TOOTH_KEY_HALF_ID) && inventory.has(LOOP_KEY_HALF_ID)) {
            inventory.remove(TOOTH_KEY_HALF_ID);
            inventory.remove(LOOP_KEY_HALF_ID);
            player.message('You join the two halves of the key together');
            inventory.add(CRYSTAL_KEY_ID);
        }

        return true;
    }

    return false;
}

module.exports = { onUseWithInventory };
