// Ported from Open-RSC authentic/npcs/alkharid/ShantayPassNpcs.java (AGPL-3.0)
// Shantay (Al Kharid desert pass): greeting and menu that opens 'shantay-pass'. Skipped: the desert pass gate and
// poster, the jail and fine logic, the assistant NPC, and the rest of the "What is this place?" lore tree (only its first
// lines are kept). The kebab recipe drop (the scrumpled piece of paper, 1120, read in items/scrumpled-piece-of-paper.js), the
// disclaimer line and the Tourist Trap line (Irena, quests/members/tourist-trap) are ported.

const SHANTAY_ID = 549;
const SCRUMPLED_PAPER_ID = 1120;
const SHANTAY_DISCLAIMER_ID = 1099;

async function onTalkToNPC(player, npc) {
    if (npc.id !== SHANTAY_ID) {
        return false;
    }

    player.engage(npc);

    // 1 in 26 (DataConversions.random(0, 25) == 0): Shantay drops the Ugthanki kebab recipe at his feet, for this player
    if (Math.floor(Math.random() * 26) === 0) {
        player.world.addPlayerDrop(player, SCRUMPLED_PAPER_ID, npc.x, npc.y);
    }

    await npc.say('Hello Effendi, I am Shantay.');

    if (!player.inventory.has(SHANTAY_DISCLAIMER_ID)) {
        await npc.say("I see you're new!", 'Make sure you read the poster before going into the desert.');
    }

    // ShantayPassNpcs: before the Tourist Trap starts he points at Irena
    if ((player.questStages.touristTrap || 0) === 0) {
        await npc.say(
            'There is a heartbroken Mother just past the gates and in the Desert.',
            'Her name is Irena and she mourns her lost Daughter. Such a shame.'
        );
    }

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
