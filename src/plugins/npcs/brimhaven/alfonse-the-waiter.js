// Ported from Open-RSC authentic/npcs/brimhaven/AlfonseTheWaiter.java (AGPL-3.0)
// Alfonse (The Shrimp and Parrot, Brimhaven): waiter greeting that opens the restaurant's fish shop.
// Hero's Quest: a player on the quest (stage 1-2) or sent by Straven (pheonix_mission / pheonix_alf) who is not in the
// Black Arm gang also gets "Do you sell Gherkins?", which opens Charlie the cook's back door (cache talked_alf,
// quests/members/heros-quest.js door 78).

const ALFONSE_ID = 260;

function offersGherkins(player) {
    const stage = player.questStages.herosQuest || 0;

    if (player.cache.blackArmStage === -1) {
        return false;
    }

    return stage === 1 || stage === 2 || !!player.cache.pheonix_mission || !!player.cache.pheonix_alf;
}

async function onTalkToNPC(player, npc) {
    if (npc.id !== ALFONSE_ID) {
        return false;
    }

    player.engage(npc);

    await npc.say('Welcome to the shrimp and parrot', 'Would you like to order sir?');

    const options = ['Yes please', 'No thankyou'];

    if (offersGherkins(player)) {
        options.push('Do you sell Gherkins?');
    }

    const choice = await player.ask(options, true);

    if (choice === 0) {
        player.disengage();
        player.openShop('the-shrimp-and-parrot');
        return true;
    }

    if (choice === 2) {
        await npc.say('Hmm ask Charlie the cook round the back', 'He may have some Gherkins for you');
        player.message('Alfonse winks');
        await player.world.sleepTicks(3);
        player.cache.talked_alf = true;
        delete player.cache.pheonix_alf;
    }

    player.disengage();
    return true;
}

module.exports = { onTalkToNPC };
