// Ported from Open-RSC Core-Framework authentic/npcs/ardougne/west/Civillians.java and the civilian branch of
// authentic/skills/thieving/Thieving.java (AGPL-3.0)
//
// The three West Ardougne civilians (729 attackable, 731 apron, 732 pickpocket) are plagued by mice and want a cat. A
// grown cat (1119, raised from a kitten: minigames/kitten-care.js) sells for 25 death runes; a kitten, Kardia's cat
// (1003) and Gertrude's cat (1093) are turned down. Fluffs' kittens (1095) count only with WANT_EXTENDED_CATS_BEHAVIOR,
// which is off in the authentic config, so they are ignored here.
//
// Pickpocketing civilian 732: the Java Thieving.blockOpNpc has no Pickpocket row for him and answers "Nothing
// interesting happens" (authentic: the option is there, nothing can be stolen). Claimed here with that message.

const CIVILIAN_ATTACKABLE_ID = 729;
const CIVILIAN_APRON_ID = 731;
const CIVILIAN_PICKPOCKET_ID = 732;
const CIVILIAN_IDS = new Set([CIVILIAN_ATTACKABLE_ID, CIVILIAN_APRON_ID, CIVILIAN_PICKPOCKET_ID]);

const CAT_ID = 1119;
const KITTEN_ID = 1096;
const KARDIA_CAT_ID = 1003;
const GERTRUDES_CAT_ID = 1093;
const DEATH_RUNE_ID = 38;
const CAT_PRICE = 25;

async function wantCat(player, npc) {
    const choice = await player.ask(
        ['i have a cat that i could sell', "nope, they're not easy to get hold of"],
        true
    );

    if (choice !== 0) {
        return;
    }

    await npc.say('you don\'t say, can i see it');
    player.message('you reveal the cat in your satchel');
    await npc.say('hmmm, not bad, not bad at all', "looks like it's a lively one");
    await player.say('erm ...kind of!');
    await npc.say("i don't have much in the way of money...", 'but i do have these...');
    player.message('the peasent shows you a sack of death runes');
    await npc.say(
        'the dwarfs bring them from the mine for us',
        "tell you what, i'll give you 25 death runes for the cat"
    );

    const deal = await player.ask(["nope, i'm not parting for that", "ok then, you've got a deal"], true);

    if (deal === 0) {
        await npc.say("well, i'm not giving you anymore");
    } else if (deal === 1) {
        player.message('you hand over the cat');

        if (player.inventory.has(CAT_ID)) {
            player.inventory.remove(CAT_ID);
            player.message('you are given 25 death runes');
            player.inventory.add(DEATH_RUNE_ID, CAT_PRICE);
            await npc.say('great, thanks for that');
            await player.say("that's ok, take care");
        }
    }
}

async function showKitten(player, npc) {
    const choice = await player.ask(
        ['i have a kitten that i could sell', "nope, they're not easy to get hold of"],
        true
    );

    if (choice === 0) {
        await npc.say('really, lets have a look');
        player.message('you reveal the kitten in your satchel');
        await npc.say("hah, that little thing won't catch any mice", 'i need a fully grown cat');
    }
}

// path 1 (the apron civilian) ends the line with "!"
async function showOtherCat(player, npc, path, lines) {
    await player.say(`i have a cat..look${path === 1 ? '!' : ''}`);
    await npc.say(...lines);
}

async function offerCat(player, npc, path) {
    const { inventory } = player;

    if (inventory.has(CAT_ID)) {
        await wantCat(player, npc);
    } else if (inventory.has(KITTEN_ID)) {
        await showKitten(player, npc);
    } else if (inventory.has(KARDIA_CAT_ID)) {
        await showOtherCat(player, npc, path, [
            "hmmm..doesn't look like it's seen daylight in years",
            "that's not going to catch any mice"
        ]);
    } else if (inventory.has(GERTRUDES_CAT_ID)) {
        await showOtherCat(player, npc, path, [
            "hmmm..doesn't look like it belongs to you",
            'i cannot buy it'
        ]);
    }
}

function hasAnyCat(player) {
    return [CAT_ID, KITTEN_ID, KARDIA_CAT_ID, GERTRUDES_CAT_ID].some((id) => player.inventory.has(id));
}

async function onTalkToNPC(player, npc) {
    if (!CIVILIAN_IDS.has(npc.id)) {
        return false;
    }

    player.engage(npc);

    let path = 0;
    let noCat = "no you're right, you don't see many around";

    if (npc.id === CIVILIAN_APRON_ID) {
        path = 1;
        await player.say('hi');
        await npc.say('good day to you traveller');
        await player.say('what are you up to?');
        await npc.say('chasing mice as usual...', "...it's all i seem to do");
        await player.say('you must waste alot of time');
        await npc.say('yep, but what can you do?', "it's not like there's many cats around here");
    } else if (npc.id === CIVILIAN_ATTACKABLE_ID) {
        noCat = "no, you're right, you don't see many around";
        await player.say('hello there');
        await npc.say("oh hello, i'm sorry, i'm a bit worn out");
        await player.say('busy day?');
        await npc.say(
            "oh, it's those bleeding mice, they're everywhere",
            "what i really need is a cat, but they're hard to come by nowadays"
        );
    } else {
        await player.say('hello');
        await npc.say("i'm a bit busy to talk, sorry");
        await player.say('what are you doing?');
        await npc.say('i need to kill these blasted mice', "they're all over the place, i need a cat");
    }

    if (hasAnyCat(player)) {
        await offerCat(player, npc, path);
    } else {
        await player.say(noCat);
    }

    player.disengage();
    return true;
}

async function onNPCCommand(player, npc) {
    if (npc.id !== CIVILIAN_PICKPOCKET_ID) {
        return false;
    }

    player.message('Nothing interesting happens');
    return true;
}

module.exports = { onTalkToNPC, onNPCCommand };
