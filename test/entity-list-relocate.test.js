// model/entity-list.js: an entity that moved stays findable and removable. js-quadtree finds a point by its coordinates,
// so before relocate()/unfile() a walking NPC that left its quadtree node could not be found at its new tile, and once
// removed (killed) it stayed in the tree as a ghost occupant that blocked Character#canWalk (live: Sheep Herder).

const test = require('node:test');
const assert = require('node:assert/strict');

const EntityList = require('../src/model/entity-list');

function crowd(list, n = 500) {
    const all = [];

    for (let i = 0; i < n; i += 1) {
        const entity = { x: 500 + (i % 40), y: 500 + Math.floor(i / 40) };
        list.add(entity);
        all.push(entity);
    }

    return all;
}

test('a moved entity that was relocated is found at its new tile and nowhere else', () => {
    const list = new EntityList(2304, 7104);
    const [entity] = crowd(list).slice(10, 11);

    entity.x += 3;
    entity.y += 40;
    list.relocate(entity);

    assert.ok(list.getAtPoint(entity.x, entity.y).includes(entity));
    assert.equal(list.getAtPoint(entity.x - 3, entity.y - 40).includes(entity), false);
    assert.equal(list.quadTree.getAllPoints().length, 500);
});

test('removing an entity that moved without being relocated leaves no ghost in the tree', () => {
    const list = new EntityList(2304, 7104);
    const all = crowd(list);
    const entity = all[10];

    entity.x += 3;
    entity.y += 40;
    assert.equal(list.remove(entity), true);

    assert.equal(list.quadTree.getAllPoints().includes(entity), false);
    assert.equal(list.quadTree.getAllPoints().length, 499);
    assert.equal(list.getAtPoint(entity.x, entity.y).includes(entity), false);
});

test('relocate ignores an entity that is not in the list', () => {
    const list = new EntityList(2304, 7104);
    crowd(list, 10);
    const stranger = { x: 1, y: 1, index: 3 };
    list.relocate(stranger);
    assert.equal(list.quadTree.getAllPoints().length, 10);
});
