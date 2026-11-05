// Ported from Open-RSC Core-Framework authentic/npcs/catherby/Chef.java (AGPL-3.0).
// Caleb, the chef (310) in Catherby: stage 1 -> 2 (the fish list), 2 -> 3 (crest fragment 695 for cooked swordfish,
// bass, tuna, salmon and shrimp), and after the quest the gauntlets of cooking.

const {
    ITEMS,
    NPCS,
    GAUNTLETS,
    stage,
    getGauntletEnchantment,
    enchantGauntlets
} = require('./shared');

const SWORDFISH_ID = 370;
const BASS_ID = 555;
const TUNA_ID = 367;
const SALMON_ID = 357;
const SHRIMP_ID = 350;

const FISH_IDS = [SWORDFISH_ID, BASS_ID, TUNA_ID, SALMON_ID, SHRIMP_ID];

async function restOfCrest(npc) {
    await npc.say(
        'Well we had a bit of a fight over it',
        'We all wanted to be the heir of our fathers lands',
        'we each ended up with a piece of the crest',
        'none of us wanted to give their piece of the crest up to any of the others',
        'And none of us wanted to face our father',
        'coming home without a complete crest'
    );
}

async function whereAreYourBrothers(player, npc) {
    await player.say('So do you know where I could find any of your brothers?');
    await npc.say(
        "Well we haven't really kept in touch",
        'What with all falling out over the crest',
        'I did hear from my brother Avan about a year ago though',
        'He said he was a living in a town in the desert',
        'Ask around the desert and you may find him',
        'My brother has very expensive tastes',
        'He may not give up the crest easily'
    );
    delete player.cache.skippedMenu;
}

async function haveYourBit(player, npc) {
    await npc.say('Well I am the oldest son, by rights it is mine');
    await player.say("It's not a lot of use to you without the rest of it though");
    await npc.say(
        'Well true',
        "So I'll tell you what I'll do",
        'I am struggling to complete my seafood salad',
        "I don't seem to be able to get hold of the ingredients I need",
        "Help me and I'll help you"
    );
    await player.say('What are you missing exactly?');
    await npc.say('I need cooked swordfish,bass,tuna,salmon and shrimp');

    const choice = await player.ask(['Ok I will get those', "Why don't you just give me the crest?"], true);

    if (choice === 0) {
        player.questStages.familyCrest = 2;
    } else if (choice === 1) {
        await npc.say("No I don't want to just give it away");
    }
}

async function initialDialogue(player, npc, option) {
    if (option === 0) {
        await player.say('Are you Caleb Fitzharmon?');
        await npc.say('I am he, and who might you be?');
        await player.say(
            'I have been sent by your father',
            'He wants me to retrieve the Fitzharmon family crest'
        );
        await npc.say('Ah, yes hmm well I do have a bit of it yes');

        const choice = await player.ask(
            ['Err what happened to the rest of crest?', 'So can I have your bit?'],
            true
        );

        if (choice === 0) {
            await restOfCrest(npc);
            await player.say('So can I have your bit?');
            await haveYourBit(player, npc);
        } else if (choice === 1) {
            await haveYourBit(player, npc);
        }
    } else if (option === 1) {
        await player.say('Nothing I will be on my way');
    } else if (option === 2) {
        await player.say('I see you are a chef', 'Will you cook me anything?');
        await npc.say(
            'I would, but I am very busy',
            'Trying to prepare my special fish salad',
            'Which I hope will significantly increase my renown as a master chef'
        );
    }
}

async function questComplete(player, npc) {
    const { world } = player;

    if (getGauntletEnchantment(player) !== GAUNTLETS.STEEL) {
        await npc.say(
            'I hear you have bought the completed crest to my father', // sic
            'Impressive work I must say'
        );
        return;
    }

    await npc.say(
        'I hear you have brought the completed crest to my father',
        'Impressive work I must say'
    );

    if (!player.inventory.has(ITEMS.steelGauntlets)) {
        return;
    }

    await player.say('My Father says you can improve these gauntlets for me');
    await npc.say(
        'Yes that is true',
        'I can change them to gauntlets of cooking',
        'Wearing them means you will burn your lobsters, swordish and shark less' // sic
    );

    const choice = await player.ask(
        ['Yes please do that for me', "I'll see what your brothers have to offer first"],
        true
    );

    if (choice === 0) {
        player.message('Caleb holds the gauntlets and closes his eyes');
        await world.sleepTicks(3);
        player.message('Caleb concentrates');
        await world.sleepTicks(3);
        player.message('Caleb hands the gauntlets to you');
        await world.sleepTicks(3);
        enchantGauntlets(player, GAUNTLETS.COOKING);
    } else if (choice === 1) {
        await npc.say('Ok suit yourself');
    }
}

async function fishCollecting(player, npc) {
    const { world } = player;

    await npc.say('How is the fish collecting going?');

    if (!FISH_IDS.every((id) => player.inventory.has(id))) {
        await player.say("I haven't got all the fish yet");
        await npc.say('Remember I want cooked swordfish, bass, tuna, salmon and shrimp');
        return;
    }

    await player.say('Yes i have all of that now');
    player.message('You give all of the fish to Caleb');
    await world.sleepTicks(3);

    for (const id of FISH_IDS) {
        player.inventory.remove(id);
    }

    player.message('Caleb gives you his piece of the crest');
    player.inventory.add(ITEMS.crestFragmentOne);
    player.cache.skippedMenu = true;
    player.questStages.familyCrest = 3;

    const choice = await player.ask(['Err what happened to the rest of it?', 'Thankyou very much'], true);

    if (choice === 0) {
        await restOfCrest(npc);
        await whereAreYourBrothers(player, npc);
    }
}

async function findAvan(player, npc) {
    if (player.cache.skippedMenu) {
        await npc.say("Hello again, I'm just putting the finishing touches to my salad");

        const choice = await player.ask(
            ['Err what happened to the rest of the crest?', 'Good luck with that then'],
            false
        );

        if (choice === 0) {
            await player.say('Err what happened to the rest of the crest?');
            await restOfCrest(npc);
            await whereAreYourBrothers(player, npc);
        } else if (choice === 1) {
            await player.say('Good look with that then'); // sic
        }

        return;
    }

    await player.say('Where did you say I could find Avan?');
    await npc.say('He said he was a living in a town in the desert', 'Ask around the desert and you may find him');
}

async function restOfTheCrest(player, npc) {
    await npc.say('How are you doing getting the rest of the crest?');

    if (player.inventory.has(ITEMS.familyCrest)) {
        await player.say('I have found it');
        await npc.say('Well done, take it to my father');
    } else if (!player.inventory.has(ITEMS.crestFragmentOne)) {
        const choice = await player.ask(['I am still working on it', 'I have lost the piece you gave me'], true);

        if (choice === 0) {
            await npc.say('Well good luck in your quest');
        } else if (choice === 1) {
            await npc.say('Ah well here is another one');
            player.inventory.add(ITEMS.crestFragmentOne);
        }
    } else {
        await player.say('I am still working on it');
        await npc.say('Well good luck in your quest');
    }
}

async function onTalkToNPC(player, npc) {
    if (npc.id !== NPCS.caleb) {
        return false;
    }

    player.engage(npc);

    const questStage = stage(player);

    if (questStage === -1) {
        await questComplete(player, npc);
    } else if (questStage === 0 || questStage === 1) {
        await npc.say('Who are you? What are you after?');

        if (questStage === 0) {
            const choice = await player.ask(
                ['Nothing, I will be on my way', 'I see you are a chef, will you cook me anything?'],
                false
            );

            if (choice >= 0) {
                await initialDialogue(player, npc, choice + 1);
            }
        } else {
            const choice = await player.ask(
                [
                    'Are you Caleb Fitzharmon?',
                    'Nothing, I will be on my way',
                    'I see you are a chef, will you cook me anything?'
                ],
                false
            );

            await initialDialogue(player, npc, choice);
        }
    } else if (questStage === 2) {
        await fishCollecting(player, npc);
    } else if (questStage === 3) {
        await findAvan(player, npc);
    } else {
        await restOfTheCrest(player, npc);
    }

    player.disengage();
    return true;
}

module.exports = { onTalkToNPC };
