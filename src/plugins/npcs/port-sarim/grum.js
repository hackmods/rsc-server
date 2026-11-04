// https://classic.runescape.wiki/w/Transcript:Grum

const { beggarWaits } = require('../../quests/members/merlins-crystal/excalibur');

const DOORFRAME_ID = 11;
const DOOR_ID = 85;
const GRUM_ID = 157;

async function onTalkToNPC(player, npc) {
    if (npc.id !== GRUM_ID) {
        return false;
    }

    player.engage(npc);

    await npc.say('Would you like to buy or sell some gold jewellry?');

    const choice = await player.ask(
        ['Yes please', "No, I'm not that rich"],
        false
    );

    switch (choice) {
        case 0: // yes
            await player.say("Yes Please");
            player.disengage();
            player.openShop('grums-gold-exchange');
            return true;
        case 1: // no
            await player.say("No, I'm not that rich");
            await npc.say("Get out then we don't want any riff-raff in here");
            break;
    }

    player.disengage();
    return true;
}

async function onWallObjectCommandOne(player, wallObject) {
    // Merlin's Crystal: with the Lady of the Lake's test on, the beggar waits at this door
    // (quests/members/merlins-crystal/excalibur.js)
    if (wallObject.id !== DOOR_ID || beggarWaits(player, wallObject)) {
        return false;
    }

    await player.enterDoor(wallObject, DOORFRAME_ID);

    return true;
}

module.exports = { onTalkToNPC, onWallObjectCommandOne };
