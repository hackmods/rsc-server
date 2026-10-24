// Every registered hook that acts must return true. World#callPlugin stops at the first true; a hook that does the work
// and returns false/undefined lets the next handler run too, and the packet handler then adds "Nothing interesting
// happens" (woodcutting did this on every chop). hooks-claim.test.js pins the five known cases; this one sweeps every
// plugin, so a new handler that forgets its `return` fails here.
//
// Each hook is called, as World#loadPlugins registers it, against every candidate rsc-data offers it: item commands,
// object and wall-object commands on placed instances, NPC talk and commands. The player and world are recording stubs
// (every property exists, every call returns another stub). A handler "acted" when it called one of SIDE_EFFECTS; acting
// and then returning falsy fails. Throws and timeouts are not judged here (a stub can break a handler's internals).
// The same probe, with more candidates, is Autonomous-RSC's scripts/audit-server-gaps.js.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const flat = require('flat');

const items = require('@2003scape/rsc-data/config/items');
const objects = require('@2003scape/rsc-data/config/objects');
const wallObjects = require('@2003scape/rsc-data/config/wall-objects');
const npcs = require('@2003scape/rsc-data/config/npcs');
const objectLocations = require('@2003scape/rsc-data/locations/objects');
const wallObjectLocations = require('@2003scape/rsc-data/locations/wall-objects');
const npcLocations = require('@2003scape/rsc-data/locations/npcs');

const pluginFiles = require('../src/plugins');

const SIDE_EFFECTS = /^(message|say|ask|addExperience|add|remove|sendSound|sendBubble|replaceEntity|teleport|openShop|sendStats|addQuestPoints|attack|chase)$/;
// quest stages tried: a quest handler may act only at some of them
const STAGES = [0, -1, 1, 2, 3, 4, 5];
// instances tried per object id: enough for handlers keyed by coordinates on a few tiles
const INSTANCES = 3;
const CALL_TIMEOUT_MS = 100;
const INERT = /^(examine|walkto)$/i;
// stub accesses per call; dialogue that loops on the stub's answers (osman.js re-asks forever) stops here
const STEP_BUDGET = 20000;

// handlers allowed to act and still pass the click on (none today); key: "<plugin key> <candidate>"
const ALLOWED = new Set();

const worldSource = fs.readFileSync(path.join(__dirname, '../src/model/world.js'), 'utf8');
const PLUGIN_TYPES = [.../const PLUGIN_TYPES = \[([\s\S]*?)\]/.exec(worldSource)[1].matchAll(/'(\w+)'/g)].map((m) => m[1]);

const handlers = Object.entries(flat(pluginFiles))
    .filter(([, fn]) => typeof fn === 'function' && PLUGIN_TYPES.includes(fn.name))
    .map(([key, fn]) => ({ key, fn }));

let seed = 1;

class Budget extends Error {}

function makeStubs(stage) {
    const acted = new Set();
    let steps = 0;
    const tick = () => {
        if (++steps > STEP_BUDGET) throw new Budget();
    };

    function stub(overlay = {}, thenable = false, name = '') {
        return new Proxy(() => {}, {
            get(target, prop) {
                tick();
                if (prop === 'then') return thenable ? (resolve) => resolve(stub()) : undefined;
                if (prop === Symbol.toPrimitive) return (hint) => (hint === 'string' ? '' : 0);
                if (prop === Symbol.iterator) return function* empty() {};
                if (Object.prototype.hasOwnProperty.call(overlay, prop)) return overlay[prop];
                if (typeof prop === 'symbol') return undefined;
                overlay[prop] = stub({}, false, prop);
                return overlay[prop];
            },
            set(target, prop, value) {
                tick();
                overlay[prop] = value;
                return true;
            },
            apply() {
                tick();
                if (SIDE_EFFECTS.test(name)) acted.add(name);
                return stub({}, true);
            },
            construct: () => stub(),
            has: () => true
        });
    }

    const skills = new Proxy({}, { get: (t, p) => (typeof p === 'string' ? (t[p] ||= { current: 99, base: 99 }) : undefined) });
    const questStages = new Proxy({}, { get: (t, p) => (p in t ? t[p] : stage), set: (t, p, v) => ((t[p] = v), true) });
    const world = stub({ members: true });
    const player = stub({ world, skills, questStages, username: 'probe', ask: async () => (acted.add('ask'), 0) });

    return { player, world, acted, entity: (fields) => stub({ world, ...fields }) };
}

/** @returns {Promise<string|null>} "acted (...) but returned x" when the hook falls through after acting */
async function fallsThrough(handler, makeArgs, stage) {
    seed = 1;
    const stubs = makeStubs(stage);
    let timer;
    try {
        const result = await Promise.race([
            Promise.resolve().then(() => handler.fn.apply(stubs.world, makeArgs(stubs))),
            new Promise((resolve) => (timer = setTimeout(() => resolve('timeout'), CALL_TIMEOUT_MS)))
        ]);
        if (result === 'timeout' || result) return null;
        return stubs.acted.size ? `acted (${[...stubs.acted].join(', ')}) but returned ${result}` : null;
    } catch (e) {
        return null;
    } finally {
        clearTimeout(timer);
    }
}

function byId(locations) {
    const map = new Map();
    for (const loc of locations) {
        if (!map.has(loc.id)) map.set(loc.id, []);
        map.get(loc.id).push(loc);
    }
    return map;
}

function candidates() {
    const out = [];
    items.forEach((def, id) => {
        if (def.command && def.command.trim()) {
            out.push({ hook: 'onInventoryCommand', label: `item ${id} ${def.command}`, args: (s) => [s.player, s.entity({ id, amount: 1, definition: def })] });
        }
    });
    for (const [defs, locations, hook, kind] of [
        [objects, byId(objectLocations), 'onGameObjectCommand', 'object'],
        [wallObjects, byId(wallObjectLocations), 'onWallObjectCommand', 'wall object']
    ]) {
        defs.forEach((def, id) => {
            const placed = (locations.get(id) || []).slice(0, INSTANCES);
            (def.commands || []).slice(0, 2).forEach((command, slot) => {
                if (!command || INERT.test(command)) return;
                for (const loc of placed) {
                    out.push({
                        hook: `${hook}${slot ? 'Two' : 'One'}`,
                        label: `${kind} ${id} "${command}" at ${loc.x},${loc.y}`,
                        args: (s) => [s.player, s.entity({ id, x: loc.x, y: loc.y, direction: loc.direction, definition: def })]
                    });
                }
            });
        });
    }
    const npcPlaced = byId(npcLocations);
    npcs.forEach((def, id) => {
        const loc = (npcPlaced.get(id) || [])[0];
        if (!loc) return;
        const args = (s) => [s.player, s.entity({ id, x: loc.x, y: loc.y, definition: def })];
        out.push({ hook: 'onTalkToNPC', label: `npc ${id} talk`, args });
        if (def.command && def.command.trim()) out.push({ hook: 'onNPCCommand', label: `npc ${id} ${def.command}`, args });
    });
    return out;
}

test('no registered hook acts and then falls through', async () => {
    const realRandom = Math.random;
    Math.random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const failures = [];
    try {
        for (const candidate of candidates()) {
            for (const handler of handlers.filter((h) => h.fn.name === candidate.hook)) {
                for (const stage of STAGES) {
                    const why = await fallsThrough(handler, candidate.args, stage);
                    if (why && !ALLOWED.has(`${handler.key} ${candidate.label}`)) {
                        failures.push(`${handler.key} on ${candidate.label} (quest stage ${stage}): ${why}`);
                        break;
                    }
                }
            }
        }
    } finally {
        Math.random = realRandom;
    }
    assert.deepStrictEqual(failures, [], `return true from these hooks:\n${failures.join('\n')}`);
});

test('the sweep reaches the plugins (sanity)', () => {
    assert.ok(handlers.length > 200, `only ${handlers.length} handlers registered`);
    assert.ok(handlers.some((h) => h.fn.name === 'onGameObjectCommandOne' && /woodcutting/.test(h.key)));
});
