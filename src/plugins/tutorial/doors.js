// Tutorial Island's gated doors: each opens once the player reaches the stage
// its instructor sets.

const t = require('./core');

async function onWallObjectCommandOne(player, wallObject) {
    const door = t.getDoor(wallObject);

    if (!door) {
        return false;
    }

    // finished or never-on-tutorial players (admins, visitors) may pass
    if (t.onTutorial(player) && t.stage(player) < door.stage) {
        player.message(door.refusal);
        return true;
    }

    await player.enterDoor(wallObject);
    return true;
}

module.exports = { onWallObjectCommandOne };
