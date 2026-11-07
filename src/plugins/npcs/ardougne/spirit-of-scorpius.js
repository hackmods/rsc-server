// Ported from Open-RSC Core-Framework authentic/npcs/ardougne/west/SpiritOfScorpius.java (AGPL-3.0): the Spirit of Scorpius
// (665) at his grave (692,649), south of Ardougne, who only speaks to those who finished the Observatory Quest
// (quests/members/observatory-quest.js): a mould for the unholy symbol of Zamorak, the blessing of the unblessed symbol and a
// replacement mould. The ghosts around the grave (664) threaten and attack. The grave 941 reads a warning.
// Not ported: the custom-quests "About mould drops" option and the crown of the occult (1514, not in this server's data).

const SPIRIT_OF_SCORPIUS_ID = 665;
const GHOST_SCORPIUS_ID = 664;
const GRAVE_OF_SCORPIUS_ID = 941;

const UNHOLY_SYMBOL_MOULD_ID = 1026;
const UNBLESSED_UNHOLY_SYMBOL_ID = 1028;
const UNHOLY_SYMBOL_ID = 1029;

function observatoryDone(player) {
    return player.questStages.observatoryQuest === -1;
}

// Java mes(...) followed by delay(3)
async function mes(player, message) {
    player.message(`@que@${message}`);
    await player.world.sleepTicks(3);
}

async function spirit(player, n) {
    if (!observatoryDone(player)) {
        await n.say('How dare you disturb me!');
        return;
    }

    if (player.cache.scorpius_mould) {
        const option = await player.ask(
            ['I have come to seek a blessing', 'I need another unholy symbol mould', 'I have come to kill you'],
            false
        );

        if (option === 0) {
            await player.say('I have come to seek a blessing');

            if (player.inventory.has(UNHOLY_SYMBOL_ID)) {
                await n.say(
                    'I see you have the unholy symbol of our Lord',
                    "It is blessed with the Lord Zamorak's power",
                    'Come to me when your faith weakens'
                );
            } else if (player.inventory.has(UNBLESSED_UNHOLY_SYMBOL_ID)) {
                await n.say('I see you have the unholy symbol of our Lord', 'I will bless it for you');
                player.message('The ghost mutters in a strange voice');
                player.inventory.remove(UNBLESSED_UNHOLY_SYMBOL_ID, 1);
                player.inventory.add(UNHOLY_SYMBOL_ID, 1);
                await mes(player, 'The unholy symbol throbs with power');
                await n.say('The symbol of our lord has been blessed with power!', 'My master calls...');
            } else {
                await n.say('No blessings will be given to those', "Who have no symbol of our Lord's love!");
            }
        } else if (option === 1) {
            await player.say('I need another mould for the unholy symbol');

            if (player.inventory.has(UNHOLY_SYMBOL_MOULD_ID)) {
                await n.say('One you already have, another is not needed', 'Leave me be!');
            } else {
                await n.say(
                    'To lose an object is easy to replace',
                    'To lose the affections of our lord is impossible to forgive...'
                );
                player.message('The ghost hands you another mould');
                player.inventory.add(UNHOLY_SYMBOL_MOULD_ID, 1);
            }
        } else if (option === 2) {
            await player.say('I have come to kill you');
            await n.say('The might of mortals to me is as the dust is to the sea!');
        }

        return;
    }

    const menu = await player.ask(['I seek your wisdom', 'I have come to kill you'], true);

    if (menu === 0) {
        await n.say(
            'Indeed, I feel you have beheld the far places in the heavens',
            'My Lord instructs me to help you',
            'Here is a mould to make a token for our Lord',
            'A mould for the unholy symbol of Zamorak'
        );
        player.message('The ghost gives you a casting mould');
        player.inventory.add(UNHOLY_SYMBOL_MOULD_ID, 1);

        if (!player.cache.scorpius_mould) {
            player.cache.scorpius_mould = true;
        }
    } else if (menu === 1) {
        await n.say('The might of mortals to me is as the dust is to the sea!');
    }
}

async function onTalkToNPC(player, npc) {
    if (npc.id !== SPIRIT_OF_SCORPIUS_ID && npc.id !== GHOST_SCORPIUS_ID) {
        return false;
    }

    player.engage(npc);

    try {
        if (npc.id === SPIRIT_OF_SCORPIUS_ID) {
            await spirit(player, npc);
        } else {
            await npc.say('We are waiting for you');
        }
    } finally {
        if (player.interlocutor) {
            player.disengage();
        }
    }

    // the ghost attacks once the talk is over
    if (npc.id === GHOST_SCORPIUS_ID) {
        Promise.resolve(npc.attack(player)).catch(() => {});
    }

    return true;
}

// the grave: "Read"
async function onGameObjectCommandOne(player, gameObject) {
    if (gameObject.id !== GRAVE_OF_SCORPIUS_ID) {
        return false;
    }

    player.message('Here lies Scorpius:');
    player.message('Only those who have seen beyond the stars');
    player.message('may seek his counsel');

    return true;
}

module.exports = { onTalkToNPC, onGameObjectCommandOne };
