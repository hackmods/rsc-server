// Ported from Open-RSC authentic/npcs/varrock/Tailor.java (AGPL-3.0)
// Tailor (Varrock): fancy-dress remark that offers the clothing shop; declining ends the talk.

const TAILOR_ID = 501;

async function onTalkToNPC(player, npc) {
    if (npc.id !== TAILOR_ID) {
        return false;
    }

    player.engage(npc);

    await npc.say('Now you look like someone who goes to a lot of fancy dress parties');
    await player.say('Errr... what are you saying exactly?');
    await npc.say("I'm just saying that perhaps you would like to peruse my selection of garments");

    const choice = await player.ask(
        [
            'I think I might just leave the perusing for now thanks',
            'OK,lets see what you\'ve got then'
        ],
        false
    );

    if (choice === 0) {
        await player.say('I think I might just leave the perusing for now thanks');
        player.disengage();
        return true;
    }

    await player.say("OK,let's see what you've got then");
    player.disengage();
    player.openShop('fancy-clothes');
    return true;
}

module.exports = { onTalkToNPC };
