// Fake player, world and NPC objects for the members quest tests (witchs-house, fishing-contest, lost-city). Not a test
// file itself (test/run.js only runs *.test.js). Every call a plugin makes is recorded; `answers` scripts the menus.

function fakeNpc(id, { x = 0, y = 0, minX = x, maxX = x, minY = y, maxY = y } = {}) {
    const npc = {
        id,
        x,
        y,
        minX,
        maxX,
        minY,
        maxY,
        spawnX: x,
        spawnY: y,
        said: [],
        attacked: [],
        interlocutor: null,
        locked: false,
        say: async (...lines) => {
            npc.said.push(...lines);
        },
        lock: () => {
            npc.locked = true;
        },
        unlock: () => {
            npc.locked = false;
        },
        attack: async (target) => {
            npc.attacked.push(target);
            return true;
        }
    };

    return npc;
}

function fakeWorld({ npcs = [], members = true } = {}) {
    const world = {
        members,
        npcList: [...npcs],
        spawned: [],
        removed: [],
        replaced: [],
        timeouts: [],
        sleepTicks: async () => {},
        spawnTimedNPC(opts) {
            const npc = fakeNpc(opts.id, opts);
            npc.index = world.npcList.length + 100;
            world.spawned.push({ ...opts });
            world.npcList.push(npc);
            return npc;
        },
        addEntity(type, entity) {
            if (type === 'npcs') world.npcList.push(entity);
        },
        removeEntity(type, entity) {
            world.removed.push(entity);
            world.npcList = world.npcList.filter((n) => n !== entity);
        },
        replaceEntity(type, entity, id) {
            world.replaced.push([entity.id, id]);
            return { ...entity, id };
        },
        setTickTimeout(fn, ticks) {
            world.timeouts.push({ fn, ticks });
        },
        runTimeouts() {
            const pending = world.timeouts;
            world.timeouts = [];
            pending.forEach((t) => t.fn());
        },
        npcs: {
            getByIndex: (index) => world.npcList.find((n) => n.index === index)
        }
    };

    return world;
}

const SKILLS = ['attack', 'defense', 'strength', 'hits', 'prayer', 'fishing', 'crafting', 'woodcutting'];

function fakePlayer({
    world = fakeWorld(),
    quest,
    stage = 0,
    items = [],
    equipped = [],
    banked = [],
    cache = {},
    answers = [],
    x = 0,
    y = 0,
    levels = {}
} = {}) {
    const inventory = items.map((it) => (Array.isArray(it) ? { id: it[0], amount: it[1] } : { id: it, amount: 1 }));
    const skills = {};

    for (const name of SKILLS) {
        const level = levels[name] || 30;
        skills[name] = { base: level, current: level };
    }

    const player = {
        world,
        x,
        y,
        skills,
        cache,
        questStages: quest ? { [quest]: stage } : {},
        messages: [],
        said: [],
        asked: [],
        doors: [],
        gates: [],
        teleports: [],
        climbs: [],
        damaged: [],
        completed: [],
        interlocutor: null,
        inventory: {
            items: inventory,
            count: (id) => inventory.filter((it) => it.id === id).reduce((n, it) => n + it.amount, 0),
            has: (id, amount = 1) => player.inventory.count(id) >= amount,
            add: (id, amount = 1) => {
                inventory.push({ id, amount });
            },
            remove: (id, amount = 1) => {
                const i = inventory.findIndex((it) => it.id === id);
                if (i < 0) return;
                if (inventory[i].amount > amount) inventory[i].amount -= amount;
                else inventory.splice(i, 1);
            },
            isEquipped: (id) => equipped.includes(id) && player.inventory.has(id)
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
        engage: (npc) => {
            player.interlocutor = npc;
            npc.interlocutor = player;
        },
        disengage: () => {
            if (player.interlocutor) player.interlocutor.interlocutor = null;
            player.interlocutor = null;
        },
        enterDoor: async (door, frame) => {
            player.doors.push([door.id, frame]);
        },
        enterGate: async (gate, open) => {
            player.gates.push([gate.id, open]);
        },
        teleport: (tx, ty) => {
            player.teleports.push([tx, ty]);
            player.x = tx;
            player.y = ty;
        },
        climb: (object, up) => {
            player.climbs.push([object.id, up]);
        },
        damage: (n) => {
            player.damaged.push(n);
        },
        changeStat: (skill, delta) => {
            skills[skill].current = Math.max(0, skills[skill].current + delta);
            return skills[skill].current;
        },
        completeQuest: (key, opts) => {
            player.completed.push([key, opts]);
            player.questStages[key] = -1;
        },
        getNearbyEntitiesByID: (type, id) => world.npcList.filter((n) => n.id === id),
        getDistance: (e) => Math.max(Math.abs(e.x - player.x), Math.abs(e.y - player.y))
    };

    return player;
}

function gameObject(id, x, y, commands) {
    const objects = require('@2003scape/rsc-data/config/objects');
    return { id, x, y, direction: 0, definition: { ...objects[id], commands: commands || objects[id].commands } };
}

function wallObject(id, x, y, direction = 0) {
    return { id, x, y, direction };
}

module.exports = { fakeNpc, fakeWorld, fakePlayer, gameObject, wallObject };
