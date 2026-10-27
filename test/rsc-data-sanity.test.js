// Sanity sweep over the CORRECTED rsc-data skill rows (src/data-fixes.json applied): a cooked item shares a name stem
// with its raw item, fish ids are fish-like, a potion differs from its secondary, every id exists. Anything not in
// ACCEPTED fails. Also checks that every data-fixes.json entry still differs from the raw rsc-data value (read with fs,
// uncorrected), so a fix rsc-data adopts is flagged for removal.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { fixes } = require('../src/data-fixes');
const items = require('@2003scape/rsc-data/config/items');
const cooking = require('@2003scape/rsc-data/skills/cooking');
const fishing = require('@2003scape/rsc-data/skills/fishing');
const herblaw = require('@2003scape/rsc-data/skills/herblaw');
const mining = require('@2003scape/rsc-data/skills/mining');

// reviewed false positives of the heuristic, by exact anomaly line
const ACCEPTED = new Set([
    'cooking 133/raw chicken -> cookedmeat(132): no shared stem', // the cooked item is literally named "cookedmeat"
    'mining rock 112 gives gold(152): not ore-like', // gold and silver rocks give gold/silver, which are the ores
    'mining rock 315 gives gold(690): not ore-like', // the Witchaven (Family Crest) rock gives perfect gold, item 690, named "gold"
    'mining rock 195 gives silver(383): not ore-like',
    'mining rock 588 gives uncut opal(891): not ore-like', // the gem rock gives a list of uncut gems
    'mining rock 588 gives uncut jade(890): not ore-like',
    'mining rock 588 gives uncut red topaz(889): not ore-like'
]);

function name(id) {
    return items[id] ? items[id].name.toLowerCase() : null;
}

function stems(text) {
    return text
        .replace(/\b(raw|uncooked|cooked|burnt|burned|unfinished|unstrung|ground|the)\b/g, ' ')
        .split(/[^a-z]+/)
        .filter((word) => word.length >= 3)
        .map((word) => word.replace(/s$/, ''));
}

function shareStem(a, b) {
    const left = stems(a);
    const right = new Set(stems(b));
    return left.some((word) => right.has(word));
}

const FISH_LIKE = /fish|shrimp|anchov|sardine|herring|trout|salmon|pike|tuna|lobster|swordfish|shark|bass|cod|mackerel|oyster|casket|boots|gloves|eel|seaweed|leather|bait|net|rod/;

function anomalies() {
    const found = [];
    const need = (where, id) => {
        if (!name(id)) {
            found.push(`${where}: item ${id} does not exist`);
            return false;
        }
        return true;
    };

    for (const [rawId, def] of Object.entries(cooking.uncooked)) {
        if (def.reference) continue;
        if (!need(`cooking ${rawId}`, rawId) || !need(`cooking ${rawId} cooked`, def.cooked) || !need(`cooking ${rawId} burnt`, def.burnt)) continue;
        if (!shareStem(name(rawId), name(def.cooked))) {
            found.push(`cooking ${rawId}/${name(rawId)} -> ${name(def.cooked)}(${def.cooked}): no shared stem`);
        }
    }

    for (const [spotId, spot] of Object.entries(fishing.spots)) {
        for (const [action, def] of Object.entries(spot)) {
            if (!def.fish) continue; // reference
            for (const fishId of Object.keys(def.fish)) {
                if (!need(`fishing ${spotId}/${action}`, fishId)) continue;
                if (!FISH_LIKE.test(name(fishId))) {
                    found.push(`fishing ${spotId}/${action} fish ${fishId} = ${name(fishId)}: not fish-like`);
                }
            }
        }
    }

    for (const [unfinished, secondaries] of Object.entries(herblaw.potions)) {
        need(`herblaw potion base ${unfinished}`, unfinished);
        for (const [secondary, def] of Object.entries(secondaries)) {
            need(`herblaw ${unfinished}+${secondary}`, secondary);
            need(`herblaw ${unfinished}+${secondary} result`, def.id);
            if (def.id === Number(secondary) || def.id === Number(unfinished)) {
                found.push(`herblaw ${name(unfinished)}(${unfinished}) + ${name(secondary)}(${secondary}) -> self`);
            }
        }
    }

    for (const [herb, def] of Object.entries(herblaw.herbs)) {
        need(`herblaw herb ${herb}`, herb);
        need(`herblaw herb ${herb} result`, def.id);
    }

    for (const [rockId, rock] of Object.entries(mining.rocks || {})) {
        if (rock.reference) continue;
        const ores = [].concat(rock.ore === undefined ? [] : rock.ore);
        for (const ore of ores) {
            const id = typeof ore === 'object' ? ore.id : ore;
            if (!need(`mining rock ${rockId}`, id)) continue;
            if (!/ore|coal|gem|sapphire|emerald|ruby|diamond|clay|sand|stone|nugget|rock/.test(name(id))) {
                found.push(`mining rock ${rockId} gives ${name(id)}(${id}): not ore-like`);
            }
        }
    }

    return found;
}

test('rsc-data skill rows are sane once data-fixes.json is applied', () => {
    const unexpected = anomalies().filter((line) => !ACCEPTED.has(line));
    assert.deepStrictEqual(unexpected, []);
});

// raw (uncorrected) rsc-data, straight from the json files
function rawAt(file, keyPath) {
    const root = path.dirname(require.resolve('@2003scape/rsc-data/package.json'));
    let node = JSON.parse(fs.readFileSync(path.join(root, `${file}.json`), 'utf8'));
    for (const key of keyPath.split('.')) {
        if (node === undefined || node === null) return undefined;
        node = node[key];
    }
    return node;
}

test('every data-fixes.json entry still differs from raw rsc-data', () => {
    const stale = [];
    for (const fix of fixes) {
        assert.ok(fix.source, `${fix.id} has no source`);
        const raw = rawAt(fix.file, fix.path);
        const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
        let differs;
        if (fix.op === 'set') differs = !same(raw, fix.value);
        else if (fix.op === 'delete') differs = raw !== undefined;
        else differs = fix.values.some((value) => !raw.some((existing) => same(existing, value)));
        if (!differs) stale.push(fix.id);
    }
    assert.deepStrictEqual(stale, [], 'rsc-data now has these rows: remove them from data-fixes.json');
});
