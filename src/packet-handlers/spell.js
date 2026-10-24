const {
    spells,
    PROJECTILE_MAGIC,
    getMaxHit,
    hasRunes,
    getRunesToRemove,
    getSpellExperience,
    rollSpellDamage
} = require('../spell-helpers');

const log = require('bole')('spell');

// in tiles; withinRange(..., precise) compares against range / 2 (as shootRanged does)
// in tiles; withinRange(..., precise) compares against range / 2, as
// shootRanged accounts for
const CAST_RANGE = 5;
const CAST_DELAY_TICKS = 3;

// players currently in their cast delay
const casting = new WeakSet();

async function castNPC({ player }, { index, id: spellIndex }) {
    if (player.locked || casting.has(player)) {
        return;
    }

    if (player.opponent) {
        player.message('You are already busy fighting!');
        return;
    }

    const { world } = player;
    const npc = world.npcs.getByIndex(index);

    if (!npc) {
        throw new RangeError(`invalid npc index ${index}`);
    }

    const spell = spells[spellIndex];

    if (!spell) {
        return;
    }

    player.walkAction = false;

    player.endWalkFunction = async () => {
        if (player.locked || !world.npcs.getByIndex(index)) {
            return;
        }

        if (!npc.withinRange(player, CAST_RANGE * 2, true)) {
            if (npc.withinRange(player, 8)) {
                await player.chase(npc);
            }

            if (!npc.withinRange(player, CAST_RANGE * 2, true)) {
                return;
            }
        }

        if (npc.skills.hits.current <= 0) {
            return;
        }

        const handled = await world.callPlugin(
            'onCastOnNPC',
            player,
            npc,
            spell,
            spellIndex
        );

        if (handled) {
            return;
        }

        if (spell.type !== 'offensive' || !getMaxHit(spell)) {
            player.message('This spell can not be used on this target');
            return;
        }

        // same attackable check as npcAttack in npc.js
        if (!npc.definition.hostility) {
            player.message('This spell can not be used on this target');
            return;
        }

        if (npc.locked) {
            return;
        }

        if (player.skills.magic.current < spell.level) {
            player.message('Your magic level is not high enough for this spell');
            return;
        }

        if (!hasRunes(player.inventory, spell)) {
            player.message("You don't have enough runes to cast this spell");
            return;
        }

        if (!player.withinLineOfSight(npc, true)) {
            player.message("I can't get a clear shot from here");
            return;
        }

        player.walkQueue.length = 0;
        casting.add(player);

        try {
            for (const rune of getRunesToRemove(player.inventory, spell)) {
                player.inventory.remove(rune.id, rune.amount);
            }

            player.sendProjectile(npc, PROJECTILE_MAGIC);

            const damage = rollSpellDamage(spell);

            // damage() handles death + onNPCDeath, as in Player.shootRanged
            npc.damage(damage, player);

            player.addExperience('magic', getSpellExperience(spell, damage));

            // start retaliation like Player.shootRanged
            if (!npc.locked && npc.chasing !== player && !npc.opponent) {
                npc.attack(player)
                    .then(() => {
                        npc.retreatTicks = 4;
                    })
                    .catch((err) => log.error(err));
            }

            await world.sleepTicks(CAST_DELAY_TICKS);
        } finally {
            casting.delete(player);
        }
    };
}

module.exports = { castNPC };
