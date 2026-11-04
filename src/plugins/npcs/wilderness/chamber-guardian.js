// Ported from Open-RSC authentic/minigames/mage_arena/Chamber_Guardian.java (AGPL-3.0)
// Chamber guardian (784, the god stones' chamber under Kolodion's cave): the Mage Arena steps after Kolodion's duel
// (player.cache.mageArena, set by minigames/mage-arena.js):
//   2  he sends you to chant at a god stone (and moves you to 3 himself)
//   3  with a sacred cape in the inventory: the matching god staff, then 4
//   4  the staff shop (mage-arena-staves) and the Charge lore
// Anything else gets the "have you made your choice?" line.

const CHAMBER_GUARDIAN_ID = 784;

// cape -> staff: zamorak 1213 -> 1216, saradomin 1214 -> 1218, guthix 1215 -> 1217 (the Java's order)
const CAPE_STAVES = [
    [1213, 1216],
    [1214, 1218],
    [1215, 1217]
];

async function notYet(player, npc) {
    await npc.say('hello adventurer, have you made your choice?');
    await player.say('no, not yet.');
    await npc.say(
        'once you\'re done come back to me...',
        '...and i\'ll supply you with a mage staff ready for battle'
    );
}

async function onTalkToNPC(player, npc) {
    if (npc.id !== CHAMBER_GUARDIAN_ID) {
        return false;
    }

    player.engage(npc);

    const stage = player.cache.mageArena;
    const cape = stage === 3 && CAPE_STAVES.find(([capeID]) => player.inventory.has(capeID));

    if (stage === 2) {
        await player.say('hello my friend, kolodion sent me down');
        await npc.say(
            'sssshhh...the gods are talking..i can hear their whispers',
            "..can you hear them adventurer...they're calling you"
        );
        await player.say('erm...ok!');
        await npc.say('go and chant to the the sacred stone of your chosen god', 'you will be rewarded');
        await player.say('ok?');
        await npc.say("once you're done come back to me...", "...and i'll supply you with a mage staff ready for battle");
        player.cache.mageArena = 3;
    } else if (stage === 3 && cape) {
        await npc.say('hello adventurer, have you made your choice?');
        await player.say('i have');
        await npc.say(
            'good, good .. i hope you chose well',
            'you will have been rewarded with a magic cape',
            'now i will give you a magic staff',
            "these are all the weapons and armour you'll need here"
        );
        player.message('the mage guardian gives you a magic staff');
        player.inventory.add(cape[1]);
        player.cache.mageArena = 4;
    } else if (stage === 4) {
        await player.say('hello again');
        await npc.say('hello adventurer, are you looking for another staff?');

        const choice = await player.ask(
            [
                'what do you have to offer?',
                'no thanks',
                'tell me what you know about the charge spell?'
            ],
            true
        );

        if (choice === 0) {
            await npc.say('take a look');
            player.disengage();
            player.openShop('mage-arena-staves');
            return true;
        }

        if (choice === 1) {
            await npc.say('well, let me know if you need one');
        } else if (choice === 2) {
            await npc.say(
                'we believe the spells are gifts from the gods',
                'the charge spell draws even more power from the cosmos',
                'while wearing a matching cape and staff',
                'it will double the damage caused by ...',
                'battle mage spells for several minutes'
            );
            await player.say('good stuff');
        }
    } else {
        await notYet(player, npc);
    }

    player.disengage();
    return true;
}

module.exports = { onTalkToNPC };
