// ARSC overlay: drinking herblaw potions (https://classic.runescape.wiki/w/Potions). Upstream items/quaffable.js only
// knows drinks like wine and beer. A potion is a chain of item ids, one per dose left (3 -> 2 -> 1 -> empty vial;
// strength potions have 4 doses). Each sip applies the potion's effect and leaves the next dose down.
// Potion of Zamorak: Open-RSC Core-Framework authentic/itemactions/Drinkables.java useZamorakPotion (AGPL-3.0).
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
    { name: 'poison antidote', doses: dosesFrom(569, 3), effect: { type: 'antidote' } },
    { name: 'potion of Zamorak', doses: dosesFrom(963, 3), drinkMessage: 'You drink some of the foul liquid', effect: { type: 'zamorak' } }
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

// Functions.addstat: current + constant + current * percent / 100, capped at max + constant + max * percent / 100
function addStat(player, skill, constant, percent) {
    const stat = player.skills[skill];
    const cap = stat.base + constant + Math.floor((stat.base * percent) / 100);
    const level = Math.min(stat.current + constant + Math.floor((stat.current * percent) / 100), cap);

    player.changeStat(skill, level - stat.current, { cap });
}

// Functions.substat: current - (constant + current * percent / 100); hits is a real hit (damage)
function subStat(player, skill, constant, percent) {
    const damage = constant + Math.floor((player.skills[skill].current * percent) / 100);

    if (skill === 'hits') {
        player.damage(damage);
    } else {
        player.changeStat(skill, -damage);
    }
}

function applyEffect(player, effect, dosesLeft) {
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
        // attack +20%, strength +12% (both +4 flat, +2 on the last dose), defense -10% (-4, -2 on the last dose),
        // hits -10% as damage, prayer +10% of the current level
        case 'zamorak': {
            const last = dosesLeft === 1;

            addStat(player, 'attack', last ? 2 : 4, 20);
            subStat(player, 'defense', last ? 2 : 4, 10);
            addStat(player, 'strength', 2, 12);
            subStat(player, 'hits', 0, 10);
            addStat(player, 'prayer', 0, 10);

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
        // Open-RSC Drinkables.java: both cure the poison, then keep it off for 3 minutes (cure poison potion) or
        // 6 minutes (antidote). Neither says anything beyond the usual drink and doses messages.
        case 'curePoison':
            player.curePoison();
            player.setCurePoisonProtection();
            break;
        case 'antidote':
            player.curePoison();
            player.setAntidoteProtection();
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
    player.message(`@que@${potion.drinkMessage || `You drink some of your ${potion.name}`}`);

    await world.sleepTicks(2);

    if (!player.inventory.has(item.id)) {
        return true;
    }

    const next = dosesLeft > 1 ? potion.doses[potion.doses.length - dosesLeft + 1] : EMPTY_VIAL_ID;

    player.inventory.remove(item.id);
    player.inventory.add(next);

    applyEffect(player, potion.effect, dosesLeft);

    if (dosesLeft > 1) {
        const left = dosesLeft - 1;
        player.message(`@que@You have ${left} dose${left === 1 ? '' : 's'} of potion left`);
    } else {
        player.message('@que@You have finished your potion');
    }

    return true;
}

module.exports = { onInventoryCommand };
