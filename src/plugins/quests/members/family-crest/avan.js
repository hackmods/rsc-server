// Ported from Open-RSC Core-Framework authentic/quests/members/FamilyCrest.java (Avan branch) (AGPL-3.0).
// Avan (307, "man"), the Al Kharid scorpion pit: stage 4 -> 5 (perfect gold ruby ring and necklace), 6 -> 7 (crest
// fragment 696), and after the quest the gauntlets of goldsmithing.

const { ITEMS, NPCS, GAUNTLETS, stage, getGauntletEnchantment, enchantGauntlets } = require('./shared');

async function bootLead(npc) {
    await npc.say(
        'Well I have been looking for such gold for a while',
        'My latest lead was a dwarf named Boot',
        'Though he has gone back to his home in the mountain now'
    );
}

async function johnathonLead(npc) {
    await npc.say(
        'I heard my brother Johnathon is now a young mage',
        'He is hunting some demon in the wilderness',
        "But he's not doing a very good job of it",
        'He spends most his time recovering in an inn',
        'on the edge of the wilderness'
    );
}

async function questComplete(player, npc) {
    const { world } = player;

    await npc.say('I have heard word from my father', 'Thankyou for helping to restore our family honour');

    if (!player.inventory.has(ITEMS.steelGauntlets) || getGauntletEnchantment(player) !== GAUNTLETS.STEEL) {
        return;
    }

    await player.say('Your father said that you could improve these Gauntlets in some way for me');
    await npc.say(
        'Indeed I can',
        'In my quest to find the perfect gold I learned a lot',
        "I can make it so when you're wearing these"
    );
    await npc.say('You gain more experience when smithing gold');

    const choice = await player.ask(
        ['That sounds good, improve them for me', "I think I'll check my other options with your brothers"],
        false
    );

    if (choice === 0) {
        await player.say('That sounds good, enchant them for me');
        player.message('Avan takes out a little hammer');
        await world.sleepTicks(3);
        player.message('He starts pounding on the gauntlets');
        await world.sleepTicks(3);
        player.message('Avan hands the gauntlets to you');
        await world.sleepTicks(3);
        enchantGauntlets(player, GAUNTLETS.GOLDSMITHING);
    } else if (choice === 1) {
        await player.say("I think I'll check my other options with your brothers");
        await npc.say('Ok if you insist on getting help from the likes of them');
    }
}

async function lookingForAvan(player, npc) {
    const choice = await player.ask(
        ['Why are you hanging around in a scorpion pit?', "I'm looking for a man named Avan"],
        false
    );

    if (choice === 0) {
        await player.say('Why are you hanging about in a scorpion pit?');
        await npc.say("It's a good place to find gold");
    } else if (choice === 1) {
        await player.say("I'm looking for a man named Avan");
        await npc.say("I'm called Avan yes");
        await player.say('You have part of a crest', 'I have been sent to fetch it');
        await npc.say('Is one of my good for nothing brothers after it again?');
        await player.say('no your father would like it back');
        await npc.say(
            'Oh Dad wants it this time',
            "Well I'll tell you what I'll do",
            "I'm trying to obtain the perfect jewellry", // sic
            'There is a lady I am trying to impress',
            'What I want is a gold ring with a red stone in',
            'And a necklace to match',
            'Not just any gold mind you',
            "The gold in these rocks doesn't seem to be of the best quality",
            'I want as good a quality as you can get'
        );
        await player.say('Any ideas where I can find that?');
        await bootLead(npc);
        await player.say('Ok I will try to get what you are after');
        player.questStages.familyCrest = 5;
    }
}

async function jewellery(player, npc) {
    await npc.say('So how are you doing getting the jewellry?');

    if (player.inventory.has(ITEMS.perfectRubyRing) && player.inventory.has(ITEMS.perfectRubyNecklace)) {
        await player.say('I have it');
        await npc.say('These are brilliant');
        player.message('You exchange the jewellry for a piece of crest');
        player.inventory.remove(ITEMS.perfectRubyRing);
        player.inventory.remove(ITEMS.perfectRubyNecklace);
        player.inventory.add(ITEMS.crestFragmentTwo);
        await npc.say(
            'These are a fine piece of work',
            'Such marvelous gold to', // sic
            'I suppose you will be after the last piece of crest now'
        );
        await johnathonLead(npc);
        player.questStages.familyCrest = 7;
    } else {
        await player.say(
            'I have spoken to boot about the perfect gold',
            "I haven't bought you your jewellry yet though" // sic
        );
        await npc.say('Remember I want a gold ring with a red stone in', 'And a necklace to match');
    }
}

async function restOfTheCrest(player, npc) {
    await npc.say('How are you doing getting the rest of the crest?');

    if (player.inventory.has(ITEMS.familyCrest)) {
        await player.say('I have found it');
        await npc.say('Well done, take it to my father');
    } else if (!player.inventory.has(ITEMS.crestFragmentTwo)) {
        const choice = await player.ask(['I am still working on it', 'I have lost the piece you gave me'], true);

        if (choice === 0) {
            await npc.say('Well good luck in your quest');
        } else if (choice === 1) {
            await npc.say('Ah well here is another one');
            player.inventory.add(ITEMS.crestFragmentTwo);
        }
    } else {
        await player.say('I am still working on it');
        await npc.say('Well good luck in your quest');
    }
}

async function onTalkToNPC(player, npc) {
    if (npc.id !== NPCS.avan) {
        return false;
    }

    player.engage(npc);

    const questStage = stage(player);

    if (!player.world.members || (questStage >= 0 && questStage <= 3)) {
        await npc.say("Can't you see I'm busy?");
    } else if (questStage === -1) {
        await questComplete(player, npc);
    } else if (questStage === 4) {
        await lookingForAvan(player, npc);
    } else if (questStage === 5) {
        await npc.say('So how are you doing getting the jewellry?');
        await player.say("I'm still after that perfect gold");
        await bootLead(npc);
    } else if (questStage === 6) {
        await jewellery(player, npc);
    } else if (questStage === 7) {
        await player.say('Where did you say I could find Johnathon again?');
        await johnathonLead(npc);
    } else if (questStage === 8) {
        await restOfTheCrest(player, npc);
    }

    player.disengage();
    return true;
}

module.exports = { onTalkToNPC };
