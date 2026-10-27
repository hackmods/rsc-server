const wilderness = require('../wilderness');

async function getPlayer(player, index) {
    if (player.locked) {
        return;
    }

    const { world } = player;
    const otherPlayer = world.players.getByIndex(index);

    if (!otherPlayer) {
        throw new RangeError(`invalid player index ${index}`);
    }

    if (!otherPlayer.withinRange(player, 3, true)) {
        if (otherPlayer.withinRange(player, 8)) {
            await player.chase(otherPlayer);
        } else {
            return;
        }

        if (!otherPlayer.withinRange(player, 3, true)) {
            return;
        }
    }

    otherPlayer.stepsLeft = 0;
    player.lock();

    return otherPlayer;
}

async function useWithPlayer({ player }, { playerIndex, index }) {
    if (player.locked) {
        return;
    }

    // so players face the other player when using items, instead of walking
    // through them
    player.walkAction = false;

    player.endWalkFunction = async () => {
        const item = player.inventory.items[index];

        if (!item) {
            throw new RangeError(`invalid item index ${index}`);
        }

        const { world } = player;
        const otherPlayer = await getPlayer(player, playerIndex);

        if (!otherPlayer) {
            player.unlock();
            return;
        }

        if (!world.members && item.definition.members) {
            player.message('Nothing interesting happens');
            return;
        }

        const blocked = await world.callPlugin('onUseWithPlayer',
            player,
            otherPlayer,
            item
        );

        player.unlock();

        if (!blocked) {
            player.message('Nothing interesting happens');
        }
    };
}

// AttackHandler (PLAYER_ATTACK): melee or, with a bow wielded, ranged on a
// player in the wilderness, within the wilderness level of combat levels
async function playerAttack({ player }, { index }) {
    if (player.opponent) {
        player.message('You are already busy fighting!');
        return;
    }

    if (player.locked || player.rangedTimeout) {
        return;
    }

    const { world } = player;
    const target = world.players.getByIndex(index);

    if (!target) {
        throw new RangeError(`invalid player index ${index}`);
    }

    if (target === player) {
        return;
    }

    const ranged = !!player.inventory.getRangedWeapon();

    // an empty refusal is the silent re-attack timer
    const refused = (other) => {
        const refusal = wilderness.attackRefusal(player, other, {
            missile: ranged
        });

        if (refusal) {
            player.message(refusal);
        }

        return refusal !== null;
    };

    if (refused(target)) {
        return;
    }

    if (ranged) {
        await player.shootRanged(target);
        return;
    }

    player.toAttack = target;

    player.endWalkFunction = async () => {
        const other = world.players.getByIndex(index);

        if (!other || other !== target || !other.loggedIn) {
            player.toAttack = null;
            return;
        }

        if (refused(other)) {
            player.toAttack = null;
            return;
        }

        if (other.opponent) {
            player.toAttack = null;
            player.message("I can't get close enough");
            return;
        }

        if (!(await player.attack(other))) {
            player.message("I can't reach that!");
        }
    };
}

module.exports = { useWithPlayer, playerAttack };
