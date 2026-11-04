// The Mage Arena (Open-RSC MageArena.java, Chamber_Guardian.java, Gundai.java, SpellHandler.java god-spell rules):
// Kolodion's dialogue and duel through his five forms, the arena's weapon rule, the god stones and capes, the Chamber
// Guardian's staff, the barrier, and the god spells' 100 arena casts.

const test = require('node:test');
const assert = require('node:assert/strict');

const plugins = require('../src/plugins');
const arena = require('../src/plugins/minigames/mage-arena');
const guardian = require('../src/plugins/npcs/wilderness/chamber-guardian');
const gundai = require('../src/plugins/npcs/wilderness/gundai');
const items = require('@2003scape/rsc-data/config/items');
const npcSpawns = require('@2003scape/rsc-data/locations/npcs');
const objectSpawns = require('@2003scape/rsc-data/locations/objects');

const KOLODION = 712;
const [HUMAN, OGRE, SPIDER, SOULESS, DEMON] = [713, 757, 758, 759, 760];
const ZAMORAK_CAPE = 1213;
const SARADOMIN_CAPE = 1214;
const GUTHIX_CAPE = 1215;
const STAFF_OF_SARADOMIN = 1218;

function makeWorld() {
    const npcs = [];
    const objects = [];

    return {
        npcList: npcs,
        timeouts: [],
        npcs: {
            getByIndex: (index) => npcs.find((n) => n.index === index),
            getInArea: () => npcs
        },
        gameObjects: { getByIndex: (index) => objects.find((o) => o.index === index) },
        async sleepTicks() {},
        setTickTimeout(fn, ticks) {
            this.timeouts.push({ fn, ticks });
        },
        addEntity(type, entity) {
            entity.index = Math.random();
            (type === 'npcs' ? npcs : objects).push(entity);
        },
        removeEntity(type, entity) {
            const list = type === 'npcs' ? npcs : objects;
            const i = list.indexOf(entity);
            if (i > -1) list.splice(i, 1);
        },
        spawnTimedNPC({ id, x, y, ticks }) {
            const npc = makeNPC(id, this, x, y);
            npc.ticks = ticks;
            this.addEntity('npcs', npc);
            return npc;
        }
    };
}

function makeNPC(id, world, x = 446, y = 3371) {
    return {
        id,
        x,
        y,
        world,
        said: [],
        async say(...lines) {
            this.said.push(...lines);
        },
        withinRange(other, range = 8) {
            return Math.abs(other.x - this.x) <= range / 2 && Math.abs(other.y - this.y) <= range / 2;
        }
    };
}

function makePlayer({ magic = 70, bag = [], cache = {}, choices = [], world = makeWorld(), x = 446, y = 3372 } = {}) {
    const inventory = bag.map((id) => ({ id, amount: 1, definition: items[id] }));
    const queue = [...choices];

    return {
        x,
        y,
        world,
        cache,
        loggedIn: true,
        said: [],
        messages: [],
        damageTaken: [],
        skills: {
            magic: { current: magic, base: magic },
            attack: { current: 60, base: 60 },
            strength: { current: 60, base: 60 },
            hits: { current: 70, base: 70 }
        },
        bank: { has: () => false },
        inventory: {
            items: inventory,
            has(id) {
                return inventory.some((i) => i.id === id);
            },
            add(id) {
                inventory.push({ id, amount: 1, definition: items[id] });
            }
        },
        engage() {},
        disengage() {},
        retreat() {},
        sendStats() {},
        sendTeleportBubble() {},
        message(...lines) {
            this.messages.push(...lines);
        },
        async say(...lines) {
            this.said.push(...lines);
        },
        async ask(options) {
            const choice = queue.length ? queue.shift() : options.length - 1;
            this.said.push(options[choice]);
            return choice;
        },
        teleport(tx, ty) {
            this.x = tx;
            this.y = ty;
        },
        damage(amount) {
            this.damageTaken.push(amount);
            this.skills.hits.current -= amount;
        },
        async enterGate() {}
    };
}

test('listed in plugins/index.js; Kolodion, the battle mages, the stones, gates and barrier are placed', () => {
    for (const plugin of [arena, guardian, gundai]) assert.ok(Object.values(plugins).includes(plugin));
    assert.ok(npcSpawns.some((n) => n.id === KOLODION));
    for (const id of [789, 790, 791, 784, 792]) assert.ok(npcSpawns.some((n) => n.id === id), `npc ${id}`);
    for (const id of [1019, 1020, 1027, 1152, 1153, 1154]) assert.ok(objectSpawns.some((o) => o.id === id), `object ${id}`);
    assert.equal(arena.KOLODION_TICKS, 806);
});

test('Kolodion turns away a wizard below magic 60', async () => {
    const player = makePlayer({ magic: 59 });
    const kolodion = makeNPC(KOLODION, player.world);

    assert.equal(await arena.onTalkToNPC(player, kolodion), true);
    assert.equal(kolodion.said.at(-1), "hah, a wizard of your level..don't be absurd");
    assert.equal(player.cache.mageArena, undefined);
});

test('the arena rule: weapons and armour stay out, staves, capes, amulets and basic gear go in', () => {
    const allowed = [100, 1218, 1213, 183, 522, 16, 17, 556];
    const refused = [1, 70, 7, 15, 124, 401];

    for (const id of allowed) assert.equal(arena.isNotAllowed({ id, definition: items[id] }), false, `${items[id].name}`);
    for (const id of refused) assert.equal(arena.isNotAllowed({ id, definition: items[id] }), true, `${items[id].name}`);
    assert.equal(arena.isNotAllowed({ id: 10, definition: items[10] }), false, 'coins');
});

test('Kolodion refuses an armed player before the duel', async () => {
    const player = makePlayer({ bag: [1], choices: [0, 0] });
    const kolodion = makeNPC(KOLODION, player.world);

    await arena.onTalkToNPC(player, kolodion);
    assert.ok(player.messages.includes('...while carrying weapons or armour'));
    assert.equal(player.cache.mageArena, undefined);
    assert.equal(player.world.npcList.length, 0);
});

test('joining the fight: stage 1, into the arena, melee zeroed and the human form spawned for this player', async () => {
    const player = makePlayer({ bag: [100], choices: [0, 0, 0] });
    const kolodion = makeNPC(KOLODION, player.world);

    await arena.onTalkToNPC(player, kolodion);
    assert.equal(player.cache.mageArena, 1);
    assert.equal(player.cache.kolodionStage, HUMAN);
    assert.deepEqual([player.x, player.y], [229, 130]);
    assert.equal(player.skills.attack.current, 0);
    assert.equal(player.skills.strength.current, 0);

    const [form] = player.world.npcList;
    assert.equal(form.id, HUMAN);
    assert.deepEqual([form.x, form.y, form.ticks], [227, 130, 806]);
    assert.equal(form.spawnedFor, player);
    assert.equal(player.spawnedKolodion, form);
    assert.ok(player.messages.includes('kolodion blasts you with his staff'));
    assert.equal(player.damageTaken.length, 1);
    assert.ok(player.damageTaken[0] >= 7 && player.damageTaken[0] <= 15);
});

test('each form dies into the next; the demon ends the duel at stage 2 in the cave', async () => {
    const player = makePlayer({ cache: { mageArena: 1, kolodionStage: HUMAN }, x: 229, y: 130 });
    const { world } = player;
    let form = arena.spawnKolodion(player, HUMAN, true);

    for (const next of [OGRE, SPIDER, SOULESS, DEMON]) {
        assert.equal(await arena.onNPCDeath(player, form), true);
        assert.ok(!world.npcList.includes(form), 'the dead form is removed');
        form = player.spawnedKolodion;
        assert.equal(form.id, next);
        assert.equal(player.cache.kolodionStage, next);
    }

    assert.ok(player.messages.includes('He becomes a vicious demon'));
    assert.ok(player.messages.includes('kolodion blasts you again'));

    const kolodion = makeNPC(KOLODION, world, 446, 3371);
    world.addEntity('npcs', kolodion);

    assert.equal(await arena.onNPCDeath(player, form), true);
    assert.equal(player.cache.mageArena, 2);
    assert.equal(player.cache.kolodionStage, undefined);
    assert.deepEqual([player.x, player.y], [446, 3370]);
    assert.ok(kolodion.said.includes('step into the magic pool, it will carry you to the chamber'));
    assert.equal(await arena.onNPCDeath(player, { id: 11 }), false);
});

test('a lost duel resumes at the form reached', async () => {
    const player = makePlayer({ cache: { mageArena: 1, kolodionStage: SPIDER } });
    const kolodion = makeNPC(KOLODION, player.world);

    await arena.onTalkToNPC(player, kolodion);
    assert.equal(player.world.npcList[0].id, SPIDER);
    assert.equal(player.damageTaken.length, 0, 'a resumed form does not blast again');
    assert.deepEqual(kolodion.said.at(-1), 'let us continue with the battle...now');
});

test('another player\'s Kolodion is busy, and the battle mages wait for stage 2/3', async () => {
    const owner = makePlayer();
    const other = makePlayer({ world: owner.world });
    const form = arena.spawnKolodion(owner, HUMAN, true);

    assert.equal(await arena.onNPCAttack(other, form), true);
    assert.equal(await arena.onCastOnNPC(other, form, { name: 'Wind strike' }, 1), true);
    assert.deepEqual(other.messages, ['that mage is busy.', 'that mage is busy.']);
    assert.equal(await arena.onNPCAttack(owner, form), false);

    const mage = makeNPC(789, owner.world, 226, 130);
    const fresh = makePlayer({ cache: { mageArena: 2 } });
    assert.equal(await arena.onCastOnNPC(fresh, mage, { name: 'Wind strike' }, 1), false, 'casting from stage 2');
    assert.equal(await arena.onNPCAttack(fresh, mage), true, 'melee from stage 3');
    assert.equal(await arena.onNPCAttack(makePlayer({ cache: { mageArena: 4 } }), mage), false);
    assert.equal(await arena.onCastOnNPC(makePlayer(), mage, { name: 'Wind strike' }, 1), true);
});

test('god spells: counted in the arena, refused outside it until 100 casts', async () => {
    const npc = makeNPC(11, makeWorld(), 230, 130);
    const spell = { name: 'Saradomin strike' };
    const inside = makePlayer({ x: 228, y: 130, cache: { mageArena: 4 } });

    assert.equal(await arena.onCastOnNPC(inside, npc, spell, 34), false);
    assert.equal(inside.cache['Saradomin strike_casts'], 1);

    inside.cache['Saradomin strike_casts'] = 99;
    await arena.onCastOnNPC(inside, npc, spell, 34);
    assert.equal(inside.cache['Saradomin strike_casts'], 100);
    assert.ok(inside.messages.includes('Well done .. you can now use the Saradomin strike outside the arena'));

    const outside = makePlayer({ x: 300, y: 300, cache: { 'Saradomin strike_casts': 40 } });
    assert.equal(await arena.onCastOnNPC(outside, npc, spell, 34), true);
    assert.deepEqual(outside.messages, [
        'this spell can only be used in the mage arena',
        'You must learn this spell first, you need 60 more casts in the mage arena'
    ]);

    const trained = makePlayer({ x: 300, y: 300, cache: { 'Saradomin strike_casts': 100 } });
    assert.equal(await arena.onCastOnNPC(trained, npc, spell, 34), false);
    assert.equal(await arena.onCastOnNPC(makePlayer({ x: 300, y: 300 }), npc, { name: 'Fire blast' }, 32), false);
});

test('a spell at Kolodion in the arena sets the flag his next strike answers', async () => {
    const player = makePlayer({ x: 229, y: 130 });
    const form = arena.spawnKolodion(player, HUMAN, true);

    await arena.onCastOnNPC(player, form, { name: 'Fire blast' }, 32);
    assert.equal(player.magedKolodion, true);

    // the flag forces a strike or a taunt this tick; run until it struck
    for (let i = 0; i < 50 && !player.damageTaken.length; i += 1) {
        player.magedKolodion = true;
        assert.equal(await arena.kolodionStep(player), true);
    }

    assert.ok(player.damageTaken.length, 'Kolodion struck with a god spell');
    assert.equal(player.magedKolodion, false);
});

test('Kolodion\'s god spell damage grows with his form', () => {
    assert.equal(arena.kolodionDamage(70, 70, 0), 1 + Math.ceil(Math.max(70 - 13, 0) / 20));
    assert.ok(arena.kolodionDamage(70, 70, 3) > arena.kolodionDamage(70, 70, 0));
    assert.equal(arena.kolodionDamage(1, 10, 0), 1);
});

test('leaving the arena removes the form and stops the event', async () => {
    const player = makePlayer({ x: 229, y: 130 });
    const form = arena.spawnKolodion(player, HUMAN, true);

    player.teleport(120, 500);
    assert.equal(await arena.kolodionStep(player), false);
    assert.ok(!player.world.npcList.includes(form));
});

test('the god stones: the first chant gives the cape and stage 3, later only with no cape owned', async () => {
    const player = makePlayer({ cache: { mageArena: 2 } });

    assert.equal(await arena.onGameObjectCommandOne(player, { id: 1152 }), true);
    assert.ok(player.inventory.has(SARADOMIN_CAPE));
    assert.equal(player.cache.mageArena, 3);

    await arena.onGameObjectCommandOne(player, { id: 1153 });
    assert.ok(!player.inventory.has(GUTHIX_CAPE));
    assert.ok(player.messages.includes('but there is no response'));

    const before = makePlayer({ cache: { mageArena: 1 } });
    await arena.onGameObjectCommandOne(before, { id: 1154 });
    assert.ok(!before.inventory.has(ZAMORAK_CAPE), 'nothing before Kolodion is beaten');

    assert.equal(await arena.onGroundItemTake(player, { id: GUTHIX_CAPE }), true);
    assert.ok(player.messages.includes('you may only possess one sacred cape at a time'));
    assert.equal(await arena.onGroundItemTake(makePlayer(), { id: GUTHIX_CAPE }), false);
});

test('the Chamber Guardian: stage 2 -> 3, the matching staff at 3 -> 4, the shop at 4', async () => {
    const npc = makeNPC(784, makeWorld());
    const two = makePlayer({ cache: { mageArena: 2 } });
    await guardian.onTalkToNPC(two, npc);
    assert.equal(two.cache.mageArena, 3);

    const three = makePlayer({ cache: { mageArena: 3 }, bag: [SARADOMIN_CAPE] });
    await guardian.onTalkToNPC(three, npc);
    assert.ok(three.inventory.has(STAFF_OF_SARADOMIN));
    assert.equal(three.cache.mageArena, 4);

    const noCape = makePlayer({ cache: { mageArena: 3 } });
    await guardian.onTalkToNPC(noCape, npc);
    assert.equal(noCape.cache.mageArena, 3);

    const four = makePlayer({ cache: { mageArena: 4 }, choices: [0] });
    four.openShop = (name) => (four.shop = name);
    await guardian.onTalkToNPC(four, npc);
    assert.equal(four.shop, 'mage-arena-staves');
});

test('the barrier: in only at stage 4 and unarmed, out always', async () => {
    const outside = makePlayer({ x: 228, y: 118, cache: { mageArena: 3 } });
    await arena.onGameObjectCommandOne(outside, { id: 1027 });
    assert.deepEqual(outside.messages, ['you cannot enter without the permission of kolodion']);

    const armed = makePlayer({ x: 228, y: 118, cache: { mageArena: 4 }, bag: [1] });
    await arena.onGameObjectCommandOne(armed, { id: 1027 });
    assert.equal(armed.y, 118);

    const ready = makePlayer({ x: 228, y: 118, cache: { mageArena: 4 }, bag: [STAFF_OF_SARADOMIN, SARADOMIN_CAPE] });
    await arena.onGameObjectCommandOne(ready, { id: 1027 });
    assert.deepEqual([ready.x, ready.y], [228, 120]);

    await arena.onGameObjectCommandOne(ready, { id: 1027 });
    assert.deepEqual([ready.x, ready.y], [228, 118]);
    assert.ok(ready.messages.includes('you pass through the mystical barrier'));
});

test('Gundai opens the bank', async () => {
    const player = makePlayer({ choices: [0] });
    let opened = false;
    player.bank.open = () => (opened = true);

    assert.equal(await gundai.onTalkToNPC(player, makeNPC(792, player.world)), true);
    assert.ok(opened);
});
