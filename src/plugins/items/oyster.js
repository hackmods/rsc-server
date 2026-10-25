// Ported from Open-RSC Core-Framework authentic/itemactions/InvAction.java
// (handleOyster) (AGPL-3.0)

const OYSTER_EMPTY_ID = 791;
const OYSTER_ID = 793;
const OYSTER_PEARLS_ID = 792;

async function onInventoryCommand(player, item) {
    if (item.id !== OYSTER_ID) {
        return false;
    }

    player.message('you open the oyster shell');

    // DataConversions.random(0, 10) == 1: one in eleven
    const pearl = Math.floor(Math.random() * 11) === 1;

    player.inventory.remove(OYSTER_ID);
    player.inventory.add(pearl ? OYSTER_PEARLS_ID : OYSTER_EMPTY_ID);

    return true;
}

module.exports = { onInventoryCommand };
