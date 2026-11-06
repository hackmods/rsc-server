// Entity.getNearbyEntitiesWithinRadius: Open-RSC's radius, where getNearbyEntitiesByID's `range` is a box side
// (EntityList.getInArea), so it reaches only range / 2. Live, Biohazard's door mourner (492) 7 tiles off was not found at
// "10" and the mourners' headquarters door did nothing.

const test = require('node:test');
const assert = require('node:assert/strict');
const Entity = require('../src/model/entity');
const EntityList = require('../src/model/entity-list');

function placed(world, id, x, y, tag) {
    const npc = new Entity(world);
    Object.assign(npc, { id, x, y, tag });
    world.npcs.add(npc);
    return npc;
}

test('a radius of 10 finds an npc 7 tiles off, where the box lookup of the same number does not', () => {
    const world = { npcs: new EntityList(2000, 4000) };
    const player = new Entity(world);
    Object.assign(player, { x: 633, y: 573 });
    placed(world, 492, 626, 578, 1); // the door mourner, as seen live
    placed(world, 492, 620, 573, 2); // 13 tiles off: outside either
    assert.deepEqual(player.getNearbyEntitiesByID('npcs', 492, 10).map((n) => n.tag), []);
    assert.deepEqual(player.getNearbyEntitiesWithinRadius('npcs', 492, 10).map((n) => n.tag), [1]);
    assert.deepEqual(player.getNearbyEntitiesWithinRadius('npcs', 492, 13).map((n) => n.tag).sort(), [1, 2]);
    assert.deepEqual(player.getNearbyEntitiesWithinRadius('npcs', 445, 13), []);
});
