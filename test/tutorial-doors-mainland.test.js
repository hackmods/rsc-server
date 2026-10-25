const test = require('node:test');
const assert = require('node:assert/strict');

const t = require('../src/plugins/tutorial/core');
const doors = require('../src/plugins/tutorial/doors');

function fakePlayer({ cache = {} } = {}) {
    return {
        cache,
        messages: [],
        doorsEntered: 0,
        message(...lines) {
            this.messages.push(...lines);
        },
        async enterDoor() {
            this.doorsEntered += 1;
        }
    };
}

// mainland copies of the tutorial wall ids (rsc-data placements from traversal.json)
const MAINLAND = [
    [75, 463, 681], [76, 439, 694], [77, 463, 676], [78, 448, 682], [80, 459, 674],
    [81, 472, 674], [82, 567, 484], [83, 360, 3425], [84, 355, 3353], [88, 509, 3441],
    [90, 512, 3441]
];

test('mainland copies of tutorial wall ids fall through to other plugins', async () => {
    for (const [id, x, y] of MAINLAND) {
        for (const stage of [-1, 0, 100]) {
            const player = fakePlayer({ cache: stage < 0 ? {} : { tutorial: stage } });
            const wall = { id, x, y, direction: 0 };
            assert.equal(await doors.onWallObjectCommandOne(player, wall), false, `wall ${id} at ${x},${y} claimed`);
            assert.equal(player.doorsEntered, 0, `wall ${id} at ${x},${y} entered`);
            assert.deepEqual(player.messages, [], `wall ${id} at ${x},${y} messaged`);
        }
    }
});

test('tutorial wall ids at their tutorial tiles are still claimed', async () => {
    for (const door of t.DOORS) {
        const wall = { id: door.id, x: door.x, y: door.y, direction: 0 };

        const early = fakePlayer({ cache: { tutorial: door.stage - 1 } });
        assert.equal(await doors.onWallObjectCommandOne(early, wall), true);
        assert.deepEqual(early.messages, [door.refusal]);
        assert.equal(early.doorsEntered, 0);

        const ready = fakePlayer({ cache: { tutorial: door.stage } });
        assert.equal(await doors.onWallObjectCommandOne(ready, wall), true);
        assert.equal(ready.doorsEntered, 1, `door ${door.id} stayed shut`);
    }
});

test('a non-tutorial player at a tutorial tile is let through as before', async () => {
    const door = t.DOORS[0];
    const player = fakePlayer();
    const wall = { id: door.id, x: door.x, y: door.y, direction: 0 };
    assert.equal(await doors.onWallObjectCommandOne(player, wall), true);
    assert.equal(player.doorsEntered, 1);
});
