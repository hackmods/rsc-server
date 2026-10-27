// Treasure trails: every clue step in src/clues/steps.json points at something
// that is really in the world (rsc-data spawns and objects), and the reward
// and drop tables only name real items.

const test = require('node:test');
const assert = require('node:assert/strict');

const itemDefs = require('@2003scape/rsc-data/config/items.json');
const npcDefs = require('@2003scape/rsc-data/config/npcs.json');
const objectDefs = require('@2003scape/rsc-data/config/objects.json');
const npcSpawns = require('@2003scape/rsc-data/locations/npcs.json');
const objectSpawns = require('@2003scape/rsc-data/locations/objects.json');
const arscLocations = require('../src/arsc-locations');

const { steps, minimumSteps } = require('../src/clues/steps.json');

const TIERS = ['easy', 'medium', 'hard'];
const TYPES = ['dig', 'talk', 'search', 'kill'];

// ground floor only: y >= 944 is an upper floor or a dungeon
const PLANE_HEIGHT = 944;

const allNpcSpawns = npcSpawns.concat(arscLocations.npcs || []);
const allObjectSpawns = objectSpawns.concat(arscLocations.gameObjects || []);

function chebyshev(a, b) {
    return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

test('every step has a unique id, a tier, a type and text', () => {
    const ids = new Set();

    for (const step of steps) {
        assert.ok(step.id && !ids.has(step.id), `duplicate or missing id ${step.id}`);
        ids.add(step.id);
        assert.ok(TIERS.includes(step.tier), `${step.id}: tier ${step.tier}`);
        assert.ok(TYPES.includes(step.type), `${step.id}: type ${step.type}`);
        assert.ok(Number.isInteger(step.x) && Number.isInteger(step.y), `${step.id}: x, y`);
        assert.ok(typeof step.text === 'string' && step.text.length >= 20, `${step.id}: text`);
        assert.ok(step.text.length <= 240, `${step.id}: text too long for the message box`);
    }
});

test('each tier has enough steps', () => {
    for (const tier of TIERS) {
        const count = steps.filter((step) => step.tier === tier).length;
        assert.ok(count >= minimumSteps, `${tier} has ${count} steps, wants ${minimumSteps}`);
    }
});

test('kill steps are hard only, and hard steps say why they are dangerous', () => {
    for (const step of steps) {
        if (step.type === 'kill') {
            assert.equal(step.tier, 'hard', `${step.id}: kill steps are hard tier`);
        }

        if (step.tier === 'hard') {
            assert.ok(step.danger && step.danger.length > 5, `${step.id}: hard step needs danger`);
        }
    }
});

test('dig steps are on the ground floor', () => {
    for (const step of steps.filter((s) => s.type === 'dig')) {
        assert.ok(step.y < PLANE_HEIGHT, `${step.id}: dig on plane 0`);
    }
});

test('talk and kill steps name an NPC that spawns near the step', () => {
    for (const step of steps.filter((s) => s.type === 'talk' || s.type === 'kill')) {
        const def = npcDefs[step.npc];
        assert.ok(def, `${step.id}: npc ${step.npc} exists`);

        if (step.type === 'kill') {
            assert.ok(def.hostility, `${step.id}: ${def.name} can be attacked`);
        }

        const radius = step.radius || 0;
        const near = allNpcSpawns.some(
            (spawn) => spawn.id === step.npc && chebyshev(spawn, step) <= radius
        );

        assert.ok(near, `${step.id}: no ${def.name} (${step.npc}) spawn within ${radius} of ${step.x},${step.y}`);
    }
});

test('search steps name an object at that exact tile with that command', () => {
    for (const step of steps.filter((s) => s.type === 'search')) {
        const def = objectDefs[step.object];
        assert.ok(def, `${step.id}: object ${step.object} exists`);

        const here = allObjectSpawns.some(
            (spawn) => spawn.id === step.object && spawn.x === step.x && spawn.y === step.y
        );

        assert.ok(here, `${step.id}: no ${def.name} (${step.object}) at ${step.x},${step.y}`);

        const commands = (def.commands || []).map((c) => c.toLowerCase());
        assert.ok(
            commands.includes(step.command.toLowerCase()),
            `${step.id}: ${def.name} has no "${step.command}" option (${commands.join(', ')})`
        );
    }
});

test('no two steps share a target', () => {
    const seen = new Set();

    for (const step of steps) {
        const key = `${step.type}:${step.npc ?? step.object ?? ''}:${step.x},${step.y}`;
        assert.ok(!seen.has(key), `${step.id}: same target as another step`);
        seen.add(key);
    }
});

test('reward and drop tables name real items', () => {
    const clues = require('../src/clues');
    const { rewards } = clues;

    for (const tier of TIERS) {
        const tables = [rewards[tier].common, (rewards[tier].supplies || {}).table || [], (rewards[tier].rare || {}).table || []];

        for (const entry of tables.flat()) {
            assert.ok(itemDefs[entry.id] || clues.ITEMS[entry.id], `${tier}: item ${entry.id}`);
            assert.ok(entry.weight > 0, `${tier}: item ${entry.id} weight`);
        }
    }
});
