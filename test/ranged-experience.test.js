// A kill made with a bow pays ranged experience (NPC#die): Character#damage records ranged damage when
// Player#shootRanged passes ranged = true, and die() splits the kill's experience by how the victor dealt it.

const test = require('node:test');
const assert = require('node:assert');

const NPC = require('../src/model/npc');

const CHICKEN_ID = 3;

function makeWorld(victor) {
    return {
        members: true,
        players: { getByID: (id) => (id === victor.id ? victor : undefined) },
        callPlugin: async () => false,
        addPlayerDrop() {},
        removeEntity() {}
    };
}

function makeVictor(combatStyle = 1) {
    const xp = {};
    return {
        id: 7,
        xp,
        combatStyle,
        retreat() {},
        sendSound() {},
        addExperience(skill, amount) {
            xp[skill] = (xp[skill] || 0) + amount;
        }
    };
}

async function kill(victor, hits) {
    const npc = new NPC(makeWorld(victor), { id: CHICKEN_ID, x: 0, y: 0, minX: 0, maxX: 0, minY: 0, maxY: 0 });
    const total = npc.getCombatExperience();
    npc.skills.hits.current = hits.length;
    npc.broadcastDamage = () => {};
    for (const ranged of hits) npc.damage(1, victor, ranged);
    // die() pays out in callPlugin's then()
    await new Promise((resolve) => setImmediate(resolve));
    return total;
}

test('a bow kill pays all the experience into ranged, none into hits', async () => {
    const victor = makeVictor();
    const total = await kill(victor, [true, true, true]);
    assert.ok(total > 0);
    assert.strictEqual(victor.xp.ranged, total);
    assert.strictEqual(victor.xp.hits, 0);
    assert.strictEqual(victor.xp.strength, 0);
});

test('a melee kill pays no ranged experience (aggressive: hits + 3x strength)', async () => {
    const victor = makeVictor(1);
    const total = await kill(victor, [false, false, false]);
    const quarter = Math.floor(total / 4);
    assert.strictEqual(victor.xp.ranged, undefined);
    assert.strictEqual(victor.xp.hits, quarter);
    assert.strictEqual(victor.xp.strength, quarter * 3);
});

test('a mixed kill splits by damage dealt', async () => {
    const victor = makeVictor(2);
    const total = await kill(victor, [true, false, false, false]);
    assert.strictEqual(victor.xp.ranged, Math.floor(total / 4));
    assert.strictEqual(victor.xp.hits, Math.floor((total * 3) / 4 / 4));
    assert.strictEqual(victor.xp.attack, Math.floor((total * 3) / 4 / 4) * 3);
});
