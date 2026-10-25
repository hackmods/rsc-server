// Battlestaff crafting: skills/crafting/battlestaff.js, driven by fake player and item objects.

const test = require('node:test');
const assert = require('node:assert/strict');

const items = require('@2003scape/rsc-data/config/items.json');
const { battlestaves } = require('@2003scape/rsc-data/skills/crafting');
const battlestaff = require('../src/plugins/skills/crafting/battlestaff');

const BATTLESTAFF_ID = 614;

function fakePlayer(level, inventory) {
    const player = {
        inventory: {
            items: [...inventory],
            has: (id) => player.inventory.items.includes(id),
            add: (id, amount = 1) => {
                for (let i = 0; i < amount; i++) player.inventory.items.push(id);
            },
            remove: (id, amount = 1) => {
                for (let i = 0; i < amount; i++) {
                    const index = player.inventory.items.indexOf(id);
                    if (index !== -1) player.inventory.items.splice(index, 1);
                }
            }
        },
        skills: { crafting: { current: level } },
        messages: [],
        experience: [],
        message(...m) {
            player.messages.push(...m);
        },
        addExperience(skill, amount) {
            player.experience.push([skill, amount]);
        }
    };
    return player;
}

const item = (id) => ({ id });

test('battlestaff is item 614 and the orbs are 612, 613, 626, 627', () => {
    assert.equal(items[BATTLESTAFF_ID].name, 'Battlestaff');
    assert.equal(items[612].name, 'Fire orb');
    assert.equal(items[613].name, 'Water orb');
    assert.equal(items[626].name, 'air orb');
    assert.equal(items[627].name, 'earth orb');
});

test('each orb on a battlestaff makes the matching staff, with XP, at enough level', async () => {
    for (const orbID of [612, 613, 626, 627]) {
        const { level, experience, id: resultID } = battlestaves[orbID];
        const player = fakePlayer(level, [BATTLESTAFF_ID, orbID]);

        const handled = await battlestaff.onUseWithInventory(
            player, item(BATTLESTAFF_ID), item(orbID)
        );

        assert.equal(handled, true, `orb ${orbID} claimed`);
        assert.deepEqual(player.inventory.items, [resultID], `orb ${orbID} made item ${resultID}`);
        assert.deepEqual(player.experience, [['crafting', experience]]);
    }
});

test('the reversed order (orb used on battlestaff) also works', async () => {
    const { level, experience, id: resultID } = battlestaves[613];
    const player = fakePlayer(level, [613, BATTLESTAFF_ID]);

    const handled = await battlestaff.onUseWithInventory(
        player, item(613), item(BATTLESTAFF_ID)
    );

    assert.equal(handled, true);
    assert.deepEqual(player.inventory.items, [resultID]);
    assert.deepEqual(player.experience, [['crafting', experience]]);
});

test('too low a crafting level sends the Java message and removes nothing', async () => {
    const player = fakePlayer(53, [BATTLESTAFF_ID, 613]);

    const handled = await battlestaff.onUseWithInventory(
        player, item(BATTLESTAFF_ID), item(613)
    );

    assert.equal(handled, true);
    assert.deepEqual(player.messages, [
        '@que@You need a crafting level of 54 to make a water battlestaff'
    ]);
    assert.deepEqual(player.inventory.items, [BATTLESTAFF_ID, 613]);
    assert.deepEqual(player.experience, []);
});

test('an unrelated pair is not claimed', async () => {
    const player = fakePlayer(99, [BATTLESTAFF_ID, 1]);

    assert.equal(
        await battlestaff.onUseWithInventory(player, item(BATTLESTAFF_ID), item(1)),
        false
    );
    assert.equal(
        await battlestaff.onUseWithInventory(player, item(613), item(612)),
        false
    );
    assert.deepEqual(player.inventory.items, [BATTLESTAFF_ID, 1]);
});
