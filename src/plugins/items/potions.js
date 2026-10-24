// ARSC overlay: drinking herblaw potions (https://classic.runescape.wiki/w/Potions). Upstream items/quaffable.js only
// knows drinks like wine and beer. A potion is a chain of item ids, one per dose left (3 -> 2 -> 1 -> empty vial;
// strength potions have 4 doses). Each sip applies the potion's effect and leaves the next dose down.
// Boosts only apply when they would raise the stat above where it is: sipping twice does not stack.

const EMPTY_VIAL_ID = 465;

// ids of the doses, full first
const dosesFrom = (first, count) => Array.from({ length: count }, (_, i) => first + i);

const boost = (skill, flat, percent, message) => ({ type: 'boost', skill, flat, percent, message });
const restore = (flat, percent) => ({ type: 'restore', flat, percent });

// name is what the drinker sees in "You drink some of your <name>"
const POTIONS = [
    { name: 'attack potion', doses: dosesFrom(474, 3), effect: boost('attack', 3, 0.1, 'You feel stronger') },
    { name: 'strength potion', doses: dosesFrom(221, 4), effect: boost('strength', 3, 0.1, 'You feel stronger') },
    { name: 'defense potion', doses: dosesFrom(480, 3), effect: boost('defense', 3, 0.1, 'You feel more resilient') },
    { name: 'super attack potion', doses: dosesFrom(486, 3), effect: boost('attack', 5, 0.15, 'You feel much stronger') },
    { name: 'super strength potion', doses: dosesFrom(492, 3), effect: boost('strength', 5, 0.15, 'You feel much stronger') },
    { name: 'super defense potion', doses: dosesFrom(495, 3), effect: boost('defense', 5, 0.15, 'You feel much more resilient') },
    { name: 'fishing potion', doses: dosesFrom(489, 3), effect: boost('fishing', 3, 0, 'You feel more skilled at fishing') },
    { name: 'ranging potion', doses: dosesFrom(498, 3), effect: boost('ranged', 4, 0, 'You feel more accurate') },
    { name: 'restore prayer potion', doses: dosesFrom(483, 3), effect: { type: 'prayer', flat: 7, percent: 0.25 } },
    { name: 'stat restoration potion', doses: dosesFrom(477, 3), effect: restore(8, 0.25) },
    { name: 'cure poison potion', doses: dosesFrom(566, 3), effect: { type: 'curePoison' } },
    { name: 'poison antidote', doses: dosesFrom(569, 3), effect: { type: 'curePoison' } }
];

// skills the stat restoration potion tops up (not hits, and prayer has its own potion)
const RESTORABLE = [
    'attack', 'defense', 'strength', 'ranged', 'magic', 'cooking', 'woodcutting', 'fletching', 'fishing',
    'firemaking', 'crafting', 'smithing', 'mining', 'herblaw', 'agility', 'thieving'
];

const byItemID = new Map();

for (const potion of POTIONS) {
    potion.doses.forEach((id, index) => {
        byItemID.set(id, { potion, dosesLeft: potion.doses.length - index });
    });
}

function applyEffect(player, effect) {
    const { skills } = player;

    switch (effect.type) {
        case 'boost': {
            const stat = skills[effect.skill];
            const max = stat.base + effect.flat + Math.floor(stat.base * effect.percent);

            if (stat.current < max) {
                stat.current = max;
            }

            player.sendStats();
            player.message(`@que@${effect.message}`);

            break;
        }
        case 'prayer': {
            const { prayer } = skills;

            prayer.current = Math.min(
                prayer.base,
                prayer.current + effect.flat + Math.floor(prayer.base * effect.percent)
            );

            player.sendStats();
            player.message('@que@You feel a lot closer to the gods');

            break;
        }
        case 'restore': {
            for (const name of RESTORABLE) {
                const stat = skills[name];

                if (stat && stat.current < stat.base) {
                    stat.current = Math.min(
                        stat.base,
                        stat.current + effect.flat + Math.floor(stat.base * effect.percent)
                    );
                }
            }

            player.sendStats();
            player.message('@que@You feel restored');

            break;
        }
        case 'curePoison':
            // there is no poison in this server yet; the potion is still used up
            player.message('@que@You feel better');
            break;
    }
}

async function onInventoryCommand(player, item) {
    const found = byItemID.get(item.id);

    if (!found) {
        return false;
    }

    const { potion, dosesLeft } = found;
    const { world } = player;

    player.sendBubble(item.id);
    player.message(`@que@You drink some of your ${potion.name}`);

    await world.sleepTicks(2);

    if (!player.inventory.has(item.id)) {
        return true;
    }

    const next = dosesLeft > 1 ? potion.doses[potion.doses.length - dosesLeft + 1] : EMPTY_VIAL_ID;

    player.inventory.remove(item.id);
    player.inventory.add(next);

    applyEffect(player, potion.effect);

    if (dosesLeft > 1) {
        const left = dosesLeft - 1;
        player.message(`@que@You have ${left} dose${left === 1 ? '' : 's'} of potion left`);
    } else {
        player.message('@que@You have finished your potion');
    }

    return true;
}

module.exports = { onInventoryCommand };
