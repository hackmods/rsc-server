// ARSC sleep-word bypass: ARSC_SLEEP_PREFIX takes a bare prefix ('bot'), '*', or the
// policy syntax (prefix:bot;list:tks), so the fleet's named accounts can wake too.

const test = require('node:test');
const assert = require('node:assert');

const { sleepWord } = require('../src/packet-handlers/sleep');

function sleeper(username, rank = 0) {
    const calls = [];
    return {
        username,
        rank,
        calls,
        interfaceOpen: { sleep: true },
        sleepWord: 'captcha',
        world: { sleepTicks: async () => {} },
        isAdministrator() {
            return this.rank >= 3;
        },
        exitSleep() {
            calls.push('exit');
        },
        sendSleepIncorrect() {
            calls.push('incorrect');
        },
        openSleep() {
            calls.push('reopen');
        }
    };
}

async function wakes(username, env, rank) {
    const saved = { a: process.env.ARSC_SLEEP_ANYWORD, p: process.env.ARSC_SLEEP_PREFIX };
    process.env.ARSC_SLEEP_ANYWORD = env.anyword == null ? '1' : env.anyword;
    if (env.prefix == null) delete process.env.ARSC_SLEEP_PREFIX;
    else process.env.ARSC_SLEEP_PREFIX = env.prefix;
    try {
        const p = sleeper(username, rank);
        await sleepWord({ player: p }, { sleepWord: 'anything' });
        return p.calls[0] === 'exit';
    } finally {
        process.env.ARSC_SLEEP_ANYWORD = saved.a;
        if (saved.p == null) delete process.env.ARSC_SLEEP_PREFIX;
        else process.env.ARSC_SLEEP_PREFIX = saved.p;
    }
}

test('legacy bare prefix: bot* wakes, a named account does not', async () => {
    assert.strictEqual(await wakes('botalpha', { prefix: 'bot' }), true);
    assert.strictEqual(await wakes('tks', { prefix: 'bot' }), false);
    assert.strictEqual(await wakes('botalpha', {}), true); // default 'bot'
});

test('policy syntax: prefix plus a list of named accounts', async () => {
    const prefix = 'prefix:bot;list:tks,everdred,kale stille';
    assert.strictEqual(await wakes('botwa2', { prefix }), true);
    assert.strictEqual(await wakes('tks', { prefix }), true);
    assert.strictEqual(await wakes('Kale Stille', { prefix }), true);
    assert.strictEqual(await wakes('zezima', { prefix }), false);
});

test('star wakes anyone; ANYWORD off wakes no one on a wrong word', async () => {
    assert.strictEqual(await wakes('zezima', { prefix: '*' }), true);
    assert.strictEqual(await wakes('botalpha', { prefix: '*', anyword: '0' }), false);
});

test('the right word still wakes a player outside the policy', async () => {
    process.env.ARSC_SLEEP_ANYWORD = '1';
    process.env.ARSC_SLEEP_PREFIX = 'bot';
    const p = sleeper('zezima');
    await sleepWord({ player: p }, { sleepWord: 'captcha' });
    assert.deepStrictEqual(p.calls, ['exit']);
});
