// Thieving: skills/thieving.js pickpocketing, driven by fake player and npc objects.

const test = require('node:test');
const assert = require('node:assert/strict');

const npcs = require('@2003scape/rsc-data/config/npcs.json');
const thievingData = require('@2003scape/rsc-data/skills/thieving.json');
const thieving = require('../src/plugins/skills/thieving');

function fakePlayer(level = 1) {
    const player = {
        world: { async sleepTicks() {} },
        skills: { thieving: { current: level, base: level } },
        messages: [],
        message(...m) {
            player.messages.push(...m);
        }
    };
    return player;
}

const npc = (id) => ({ id, definition: npcs[id] });

test('an npc with no pickpocket option is left to other plugins', async () => {
    assert.equal(await thieving.onNPCCommand(fakePlayer(), npc(0)), false);
});

test('men, a farmer and warriors rsc-data leaves out are pickpocketed like their marks', async () => {
    for (const [id, mark] of [[72, 11], [318, 11], [319, 63], [159, 86], [320, 86]]) {
        assert.equal(npcs[id].command, 'pickpocket', `npc ${id} offers Pickpocket`);
        assert.equal(thievingData.pickpocket[id], undefined, `rsc-data has no entry for npc ${id}`);

        // below the mark's level: claimed, with the level message, and nothing rolled
        const required = thievingData.pickpocket[mark].level;
        const player = fakePlayer(0);
        assert.equal(await thieving.onNPCCommand(player, npc(id)), true, `npc ${id} is claimed`);
        assert.deepEqual(player.messages, [
            `You need a thieving level of ${required} to steal from the ${npcs[id].name.toLowerCase()}`
        ]);
    }
});
