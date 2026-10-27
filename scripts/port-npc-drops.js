#!/usr/bin/env node
// Port Open-RSC's NPC drop tables (NpcDrops.java) into src/arsc-drops.json, in the roll format of
// @2003scape/rsc-data/rolls/drops.json that src/rolls.js reads. No dependencies.
//
//   node scripts/port-npc-drops.js            write src/arsc-drops.json
//   node scripts/port-npc-drops.js --check    exit 1 if the file is stale
//   node scripts/port-npc-drops.js --java DIR path to OpenRSC-Core-Framework (or set ARSC_OPENRSC)
//
// How it works: the Java drop-building methods are plain `new DropTable(..)` / `addItemDrop(..)` calls, so they are
// rewritten to JavaScript line by line and run against a small DropTable class that mirrors content/DropTable.java.
// Config flags take the AUTHENTIC branch:
//   WANT_OPENPK_POINTS = false  (OpenPK is a custom PK-points server mode: rune/dragon/arrow tables, fatter coin drops)
//   WANT_CUSTOM_QUESTS = false  (custom quests: Balrog, King Black Dragon rare table, bad luck mitigation)
//   ONLY_REGULAR_BONES = false  (big/bat/dragon bones and ashes are kept)
// Weights: DropTable rolls 0..totalWeight-1 and the tables are padded to 128 with addEmptyDrop; rolls.js rolls 0..128
// over the same 128 scale, so weights copy 1:1. A table whose total is not 128 (the herb table is 125) is rescaled to
// 128 so it does not silently miss, and an item missing from rsc-data becomes an empty slot, not a redistributed one.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'src', 'arsc-drops.json');
const ROLL_SCALE = 128;
const FLAGS = {
    WANT_OPENPK_POINTS: false,
    WANT_CUSTOM_QUESTS: false,
    ONLY_REGULAR_BONES: false
};
const BONE_ITEM = { bones: 20, big: 413, bat: 604, dragon: 814, ashes: 181 };
const JAVA_REL = path.join('server', 'src', 'com', 'openrsc', 'server', 'constants');

function findJavaDir(explicit) {
    const candidates = [explicit, process.env.ARSC_OPENRSC];
    let dir = ROOT;
    for (let i = 0; i < 8; i += 1) {
        candidates.push(path.join(dir, 'source', 'OpenRSC-Core-Framework'));
        dir = path.dirname(dir);
    }
    for (const c of candidates) {
        if (c && fs.existsSync(path.join(c, JAVA_REL, 'NpcDrops.java'))) {
            return path.join(c, JAVA_REL);
        }
    }
    return null;
}

function parseEnum(file) {
    const map = new Map();
    const text = fs.readFileSync(file, 'utf8');
    for (const m of text.matchAll(/^\s*([A-Z0-9_]+)\((-?\d+)\)[,;]/gm)) {
        map.set(m[1], Number(m[2]));
    }
    return map;
}

// the text of `void name() { ... }` by brace matching
function methodBody(text, name) {
    const start = text.search(new RegExp(`void\\s+${name}\\s*\\(`));
    if (start < 0) {
        throw new Error(`method ${name} not found`);
    }
    let i = text.indexOf('{', start);
    const begin = i + 1;
    let depth = 0;
    for (; i < text.length; i += 1) {
        if (text[i] === '{') depth += 1;
        else if (text[i] === '}') {
            depth -= 1;
            if (depth === 0) return text.slice(begin, i);
        }
    }
    throw new Error(`unbalanced braces in ${name}`);
}

// mirrors content/DropTable.java (construction side only)
class DropTable {
    constructor(description = '') {
        this.description = description;
        this.drops = [];
        this.totalWeight = 0;
    }

    getTotalWeight() {
        return this.totalWeight;
    }

    addEmptyDrop(weight) {
        if (weight < 0) throw new Error(`negative empty weight in ${this.description}`);
        this.drops.push({ type: 'nothing', weight });
        this.totalWeight += weight;
    }

    addItemDrop(id, amount, weight) {
        this.drops.push({ type: 'item', id, amount, weight });
        this.totalWeight += weight;
    }

    addTableDrop(table, weight) {
        if (!(table instanceof DropTable)) {
            throw new Error(`bad sub-table in ${this.description}`);
        }
        this.drops.push({ type: 'table', table, weight });
        this.totalWeight += weight;
    }

    // a snapshot: later additions to the original do not appear in the clone
    clone(description = '') {
        const copy = new DropTable(description);
        for (const d of this.drops) {
            copy.drops.push(Object.assign({}, d));
            copy.totalWeight += d.weight;
        }
        return copy;
    }
}

function slug(description) {
    return description
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

// rescale a table's weighted entries to ROLL_SCALE (largest remainder, never below 1)
function normalise(entries) {
    const weighted = entries.filter((e) => e.weight > 0);
    const total = weighted.reduce((sum, e) => sum + e.weight, 0);
    if (total === ROLL_SCALE || total === 0) return;
    const raw = weighted.map((e) => (e.weight * ROLL_SCALE) / total);
    const out = raw.map((r) => Math.max(1, Math.floor(r)));
    let diff = ROLL_SCALE - out.reduce((a, b) => a + b, 0);
    const order = raw
        .map((r, i) => [r - Math.floor(r), i])
        .sort((a, b) => b[0] - a[0] || a[1] - b[1]);
    for (let k = 0; diff > 0; k = (k + 1) % order.length, diff -= 1) {
        out[order[k][1]] += 1;
    }
    while (diff < 0) {
        out[out.indexOf(Math.max(...out))] -= 1;
        diff += 1;
    }
    weighted.forEach((e, i) => {
        e.weight = out[i];
    });
}

function generate({ javaDir } = {}) {
    const dir = findJavaDir(javaDir);
    if (!dir) {
        throw new Error(
            'OpenRSC-Core-Framework not found (use --java DIR or ARSC_OPENRSC)'
        );
    }

    const items = require('@2003scape/rsc-data/config/items');
    const npcs = require('@2003scape/rsc-data/config/npcs');
    const base = require('@2003scape/rsc-data/rolls/drops');
    const javaItems = parseEnum(path.join(dir, 'ItemId.java'));
    const javaNpcs = parseEnum(path.join(dir, 'NpcId.java'));
    const itemNameById = new Map([...javaItems].map(([n, id]) => [id, n]));
    const source = fs.readFileSync(path.join(dir, 'NpcDrops.java'), 'utf8');

    const strict = (map, what) =>
        new Proxy(Object.fromEntries(map), {
            get(target, name) {
                if (!(name in target)) {
                    throw new Error(`unknown ${what} ${String(name)}`);
                }
                return target[name];
            },
            has: () => true
        });

    const npcDrops = new Map();
    // the NpcDrops fields the methods assign, plus what they call
    const ctx = {
        herbDropTable: null,
        rareDropTable: null,
        megaRareDropTable: null,
        ultraRareDropTable: null,
        kbdTableCustom: null,
        runeDropTable: null,
        dragonDropTable: null,
        arrowsRunesDropTable: null,
        config: FLAGS,
        DropTable,
        ItemId: strict(javaItems, 'ItemId'),
        NpcId: strict(javaNpcs, 'NpcId'),
        npcDrops: { put: (id, table) => npcDrops.set(id, table) }
    };

    // `with` gives the method bodies the bare field names the Java uses
    const run = (name) => {
        const js = methodBody(source, name)
            .replace(/^(\s*)DropTable\s+(\w+)/gm, '$1let $2')
            .replace(/this\.npcDrops\.put\(/g, 'npcDrops.put(')
            .replace(/\b(ItemId|NpcId)\.([A-Z0-9_]+)\.id\(\)/g, '$1.$2');
        // eslint-disable-next-line no-new-func
        new Function('ctx', `with (ctx) {\n${js}\n}`)(ctx);
    };

    run('createHerbDropTable');
    run('createMegaRareDropTable');
    run('createRareDropTable');
    run('createUltraRareDropTable');
    run('generateNpcDrops');

    // bone sets
    const sets = {
        boneless: new Set(),
        bat: new Set(),
        big: new Set(),
        dragon: new Set(),
        ashes: new Set()
    };
    const setFor = {
        generateBonelessNpcs: 'boneless',
        generateBatBoneNpcs: 'bat',
        generateBigBoneDrops: 'big',
        generateDragonBoneDrops: 'dragon',
        generateAshesDrops: 'ashes'
    };
    for (const [method, set] of Object.entries(setFor)) {
        const body = methodBody(source, method);
        for (const m of body.matchAll(/NpcId\.([A-Z0-9_]+)\.id\(\)/g)) {
            sets[set].add(javaNpcs.get(m[1]));
        }
    }
    // same order as Npc.getBonesDrop
    const boneFor = (npcId) => {
        if (sets.big.has(npcId)) return BONE_ITEM.big;
        if (sets.bat.has(npcId)) return BONE_ITEM.bat;
        if (sets.dragon.has(npcId)) return BONE_ITEM.dragon;
        if (sets.ashes.has(npcId)) return BONE_ITEM.ashes;
        if (!sets.boneless.has(npcId)) return BONE_ITEM.bones;
        return null;
    };

    // name the sub-tables that NPC tables reference
    const tableNames = new Map([
        [ctx.herbDropTable, 'herb'],
        [ctx.rareDropTable, 'rare'],
        [ctx.megaRareDropTable, 'mega-rare'],
        [ctx.ultraRareDropTable, 'ultra-rare']
    ]);
    const usedNames = new Set(tableNames.values());
    const nameOf = (table) => {
        if (!tableNames.has(table)) {
            const stem = slug(table.description) || 'table';
            let name = stem;
            for (let n = 2; usedNames.has(name); n += 1) name = `${stem}-${n}`;
            usedNames.add(name);
            tableNames.set(table, name);
        }
        return tableNames.get(table);
    };

    const skipped = { slots: 0, names: new Set(), npcIds: [] };
    const subTables = {};
    const done = new Set();

    const convert = (table) => {
        const entries = table.drops.map((d) => {
            const entry = { weight: d.weight };
            if (d.type === 'nothing') {
                entry.empty = true;
            } else if (d.type === 'item') {
                if (!items[d.id]) {
                    skipped.slots += 1;
                    skipped.names.add(itemNameById.get(d.id) || `#${d.id}`);
                    entry.empty = true;
                } else {
                    entry.id = d.id;
                    entry.amount = d.amount;
                }
            } else {
                entry.reference = d.table;
            }
            return entry;
        });
        normalise(entries);
        const out = [];
        for (const e of entries) {
            if (e.empty) continue;
            if (e.reference) {
                const name = nameOf(e.reference);
                if (!done.has(e.reference)) {
                    done.add(e.reference);
                    subTables[name] = convert(e.reference);
                }
                out.push({ reference: name, weight: e.weight });
            } else {
                const o = { id: e.id };
                if (e.amount !== 1) o.amount = e.amount;
                o.weight = e.weight;
                out.push(o);
            }
        }
        return out;
    };

    const drops = {};
    const ported = [];
    for (const [npcId, table] of [...npcDrops].sort((a, b) => a[0] - b[0])) {
        if (!npcs[npcId]) {
            skipped.npcIds.push(npcId);
            continue;
        }
        const body = convert(table);
        const bone = boneFor(npcId);
        drops[npcId] = bone ? [{ id: bone, weight: 0 }, ...body] : body;
        ported.push(npcId);
    }

    // attackable NPCs with neither a Java nor an rsc-data table still follow the Java bone sets (Chronozon: ashes)
    const boneOnly = [];
    npcs.forEach((def, npcId) => {
        if (!def || !def.hostility || drops[npcId] || base[npcId]) return;
        const bone = boneFor(npcId);
        if (bone) {
            drops[npcId] = [{ id: bone, weight: 0 }];
            boneOnly.push(npcId);
        }
    });

    const sorted = {};
    for (const key of Object.keys(drops).sort((a, b) => a - b)) {
        sorted[key] = drops[key];
    }
    for (const key of Object.keys(subTables).sort()) {
        sorted[key] = subTables[key];
    }

    return {
        about:
            'NPC drop tables ported from Open-RSC NpcDrops.java by scripts/port-npc-drops.js; do not edit by hand. ' +
            'Same entry format as @2003scape/rsc-data rolls/drops.json (weight 0 = always, reference = sub-table). ' +
            'src/drop-table.js layers this over rsc-data: an entry here replaces the rsc-data table for that NPC id.',
        generatedFrom: {
            file: 'OpenRSC-Core-Framework server/src/com/openrsc/server/constants/NpcDrops.java',
            flags: FLAGS,
            rollScale: ROLL_SCALE,
            npcsPorted: ported.length,
            boneOnlyNpcs: boneOnly.length,
            subTables: Object.keys(subTables).length,
            skippedItemSlots: skipped.slots,
            skippedItems: [...skipped.names].sort(),
            skippedNpcIds: skipped.npcIds
        },
        drops: sorted
    };
}

function render(result) {
    return `${JSON.stringify(result, null, 1)}\n`;
}

module.exports = { generate, render, OUT };

if (require.main === module) {
    const args = process.argv.slice(2);
    const javaIdx = args.indexOf('--java');
    const result = generate({
        javaDir: javaIdx >= 0 ? args[javaIdx + 1] : undefined
    });
    const text = render(result);

    if (args.includes('--check')) {
        const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
        if (current !== text) {
            console.error(
                'src/arsc-drops.json is stale: run node scripts/port-npc-drops.js'
            );
            process.exit(1);
        }
        console.log('src/arsc-drops.json is up to date');
    } else {
        fs.writeFileSync(OUT, text);
        const g = result.generatedFrom;
        console.log(
            `wrote ${path.relative(ROOT, OUT)}: ${g.npcsPorted} NPCs, ${g.boneOnlyNpcs} bone-only, ` +
                `${g.subTables} sub-tables, ${g.skippedItemSlots} skipped item slots ` +
                `(${g.skippedItems.join(', ')}), ${g.skippedNpcIds.length} skipped NPC ids`
        );
    }
}
