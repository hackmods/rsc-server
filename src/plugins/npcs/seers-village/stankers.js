// Ported from Open-RSC Core-Framework authentic/npcs/seers/Stankers.java (AGPL-3.0)
// Stankers, by the coal trucks north of Seers' Village: explains the trucks and gives away poison chalices (737, drunk
// in items/quaffable.js). The coal trucks themselves are game-objects/coal-truck.js.

const STANKERS_ID = 389;
const POISON_CHALICE_ID = 737;

async function onTalkToNPC(player, npc) {
    if (npc.id !== STANKERS_ID) {
        return false;
    }

    player.engage(npc);

    await npc.say('Hello bold adventurer');

    const choice = await player.ask(['Are these your trucks?', 'Hello Mr Stankers'], true);

    if (choice === 0) {
        await npc.say(
            'Yes, I use them to transport coal over the river',
            'I will let other people use them too',
            "I'm a nice person like that",
            "Just put coal in a truck and I'll move it down to my depot over the river"
        );
    } else if (choice === 1) {
        await npc.say('Would you like a poison chalice?');

        const sub = await player.ask(['Yes please', "what's a poison chalice?", 'no thankyou'], false);

        if (sub === 0) {
            await player.say('Yes please');
            player.message('Stankers hands you a glass of strangely coloured liquid');
            player.inventory.add(POISON_CHALICE_ID);
        } else if (sub === 1) {
            await player.say("What's a poison chalice?");
            await npc.say(
                "It's an exciting drink I've invented",
                "I don't know what it tastes like",
                "I haven't tried it myself"
            );
        } else if (sub === 2) {
            await player.say('No thankyou');
        }
    }

    player.disengage();
    return true;
}

module.exports = { onTalkToNPC };
