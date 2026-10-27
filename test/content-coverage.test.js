// Content coverage sweep: every NPC / object actually spawned in the world (rsc-data locations + src/arsc-locations.js)
// must have the data its interaction needs, so content can never silently lack data again. Failures list the offenders.

const test = require('node:test');
const assert = require('node:assert');

require('../src/data-fixes'); // apply the corrected rows first
const items = require('@2003scape/rsc-data/config/items');
const npcs = require('@2003scape/rsc-data/config/npcs');
const objects = require('@2003scape/rsc-data/config/objects');
const npcRespawn = require('@2003scape/rsc-data/npc-respawn');
const fishing = require('@2003scape/rsc-data/skills/fishing');
const mining = require('@2003scape/rsc-data/skills/mining');
const woodcutting = require('@2003scape/rsc-data/skills/woodcutting');
const rscNpcSpawns = require('@2003scape/rsc-data/locations/npcs');
const rscObjectSpawns = require('@2003scape/rsc-data/locations/objects');
const arsc = require('../src/arsc-locations');
const drops = require('../src/drop-table');

const spawnedNpcIds = new Set(rscNpcSpawns.concat(arsc.npcs || []).map((s) => s.id));
const spawnedObjectIds = new Set(rscObjectSpawns.concat(arsc.gameObjects || []).map((s) => s.id));

const cmds = (id) => ((objects[id] && objects[id].commands) || []).map((c) => String(c || '').toLowerCase());
const label = (id) => `${id} (${objects[id] && objects[id].name})`;
const fail = (what, list) => assert.deepStrictEqual(list, [], `${what}:\n  ${list.join('\n  ')}`);

// ids handled in code by src/plugins/skills/woodcutting.js (not in rsc-data skills/woodcutting)
const WOODCUTTING_CODE = new Set([
    1086, 1100, 1099, 1092, 1091, // Shilo jungle trees (JUNGLE_TREES)
    245 // Dramen tree (DRAMEN_TREE), Lost City
]);

// mining/prospecting objects with no mining row, deliberately
const MINING_ALLOW = new Set([
    98, // generic depleted rock: authentic "no ore available" message (fallback depleted id)
    99, // empty rock, no Open-RSC ObjectMining def: inert
    164, // empty rock, no Open-RSC ObjectMining def: inert
    547, // empty rock, no Open-RSC ObjectMining def: inert
    555, // mossy rock, no Open-RSC ObjectMining def: inert
    699, // Daconia rock, no Open-RSC ObjectMining def: inert
    269, // rockslide: mined via plugins/game-objects/object-tele-points.js (clearRockslide)
    496, // Tutorial Island rock: plugins/tutorial/objects.js
    770, // handled in code by plugins/skills/mining.js (special-cased rock, not an rsc-data row)
    1026 // Rock of Dalgroth: Watchtower quest not implemented (Open-RSC Mining.java gives the crystal at stage 9); inert until then
]);

// fishing spot objects with no usable rsc-data row, deliberately
const FISHING_ALLOW = new Set([
    351, 352, 353, 354, // Fishing Contest spots: quest not implemented
    493 // Tutorial Island shrimp: plugins/tutorial/objects.js
]);

const resolveTree = (id) => {
    const t = woodcutting.trees[id];
    return t && t.reference !== undefined ? resolveTree(t.reference) : t;
};
const resolveSpot = (id, cmd) => {
    const s = fishing.spots[id];
    if (!s) return undefined;
    return s.reference !== undefined ? resolveSpot(s.reference, cmd) : s[cmd];
};
const resolveRock = (id) => {
    const r = mining.rocks[id];
    return r && r.reference !== undefined ? resolveRock(r.reference) : r;
};

test('every spawned hostile NPC has hits and a respawn entry', () => {
    const bad = [];
    for (const id of [...spawnedNpcIds].sort((a, b) => a - b)) {
        const n = npcs[id];
        if (!n || !n.hostility) continue;
        const why = [];
        if (!(n.hits > 0)) why.push('hits<=0');
        if (!npcRespawn[id]) why.push('no npc-respawn');
        if (why.length) bad.push(`${id} ${n.name}: ${why.join(', ')}`);
    }
    fail('hostile NPCs lacking data', bad);
});

test('drop tables only reference existing items', () => {
    const bad = [];
    for (const [key, table] of Object.entries(drops)) {
        for (const e of table) {
            if (e.reference !== undefined) {
                if (!drops[e.reference]) bad.push(`table ${key}: missing sub-table ${e.reference}`);
                continue;
            }
            for (const iid of [].concat(e.id)) if (!items[iid]) bad.push(`table ${key}: item ${iid}`);
        }
    }
    fail('drop entries with unknown items', bad);
});

test('every spawned chop object has a woodcutting definition', () => {
    const bad = [...spawnedObjectIds]
        .filter((id) => cmds(id).includes('chop') && !resolveTree(id) && !WOODCUTTING_CODE.has(id))
        .map(label);
    fail('chop objects without woodcutting data', bad);
});

test('every spawned mine/prospect object has a mining row', () => {
    const bad = [...spawnedObjectIds]
        .filter((id) => cmds(id).some((c) => c === 'mine' || c === 'prospect') && !resolveRock(id) && !MINING_ALLOW.has(id))
        .map(label);
    fail('rocks without mining data', bad);
});

test('every spawned fishing spot has a fishing row for its command', () => {
    const tools = ['net', 'bait', 'lure', 'harpoon', 'cage'];
    const bad = [];
    for (const id of spawnedObjectIds) {
        if (FISHING_ALLOW.has(id)) continue;
        for (const c of cmds(id).filter((c) => tools.includes(c))) {
            if (!resolveSpot(id, c)) bad.push(`${label(id)} command "${c}"`);
        }
    }
    fail('fishing spots without data', bad);
});

test('fishing, mining and woodcutting rows only reference existing items', () => {
    const bad = [];
    const chk = (where, iid) => {
        if (typeof iid === 'number' && !items[iid]) bad.push(`${where}: item ${iid}`);
    };
    for (const [id, s] of Object.entries(fishing.spots)) {
        for (const [cmd, d] of Object.entries(s)) {
            if (cmd === 'reference') continue;
            chk(`fishing ${id} ${cmd} tool`, d.tool);
            chk(`fishing ${id} ${cmd} bait`, d.bait);
            for (const f of Object.keys(d.fish)) chk(`fishing ${id} ${cmd} fish`, Number(f));
        }
    }
    for (const [id, r] of Object.entries(mining.rocks)) {
        if (r.reference !== undefined) continue;
        for (const o of [].concat(r.ore)) chk(`mining ${id} ore`, typeof o === 'object' ? o.id : o);
    }
    for (const [id, t] of Object.entries(woodcutting.trees)) {
        if (t.reference !== undefined) continue;
        chk(`woodcutting ${id} log`, t.log);
    }
    fail('rows with unknown items', bad);
});
