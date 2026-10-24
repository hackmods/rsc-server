// Ported from Open-RSC authentic/npcs/entrana/FrincosVialShopEntrana.java (AGPL-3.0)
// Frincos (Entrana): greeting that opens the herblaw/vial shop; the other two replies just end the talk, as in the Java.

const FRINCOS_ID = 297;

async function onTalkToNPC(player, npc) {
    if (npc.id !== FRINCOS_ID) {
        return false;
    }

    player.engage(npc);

    await npc.say('Hello how can I help you?');

    const choice = await player.ask(
        ['What are you selling?', "You can't, I'm beyond help", "I'm okay, thankyou"],
        true
    );

    player.disengage();

    if (choice === 0) {
        player.openShop('entrana-herblaw');
    }

    return true;
}

module.exports = { onTalkToNPC };
