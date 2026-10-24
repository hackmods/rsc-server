// Ported from Open-RSC authentic/npcs/gutanoth/GrudsHerblawStall.java (AGPL-3.0)
// Grud's herblaw stall (Gu Tanoth, rsc-data id 686 "Ogre merchant"): talk that opens 'gruds-herblaw-stall'.

const GRUDS_ID = 686;

async function onTalkToNPC(player, npc) {
    if (npc.id !== GRUDS_ID) {
        return false;
    }

    player.engage(npc);

    await npc.say('Does The little creature want to buy sumfin\'');

    const choice = await player.ask(['Yes I do', "No I don't"], true);

    if (choice === 0) {
        await npc.say("Welcome to Grud's herblaw stall");
        player.disengage();
        player.openShop('gruds-herblaw-stall');
        return true;
    }

    await npc.say('Suit yourself');
    player.disengage();
    return true;
}

module.exports = { onTalkToNPC };
