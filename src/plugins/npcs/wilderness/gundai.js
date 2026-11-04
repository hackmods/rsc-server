// Ported from Open-RSC Core-Framework authentic/minigames/mage_arena/Gundai.java (AGPL-3.0)
// Gundai (792), the Mage Arena's banker in Kolodion's cave (452,3376). The bank pin and auction options belong to
// OpenRSC configs that are off here (no bank pins, no auction house), so the menu is the bank and goodbye.

const GUNDAI_ID = 792;

async function onTalkToNPC(player, npc) {
    if (npc.id !== GUNDAI_ID) {
        return false;
    }

    player.engage(npc);

    await player.say('hello, what are you doing out here?');
    await npc.say("why i'm a banker, the only one around these dangerous parts");

    const choice = await player.ask(["cool, I'd like to access my bank account please", 'Well, now i know'], true);

    if (choice === 0) {
        await npc.say('no problem');
        player.disengage();
        player.bank.open();
        return true;
    }

    if (choice === 1) {
        await npc.say('knowledge is power my friend');
    }

    player.disengage();
    return true;
}

module.exports = { onTalkToNPC };
