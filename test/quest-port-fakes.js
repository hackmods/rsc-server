// Fakes for the members quest port tests (tree-gnome-village, sheep-herder, gertrudes-cat): a real Player and World
// prototype with the I/O stubbed, scripted menu answers, and recorded lines. Not a test file itself.

const Module = require('node:module');

// player.js and world.js load the captcha and the landscape, which need the native canvas module
const realLoad = Module._load;
Module._load = function load(request, ...rest) {
    if (request === '@2003scape/rsc-captcha') return class {};
    if (request === '@2003scape/rsc-landscape') return { Landscape: class {} };
    return realLoad.call(this, request, ...rest);
};
require('../src/data-fixes');
const Player = require('../src/model/player');
const World = require('../src/model/world');
Module._load = realLoad;

const EntityList = require('../src/model/entity-list');
const GameObject = require('../src/model/game-object');
const GroundItem = require('../src/model/ground-item');
const Inventory = require('../src/model/inventory');
const NPC = require('../src/model/npc');
const WallObject = require('../src/model/wall-object');

const SKILLS = ['attack', 'defense', 'strength', 'hits', 'prayer', 'cooking', 'magic', 'ranged', 'woodcutting'];

function makeWorld() {
    const world = Object.create(World.prototype);

    Object.assign(world, {
        members: true,
        ticks: 0,
        tickIndex: 0,
        tickFunctions: new Map(),
        plugins: new Map(),
        players: new EntityList(2304, 7104),
        npcs: new EntityList(2304, 7104),
        gameObjects: new EntityList(2304, 7104),
        wallObjects: new EntityList(2304, 7104),
        groundItems: new EntityList(2304, 7104),
        pathFinder: {
            addObject() {},
            addWallObject() {},
            removeObject() {},
            removeWallObject() {},
            // a straight line, one tile at a time
            getLineOfSight(from, to) {
                const path = [];
                let { x, y } = from;

                while (x !== to.x || y !== to.y) {
                    x += Math.sign(to.x - x);
                    y += Math.sign(to.y - y);
                    path.push({ x, y });
                }

                return path.slice(0, -1);
            },
            isValidGameStep: () => true
        },
        server: { config: { experienceRate: 1 } }
    });

    // plugin pauses resolve at once; tick timers wait for runTicks; ms timers (respawns) are recorded, not run
    world.sleepTicks = async () => {};
    world.timeouts = [];
    world.setTimeout = (func, ms) => world.timeouts.push({ func, ms });

    return world;
}

// what World#tick does with tickFunctions
function runTicks(world, count) {
    for (let i = 0; i < count; i += 1) {
        world.ticks += 1;

        for (const [id, entry] of [...world.tickFunctions]) {
            entry.ticks -= 1;

            if (entry.ticks <= 0) {
                world.tickFunctions.delete(id);
                entry.func();
            }
        }
    }
}

// lets the plugin's detached async work (hops, walks) finish
async function settle(rounds = 20) {
    for (let i = 0; i < rounds; i += 1) {
        await new Promise((resolve) => setImmediate(resolve));
    }
}

function makePlayer({ world = makeWorld(), x = 0, y = 0, answers = [], stages = {}, cache = {}, items = [] } = {}) {
    const player = Object.create(Player.prototype);

    Object.assign(player, {
        world,
        id: 7,
        username: 'tester',
        x,
        y,
        messages: [],
        said: [],
        asked: [],
        questStages: { ...stages },
        cache: { ...cache },
        questPoints: 0,
        combatLevel: 3,
        locked: false,
        walkQueue: [],
        localEntities: { known: { npcs: new Set(), players: new Set() } },
        skills: Object.fromEntries(SKILLS.map((name) => [name, { current: 10, base: 10, experience: 0 }])),
        inventory: new Inventory(null, []),
        bank: { has: () => false },
        damaged: 0,
        teleported: null
    });

    player.inventory.player = player;

    for (const item of items) {
        const [id, amount] = Array.isArray(item) ? item : [item, 1];
        player.inventory.add(id, amount);
    }

    player.send = () => {};
    player.message = (...m) => player.messages.push(...m);
    player.say = async (...m) => {
        player.said.push(...m);
    };
    player.ask = async (options, repeat = false) => {
        player.asked.push(options);

        if (!answers.length) {
            throw new Error(`unexpected menu: ${options.join(' | ')}`);
        }

        const choice = answers.shift();

        if (repeat) {
            player.said.push(options[choice]);
        }

        return choice;
    };
    player.teleport = (tx, ty, bubble = false) => {
        player.teleported = [tx, ty, bubble];
        player.x = tx;
        player.y = ty;
    };
    player.engage = (npc) => {
        player.interlocutor = npc;
    };
    player.disengage = () => {
        player.interlocutor = null;
    };
    player.damage = (n) => {
        player.damaged += n;
    };
    player.sendSound = () => {};
    player.sendStats = () => {};
    player.sendQuestList = () => {};
    player.sendExperience = () => {};
    player.sendFatigue = () => {};
    player.sendTeleportBubble = () => {};
    player.broadcastPlayerAppearance = () => {};
    player.hasInterfaceOpen = () => false;
    player.enterDoor = async (door, frame) => {
        player.enteredDoor = [door.id, door.x, door.y, frame];
    };

    return player;
}

// equip an item already in the pack, into the slot named
function wear(player, id, slot) {
    const index = player.inventory.items.findIndex((item) => item.id === id);
    player.inventory.equipmentSlots[slot] = index;
}

// a talking NPC that records its lines
function fakeNpc(id, extra = {}) {
    const npc = {
        id,
        lines: [],
        attacked: null,
        locked: false,
        x: 0,
        y: 0,
        async say(...m) {
            npc.lines.push(...m);
        },
        async attack(target) {
            npc.attacked = target;
        },
        getNearbyEntities: () => [],
        getDistance: () => 1,
        ...extra
    };

    return npc;
}

function addNpc(world, { id, x, y, minX = x, maxX = x, minY = y, maxY = y }) {
    const npc = new NPC(world, { id, x, y, minX, maxX, minY, maxY });
    world.addEntity('npcs', npc);
    return npc;
}

function addObject(world, { id, x, y, direction = 0 }) {
    const object = new GameObject(world, { id, x, y, direction });
    world.addEntity('gameObjects', object);
    return object;
}

function wallObject({ id, x, y, direction = 0 }) {
    return { id, x, y, direction };
}

function groundItem(world, { id, x, y, amount = 1, respawn }) {
    const item = new GroundItem(world, { id, x, y, amount, respawn });
    world.addEntity('groundItems', item);
    return item;
}

module.exports = {
    Player,
    World,
    NPC,
    WallObject,
    makeWorld,
    makePlayer,
    runTicks,
    settle,
    wear,
    fakeNpc,
    addNpc,
    addObject,
    wallObject,
    groundItem
};
