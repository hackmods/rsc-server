// Ported from Open-RSC Core-Framework authentic/itemactions/SandPit.java (AGPL-3.0)

const SAND_PIT_ID = 302;
const BUCKET_ID = 21;
const SAND_ID = 625;

async function onUseWithGameObject(player, gameObject, item) {
    if (gameObject.id !== SAND_PIT_ID || item.id !== BUCKET_ID) {
        return false;
    }

    player.sendBubble(item.id);
    player.message('you fill the bucket with sand');
    player.inventory.remove(BUCKET_ID);
    player.inventory.add(SAND_ID);

    return true;
}

module.exports = { onUseWithGameObject };
