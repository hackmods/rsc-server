// Ported from Open-RSC Core-Framework authentic/npcs/brimhaven/BrimHavenBartender.java (AGPL-3.0)
// The Brimhaven bartender: a pint of grog (598, 3 coins), a bottle of Karamja rum (318, 27 coins), and the barcrawl's
// supergrog when the player is on Alfred Grimhand's barcrawl and this bar is not signed yet (cache key deadMansChest,
// miniquests/barcrawl.js). The supergrog lowers attack, defense, prayer, cooking and herblaw by 5-8 (by level band,
// the Java's estimate).

const { shouldHandleBar } = require('../../miniquests/barcrawl');

const BARTENDER_ID = 279;
const COINS_ID = 10;
const GROG_ID = 598;
const KARAMJA_RUM_ID = 318;

function supergrog(player) {
    for (const skill of ['attack', 'defense', 'prayer', 'cooking', 'herblaw']) {
        const { base } = player.skills[skill];
        const reduction = base < 20 ? 5 : base < 40 ? 6 : base < 70 ? 7 : 8;

        player.changeStat(skill, -reduction);
    }
}

async function onTalkToNPC(player, npc) {
    if (npc.id !== BARTENDER_ID) {
        return false;
    }

    const { world } = player;

    player.engage(npc);

    await npc.say('Yohoho me hearty what would you like to drink?');

    const options = ['Nothing thankyou', 'A pint of Grog please', 'A bottle of rum please'];

    if (shouldHandleBar(player, 'deadMansChest')) {
        options.push("I'm doing Alfred Grimhand's barcrawl");
    }

    const choice = await player.ask(options, true);

    if (choice === 1) {
        await npc.say('One grog coming right up', "That'll be 3 gold");

        if (player.inventory.has(COINS_ID, 3)) {
            player.message('You buy a pint of Grog');
            player.inventory.remove(COINS_ID, 3);
            player.inventory.add(GROG_ID);
        } else {
            await player.say("Oh dear. I don't seem to have enough money");
        }
    } else if (choice === 2) {
        await npc.say("That'll be 27 gold");

        if (player.inventory.has(COINS_ID, 27)) {
            player.message('You buy a bottle of rum');
            player.inventory.remove(COINS_ID, 27);
            player.inventory.add(KARAMJA_RUM_ID);
        } else {
            await player.say("Oh dear. I don't seem to have enough money");
        }
    } else if (choice === 3) {
        await npc.say('Haha time to be breaking out the old supergrog', "That'll be 15 coins please");

        if (player.inventory.has(COINS_ID, 15)) {
            player.inventory.remove(COINS_ID, 15);

            for (const line of [
                'The bartender serves you a glass of strange thick dark liquid',
                'You wince and drink it',
                'You stagger backwards'
            ]) {
                player.message(`@que@${line}`);
                await world.sleepTicks(3);
            }

            supergrog(player);
            player.message('@que@You think you see 2 bartenders signing 2 barcrawl cards');
            await world.sleepTicks(3);
            player.cache.barcrawl.deadMansChest = true;
        } else {
            await player.say("Sorry I don't have 15 coins");
        }
    }

    player.disengage();
    return true;
}

module.exports = { onTalkToNPC };
