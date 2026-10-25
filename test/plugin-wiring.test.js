// Plugin wiring: checks that every plugin file is live. World#loadPlugins registers a function only when its name is in
// PLUGIN_TYPES (src/model/world.js), and only the files listed in src/plugins/index.js are loaded. A hook with a typo, a
// file left out of the index, a registered file with nothing in it, or a PLUGIN_TYPES name that nothing dispatches all
// fail silently. hook-returns.test.js checks that live hooks return true; this file checks that they are live at all.
//
// (a) every exported function named on[A-Z]... under src/plugins has fn.name in PLUGIN_TYPES, or is in INTERNAL_ON
//     (code that calls it directly, never through callPlugin).
// (b) every file listed in index.js exports at least one function, except EMPTY_OK.
// (c) every .js under src/plugins is listed in index.js, except INDEX_EXEMPT.
// (d) every PLUGIN_TYPES name is dispatched. Dispatch comes from three places, all collected from src/ by grep:
//     1. literal callPlugin('name') calls (`\.callPlugin\(\s*'(\w+)'`);
//     2. literal lookups of the registry (`plugins.get('name')`, world-admin.js does this for onTalkToNPC);
//     3. dynamic dispatchers: a callPlugin whose name is a variable. The grep for `.callPlugin(` with a variable first
//        argument must find exactly the sites in DYNAMIC_DISPATCH (adding one fails until it is listed there), and each
//        wrapper's literal call sites (`gameObjectCommand('name'`) supply the names.
//    Every literal name must also be a PLUGIN_TYPES name, so a typo in a dispatch site fails too.
//
// Each allowlist also fails when an entry no longer applies, so the lists shrink as the code is fixed.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const flat = require('flat');

const SRC = path.join(__dirname, '../src');
const PLUGIN_DIR = path.join(SRC, 'plugins');
const INDEX = path.join(PLUGIN_DIR, 'index.js');

// on* exports the code calls by name (player.js, command.js, tutorial/doors.js ...): "<file>:<export>". Verified by grep:
// woodcutting's onGameObjectCommand, onWallObjectCommand and onJungleGameObjectCommand are file-local, not exported, so
// they are not listed (a later export of one of them would fail (a) until it is added here).
const INTERNAL_ON = new Set([
    'tutorial/core.js:onTutorial',
    'tutorial/core.js:onFirstLogin',
    'tutorial/core.js:onDeath',
    'tutorial/core.js:onWake'
]);

// files in index.js that export no function on purpose. casket.js, dummy.js and the other filled files are not here.
const EMPTY_OK = new Set([
    'items/scrumpled-piece-of-paper.js',
    'items/war-ship.js',
    'npcs/tree-gnome-stronghold/gnome-child.js',
    'npcs/tree-gnome-stronghold/gnome-local.js',
    'npcs/yanille/sidney-smith.js',
    'quests/members/fishing-contest.js',
    'quests/members/legends-quest.js',
    'quests/members/witchs-house.js'
]);

// files under src/plugins that index.js does not load: tutorial/core.js is a library that other files require directly
const INDEX_EXEMPT = new Set(['tutorial/core.js']);

// callPlugin calls whose name is a variable: "<file under src>:<variable>" -> the wrapper function that receives the name
// as its first argument. The wrapper's literal call sites are the dispatched names.
const DYNAMIC_DISPATCH = new Map([
    ['packet-handlers/game-object.js:pluginHandler', 'gameObjectCommand'],
    ['packet-handlers/wall-object.js:pluginHandlerName', 'wallObjectCommand']
]);

const worldSource = fs.readFileSync(path.join(SRC, 'model/world.js'), 'utf8');
const PLUGIN_TYPES = [...(/const PLUGIN_TYPES = \[([\s\S]*?)\]/.exec(worldSource)[1]).matchAll(/'(\w+)'/g)].map((m) => m[1]);

function walk(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return walk(full);
        return entry.name.endsWith('.js') ? [full] : [];
    });
}

// path relative to base, with forward slashes: "items/oyster.js"
const rel = (file, base = PLUGIN_DIR) => path.relative(base, file).split(path.sep).join('/');

// "items/oyster.js" -> "items.oyster", the form the index keys use
const dotted = (r) => r.replace(/\.js$/, '').split('/').join('.');

// [name, fn] for each function a module exports. A module that is a bare function (dummy.js) is named by the function.
function exportedFns(mod) {
    if (typeof mod === 'function') return [[mod.name, mod]];
    return Object.entries(flat(mod)).filter(([, value]) => typeof value === 'function');
}

const indexSource = fs.readFileSync(INDEX, 'utf8');
const indexed = [...indexSource.matchAll(/require\('(\.\/[^']+)'\)/g)].map((m) => rel(path.resolve(PLUGIN_DIR, m[1])));
const load = (r) => require(path.join(PLUGIN_DIR, r));
const pluginFiles = walk(PLUGIN_DIR).filter((file) => file !== INDEX);

test('index.js lists every require it makes (the regex sees them all)', () => {
    assert.strictEqual(indexed.length, (indexSource.match(/require\(/g) || []).length);
});

test('every exported on* function under src/plugins is a PLUGIN_TYPES name or INTERNAL_ON', () => {
    const failures = [];
    const seenInternal = new Set();
    for (const file of pluginFiles) {
        const r = rel(file);
        for (const [key, fn] of exportedFns(require(file))) {
            const name = key.split('.').pop();
            if (!/^on[A-Z]/.test(name)) continue;
            if (PLUGIN_TYPES.includes(fn.name)) continue;
            if (INTERNAL_ON.has(`${r}:${name}`)) {
                seenInternal.add(`${r}:${name}`);
                continue;
            }
            failures.push(`${dotted(r)} exports ${name} (fn.name ${fn.name}): not in PLUGIN_TYPES, so it never runs`);
        }
    }
    const stale = [...INTERNAL_ON].filter((entry) => !seenInternal.has(entry));
    assert.deepStrictEqual(
        [...failures, ...stale.map((entry) => `INTERNAL_ON entry no longer exported: ${entry}`)],
        []
    );
});

test('every file listed in index.js exports a function, except EMPTY_OK', () => {
    const failures = [];
    for (const r of indexed) {
        if (EMPTY_OK.has(r)) continue;
        if (exportedFns(load(r)).length === 0) failures.push(`${dotted(r)} is registered but exports no function`);
    }
    const stale = [...EMPTY_OK].filter((r) => !indexed.includes(r) || exportedFns(load(r)).length > 0);
    assert.deepStrictEqual(
        [...failures, ...stale.map((r) => `EMPTY_OK entry no longer empty or not listed: ${r}`)],
        []
    );
});

test('every .js under src/plugins is listed in index.js, except INDEX_EXEMPT', () => {
    const listed = new Set(indexed);
    const unlisted = walk(PLUGIN_DIR)
        .map((file) => rel(file))
        .filter((r) => r !== 'index.js' && !listed.has(r) && !INDEX_EXEMPT.has(r))
        .map((r) => `${dotted(r)} is not required by index.js, so it is never loaded`);
    const stale = [...INDEX_EXEMPT].filter((r) => listed.has(r)).map((r) => `INDEX_EXEMPT entry is listed in index.js: ${r}`);
    assert.deepStrictEqual([...unlisted, ...stale], []);
});

test('every PLUGIN_TYPES name is dispatched somewhere in src', () => {
    const sources = walk(SRC).map((file) => fs.readFileSync(file, 'utf8'));
    const literal = new Set();
    const collect = (re, text) => {
        for (const m of text.matchAll(re)) literal.add(m[1]);
    };

    for (const text of sources) {
        collect(/\.callPlugin\(\s*'(\w+)'/g, text);
        collect(/\.plugins\.get\(\s*'(\w+)'\s*\)/g, text);
    }
    for (const wrapper of new Set(DYNAMIC_DISPATCH.values())) {
        const re = new RegExp(`\\b${wrapper}\\(\\s*'(\\w+)'`, 'g');
        for (const text of sources) collect(re, text);
    }

    // the dynamic sites: every callPlugin whose first argument is a variable, by file and variable name
    const dynamic = new Set();
    for (const file of walk(SRC)) {
        const text = fs.readFileSync(file, 'utf8');
        for (const m of text.matchAll(/\.callPlugin\(\s*([A-Za-z_$][\w$]*)/g)) dynamic.add(`${rel(file, SRC)}:${m[1]}`);
    }
    assert.deepStrictEqual([...dynamic].sort(), [...DYNAMIC_DISPATCH.keys()].sort(), 'dynamic callPlugin sites changed');

    const unknown = [...literal].filter((name) => !PLUGIN_TYPES.includes(name));
    assert.deepStrictEqual(unknown, [], 'dispatched names that are not in PLUGIN_TYPES');

    const undispatched = PLUGIN_TYPES.filter((name) => !literal.has(name));
    assert.deepStrictEqual(undispatched, [], 'PLUGIN_TYPES names nothing dispatches');
});
