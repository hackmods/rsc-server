// ARSC: a :: command that finds nothing (an offline player, an unknown region, a missing name) tells its player and
// never throws into the server loop (src/packet-handlers/command.js, World#getPlayerByUsername).

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

// World loads Player (the captcha) and the landscape painter, both on the native canvas: stub them
const realLoad = Module._load;
Module._load = function load(request, ...rest) {
    if (request === '@2003scape/rsc-captcha') return class {};
    // World's map painter needs the canvas too; these tests never build a real World
    if (request === '@2003scape/rsc-landscape') return { Landscape: class {} };
    return realLoad.call(this, request, ...rest);
};
const { command } = require('../src/packet-handlers/command');
const World = require('../src/model/world');
Module._load = realLoad;

function makeWorld(online = []) {
    return {
        members: true,
        players: { getAll: () => online },
        gameObjects: { getByID: () => undefined },
        npcs: { getByID: () => undefined },
        getPlayerByUsername: World.prototype.getPlayerByUsername
    };
}

function makePlayer(world, extra = {}) {
    const player = {
        username: 'admin',
        rank: 3,
        x: 100,
        y: 100,
        world,
        cache: { minted: 1 },
        messages: [],
        teleports: [],
        isAdministrator: () => true,
        message(...lines) {
            this.messages.push(...lines);
        },
        teleport(x, y) {
            this.teleports.push([x, y]);
        },
        ...extra
    };
    return player;
}

async function run(player, cmd, args) {
    await command({ player }, { command: cmd, args });
    return player.messages.at(-1);
}

test('::goto an offline player, no name, or a two-word name', async () => {
    const rook = { username: 'fang rook', x: 192, y: 408 };
    const world = makeWorld([rook]);
    const admin = makePlayer(world);
    world.players.getAll = () => [rook, admin];

    assert.match(await run(admin, 'goto', ['nobody']), /nobody is not online/);
    assert.match(await run(admin, 'goto', []), /usage: ::goto/);
    assert.equal(admin.teleports.length, 0);

    await run(admin, 'goto', ['fang', 'rook']);
    await run(admin, 'goto', ['fang_rook']);
    assert.deepEqual(admin.teleports, [[192, 408], [192, 408]]);
});

test('::give with no name, ::gotoentity, ::chaseobj and ::teleport with nothing to find', async () => {
    const world = makeWorld();
    const admin = makePlayer(world);
    world.players.getAll = () => [admin];

    assert.match(await run(admin, 'give', []), /unable to find player/);
    assert.match(await run(admin, 'gotoentity', ['nothing', '1']), /usage: ::gotoentity/);
    assert.match(await run(admin, 'chaseobj', ['999999']), /no game object 999999/);
    assert.match(await run(admin, 'teleport', ['atlantis']), /unknown region atlantis/);
});

test('any command that still throws tells its player instead of the server loop', async () => {
    const world = makeWorld();
    const admin = makePlayer(world, {
        openShop() {
            throw new Error('no such shop');
        }
    });

    await assert.doesNotReject(command({ player: admin }, { command: 'shop', args: ['nowhere'] }));
    assert.match(admin.messages.at(-1), /::shop failed: no such shop/);
});

test('World#getPlayerByUsername finds nobody for no name', () => {
    const world = makeWorld([{ username: 'a' }]);
    assert.equal(world.getPlayerByUsername(undefined), undefined);
    assert.equal(world.getPlayerByUsername(''), undefined);
    assert.equal(world.getPlayerByUsername('A').username, 'a');
});
