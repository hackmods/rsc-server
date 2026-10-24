// Ported from Open-RSC authentic/npcs/grandtree/GnomeWaiter.java (AGPL-3.0)
// Gnome waiter (Grand Tree restaurant): menu talk, then opens the gnome restaurant shop.

const GNOME_WAITER_ID = 581;

async function onTalkToNPC(player, npc) {
    if (npc.id !== GNOME_WAITER_ID) {
        return false;
    }

    player.engage(npc);

    await player.say('hello');
    await npc.say('good afternoon', 'can i tempt you with our new menu?');

    const choice = await player.ask(['i\'ll take a look', 'not really'], true);

    if (choice === 0) {
        await npc.say('i hope you like what you see');
        player.disengage();
        player.openShop('gnome-restaurant');
        return true;
    }

    await npc.say('ok then, enjoy your stay');
    player.disengage();
    return true;
}

module.exports = { onTalkToNPC };
