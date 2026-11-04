// Eating. The heal amounts and leftovers (pie halves and dishes, cake slices, pizza halves, the bowl from stew and
// curry) come from rsc-data edible.json; the messages and the foods with their own effects are ported from Open-RSC
// Core-Framework authentic/itemactions/Eating.java (AGPL-3.0): the Al Kharid kebab's random outcome, the tasty
// Ugthanki kebab, the special defence cabbage, the rock cake, the Oomlie meat parcel, the rotten apples, and the
// one-line messages of the fruits and gnome foods. Jangerberries are InvAction.java handleJangerberries.
// "It heals some health" is only said when hits were below the maximum and the food has no message of its own.

const edible = require('@2003scape/rsc-data/edible');
const { addStat, subStat, healStat } = require('../../stats');

const KEBAB_ID = 210;
const TASTY_UGTHANKI_KEBAB_ID = 1102;
const SPECIAL_DEFENSE_CABBAGE_ID = 228;
const CABBAGE_ID = 18;
const ROCK_CAKE_ID = 1061;
const ROTTEN_APPLES_ID = 801;
const COOKED_OOMLIE_MEAT_PARCEL_ID = 1269;
const JANGERBERRIES_ID = 936;

const que = (player, message) => player.message(`@que@${message}`);
const randomInt = (low, high) => low + Math.floor(Math.random() * (high - low + 1));

// foods with only their own "You eat..." line(s) (Eating.java); a function gets the lowercase item name
const MESSAGES = new Map([
    [873, ['You eat the leaves..chewy but tasty']], // equa leaves
    [765, ['You eat the berrys..quite tasty']], // dwellberries
    [855, ["You eat the lemon ..it's very sour"]],
    [856, ["You eat the lemon slices ..they're very sour"]],
    [860, ["You eat the lemon cubes ..they're very sour"]],
    [863, ["You eat the lime ..it's quite sour"]],
    [864, (name) => [`You eat the ${name}..they're quite sour`]], // lime chunks
    [865, (name) => [`You eat the ${name}..they're quite sour`]], // lime slices
    [857, ["You eat the orange ...yum"]],
    [858, ['You eat the orange slices ...yum']],
    [859, ['You eat the orange cubes ...yum']],
    [861, ['You eat the pineapple ...yum']],
    [862, ['You eat the pineapple chunks ..yum']],
    [871, ['You eat the cream..you get some on your nose']],
    [132, ['You eat the meat']]
]);

// gnome foods: the quest-tab line, then a chat line (Eating.java)
const GNOME_FOODS = new Map();
const gnome = (ids, first, second) => ids.forEach((id) => GNOME_FOODS.set(id, [first, second]));
gnome([907, 950], () => 'You eat the choc bomb', 'it tastes great');
gnome([908, 951], () => 'You eat the veg ball', 'it tastes quite good');
gnome([910, 953], () => 'You eat the tangled toads legs', 'it tastes.....slimey');
gnome([885], () => 'You eat the gnome bowl', "it's pretty tastless");
gnome([900], () => 'You eat the gnome crunchies', null);
gnome([901, 944], () => 'You eat the cheese and tomato batta', "it's quite tasty");
gnome([902, 945, 904, 947], (name) => `You eat the ${name}`, "it's a bit chewy");
gnome([905, 948, 906, 949], (name) => `You eat the ${name}`, "it's tastes pretty good");
gnome([911, 954, 914, 957], (name) => `You eat the ${name}`, "they're very tasty");
gnome([912, 955, 913, 956], (name) => `You eat the ${name}`, "they're a bit chewy");

function healAmount(definition) {
    if (typeof definition === 'number') {
        return definition;
    }

    return (definition && definition.hits) || 0;
}

// hits up by amount (never above the maximum); true if it healed
function heal(player, amount) {
    const { hits } = player.skills;

    if (hits.current >= hits.base) {
        return false;
    }

    const level = Math.min(hits.current + amount, hits.base);

    player.changeStat('hits', level - hits.current);

    return true;
}

// Eating.java handleKebab: one roll of 0-31
async function eatKebab(player) {
    const { hits } = player.skills;
    const rand = randomInt(0, 31);
    let restore = 0;

    que(player, 'You eat the Kebab');

    if (rand === 0) {
        que(player, 'That tasted a bit dodgy');
        player.message('You feel a bit ill');

        if (hits.current > 2) {
            const damage = randomInt(2, 4);
            player.changeStat('hits', Math.max(hits.current - damage, 1) - hits.current);
        }
    } else if (rand <= 1) {
        que(player, 'Wow that was an amazing kebab!');
        player.message('You feel slightly invigorated');
        const boost = randomInt(1, 3);

        for (const skill of ['attack', 'strength', 'defense']) {
            if (player.skills[skill].current <= player.skills[skill].base) {
                player.changeStat(skill, boost);
            }
        }

        restore = 30;
    } else if (rand <= 8) {
        que(player, 'That was a good kebab');
        await player.world.sleepTicks(2);
        player.message('You feel a lot better');
        restore = randomInt(10, 20);
    } else if (rand <= 28) {
        que(player, 'It heals some health');
        restore = Math.floor((hits.base * 10) / 100);
    } else {
        que(player, "The kebab didn't seem to do a lot");
    }

    if (restore > 0) {
        heal(player, restore);
    }
}

// returns true when the food said its own heal line (no "It heals some health" afterwards)
async function eatMessages(player, item) {
    const name = item.definition.name.toLowerCase();
    const definition = edible[item.id];

    switch (item.id) {
        case SPECIAL_DEFENSE_CABBAGE_ID: {
            que(player, `You eat the ${name}`);
            que(player, 'It seems to taste nicer than normal');
            const defense = player.skills.defense;

            if (defense.current + 1 <= defense.base + 1) {
                player.changeStat('defense', 1);
            }

            return true;
        }
        case CABBAGE_ID:
            que(player, `You eat the ${name}. Yuck!`);
            que(player, 'It heals some health anyway');
            return true;
        case TASTY_UGTHANKI_KEBAB_ID:
            player.sendBubble(item.id);
            que(player, `You eat the ${item.definition.name}`);
            que(player, 'It heals some health');
            await player.say(['Yummmmm!', 'Oh, so nice!!!', 'Lovely!'][randomInt(0, 2)]);
            return true;
        case COOKED_OOMLIE_MEAT_PARCEL_ID:
            que(player, 'You eat the prepared Oomlie meat in Palm leaf parcel');
            player.message('It tastes very gamey !');
            return true;
        case ROCK_CAKE_ID:
            que(player, `You eat the ${name}`);
            await player.say('Ow! I nearly broke a tooth!');
            player.message('You feel strangely heavier and more tired');
            return false;
        case ROTTEN_APPLES_ID:
            que(player, 'you eat an apple');
            await player.world.sleepTicks(3);
            await player.say('yuck');
            player.message("it's rotten, you spit it out");
            return false;
        default:
    }

    const gnomeFood = GNOME_FOODS.get(item.id);

    if (gnomeFood) {
        que(player, gnomeFood[0](name));

        if (gnomeFood[1]) {
            player.message(gnomeFood[1]);
        }

        return false;
    }

    const lines = MESSAGES.get(item.id);

    if (lines) {
        for (const line of typeof lines === 'function' ? lines(name) : lines) {
            que(player, line);
        }

        return false;
    }

    if (definition && typeof definition === 'object' && definition.message) {
        for (const line of Array.isArray(definition.message) ? definition.message : [definition.message]) {
            que(player, line);
        }

        return false;
    }

    que(player, `You eat the ${name}`);

    return false;
}

// InvAction.java handleJangerberries
async function eatJangerberries(player) {
    que(player, 'You eat the Jangerberries');
    await player.world.sleepTicks(3);

    if (!player.inventory.has(JANGERBERRIES_ID)) {
        return;
    }

    player.inventory.remove(JANGERBERRIES_ID);
    addStat(player, 'attack', 2, 0);
    subStat(player, 'defense', 1, 0);
    addStat(player, 'strength', 1, 0);
    healStat(player, 'hits', 2, 0);
    healStat(player, 'prayer', 1, 0);
}

async function onInventoryCommand(player, item) {
    if (!/eat/i.test(item.definition.command || '')) {
        return false;
    }

    if (item.id === JANGERBERRIES_ID) {
        await eatJangerberries(player);
        return true;
    }

    const definition = edible[item.id];

    if (item.id !== KEBAB_ID && definition === undefined) {
        return false;
    }

    if (!player.inventory.has(item.id)) {
        return true;
    }

    player.inventory.remove(item.id);
    player.sendSound('eat');

    if (item.id === KEBAB_ID) {
        await eatKebab(player);
        return true;
    }

    const ownHealLine = await eatMessages(player, item);
    const healed = heal(player, healAmount(definition));

    if (healed && !ownHealLine) {
        que(player, 'It heals some health');
    }

    // the edible turns into something else (pie dish, partial cake, half pizza, bowl)
    if (definition && typeof definition === 'object' && typeof definition.result !== 'undefined') {
        player.inventory.add(definition.result);
    }

    return true;
}

module.exports = { onInventoryCommand };
