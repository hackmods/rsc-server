// ARSC minting gate (Grand Exchange): ::item, ::give and ::droprandom need
// ARSC_MINT_POLICY on top of the command policy and mark the receiver minted
// (barred from the exchange); ::setcache cannot clear the mark. Also the save
// fixes the exchange relies on: getSaveMessage leaves the live skills intact.

const test = require('node:test');
const assert = require('node:assert');

const { command } = require('../src/packet-handlers/command');
const worldAdmin = require('../src/world-admin');
// Player pulls in rsc-captcha (native canvas): skipped where canvas is not built
let Player = null;

try {
    Player = require('../src/model/player');
} catch (e) {
    Player = null;
}

function makePlayer(username, others = {}) {
    const added = [];
    const messages = [];
    const player = {
        username,
        rank: 0,
        cache: {},
        added,
        messages,
        isAdministrator() {
            return this.rank >= 3;
        },
        message(...lines) {
            messages.push(...lines);
        },
        inventory: {
            add(id, amount) {
                added.push([id, amount]);
            }
        },
        world: {
            getPlayerByUsername: (name) => others[name] || null,
            addPlayerDrop() {}
        }
    };
    return player;
}

function withPolicy(cmd, mint, fn) {
    const saved = [process.env.ARSC_CMD_POLICY, process.env.ARSC_MINT_POLICY];
    process.env.ARSC_CMD_POLICY = cmd;

    if (mint == null) {
        delete process.env.ARSC_MINT_POLICY;
    } else {
        process.env.ARSC_MINT_POLICY = mint;
    }

    return fn().finally(() => {
        [process.env.ARSC_CMD_POLICY, process.env.ARSC_MINT_POLICY] = saved;

        for (const [key, value] of [['ARSC_CMD_POLICY', saved[0]], ['ARSC_MINT_POLICY', saved[1]]]) {
            if (value === undefined) {
                delete process.env[key];
            }
        }
    });
}

test('::item marks the player minted (open policy by default)', () =>
    withPolicy('open', null, async () => {
        const player = makePlayer('zasama');
        await command({ player }, { command: 'item', args: ['10', '500'] });
        assert.deepStrictEqual(player.added, [[10, 500]]);
        assert.ok(player.cache.minted > 0);
    }));

test('ARSC_MINT_POLICY list: refuses others, commands still work', () =>
    withPolicy('open', 'list:zasama,horatius', async () => {
        const human = makePlayer('somebody');
        await command({ player: human }, { command: 'item', args: ['10', '500'] });
        assert.deepStrictEqual(human.added, []);
        assert.strictEqual(human.cache.minted, undefined);
        assert.match(human.messages[0], /cannot conjure/);

        const sentinel = makePlayer('Horatius');
        await command({ player: sentinel }, { command: 'item', args: ['373', '4'] });
        assert.deepStrictEqual(sentinel.added, [[373, 4]]);
        assert.ok(sentinel.cache.minted);

        assert.strictEqual(worldAdmin.canMint(makePlayer('zasamax')), false);
    }));

test('policy clauses joined by ; (the live compose: rank;prefix:bot;list:...)', () =>
    withPolicy('open', 'rank;prefix:bot;list:zasama,kale stille', async () => {
        assert.strictEqual(worldAdmin.canMint(makePlayer('botwa1')), true);
        assert.strictEqual(worldAdmin.canMint(makePlayer('Kale Stille')), true);
        assert.strictEqual(worldAdmin.canMint(makePlayer('Zasama')), true);
        assert.strictEqual(worldAdmin.canMint(makePlayer('somebody')), false);

        const admin = makePlayer('somebody');
        admin.rank = 3;
        assert.strictEqual(worldAdmin.canMint(admin), true);
    }));

test('::give marks the receiver, not the giver', () =>
    withPolicy('open', 'open', async () => {
        const other = makePlayer('friend');
        const giver = makePlayer('giver', { friend: other });
        other.message = () => {};
        await command({ player: giver }, { command: 'give', args: ['friend', '10', '100'] });
        assert.ok(other.cache.minted);
        assert.strictEqual(giver.cache.minted, undefined);
    }));

test('::setcache cannot clear minted; ::ge works under a closed command policy', () =>
    withPolicy('prefix:nobody', 'open', async () => {
        const player = makePlayer('admin');
        player.rank = 3;
        player.cache.minted = 5;
        await command({ player }, { command: 'setcache', args: ['minted', '0'] });
        assert.strictEqual(player.cache.minted, 5);

        const human = makePlayer('human');
        human.x = 0;
        human.y = 0;
        human.world.npcs = { getInArea: () => [] };
        await command({ player: human }, { command: 'ge', args: ['offers'] });
        assert.match(human.messages[0], /^\[GE\] refused FAR/);
    }));

test('getSaveMessage copies skills without touching the live base levels', { skip: !Player && 'canvas not built' }, () => {
    const player = Object.create(Player.prototype);
    Object.assign(player, {
        id: 1,
        skills: { attack: { current: 5, experience: 400, base: 5 } },
        inventory: [],
        bank: [],
        cache: {},
        friends: [],
        ignores: [],
        questStages: {},
        appearance: { hairColour: 1 }
    });

    const message = player.getSaveMessage();
    assert.strictEqual(message.handler, 'playerUpdate');
    assert.strictEqual(message.skills.attack.base, undefined);
    assert.strictEqual(message.skills.attack.experience, 400);
    assert.strictEqual(player.skills.attack.base, 5);
});
