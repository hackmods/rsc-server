// Ported from Open-RSC Core-Framework authentic/itemactions/InvUseOnItem.java (milk + chocolate dust, chocolaty milk +
// snape grass) and authentic/itemactions/InvAction.java (handleScruffyNote, handleMagicScroll) (AGPL-3.0).
//
// The Plague City items you make or read:
//   Milk (22) + Chocolate dust (772, a chocolate bar 337 ground with the pestle and mortar, skills/herblaw.js)
//     -> chocolaty milk (770); + Snape grass (469) -> Hangover cure (771) for Bravek (west-ardougne.js)
//   Scruffy note (781): the recipe, badly spelt
//   Magic scroll (752, Edmond's reward): reading it sets cache.ardougneScroll (Java ardougne_scroll), which the Ardougne
//     teleport needs (packet-handlers/magic.js); a second scroll after that just crumbles
// Not ported: drinking the chocolaty milk (InvAction/Drinkables, heals 4) is with the other eating/drinking leftovers.

const MILK_ID = 22;
const SNAPE_GRASS_ID = 469;
const MAGIC_SCROLL_ID = 752;
const CHOCOLATY_MILK_ID = 770;
const HANGOVER_CURE_ID = 771;
const CHOCOLATE_DUST_ID = 772;
const SCRUFFY_NOTE_ID = 781;

function isPair(item, target, a, b) {
    return (item.id === a && target.id === b) || (item.id === b && target.id === a);
}

async function onUseWithInventory(player, item, target) {
    if (isPair(item, target, MILK_ID, CHOCOLATE_DUST_ID)) {
        player.inventory.remove(MILK_ID);
        player.inventory.remove(CHOCOLATE_DUST_ID);
        player.message('You mix the chocolate into the bucket');
        player.inventory.add(CHOCOLATY_MILK_ID);
        return true;
    }

    if (isPair(item, target, CHOCOLATY_MILK_ID, SNAPE_GRASS_ID)) {
        player.inventory.remove(CHOCOLATY_MILK_ID);
        player.inventory.remove(SNAPE_GRASS_ID);
        player.message('You mix the snape grass into the bucket');
        player.inventory.add(HANGOVER_CURE_ID);
        return true;
    }

    return false;
}

async function mes(player, ...lines) {
    for (const line of lines) {
        player.message(line);
        await player.world.sleepTicks(3);
    }
}

async function readScruffyNote(player) {
    await mes(
        player,
        'The handwriting on this note is very scruffy',
        'as far as you can make out it says',
        'Got a bncket of nnlk',
        'Tlen qrind sorne lhoculate',
        'vnith a pestal and rnortar',
        'ald the grourd dlocolate to tho milt',
        'fnales add 5cme snape gras5',
        'you guess it really says something slightly different'
    );
}

async function readMagicScroll(player) {
    if (player.cache.ardougneScroll && player.questStages.plagueCity === -1) {
        await mes(player, 'The scroll crumbles to dust');
    } else {
        await mes(
            player,
            'You memorise what is written on the scroll',
            'You can now cast the Ardougne teleport spell',
            'Provided you have the required runes and magic level',
            'The scroll crumbles to dust'
        );
    }

    player.inventory.remove(MAGIC_SCROLL_ID);
    player.cache.ardougneScroll = true;
}

async function onInventoryCommand(player, item) {
    if (item.id === SCRUFFY_NOTE_ID) {
        await readScruffyNote(player);
        return true;
    }

    if (item.id === MAGIC_SCROLL_ID) {
        await readMagicScroll(player);
        return true;
    }

    return false;
}

module.exports = { onUseWithInventory, onInventoryCommand };
