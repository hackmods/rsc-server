// Ported from Open-RSC authentic/npcs/lostcity/Irksol.java (AGPL-3.0)
// Irksol (Zanaris): talk that opens the members ruby ring shop. No quest gate in the Java.

const IRKSOL_ID = 218;

async function onTalkToNPC(player, npc) {
    if (npc.id !== IRKSOL_ID) {
        return false;
    }

    player.engage(npc);

    await npc.say(
        'selling ruby rings',
        'The best deals in all the planes of existance'
    );

    const choice = await player.ask(
        ["I'm interested in these deals", 'No thankyou'],
        false
    );

    if (choice === 0) {
        await player.say("I'm interested in these deals");
        await npc.say('Take a look at these beauties');
        player.disengage();
        player.openShop('ruby-ring');
        return true;
    }

    await player.say('no thankyou');
    player.disengage();
    return true;
}

module.exports = { onTalkToNPC };
