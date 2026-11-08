// Ported from Open-RSC Core-Framework authentic/itemactions/InvAction.java (handleADollOfIban, handleStaffOfIban,
// handleOldJournal, readJournalChapter) and authentic/npcs/ardougne/west/DarkMage.java (AGPL-3.0): the doll of Iban that tells
// what has been smeared on it, Kardia's old journal, the broken staff of Iban, and the Dark Mage (667) in West Ardougne who
// mends the staff for 200,000 coins once the quest is done (the Combat Odyssey branch of the Java is a custom option and
// is not ported). Stage map: shared.js.

const { ITEM, NPC, cacheHas, mes, delay, give, take, holds, sendBox, stageOf } = require('./shared');

async function searchDoll(player) {
    await mes(player, 'you carefully search the doll');

    if (cacheHas(player, 'poison_on_doll')) {
        await mes(player, 'Blood has been smeared onto the doll');
    }

    if (cacheHas(player, 'cons_on_doll')) {
        await mes(player, 'Crushed bones have been smeared onto the doll');
    }

    if (cacheHas(player, 'ash_on_doll')) {
        await mes(player, 'Burnt ash has been smeared onto the doll');
    }

    if (cacheHas(player, 'shadow_on_doll')) {
        await mes(player, 'A dark liquid has been poured over the doll');
    }

    player.message('the doll is made from old wood and cloth');
    await delay(player, 4);
}

async function brokenStaff(player) {
    await mes(player, 'the staff is broken');
    await mes(player, 'you must have a dark mage repair it');
    player.message('before it can be used');
    await delay(player, 4);
}

const CHAPTERS = {
    0: [
        "you turn to the page titled 'intro'",
        '% %@red@Gather round, all ye followers of the dark arts.% %@red@Read carefully the words that I hereby inscribe,% %@red@as I detail the heady the brew that is responsible for my @red@% %@red@greatest creation yet. @red@I am Kardia, the most wretched % %@red@witch in all the land,scorned by beauty and the world.% %@red@See what I have created: @red@the most powerful force% %@red@of darkness ever to be seen in human form!'
    ],
    1: [
        "you turn to the page titled 'iban'",
        "@red@Iban was a Black Knight who had learned to fight under the%@red@great Darkquerius himself. Together they had taken on the @red@might of the White Knights, and the blood of a hundred @red@soldiers had been wiped from Iban's sword.% %@red@In many respects Iban was not so different from the White @red@Knights that he so mercilessly slaughtered: noble and @red@educated@red@ with a taste for the finer things in life. But there @red@was something that made him different: ambition. No, not @red@the simple desire to succeed or lead one's fellow @red@man. @red@This was an ambition that hungered for something beyond @red@the @red@mortal @red@realm"
    ],
    2: [
        "you turn to the page titled 'the ressurection'",
        "% %@red@I knew of Iban's life, though of course we had never met.% %@red@And @red@using the power of my dark arts, I vowed @red@to % %@red@resurrect this @red@once great warrior. I would raise @red@him again,% %@red@to fulfill @red@the @red@promise of his human life: to be a% %@red@Master of the Undead."
    ],
    3: [
        "you turn to the page titled 'flesh'",
        "@red@Ibans Flesh% %@red@Taking a small doll to represent Iban, I smeared my effigy % %@red@with the four crucial elements that constitute a life.% %@red@Rooting around the desolate battlefield, I had been able to% %@red@steal a piece of Iban's cold flesh.% %@red@Now clasping some in my own hand, I smeared it over% %@red@my miniature idol, all the while chanting Iban's name."
    ],
    4: [
        "you turn to the page titled 'blood'",
        "@red@Ibans Blood% %@red@I also needed some blood. By now, Iban's body was just a% %@red@hardened vessel-his life blood had literally drained from % %@red@him. But these caverns are home to the giant spider,% %@red@a venomous creature that is known to feed on human % %@red@blood.  Killing one of these spiders, I wiped my carved doll % %@red@in its blood."
    ],
    5: [
        "you turn to the page titled 'shadow'",
        "@red@Ibans Shadow% %@red@Then came the hard part: recreating the parts of a man @red@that cannot be seen or touched: those intangible things @red@that are life itself. Using all the mystical force that I could @red@muster, I performed the ancient ritual of Incantia, a spell @red@so powerful that it nearly stole the life from my frail and @red@withered body. Opening my eyes again, I saw the three @red@demons that had been summoned. Standing in a triangle, @red@their energy @red@was focused on the doll. These demons @red@would be the keepers of @red@Iban's shadow. Black as night, @red@their shared spirit @red@would follow his undead body like an @red@angel of death."
    ],
    6: [
        "you turn to the page titled 'conscience'",
        "@red@Ibans conscience% %@red@Finally, I had to construct that most unique thing, the one @red@element which seperates man from every other beast- his @red@conscience. A zombie does not need a mind: his is a @red@mindless destruction, borne of simple bloodlust. But for all @red@of Iban's life, he himself choose to take the evil path- @red@driven by such a monstrous ambition. This is what gave @red@him such potential- potential that I would now harness to @red@the fullest."
    ]
};

const IBAN_CONTINUED =
    "%@red@..that was almost godlike in its insatiability.% %@red@But therein lay the essence of his darkness. @red@At its most @red@base level, Iban's fundamental impulse@red@ was a desire to @red@control the hearts and minds of his fellow man.@red@ To take @red@them beyond the @red@pale of mere allegiance,@red@ and corrupt @red@them into a pure force for evil.% %@red@ This was the fantasy that chased him in his dreams. A @red@whole legion of soul-less beings, their minds demented @red@from the sheer power that he had channelled through to @red@them.%@red@But dreams was all they ever were.@red@ As a mere mortal- @red@heroic though he was- this @red@was an ambition that Iban was @red@unable to achieve. Meeting his demise in the White @red@Knights' now @red@famous Dawn Ascent, Iban died with the @red@bitter taste of @red@failure in his mouth. Little did he know that @red@his death was only the beginning.";

async function readChapter(player, chapter) {
    const [title, text] = CHAPTERS[chapter];

    player.message(title);
    sendBox(player, text, true);

    if (chapter === 1) {
        const more = await player.ask(['continue reading', 'close book']);

        if (more === 0) {
            sendBox(player, IBAN_CONTINUED, true);
        }
    }

    if (chapter >= 3 && chapter <= 6) {
        await mes(player, 'there are four more chapters');

        const option = await player.ask(['flesh', 'blood', 'shadow', 'conscience']);

        if (option >= 0) {
            await readChapter(player, option + 3);
        }
    }
}

async function oldJournal(player) {
    await mes(player, 'the journal is old and covered in dust');
    await mes(player, 'inside are several chapters...');

    const chapter = await player.ask(['intro', 'iban', 'the ressurection', 'the four elements']);

    if (chapter >= 0 && chapter <= 2) {
        await readChapter(player, chapter);
    } else if (chapter === 3) {
        await mes(player, "you turn to the page titled 'the four elements'");
        await mes(player, 'there are four more chapters');

        const offset = await player.ask(['flesh', 'blood', 'shadow', 'conscience']);

        if (offset >= 0 && offset <= 3) {
            await readChapter(player, offset + 3);
        }
    }
}

async function onInventoryCommand(player, item) {
    if (item.id === ITEM.A_DOLL_OF_IBAN) {
        await searchDoll(player);
    } else if (item.id === ITEM.OLD_JOURNAL) {
        await oldJournal(player);
    } else if (item.id === ITEM.STAFF_OF_IBAN_BROKEN) {
        await brokenStaff(player);
    } else {
        return false;
    }

    return true;
}

// ---- the Dark Mage (667) -----------------------------------------------------------------------------------------------------

async function onTalkToNPC(player, npc) {
    if (npc.id !== NPC.DARK_MAGE) {
        return false;
    }

    player.engage(npc);

    try {
        await player.say('hello there');
        await npc.say('why do do you interupt me traveller?');

        if (stageOf(player) !== -1) {
            await player.say("i'm just looking around");
            await npc.say("there's nothing to see here", 'just despair and death');

            return true;
        }

        await player.say('i just wondered what you\'re doing?');
        await npc.say('i experiment with dark magic', "it's a dangerous craft");

        if (holds(player, ITEM.STAFF_OF_IBAN_BROKEN)) {
            await player.say('could you fix this staff?');
            player.message('you show the mage your staff of iban');
            await npc.say('almighty zamorak! the staff of iban!');
            await player.say('can you fix it?');
            await npc.say(
                'this truly is dangerous magic traveller',
                'i can fix it, but it will cost you',
                'the process could kill me'
            );
            await player.say('how much?');
            await npc.say('200,000 gold pieces, not a penny less');

            const menu = await player.ask(["no chance, that's ridiculous", 'ok then'], true);

            if (menu === 0) {
                await npc.say('fine by me');
            } else if (menu === 1) {
                if (!holds(player, ITEM.COINS, 200000)) {
                    player.message("you don't have enough money");
                    await player.say("oops, i'm a bit short");
                } else {
                    await mes(player, 'you give the mage 200,000 coins');
                    await mes(player, 'and the staff of iban');
                    take(player, ITEM.COINS, 200000);
                    take(player, ITEM.STAFF_OF_IBAN_BROKEN);
                    player.message('the mage fixes the staff and returns it to you');
                    give(player, ITEM.STAFF_OF_IBAN);
                    await player.say('thanks mage');
                    await npc.say('you be carefull with that thing');
                }
            }
        }
    } finally {
        if (player.interlocutor) {
            player.disengage();
        }
    }

    return true;
}

module.exports = { onInventoryCommand, onTalkToNPC };
