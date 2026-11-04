// Fake player, world and NPC objects for the Wave 2 batch 2b tests (jungle-potion, murder-mystery, dwarf-cannon,
// multi-cannon). Not a test file itself (test/run.js only runs *.test.js). Every call a plugin makes is recorded;
// `answers` scripts the menus (an index per player.ask, in order).

function fakeNpc(id, { x = 0, y = 0, hits = 10, hostility = 'aggressive' } = {}) {
    const npc = {
        id,
        x,
        y,
        index: Math.floor(Math.random() * 1e6),
        said: [],
        damaged: [],
        locked: false,
        removed: false,
        definition: { hostility },
        skills: { hits: { base: hits, current: hits } },
        interlocutor: null,
        say: async (...lines) => {
            // NPC#broadcastChat reads interlocutor.index: a plugin that did not engage crashes in the game
            if (!npc.interlocutor) throw new TypeError(`npc ${id} says ${JSON.stringify(lines[0])} with no interlocutor`);
            npc.said.push(...lines);
        },
        damage(amount, player, kind) {
            npc.damaged.push({ amount, by: player, kind });
            npc.skills.hits.current -= amount;
            return npc.skills.hits.current <= 0;
        },
        withinLineOfSight: () => true
    };

    return npc;
}

function fakeWorld({ npcs = [], members = true } = {}) {
    const world = {
        members,
        ticks: 0,
        npcList: [...npcs],
        objects: [],
        groundItems: [],
        removed: [],
        timeouts: [],
        sleepTicks: async () => {},
        spawnTimedNPC(opts) {
            const npc = fakeNpc(opts.id, opts);
            world.npcList.push(npc);
            return npc;
        },
        addEntity(type, entity) {
            if (type === 'npcs') world.npcList.push(entity);
            else if (type === 'gameObjects') world.objects.push(entity);
            else if (type === 'groundItems') world.groundItems.push(entity);
        },
        removeEntity(type, entity) {
            world.removed.push([type, entity]);
            if (type === 'npcs') world.npcList = world.npcList.filter((n) => n !== entity);
            else if (type === 'gameObjects') world.objects = world.objects.filter((o) => o !== entity);
            else if (type === 'groundItems') world.groundItems = world.groundItems.filter((g) => g !== entity);
        },
        addTimedGroundItem(opts) {
            const item = { ...opts, owner: opts.owner && typeof opts.owner === 'object' ? opts.owner.id : opts.owner };
            world.groundItems.push(item);
            return item;
        },
        setTickTimeout(fn, ticks) {
            const t = { fn, ticks };
            world.timeouts.push(t);
            return t;
        },
        clearTickTimeout(t) {
            world.timeouts = world.timeouts.filter((x) => x !== t);
        },
        // run the pending timeouts once (one generation); returns how many ran
        runTimeouts() {
            const pending = world.timeouts;
            world.timeouts = [];
            pending.forEach((t) => t.fn());
            return pending.length;
        },
        gameObjects: {
            getAtPoint: (x, y) => world.objects.filter((o) => o.x === x && o.y === y)
        },
        npcs: {
            getInArea: (x, y, range) =>
                world.npcList.filter((n) => Math.abs(n.x - x) <= range && Math.abs(n.y - y) <= range)
        }
    };

    return world;
}

const SKILLS = [
    'attack', 'defense', 'strength', 'hits', 'ranged', 'prayer', 'magic', 'cooking', 'woodcutting', 'fletching',
    'fishing', 'firemaking', 'crafting', 'smithing', 'mining', 'herblaw', 'agility', 'thieving'
];

function fakePlayer({
    world = fakeWorld(),
    quests = {},
    items = [],
    banked = [],
    cache = {},
    answers = [],
    x = 0,
    y = 0,
    levels = {},
    fatigue = 0,
    username = 'tester'
} = {}) {
    const inventory = items.map((it) => (Array.isArray(it) ? { id: it[0], amount: it[1] } : { id: it, amount: 1 }));
    const skills = {};

    for (const name of SKILLS) {
        const level = levels[name] || 30;
        skills[name] = { base: level, current: level };
    }

    const player = {
        id: 1,
        username,
        loggedIn: true,
        world,
        x,
        y,
        skills,
        cache,
        fatigue,
        questStages: { ...quests },
        questPoints: 0,
        messages: [],
        said: [],
        asked: [],
        doors: [],
        teleports: [],
        experience: [],
        bubbles: [],
        sounds: [],
        projectiles: [],
        shops: [],
        damaged: [],
        completed: [],
        interlocutor: null,
        inventory: {
            items: inventory,
            count: (id) => inventory.filter((it) => it.id === id).reduce((n, it) => n + it.amount, 0),
            has: (id, amount = 1) => player.inventory.count(id) >= amount,
            add: (id, amount = 1) => {
                if (typeof id === 'object') {
                    amount = id.amount || 1;
                    id = id.id;
                }
                const stack = inventory.find((it) => it.id === id && id === 10);
                if (stack) stack.amount += amount;
                else inventory.push({ id, amount });
            },
            remove: (id, amount = 1) => {
                if (typeof id === 'object') {
                    amount = id.amount || 1;
                    id = id.id;
                }
                const i = inventory.findIndex((it) => it.id === id);
                if (i < 0) return;
                if (inventory[i].amount > amount) inventory[i].amount -= amount;
                else inventory.splice(i, 1);
            },
            isFull: () => inventory.length >= 30
        },
        bank: { has: (id) => banked.includes(id) },
        ask: async (options, repeat) => {
            player.asked.push(options);
            if (!answers.length) throw new Error(`no answer scripted for ${JSON.stringify(options)}`);
            const choice = answers.shift();
            if (repeat) player.said.push(options[choice]);
            return choice;
        },
        say: async (...lines) => {
            player.said.push(...lines);
        },
        message: (...lines) => {
            player.messages.push(...lines);
        },
        engaged: [],
        // Character#engage / disengage: npc.say needs npc.interlocutor
        engage: (npc) => {
            player.engaged.push(npc.id);
            player.interlocutor = npc;
            npc.interlocutor = player;
        },
        disengage: () => {
            if (player.interlocutor) player.interlocutor.interlocutor = null;
            player.interlocutor = null;
        },
        sendBubble: (id) => player.bubbles.push(id),
        sendSound: (name) => player.sounds.push(name),
        sendProjectile: (victim, sprite) => player.projectiles.push([victim.id, sprite]),
        faceEntity: () => {},
        openShop: (name) => player.shops.push(name),
        isTired: () => player.fatigue >= 7500,
        enterDoor: async (door) => {
            player.doors.push(door.id);
        },
        teleport: (tx, ty) => {
            player.teleports.push([tx, ty]);
            player.x = tx;
            player.y = ty;
        },
        damage: (n) => {
            player.damaged.push(n);
        },
        addExperience: (skill, amount, fatigue = true) => {
            player.experience.push([skill, amount, fatigue]);
        },
        addQuestPoints: (n) => {
            player.questPoints += n;
        },
        completeQuest: (key, opts) => {
            if (opts.message) player.messages.push(...[].concat(opts.message));
            for (const [skill, amount] of Object.entries(opts.experience || {})) {
                player.experience.push([skill, amount, false]);
            }
            player.completed.push([key, opts]);
            player.questStages[key] = -1;
            player.questPoints += opts.questPoints || 0;
        },
        getNearbyEntitiesByID: (type, id) => world.npcList.filter((n) => n.id === id),
        getDistance: (e) => Math.max(Math.abs(e.x - player.x), Math.abs(e.y - player.y)),
        withinLineOfSight: () => true
    };

    return player;
}

function gameObject(id, x, y, extra = {}) {
    const objects = require('@2003scape/rsc-data/config/objects');
    return { id, x, y, direction: 0, definition: objects[id], ...extra };
}

function wallObject(id, x, y, direction = 0) {
    return { id, x, y, direction };
}

module.exports = { fakeNpc, fakeWorld, fakePlayer, gameObject, wallObject };
