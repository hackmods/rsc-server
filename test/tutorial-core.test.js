const test = require('node:test');
const assert = require('node:assert/strict');

const t = require('../src/plugins/tutorial/core');
const doors = require('../src/plugins/tutorial/doors');
const objects = require('../src/plugins/tutorial/objects');
const combat = require('../src/plugins/tutorial/combat');

function fakePlayer({ cache = {}, items = [], loginDate = 0, arscBot = false } = {}) {
    const player = {
        cache,
        loginDate,
        socket: { arscBot },
        x: 122,
        y: 657,
        messages: [],
        teleports: [],
        saved: 0,
        doorsEntered: 0,
        xp: {},
        skills: { fishing: { experience: 0 } },
        world: { sleepTicks: async () => {} },
        inventory: {
            items: items.map((id) => ({ id, amount: 1 })),
            has(id, amount = 1) {
                const item = this.items.find((i) => i.id === id);
                return !!item && item.amount >= amount;
            },
            add(id, amount = 1) {
                this.items.push({ id, amount });
            },
            remove(id) {
                const index = this.items.findIndex((i) => i.id === id);
                if (index > -1) this.items.splice(index, 1);
            }
        },
        message(...lines) {
            this.messages.push(...lines);
        },
        teleport(x, y) {
            this.teleports.push([x, y]);
            this.x = x;
            this.y = y;
        },
        async save() {
            this.saved += 1;
        },
        async enterDoor() {
            this.doorsEntered += 1;
        },
        addExperience(skill, amount) {
            this.xp[skill] = (this.xp[skill] || 0) + amount;
        },
        sendSound() {},
        sendBubble() {}
    };

    return player;
}

test('a human first login starts on the island at stage 0', () => {
    const player = fakePlayer();
    t.onFirstLogin(player);
    assert.equal(player.cache.tutorial, 0);
    assert.deepEqual([player.x, player.y], [t.START.x, t.START.y]);
    assert.ok(t.inBounds(player.x, player.y));
});

test('bots and existing accounts are never moved', () => {
    const bot = fakePlayer({ arscBot: true });
    t.onFirstLogin(bot);
    assert.equal(bot.cache.tutorial, undefined);
    assert.deepEqual([bot.x, bot.y], [122, 657]);

    const old = fakePlayer({ loginDate: Date.now() });
    t.onFirstLogin(old);
    assert.equal(old.cache.tutorial, undefined);

    const done = fakePlayer({ cache: { tutorialDone: 1 } });
    t.onFirstLogin(done);
    assert.equal(done.cache.tutorial, undefined);
});

test('stages only move forward and only on the tutorial', () => {
    const player = fakePlayer({ cache: { tutorial: 20 } });
    t.setStage(player, 15);
    assert.equal(t.stage(player), 20);
    t.setStage(player, 25);
    assert.equal(t.stage(player), 25);

    const outsider = fakePlayer();
    t.setStage(outsider, 50);
    assert.equal(t.stage(outsider), -1);
});

test('every gated door refuses below its stage and opens at it', async () => {
    for (const door of t.DOORS) {
        const early = fakePlayer({ cache: { tutorial: door.stage - 1 } });
        assert.equal(await doors.onWallObjectCommandOne(early, door), true);
        assert.equal(early.doorsEntered, 0, `door ${door.id} opened early`);
        assert.deepEqual(early.messages, [door.refusal]);

        const ready = fakePlayer({ cache: { tutorial: door.stage } });
        await doors.onWallObjectCommandOne(ready, door);
        assert.equal(ready.doorsEntered, 1, `door ${door.id} stayed shut`);
    }
});

test('doors elsewhere are left to the normal door plugins', async () => {
    const player = fakePlayer({ cache: { tutorial: 0 } });
    const other = { id: 2, x: 120, y: 650 };
    assert.equal(await doors.onWallObjectCommandOne(player, other), false);
    // a tutorial door id on the wrong tile is not a tutorial door
    assert.equal(
        await doors.onWallObjectCommandOne(player, { id: 75, x: 1, y: 1 }),
        false
    );
});

test('cooking: first meat always burns (25 -> 30), second cooks (30 -> 31)', async () => {
    const range = { id: 491 };
    const meat = { id: t.ITEM.RAW_RAT_MEAT };
    const player = fakePlayer({ cache: { tutorial: 25 }, items: [t.ITEM.RAW_RAT_MEAT] });

    assert.equal(await objects.onUseWithGameObject(player, range, meat), true);
    assert.equal(t.stage(player), 30);
    assert.ok(player.inventory.has(t.ITEM.BURNT_MEAT));

    player.inventory.add(t.ITEM.RAW_RAT_MEAT);
    await objects.onUseWithGameObject(player, range, meat);
    assert.equal(t.stage(player), 31);
    assert.ok(player.inventory.has(t.ITEM.COOKED_MEAT));
    assert.equal(player.xp.cooking, 120);
});

test('fishing: a shrimp arrives within two casts and moves 41 -> 42', async () => {
    const player = fakePlayer({ cache: { tutorial: 41 }, items: [t.ITEM.NET] });
    const spot = { id: 493 };

    await objects.onGameObjectCommandOne(player, spot);
    await objects.onGameObjectCommandOne(player, spot);
    assert.ok(player.inventory.has(t.ITEM.RAW_SHRIMP));
    assert.equal(t.stage(player), 42);
});

test('fishing without a net catches nothing', async () => {
    const player = fakePlayer({ cache: { tutorial: 41 } });
    await objects.onGameObjectCommandOne(player, { id: 493 });
    assert.equal(t.stage(player), 41);
});

test('mining: prospect 49 -> 50, mine needs a pickaxe and 51 -> 52', async () => {
    const rock = { id: 496 };
    const player = fakePlayer({ cache: { tutorial: 49 } });

    await objects.onGameObjectCommandTwo(player, rock);
    assert.equal(t.stage(player), 50);

    player.cache.tutorial = 51;
    await objects.onGameObjectCommandOne(player, rock);
    assert.equal(t.stage(player), 51, 'mined without a pickaxe');

    player.inventory.add(t.ITEM.BRONZE_PICKAXE);
    await objects.onGameObjectCommandOne(player, rock);
    assert.equal(t.stage(player), 52);
    assert.ok(player.inventory.has(t.ITEM.TIN_ORE));
});

test('rat: attack gated before 16, death moves 16 -> 20', async () => {
    const rat = { id: t.NPC.RAT };

    const early = fakePlayer({ cache: { tutorial: 15 } });
    assert.equal(await combat.onNPCAttack(early, rat), true);

    const ready = fakePlayer({ cache: { tutorial: 16 } });
    assert.equal(await combat.onNPCAttack(ready, rat), false);
    const after = fakePlayer({ cache: { tutorial: 20 } });
    assert.equal(await combat.onNPCAttack(after, rat), true);
    assert.match(after.messages[0], /enough rat killing/);
    assert.equal(await combat.onNPCDeath(ready, rat), false);
    assert.equal(t.stage(ready), 20);
});

test('wind strike on a chicken moves 76 -> 77 -> 78 only with runes', async () => {
    const chicken = { id: t.NPC.CHICKEN };
    const windStrike = { runes: [{ id: 33, amount: 1 }, { id: 35, amount: 1 }] };

    const broke = fakePlayer({ cache: { tutorial: 76 } });
    await combat.onCastOnNPC(broke, chicken, windStrike, 0);
    assert.equal(t.stage(broke), 76);

    const player = fakePlayer({ cache: { tutorial: 76 }, items: [33, 35] });
    assert.equal(await combat.onCastOnNPC(player, chicken, windStrike, 0), false);
    assert.equal(t.stage(player), 77);
    await combat.onCastOnNPC(player, chicken, windStrike, 0);
    assert.equal(t.stage(player), 78);
});

test('waking from sleep at 85 moves to 86', () => {
    const player = fakePlayer({ cache: { tutorial: 85 } });
    t.onWake(player, false);
    assert.equal(t.stage(player), 85);
    t.onWake(player, true);
    assert.equal(t.stage(player), 86);
});

test('dying on the tutorial respawns on the island', () => {
    const player = fakePlayer({ cache: { tutorial: 16 } });
    assert.equal(t.onDeath(player), true);
    assert.deepEqual(player.teleports, [[t.START.x, t.START.y]]);
    assert.equal(t.onDeath(fakePlayer()), false);
});

test('complete strips tutorial items, keeps the rest and lands in Lumbridge', async () => {
    const player = fakePlayer({
        cache: { tutorial: 100 },
        items: [t.ITEM.BRONZE_LONG_SWORD, t.ITEM.SLEEPING_BAG, t.ITEM.COOKED_MEAT, t.ITEM.NET]
    });

    assert.equal(await t.complete(player), true);
    assert.equal(player.cache.tutorial, undefined);
    assert.ok(player.cache.tutorialDone);
    assert.ok(player.inventory.has(t.ITEM.BRONZE_LONG_SWORD));
    assert.ok(player.inventory.has(t.ITEM.NET));
    assert.ok(!player.inventory.has(t.ITEM.SLEEPING_BAG));
    assert.ok(!player.inventory.has(t.ITEM.COOKED_MEAT));
    assert.ok(!t.inBounds(player.x, player.y));
    assert.equal(player.saved, 1);

    // a second call (double click on the boatman) does nothing
    assert.equal(await t.complete(player), false);
});

test('nothing on the island can take a player below 1 hit', () => {
    const player = { cache: { tutorial: 16 }, skills: { hits: { current: 3 } } };
    assert.equal(t.safeDamage(player, 5), 2);
    player.skills.hits.current = 1;
    assert.equal(t.safeDamage(player, 4), 0);

    const outsider = { cache: {}, skills: { hits: { current: 3 } } };
    assert.equal(t.safeDamage(outsider, 5), 5);
});
