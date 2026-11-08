// ARSC Wilderness clans (src/clans.js): membership, ranks, clan chat, seeding,
// the battle lifecycle, the Herald's dialogue and the HTTP views. The world,
// players and data server are faked by hand.

const test = require('node:test');
const assert = require('node:assert/strict');
const clans = require('../src/clans');
const herald = require('../src/plugins/npcs/edgeville/clan-herald');

const HERALD = { id: clans.HERALD_ID, x: 216, y: 446 };

function makeWorld() {
    const calls = [];
    let battleId = 0;
    const online = [];

    const world = {
        online,
        calls,
        players: {
            getAll: () => online,
            getByID: (id) => online.find((p) => p.id === id)
        },
        npcs: { getAll: () => [HERALD] },
        getPlayerByUsername: (name) => online.find((p) => p.username === name.toLowerCase()),
        server: {
            dataClient: {
                sendAndReceive(message) {
                    calls.push(message);

                    if (message.handler === 'clanBattleSave') {
                        return Promise.resolve({ success: true, id: message.battle.id || ++battleId });
                    }

                    if (message.handler === 'clanLoad') {
                        return Promise.resolve({ success: true, clans: [], battles: [] });
                    }

                    if (message.handler === 'pvpHiscores') {
                        return Promise.resolve({
                            success: true,
                            rows: [{ username: 'offline one', kills: 3, deaths: 1 }]
                        });
                    }

                    return Promise.resolve({ success: true });
                }
            }
        }
    };

    return world;
}

let nextId = 1;
function join(world, username, { x = 216, y = 448, coins = 0 } = {}) {
    let coinCount = coins;
    const player = {
        id: nextId++,
        username,
        x,
        y,
        world,
        messages: [],
        cache: {},
        canChat: () => true,
        message(...lines) {
            this.messages.push(...lines);
        },
        inventory: {
            has: (id, amount) => id === clans.COINS_ID && coinCount >= amount,
            remove: (id, amount) => {
                coinCount -= amount;
            },
            coins: () => coinCount
        }
    };
    world.online.push(player);
    return player;
}

function setup() {
    const world = makeWorld();
    clans.reset(world);
    let now = 1_000_000;
    clans.state.now = () => now;
    return {
        world,
        advance(ms) {
            now += ms;
            clans.tick(now);
        },
        now: () => now
    };
}

const last = (player) => player.messages[player.messages.length - 1];
const settle = () => new Promise((resolve) => setImmediate(resolve));

test('founding a clan needs the Herald, a free tag and 5000 coins', async () => {
    const { world } = setup();
    const rook = join(world, 'fang rook', { coins: 6000 });
    const far = join(world, 'far away', { x: 100, y: 100, coins: 9000 });
    const poor = join(world, 'poor man', { coins: 10 });

    await clans.command(far, 'clan', ['found', 'FAR', 'Far', 'Clan']);
    assert.match(last(far), /Clan Herald/);
    await clans.command(poor, 'clan', ['found', 'POOR', 'Poor', 'Clan']);
    assert.match(last(poor), /5000 coins/);
    await clans.command(rook, 'clan', ['found', 'f', 'Bad']);
    assert.match(last(rook), /2 to 4 letters/);

    await clans.command(rook, 'clan', ['found', 'fang', 'Crimson', 'Fang']);
    const clan = clans.getClan('FANG');
    assert.equal(clan.name, 'Crimson Fang');
    assert.equal(clan.leader, 'fang rook');
    assert.equal(rook.inventory.coins(), 1000);
    assert.match(rook.messages.join('|'), /founded the clan Crimson Fang \[FANG\]/);
    assert.ok(world.calls.some((c) => c.handler === 'clanSave' && c.clan.tag === 'FANG'));

    await clans.command(rook, 'clan', ['found', 'FNG', 'Other']);
    assert.match(last(rook), /already in a clan/);
});

test('invites, ranks, kicks and leaving pass the lead on', async () => {
    const { world } = setup();
    const rook = join(world, 'fang rook', { coins: 5000 });
    const wren = join(world, 'fang wren');
    const moss = join(world, 'fang moss');
    await clans.command(rook, 'clan', ['found', 'FANG', 'Crimson', 'Fang']);

    await clans.command(wren, 'clan', ['join', 'FANG']);
    assert.match(last(wren), /fresh invite/);

    await clans.command(rook, 'clan', ['invite', 'fang', 'wren']);
    await clans.command(wren, 'clan', ['join', 'fang']);
    assert.equal(clans.tagOf('fang wren'), 'FANG');

    await clans.command(wren, 'clan', ['invite', 'fang', 'moss']);
    assert.match(last(wren), /leader or general/);

    await clans.command(rook, 'clan', ['promote', 'fang', 'wren']);
    assert.equal(clans.memberOf('fang wren').member.rank, 'general');
    await clans.command(wren, 'clan', ['invite', 'fang_moss']);
    await clans.command(moss, 'clan', ['join', 'FANG']);
    assert.equal(clans.getClan('FANG').members.length, 3);

    await clans.command(moss, 'clan', ['kick', 'fang', 'wren']);
    assert.match(last(moss), /leader or general/);
    await clans.command(wren, 'clan', ['kick', 'fang', 'rook']);
    assert.match(last(wren), /ranked below you/);

    await clans.command(rook, 'clan', ['leave']);
    assert.equal(clans.getClan('FANG').leader, 'fang wren', 'the general takes over');
    assert.equal(clans.memberOf('fang wren').member.rank, 'leader');

    await clans.command(wren, 'clan', ['kick', 'fang', 'moss']);
    assert.equal(clans.tagOf('fang moss'), null);
    assert.match(last(moss), /removed from Crimson Fang/);

    await clans.command(wren, 'clan', ['leave']);
    assert.equal(clans.getClan('FANG'), null, 'an empty clan disbands');
    assert.ok(world.calls.some((c) => c.handler === 'clanDelete' && c.tag === 'FANG'));
});

test('clan chat reaches online members only, strips colour codes and is kept for the web', async () => {
    const { world } = setup();
    clans.seed([{ tag: 'FANG', name: 'Crimson Fang', leader: 'fang rook', members: ['fang wren'] }]);
    const rook = join(world, 'fang rook');
    const wren = join(world, 'fang wren');
    const crow = join(world, 'crow talon');

    await clans.command(rook, 'c', ['@red@muster', 'at', 'edgeville']);
    assert.equal(last(wren), '@cya@[FANG] Fang rook: @whi@muster at edgeville');
    assert.equal(last(rook), last(wren));
    assert.equal(crow.messages.length, 0);

    clans.chat(crow, 'hello');
    assert.match(last(crow), /not in a clan/);

    const chat = require('../src/packet-handlers/chat');
    await chat.chat({ player: wren }, { message: '@c hold the line' });
    assert.equal(last(rook), '@cya@[FANG] Fang wren: @whi@hold the line');

    const view = clans.viewClan(clans.getClan('FANG'), { chatTail: 10 });
    assert.deepEqual(view.chat.map((l) => l.text), ['muster at edgeville', 'hold the line']);
    assert.equal(view.members.find((m) => m.username === 'fang rook').online, true);
});

test('seed is idempotent, sets ranks and skips members of other clans', () => {
    setup();
    const spec = [
        { tag: 'FANG', name: 'Crimson Fang', leader: 'fang rook', generals: ['fang ember'], members: ['fang ember', 'fang wren'] },
        { tag: 'CROW', name: 'Ashen Crows', leader: 'crow talon', members: ['fang wren', 'crow hex'] }
    ];
    const first = clans.seed(spec);
    assert.equal(first[0].created, true);
    assert.deepEqual(first[1].skipped, ['fang wren']);

    const again = clans.seed(spec);
    assert.equal(again[0].created, false);
    assert.equal(clans.getClan('FANG').members.length, 3);
    assert.equal(clans.memberOf('fang ember').member.rank, 'general');
    assert.equal(clans.memberOf('crow talon').member.rank, 'leader');

    assert.match(clans.seed([{ tag: 'x', name: 'y', leader: 'z' }])[0].error, /required/);
});

test('a battle: challenge, accept, countdown, kills in the window, winner', async () => {
    const { world, advance } = setup();
    clans.seed([
        { tag: 'FANG', name: 'Crimson Fang', leader: 'fang rook', members: ['fang ember'] },
        { tag: 'CROW', name: 'Ashen Crows', leader: 'crow talon', generals: ['crow hex'], members: ['crow hex'] }
    ]);
    const rook = join(world, 'fang rook');
    const ember = join(world, 'fang ember');
    const talon = join(world, 'crow talon');
    const hex = join(world, 'crow hex');
    const bystander = join(world, 'someone');

    await clans.command(ember, 'clan', ['challenge', 'CROW']);
    assert.match(last(ember), /leader or general/);
    await clans.command(rook, 'clan', ['challenge', 'CROW', 'nowhere']);
    assert.match(last(rook), /Fronts:/);

    await clans.command(rook, 'clan', ['challenge', 'CROW', 'middle']);
    await settle();
    const battle = clans.openBattleOf('FANG');
    assert.equal(battle.status, 'challenged');
    assert.ok(battle.id > 0, 'the data server gave it an id');
    assert.match(bystander.messages.join('|'), /Crimson Fang challenge Ashen Crows .* the middle ground/);

    await clans.command(talon, 'clan', ['challenge', 'FANG']);
    assert.match(last(talon), /already has a battle open/);

    await clans.command(hex, 'clan', ['accept']);
    assert.equal(battle.status, 'scheduled');
    assert.match(last(bystander), /in 10 minutes, for 20 minutes/);

    // a kill before the start does not count
    clans.onKill({ killer: 'fang rook', victim: 'crow hex', killerClan: 'FANG', victimClan: 'CROW', wildLevel: 12 });
    assert.equal(battle.killsChallenger, 0);

    advance(5 * 60000);
    assert.match(last(bystander), /in 5 minutes/);
    advance(4 * 60000);
    assert.match(last(bystander), /in 1 minute/);
    advance(60000);
    assert.equal(battle.status, 'live');
    assert.match(last(bystander), /has begun/);

    assert.equal(
        clans.onKill({ killer: 'fang rook', victim: 'crow hex', killerClan: 'FANG', victimClan: 'CROW', wildLevel: 12 }),
        battle.id
    );
    clans.onKill({ killer: 'fang ember', victim: 'crow talon', killerClan: 'FANG', victimClan: 'CROW', wildLevel: 12 });
    clans.onKill({ killer: 'crow talon', victim: 'fang ember', killerClan: 'CROW', victimClan: 'FANG', wildLevel: 12 });
    assert.equal(battle.killsChallenger, 2);
    assert.equal(battle.killsDefender, 1);
    assert.match(last(hex), /Battle: FANG 2 - 1 CROW/);
    // a kill of a non-clan player counts for the clan, not the battle
    assert.equal(clans.onKill({ killer: 'fang rook', victim: 'someone', killerClan: 'FANG', victimClan: null, wildLevel: 3 }), null);

    advance(20 * 60000);
    assert.equal(battle.status, 'done');
    assert.equal(battle.winner, 'FANG');
    assert.equal(clans.getClan('FANG').battlesWon, 1);
    assert.equal(clans.getClan('CROW').battlesLost, 1);
    assert.equal(clans.openBattleOf('FANG'), null);
    assert.match(last(bystander), /Crimson Fang win the clan battle against Ashen Crows, 2 kills to 1/);
    assert.equal(clans.getClan('FANG').kills, 4);
    assert.equal(clans.getClan('CROW').deaths, 3);
});

test('an unanswered challenge expires; a declined one is cancelled', async () => {
    const { world, advance } = setup();
    clans.seed([
        { tag: 'FANG', name: 'Crimson Fang', leader: 'fang rook' },
        { tag: 'CROW', name: 'Ashen Crows', leader: 'crow talon' }
    ]);
    const rook = join(world, 'fang rook');
    const talon = join(world, 'crow talon');

    await clans.command(rook, 'clan', ['challenge', 'CROW']);
    await settle();
    advance(clans.CHALLENGE_MS);
    assert.equal(clans.openBattleOf('FANG'), null);
    assert.match(last(talon), /let the challenge .* expire/);

    await clans.command(rook, 'clan', ['challenge', 'CROW']);
    await settle();
    await clans.command(talon, 'clan', ['decline']);
    assert.equal(clans.openBattleOf('CROW'), null);
    assert.match(last(rook), /declined the challenge/);
});

test('the Herald explains, shows standings and takes a leader\'s challenge', async () => {
    const { world } = setup();
    clans.seed([
        { tag: 'FANG', name: 'Crimson Fang', leader: 'fang rook' },
        { tag: 'CROW', name: 'Ashen Crows', leader: 'crow talon' }
    ]);
    const said = [];
    const npc = { id: clans.HERALD_ID, x: 216, y: 446, say: async (...lines) => said.push(...lines) };

    const answers = [];
    const rook = join(world, 'fang rook');
    Object.assign(rook, {
        engage() {},
        disengage() {},
        ask: async (options) => {
            answers.push(options);
            return answers.length === 1 ? options.indexOf('I want to challenge a clan') : 1;
        }
    });

    assert.equal(await herald.onTalkToNPC(rook, { ...npc, x: 100 }), false, 'not the gnome ball referee');
    assert.equal(await herald.onTalkToNPC(rook, npc), true);
    await settle();
    // menus: main, rival (one: Ashen Crows at index 0, answered 1 -> none)
    assert.equal(clans.openBattleOf('FANG'), null);

    answers.length = 0;
    rook.ask = async (options) => {
        answers.push(options);
        if (answers.length === 1) return options.indexOf('I want to challenge a clan');
        if (answers.length === 2) return 0; // Ashen Crows
        return 1; // the middle ground
    };
    await herald.onTalkToNPC(rook, npc);
    await settle();
    const battle = clans.openBattleOf('FANG');
    assert.equal(battle.defender, 'CROW');
    assert.equal(battle.front, 'middle');
    assert.ok(said.includes('Your challenge is sent'));

    const talon = join(world, 'crow talon');
    Object.assign(talon, {
        engage() {},
        disengage() {},
        ask: async (options) => options.indexOf('We accept the challenge!')
    });
    await herald.onTalkToNPC(talon, npc);
    assert.equal(battle.status, 'scheduled');

    const stranger = join(world, 'stranger');
    Object.assign(stranger, { engage() {}, disengage() {}, ask: async () => 1 });
    await herald.onTalkToNPC(stranger, npc);
    assert.match(stranger.messages.join('|'), /1\. (Crimson Fang|Ashen Crows)/);
});

test('HTTP: clans, a clan with its chat, battles, hiscores merged with online counters, seed', async () => {
    const { world } = setup();
    const url = (path) => new URL(path, 'http://x');
    const body = (obj) => async () => JSON.stringify(obj);

    const seeded = await clans.handleHttp('POST', '/clans/seed', url('/clans/seed'), body({
        clans: [{ tag: 'FANG', name: 'Crimson Fang', leader: 'fang rook', members: ['fang wren'] }]
    }));
    assert.equal(seeded.status, 200);
    assert.equal(seeded.body.results[0].created, true);

    const rook = join(world, 'fang rook');
    rook.cache.pvp = { kills: 5, deaths: 0, bestStreak: 5 };
    clans.chat(rook, 'for the Fang');

    const list = await clans.handleHttp('GET', '/clans', url('/clans'));
    assert.equal(list.body.clans[0].tag, 'FANG');

    const one = await clans.handleHttp('GET', '/clans/fang', url('/clans/fang?chat=5'));
    assert.equal(one.body.chat[0].text, 'for the Fang');
    assert.equal((await clans.handleHttp('GET', '/clans/NOPE', url('/clans/NOPE'))).status, 404);

    const scores = await clans.handleHttp('GET', '/pvp/hiscores', url('/pvp/hiscores?board=kills'));
    assert.deepEqual(scores.body.rows.map((r) => [r.username, r.kills, r.clan]), [
        ['fang rook', 5, 'FANG'],
        ['offline one', 3, null]
    ]);

    const battles = await clans.handleHttp('GET', '/clan-battles', url('/clan-battles'));
    assert.ok(battles.body.fronts.edgeville);
    assert.equal(battles.body.rules.battleMs, clans.BATTLE_MS);

    const chatPost = await clans.handleHttp('POST', '/clans/FANG/chat', url('/clans/FANG/chat'), body({ text: 'Muster!' }));
    assert.equal(chatPost.status, 200);
    assert.match(last(rook), /\[FANG\] @or1@Muster!/);

    assert.equal(await clans.handleHttp('GET', '/other', url('/other')), null);
});
