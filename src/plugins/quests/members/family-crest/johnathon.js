// Ported from Open-RSC Core-Framework authentic/quests/members/FamilyCrest.java (Johnathon branch, onUseNpc) (AGPL-3.0).
// Johnathon (314, "Wizard"), upstairs in the Jolly Boar inn north-east of Varrock: stage 7 he is poisoned, a cure
// poison potion (566/567/568) on him gives stage 8 and sends the player to Chronozon; after the quest the gauntlets of
// chaos.

const { ITEMS, NPCS, GAUNTLETS, stage, getGauntletEnchantment, enchantGauntlets } = require('./shared');

const CURE_POISON_IDS = new Set([566, 567, 568]);

async function defeat(player, npc) {
    await npc.say(
        'Well you will need to be a good mage',
        "And I don't seem to be able to manage it",
        'He will need to be hit by the 4 elemental spells of death',
        'Before he can be defeated'
    );

    const choice = await player.ask(
        ['Where can I find Chronozon?', 'So how did you end up getting poisoned', 'I will be on my way now'],
        true
    );

    if (choice === 0) {
        await find(player, npc);
    } else if (choice === 1) {
        await poisoned(player, npc);
    }
}

async function poisoned(player, npc) {
    await npc.say(
        "There are spiders towards the entrance to Chronozon's cave",
        'I must have taken a nip from one of them'
    );

    const choice = await player.ask(
        ['So is this Chronozon hard to defeat?', 'Where can I find Chronozon?', 'I will be on my way now'],
        true
    );

    if (choice === 0) {
        await defeat(player, npc);
    } else if (choice === 1) {
        await find(player, npc);
    }
}

async function find(player, npc) {
    await npc.say('He is in the wilderness, somewhere below the obelisk of air');

    const choice = await player.ask(
        ['So is this Chronozon hard to defeat?', 'So how did you end up getting poisoned', 'I will be on my way now'],
        true
    );

    if (choice === 0) {
        await defeat(player, npc);
    } else if (choice === 1) {
        await poisoned(player, npc);
    }
}

async function questComplete(player, npc) {
    const { world } = player;

    await npc.say('Hello again');

    if (!player.inventory.has(ITEMS.steelGauntlets) || getGauntletEnchantment(player) !== GAUNTLETS.STEEL) {
        await npc.say('My family now considers you a hero');
        return;
    }

    await player.say('Your father tells me, you can improve these gauntlets a bit');
    await npc.say(
        'He would be right',
        "Though I didn't get good enough at the death spells to defeat chronozon",
        'I am pretty good at the chaos spells',
        'I can enchant your gauntlets so that your bolt spells are more effective'
    );

    const choice = await player.ask(
        ['That sounds good to me', 'I shall see what options your brothers can offer me first'],
        true
    );

    if (choice === 0) {
        player.message('Johnathon waves his staff');
        await world.sleepTicks(3);
        player.message('The gauntlets sparkle and shimmer');
        await world.sleepTicks(3);
        enchantGauntlets(player, GAUNTLETS.CHAOS);
    }
    // Java tests menu == 0 twice, so "Boring crafting and cooking enhacements knowing them" is never said
}

async function onTalkToNPC(player, npc) {
    if (npc.id !== NPCS.johnathon) {
        return false;
    }

    player.engage(npc);

    const questStage = stage(player);

    if (!player.world.members || (questStage >= 0 && questStage < 7)) {
        await npc.say('I am so very tired, leave me to rest');
    } else if (questStage === 7) {
        if (player.cache.johnathonIll) {
            await npc.say('Arrgh what has that spider done to me', 'I feel so ill, I can hardly think');
        } else {
            await player.say('Greetings, are you Johnathon Fitzharmon?');
            await npc.say('That is I');
            await player.say('I seek your fragment of the Fitzharmon family quest');
            await npc.say('The poison it is too much', 'arrgh my head is all of a spin');
            player.message("Sweat is pouring down Johnathon's face");
            player.cache.johnathonIll = true;
        }
    } else if (questStage === 8) {
        if (player.inventory.has(ITEMS.crestFragmentThree)) {
            await player.say('I have your part of the crest now');
            await npc.say('Well done take it to my father');
        } else {
            await npc.say("I'm trying to kill the demon chronozon  that you mentioned");

            const choice = await player.ask(
                ['So is this Chronozon hard to defeat?', 'Where can I find Chronozon?', 'Wish me luck'],
                true
            );

            if (choice === 0) {
                await defeat(player, npc);
            } else if (choice === 1) {
                await find(player, npc);
            } else if (choice === 2) {
                await npc.say('Good luck');
            }
        }
    } else if (questStage === -1) {
        await questComplete(player, npc);
    }

    player.disengage();
    return true;
}

async function onUseWithNPC(player, npc, item) {
    if (npc.id !== NPCS.johnathon || !CURE_POISON_IDS.has(item.id)) {
        return false;
    }

    if (stage(player) !== 7) {
        player.message('nothing interesting happens');
        return true;
    }

    player.engage(npc);

    player.message('You feed your potion to Johnathon');
    await player.world.sleepTicks(3);
    player.inventory.remove(item.id);
    player.questStages.familyCrest = 8;
    delete player.cache.johnathonIll;

    await npc.say("Wow I'm feeling a lot better now", 'Thankyou, what can I do for you?');
    await player.say("I'm after your part of the fitzharmon family crest");
    await npc.say(
        "Ooh I don't think I have that anymore",
        'I have been trying to slay chronozon the blood demon',
        'and I think I dropped a lot of my things near him when he drove me away',
        'He will have it now'
    );

    const choice = await player.ask(
        ['So is this Chronozon hard to defeat?', 'Where can I find Chronozon?', 'So how did you end up getting poisoned'],
        true
    );

    if (choice === 0) {
        await defeat(player, npc);
    } else if (choice === 1) {
        await find(player, npc);
    } else if (choice === 2) {
        await poisoned(player, npc);
    }

    player.disengage();
    return true;
}

module.exports = { onTalkToNPC, onUseWithNPC };
