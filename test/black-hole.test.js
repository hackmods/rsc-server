// Thordur's Black Hole Experience: Thordur sells the disk, the ladder needs it, spinning works only in the hole and
// takes you out, and the disk cannot be dropped while you are in there.

const test = require('node:test');
const assert = require('node:assert');

const plugins = require('../src/plugins');
const arscLocations = require('../src/arsc-locations');
const blackHole = require('../src/plugins/miniquests/black-hole');
const climbable = require('../src/plugins/game-objects/climbable');

const COINS_ID = 10;
const DISK_ID = 387;

function makeWorld(thordur = null) {
    return {
        npcs: { getByID: (id) => (id === 175 ? thordur : undefined) },
        async sleepTicks() {}
    };
}

function makePlayer({ x = 311, y = 3348, items = [], choices = [], world = makeWorld() } = {}) {
    const bag = items.map(([id, amount = 1]) => ({ id, amount }));
    const queue = [...choices];

    return {
        x,
        y,
        world,
        messages: [],
        said: [],
        teleports: [],
        inventory: {
            items: bag,
            has(id, amount = 1) {
                return bag.filter((i) => i.id === id).reduce((n, i) => n + i.amount, 0) >= amount;
            },
            add(id, amount = 1) {
                bag.push({ id, amount });
            },
            remove(id, amount = 1) {
                const item = bag.find((i) => i.id === id);
                item.amount -= amount;
                if (item.amount <= 0) bag.splice(bag.indexOf(item), 1);
            }
        },
        engage() {},
        disengage() {},
        message(text) {
            this.messages.push(text);
        },
        async say(...lines) {
            this.said.push(...lines);
        },
        async ask(options, repeat) {
            const choice = queue.length ? queue.shift() : options.length - 1;
            if (repeat) this.said.push(options[choice]);
            return choice;
        },
        teleport(tx, ty) {
            this.teleports.push({ x: tx, y: ty });
            this.x = tx;
            this.y = ty;
        }
    };
}

function makeThordur() {
    return { id: 175, said: [], async say(...lines) { this.said.push(...lines); } };
}

const LADDER = { id: 199, definition: { name: 'Ladder', commands: ['Climb-Down', 'Examine'] } };

test('listed in plugins/index.js and Thordur and his ladder are placed', () => {
    assert.ok(Object.values(plugins).includes(blackHole));
    assert.ok(arscLocations.npcs.some((n) => n.id === 175));
    assert.ok(arscLocations.gameObjects.some((o) => o.id === 199));
});

test('Thordur sells a disk for 10 coins', async () => {
    const player = makePlayer({ items: [[COINS_ID, 25]], choices: [0, 0] });
    const thordur = makeThordur();

    assert.strictEqual(await blackHole.onTalkToNPC(player, thordur), true);
    assert.ok(player.inventory.has(DISK_ID));
    assert.ok(player.inventory.has(COINS_ID, 15) && !player.inventory.has(COINS_ID, 16));
    assert.ok(player.messages.includes('You pay the dwarf ten coins and get given a disk'));
});

test('Thordur gives nothing without 10 coins, or when declined', async () => {
    const broke = makePlayer({ items: [[COINS_ID, 9]], choices: [0, 0] });
    await blackHole.onTalkToNPC(broke, makeThordur());
    assert.ok(!broke.inventory.has(DISK_ID));
    assert.ok(broke.inventory.has(COINS_ID, 9));

    const declined = makePlayer({ items: [[COINS_ID, 25]], choices: [1] });
    assert.strictEqual(await blackHole.onTalkToNPC(declined, makeThordur()), true);
    assert.ok(!declined.inventory.has(DISK_ID));

    assert.strictEqual(await blackHole.onTalkToNPC(declined, { id: 0 }), false);
});

test('the ladder takes a player with a disk into the hole', async () => {
    const player = makePlayer({ items: [[DISK_ID]] });

    assert.strictEqual(await blackHole.onGameObjectCommandOne(player, LADDER), true);
    assert.strictEqual(player.teleports.length, 1);
    assert.ok(blackHole.inBlackHole(player));
    assert.strictEqual(await climbable.onGameObjectCommandOne(player, LADDER), false, 'climbable leaves it alone');
});

test('the ladder without a disk gets Thordur\'s warning and no trip', async () => {
    const thordur = makeThordur();
    const player = makePlayer({ world: makeWorld(thordur), choices: [1] });

    assert.strictEqual(await blackHole.onGameObjectCommandOne(player, LADDER), true);
    assert.deepStrictEqual(player.teleports, []);
    assert.ok(thordur.said[0].startsWith("Hey careful that's the ladder"));
});

test('spinning the disk in the hole takes you out and uses it up', async () => {
    const player = makePlayer({ x: 305, y: 3300, items: [[DISK_ID]] });

    assert.strictEqual(await blackHole.onInventoryCommand(player, { id: DISK_ID }), true);
    assert.deepStrictEqual(player.teleports, [{ x: 311, y: 3348 }]);
    assert.ok(!player.inventory.has(DISK_ID));
});

test('spinning the disk anywhere else does nothing', async () => {
    const player = makePlayer({ items: [[DISK_ID]] });

    assert.strictEqual(await blackHole.onInventoryCommand(player, { id: DISK_ID }), true);
    assert.deepStrictEqual(player.teleports, []);
    assert.ok(player.inventory.has(DISK_ID));
    assert.deepStrictEqual(player.messages, ["The disk will only work from in Thordur's black hole"]);
    assert.strictEqual(await blackHole.onInventoryCommand(player, { id: COINS_ID }), false);
});

test('the disk cannot be dropped in the hole, only outside it', async () => {
    const inside = makePlayer({ x: 303, y: 3302, items: [[DISK_ID]] });
    assert.strictEqual(await blackHole.onDropItem(inside, { id: DISK_ID }), true, 'drop blocked');
    assert.strictEqual(await blackHole.onDropItem(inside, { id: COINS_ID }), false, 'other items drop');

    const outside = makePlayer({ items: [[DISK_ID]] });
    assert.strictEqual(await blackHole.onDropItem(outside, { id: DISK_ID }), false);
});
