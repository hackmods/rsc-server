// The Curator of Varrock museum and the Dig Site (quests/members/digsite/shared.js has the stage map), from Open-RSC
// Core-Framework authentic/npcs/varrock/Curator.java onUseNpc (AGPL-3.0): he stamps the Examiner's letter of recommendation
// and keeps the earth sciences certificates, with a cake or a Fruit Blast for the level 3 one. His talk is the Shield of Arrav's
// (quests/free/shield-of-arrav/curator.js).

const { NPC, ITEM, give } = require('./shared');

const CERTIFICATES = [ITEM.LEVEL_1_CERTIFICATE, ITEM.LEVEL_2_CERTIFICATE, ITEM.LEVEL_3_CERTIFICATE];

async function onUseWithNPC(player, npc, item) {
    if (npc.id !== NPC.CURATOR) {
        return false;
    }

    if (item.id !== ITEM.UNSTAMPED_LETTER && item.id !== ITEM.STAMPED_LETTER && !CERTIFICATES.includes(item.id)) {
        return false;
    }

    player.engage(npc);

    try {
        if (item.id === ITEM.UNSTAMPED_LETTER) {
            await player.say('I have been given this by the examiner at the digsite', 'Can you stamp this for me ?');
            await npc.say(
                'What have we here ?',
                'A letter of recommendation indeed',
                "Normally I wouldn't do this",
                "But in this instance I don't see why not",
                'There you go, good luck student...'
            );
            player.inventory.remove(ITEM.UNSTAMPED_LETTER);
            give(player, ITEM.STAMPED_LETTER, 1);
            await npc.say('Be sure to come back and show me your certificates', 'I would like to see how you get on');
            await player.say('Okay, I will, thanks, see you later');
        } else if (item.id === ITEM.STAMPED_LETTER) {
            await npc.say("No, I don't want it back, thankyou");
        } else if (item.id === ITEM.LEVEL_1_CERTIFICATE) {
            await player.say('Look what I have been awarded');
            player.inventory.remove(ITEM.LEVEL_1_CERTIFICATE);
            await npc.say(
                "Well that's great, well done",
                "I'll take that for safekeeping",
                'Come and tell me when you are the next level'
            );
        } else if (item.id === ITEM.LEVEL_2_CERTIFICATE) {
            await player.say('Look, I am level 2 now...');
            await npc.say('Excellent work!');
            player.inventory.remove(ITEM.LEVEL_2_CERTIFICATE);
            await npc.say("I'll take that for safekeeping", 'Remember to come and see me when you have graduated');
        } else {
            await player.say('Look at this certificate, curator...');
            await npc.say(
                'Well well, a level 3 graduate!',
                "I'll keep your certificate safe for you",
                'I feel I must reward you for your work...',
                'What would you prefer, something to eat or drink ?'
            );

            const menu = await player.ask(['Something to eat please', 'Something to drink please'], true);

            if (menu === 0) {
                player.inventory.remove(ITEM.LEVEL_3_CERTIFICATE);
                await npc.say('Very good, come and eat this cake I baked');
                await player.say('Yum, thanks!');
                give(player, ITEM.CHOCOLATE_CAKE, 1);
            } else if (menu === 1) {
                player.inventory.remove(ITEM.LEVEL_3_CERTIFICATE);
                await npc.say('Certainly, have this...');
                give(player, ITEM.FRUIT_BLAST, 1);
                await player.say('A cocktail ?');
                await npc.say("It's a new recipie from the gnome kingdom", "You'll like it I'm sure");
                await player.say('Cheers!');
            }
        }
    } finally {
        if (player.interlocutor) {
            player.disengage();
        }
    }

    return true;
}

module.exports = { onUseWithNPC };
