// Ported from Open-RSC authentic/npcs/alkharid/ShantayPassNpcs.java (AGPL-3.0)
// Shantay (Al Kharid desert pass): greeting and menu that opens 'shantay-pass'. Skipped: the desert pass gate and
// poster, the disclaimer and "I see you're new" lines, the Tourist Trap line, the jail and fine logic, the kebab
// recipe drop, the assistant NPC, and the rest of the "What is this place?" lore tree (only its first lines are kept).

const SHANTAY_ID = 549;

async function onTalkToNPC(player, npc) {
    if (npc.id !== SHANTAY_ID) {
        return false;
    }

    player.engage(npc);

    await npc.say('Hello Effendi, I am Shantay.');

    const choice = await player.ask(
        [
            'What is this place?',
            'Can I see what you have to sell please?',
            'I must be going.'
        ],
        true
    );

    if (choice === 0) {
        await npc.say('This is the pass of Shantay.');
        await npc.say(
            'I guard this area with my men.',
            'I am responsible for keeping this pass open and repaired.',
            'My men and I prevent outlaws from getting out of the desert.',
            'And we stop the inexperienced from a dry death in the sands.'
        );
        player.disengage();
        return true;
    }

    if (choice === 1) {
        await npc.say('Absolutely Effendi!');
        player.disengage();
        player.openShop('shantay-pass');
        return true;
    }

    await npc.say('So long...');
    player.disengage();
    return true;
}

module.exports = { onTalkToNPC };
