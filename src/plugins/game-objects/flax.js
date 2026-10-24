// Ported from Open-RSC authentic/misc/Pick.java (AGPL-3.0): flax (object 313) picked with the "pick" command.
// Pick.java uses handleCropPickup, which gives one flax and leaves the plant in place (no depletion).

const FLAX_OBJECT_ID = 313;
const FLAX_ID = 675;

async function onGameObjectCommandTwo(player, gameObject) {
    if (gameObject.id !== FLAX_OBJECT_ID) {
        return false;
    }

    player.inventory.add(FLAX_ID);
    player.message('You uproot a flax plant');
    player.sendSound('potato');
    return true;
}

module.exports = { onGameObjectCommandTwo };
