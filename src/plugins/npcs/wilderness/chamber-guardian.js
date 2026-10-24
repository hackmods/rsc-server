// Ported from Open-RSC authentic/minigames/mage_arena/Chamber_Guardian.java (AGPL-3.0)
// Chamber guardian: Mage Arena staff shop for players whose Mage Arena progress is done (player.cache.mageArena === 4).
// Skipped: the Mage Arena steps (stage 2 and 3 dialogue, the cape check and the staff hand-out), because the minigame is not ported.
// NOTE: nothing in the fork sets player.cache.mageArena yet, so the shop stays closed until the minigame lands.

const CHAMBER_GUARDIAN_ID = 784;

async function onTalkToNPC(player, npc) {
    if (npc.id !== CHAMBER_GUARDIAN_ID) {
        return false;
    }

    player.engage(npc);

    if (player.cache.mageArena !== 4) {
        // Java's default branch (no Mage Arena progress, or stage 2/3 which is skipped above)
        await npc.say('hello adventurer, have you made your choice?');
        await player.say('no, not yet.');
        await npc.say(
            'once you\'re done come back to me...',
            '...and i\'ll supply you with a mage staff ready for battle'
        );
        player.disengage();
        return true;
    }

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

    player.disengage();
    return true;
}

module.exports = { onTalkToNPC };
