// Drinks that are not herblaw potions (those are items/potions.js): ales, wine, spirits, tea, chocolaty milk, the
// poison chalice and the gnome cocktails. Each one is used up and leaves its container (a beer glass, a jug, a bucket,
// a cocktail glass) where the Java gives one.
// Ported from Open-RSC Core-Framework authentic/itemactions/Drinkables.java (AGPL-3.0), the stat changes through the
// RuneScript functions in src/stats.js (Functions.java addstat/substat/healstat). Skipped: the half and full cocktail
// glasses and the odd looking cocktail (Gnome Bar minigame state), unfermented wine (FERMENTED_WINE is off).
// https://classic.runescape.wiki/w/Drinks

const { addStat, subStat, healStat } = require('../../stats');

const BEER_GLASS_ID = 620;
const JUG_ID = 140;
const BUCKET_ID = 21;
const COCKTAIL_GLASS_ID = 833;
const WINE_ID = 142;
const HALF_FULL_WINE_JUG_ID = 246;
const WHISKY_ID = 868;

const MAGIC_SKILLS = ['magic'];

// quest-tab messages (Functions.mes)
function mes(player, ...messages) {
    for (const message of messages) {
        player.message(`@que@${message}`);
    }
}

const sleep = (player, ticks) => player.world.sleepTicks(ticks);

async function spirits(player, item) {
    mes(player, `You drink the ${item.definition.name.toLowerCase()}`, 'You feel slightly reinvigorated', 'And slightly dizzy too');
    subStat(player, 'attack', item.id === WHISKY_ID ? 6 : 3, 0);
    addStat(player, 'strength', 5, 0);
    healStat(player, 'hits', 4, 0);
}

async function fruitCocktail(player, item) {
    healStat(player, 'hits', item.id === 879 ? 9 : 8, 0); // pineapple punch heals 9 (the Java tests the plain one only)
    mes(player, 'You drink the cocktail', 'yum ..it tastes great', 'You feel reinvigorated');
    player.inventory.add(COCKTAIL_GLASS_ID);
}

async function specialCocktail(player) {
    healStat(player, 'hits', 5, 0);
    subStat(player, 'attack', 1, 3);
    addStat(player, 'strength', 1, 6);
    mes(player, 'You drink the cocktail', 'yum ..it tastes great', 'although you feel slightly dizzy');
    player.inventory.add(COCKTAIL_GLASS_ID);
}

async function badWine(player, item) {
    player.message('You drink the bad wine');
    player.sendBubble(item.id);
    player.inventory.add(JUG_ID);
    subStat(player, 'attack', 3, 0);
    await sleep(player, 2);
    player.message('You start to feel sick');
}

async function wine(player, item) {
    player.sendBubble(item.id);
    mes(player, 'You drink the wine', 'It makes you feel a bit dizzy');

    // a full jug leaves half a jug 1 time in 25001
    const isFullWine = item.id === WINE_ID;

    if (isFullWine && Math.floor(Math.random() * 25001) === 0) {
        player.inventory.add(HALF_FULL_WINE_JUG_ID);
    } else {
        player.inventory.add(JUG_ID);
    }

    healStat(player, 'hits', isFullWine ? 11 : 5, 0);
    subStat(player, 'attack', isFullWine ? 3 : 1, 0);
}

async function chocolatyMilk(player, item) {
    player.sendBubble(item.id);
    player.message('You drink the chocolaty milk');
    player.inventory.add(BUCKET_ID);
    healStat(player, 'hits', 4, 0);
}

async function tea(player, item) {
    player.sendBubble(item.id);
    player.message('You drink the cup of tea');
    healStat(player, 'hits', 2, 2);
    addStat(player, 'attack', 2, 2);
}

async function beer(player, item) {
    player.sendBubble(item.id);
    mes(player, 'You drink the beer', 'You feel slightly reinvigorated', 'And slightly dizzy too');
    player.inventory.add(BEER_GLASS_ID);
    subStat(player, 'attack', 1, 5);
    addStat(player, 'strength', 2, 0);
    healStat(player, 'hits', 1, 0);
}

async function greenmansAle(player, item) {
    player.sendBubble(item.id);
    mes(player, 'You drink the greenmans ale');
    player.inventory.add(BEER_GLASS_ID);
    await sleep(player, 2);
    mes(player, 'It has a strange taste');
    subStat(player, 'attack', 0, 5);
    subStat(player, 'defense', 0, 5);
    addStat(player, 'herblaw', 1, 0);
    healStat(player, 'hits', 1, 0);
}

async function wizardsMindBomb(player, item) {
    player.sendBubble(item.id);
    mes(player, "you drink the Wizard's Mind Bomb");
    player.inventory.add(BEER_GLASS_ID);
    await sleep(player, 2);
    mes(player, 'You feel very strange');

    for (const skill of ['attack', 'defense', 'strength']) {
        subStat(player, skill, 0, 5);
    }

    for (const skill of MAGIC_SKILLS) {
        addStat(player, skill, 2, 2);
    }

    healStat(player, 'hits', 1, 0);
}

async function dwarvenStout(player, item) {
    player.sendBubble(item.id);
    mes(player, 'You drink the Dwarven Stout', 'It tastes foul');
    player.inventory.add(BEER_GLASS_ID);
    await sleep(player, 3);
    mes(player, 'It tastes pretty strong too');

    for (const skill of ['attack', 'defense', 'strength']) {
        subStat(player, skill, 0, 5);
    }

    addStat(player, 'smithing', 1, 0);
    addStat(player, 'mining', 1, 0);
    healStat(player, 'hits', 1, 0);
}

// Asgarnian ale, dragon bitter: the same regional ale
function regionalAle(name) {
    return async (player, item) => {
        mes(player, `You drink the ${name}`);
        player.sendBubble(item.id);
        player.inventory.add(BEER_GLASS_ID);
        await sleep(player, 2);
        mes(player, 'You feel slightly reinvigorated', 'And slightly dizzy too');
        subStat(player, 'attack', 1, 5);
        addStat(player, 'strength', 2, 0);
        healStat(player, 'hits', 1, 0);
    };
}

async function grog(player, item) {
    mes(player, 'You drink the Grog');
    player.sendBubble(item.id);
    player.inventory.add(BEER_GLASS_ID);
    await sleep(player, 2);
    mes(player, 'You feel slightly reinvigorated', 'And slightly dizzy too');
    subStat(player, 'attack', 6, 0);
    addStat(player, 'strength', 3, 0);
    healStat(player, 'hits', 3, 0);
}

// one of six outcomes, equally likely (DataConversions.random(0, 5))
async function poisonChalice(player) {
    switch (Math.floor(Math.random() * 6)) {
        case 0:
            subStat(player, 'hits', Math.random() < 0.5 ? 1 : 3, 0);
            player.message('That tasted a bit dodgy. You feel a bit ill');
            break;
        case 1:
            healStat(player, 'hits', 0, 5);
            player.message('It heals some health');
            break;
        case 2:
            addStat(player, 'crafting', 1, 0);
            subStat(player, 'attack', 1, 0);
            subStat(player, 'defense', 1, 0);
            player.message('You feel a little strange');
            break;
        case 3:
            healStat(player, 'hits', 0, 15);
            addStat(player, 'thieving', 1, 0);
            player.message('You feel a lot better');
            break;
        case 4:
            healStat(player, 'hits', 0, 30);
            addStat(player, 'attack', 4, 0);
            addStat(player, 'strength', 4, 0);
            addStat(player, 'defense', 4, 0);
            player.message('Wow that was an amazing!! You feel really invigorated');
            break;
        default:
            player.message('It has a slight taste of apricot');
    }
}

const DRINKS = new Map([
    [876, spirits], // brandy
    [869, spirits], // vodka
    [870, spirits], // gin
    [WHISKY_ID, spirits],
    [866, fruitCocktail], // fruit blast
    [937, fruitCocktail], // fruit blast (Blurberry barman)
    [879, fruitCocktail], // pineapple punch
    [940, fruitCocktail], // pineapple punch (Blurberry barman)
    [877, specialCocktail], // blurberry special
    [938, specialCocktail],
    [878, specialCocktail], // wizard blizzard
    [939, specialCocktail],
    [874, specialCocktail], // SGG
    [941, specialCocktail],
    [875, specialCocktail], // chocolate saturday
    [942, specialCocktail],
    [872, specialCocktail], // drunk dragon
    [943, specialCocktail],
    [180, badWine],
    [HALF_FULL_WINE_JUG_ID, wine],
    [WINE_ID, wine],
    [770, chocolatyMilk],
    [739, tea],
    [193, beer],
    [830, greenmansAle],
    [268, wizardsMindBomb],
    [269, dwarvenStout],
    [267, regionalAle('Ale')], // Asgarnian ale
    [829, regionalAle('Dragon bitter')],
    [598, grog],
    [737, poisonChalice]
]);

async function onInventoryCommand(player, item) {
    const drink = DRINKS.get(item.id);

    if (!drink || !/drink/i.test(item.definition.command || '')) {
        return false;
    }

    if (!player.inventory.has(item.id)) {
        return true;
    }

    player.inventory.remove(item.id);
    await drink(player, item);

    return true;
}

module.exports = { onInventoryCommand, DRINKS };
