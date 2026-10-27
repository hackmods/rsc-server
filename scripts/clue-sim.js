#!/usr/bin/env node
// Opens N caskets per treasure trail tier with src/clues/rewards.json and
// reports what they are worth, so the economy can be checked before a change.
// Value is rsc-data's base price (a certificate is worth its items: 5 each).
// Usage: node scripts/clue-sim.js [count=10000] [--json]

const items = require('@2003scape/rsc-data/config/items.json');
const { certificates } = require('@2003scape/rsc-data/certificates.json');
const clues = require('../src/clues');

const count = Number(process.argv.find((arg) => /^\d+$/.test(arg))) || 10000;
const asJSON = process.argv.includes('--json');

// certificate id -> the item it stands for
const certified = new Map(
    Object.entries(certificates).map(([item, cert]) => [cert, Number(item)])
);

function value(id, amount) {
    if (certified.has(id)) {
        return items[certified.get(id)].price * 5 * amount;
    }

    return items[id].price * amount;
}

// the hard-earned piles, counted apart: base prices undervalue them (a herb is 1 gp)
const herbIDs = new Set(Object.keys(require('@2003scape/rsc-data/skills/herblaw.json').herbs).map(Number));
const groupOf = (id) =>
    /-Rune$/.test(items[id].name) ? 'runes' : herbIDs.has(id) ? 'herbs' : /bone/i.test(items[id].name) ? 'bones' : null;

const report = {};

for (const tier of clues.TIERS) {
    let coins = 0;
    let total = 0;
    let rares = 0;
    const rareCounts = {};
    const piles = { runes: 0, herbs: 0, bones: 0 };

    for (let i = 0; i < count; i += 1) {
        for (const { id, amount, rare } of clues.rollCasket(tier)) {
            total += value(id, amount);

            if (id === 10) {
                coins += amount;
            }

            const group = groupOf(certified.get(id) || id);

            if (group) {
                piles[group] += certified.has(id) ? amount * 5 : amount;
            }

            if (rare) {
                rares += 1;
                const name = `${items[id].name} (${id})`;
                rareCounts[name] = (rareCounts[name] || 0) + 1;
            }
        }
    }

    report[tier] = {
        caskets: count,
        averageCoins: Math.round(coins / count),
        averageValue: Math.round(total / count),
        rareRate: rares / count,
        rareOneIn: rares ? Math.round(count / rares) : null,
        perCasket: Object.fromEntries(Object.entries(piles).map(([k, n]) => [k, +(n / count).toFixed(1)])),
        rares: rareCounts
    };
}

if (asJSON) {
    console.log(JSON.stringify(report, null, 2));
} else {
    for (const [tier, r] of Object.entries(report)) {
        console.log(
            `${tier.padEnd(6)} ${r.caskets} caskets: avg coins ${r.averageCoins} gp, ` +
                `avg value ${r.averageValue} gp, rare ${(r.rareRate * 100).toFixed(2)}% ` +
                `(1 in ${r.rareOneIn ?? '-'}); per casket: ${r.perCasket.runes} runes, ` +
                `${r.perCasket.herbs} herbs, ${r.perCasket.bones} bones`
        );

        for (const [name, n] of Object.entries(r.rares).sort((a, b) => b[1] - a[1])) {
            console.log(`         ${String(n).padStart(4)}  ${name}`);
        }
    }
}
