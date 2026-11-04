// Ported from Open-RSC Core-Framework authentic/quests/members/TreeGnomeVillage.java (AGPL-3.0), its OpBound for
// FENCE_WITH_LOOSE_PANNELS (101): the fence at (540,445) is the way into McGrubor's wood (the red vine worms of Fishing
// Contest; the wood's gate only lets you out), the two at y 705 lead into the Tree Gnome Village maze. No quest check:
// "You push your way through the fence", and the player walks through (doDoor with the open id 16).

const LOOSE_FENCE_ID = 101;
const OPEN_FENCE_ID = 16;

function isLooseFence(wallObject) {
    return (
        wallObject.id === LOOSE_FENCE_ID &&
        (wallObject.y === 705 || (wallObject.x === 540 && wallObject.y === 445))
    );
}

async function onWallObjectCommandOne(player, wallObject) {
    if (!isLooseFence(wallObject)) {
        return false;
    }

    player.message('You push your way through the fence');
    await player.enterDoor(wallObject, OPEN_FENCE_ID);

    return true;
}

module.exports = { onWallObjectCommandOne };
