// Ported from Open-RSC Core-Framework authentic/quests/members/grandtree/GnomeGlider.java (AGPL-3.0): the gnome
// gliders (objects 618) and their pilots. During The Grand Tree (stages 8-9) the pilot at the top of the tree (552)
// crashes you in south Karamja (425,764) beside the broken glider (556) and a Jogre (523) attacks. After the quest
// he flies to Karamja (389,753), Varrock (58,504), Al Kharid (88,664) and White Wolf Mountain (400,461); the pilots
// there (569, 571, 572) fly back to the tree (414,2995); the Varrock one (570) has crashed.
// Every flight passes the glider in the sky (221,3567) for a moment, as in the Java.

const PILOT_GRANDTREE_ID = 552;
const PILOT_KARAMJA_BROKEN_ID = 556;
const PILOT_KARAMJA_ID = 569;
const PILOT_VARROCK_ID = 570;
const PILOT_ALKHARID_ID = 571;
const PILOT_WHITEMOUNTAIN_ID = 572;
const JOGRE_ID = 523;
const GLIDER_ID = 618;

const SKY = [221, 3567];
const TREE = [414, 2995];

const DESTINATIONS = [
    { say: 'take me to karamja', to: [389, 753] },
    { say: 'take me to Varrock', to: [58, 504] },
    { say: 'take me to Al kharid', to: [88, 664] },
    { say: 'take me to White wolf mountain', to: [400, 461] }
];

function stageOf(player) {
    return player.questStages.grandTree || 0;
}

async function mes(player, line, ticks = 3) {
    player.message(line);
    await player.world.sleepTicks(ticks);
}

async function fly(player, npc, [x, y]) {
    const { world } = player;

    await npc.say("ok, your the boss, jump on", "hold on tight, it'll be a rough ride"); // sic
    await mes(player, "you hold on tight to the glider's wooden beam");
    await mes(player, 'the pilot leans back and then pushes the glider forward');
    await mes(player, 'you float softly off the grand tree');

    player.disengage();
    player.teleport(...SKY);
    await world.sleepTicks(2);
    await player.say('whhaaaaaaaaaagghhh');
    player.teleport(x, y);
    await world.sleepTicks(2);
    await player.say('ouch');
}

async function grandTreePilot(player, npc) {
    const stage = stageOf(player);

    await player.say('hello');

    if (stage === -1) {
        await npc.say('well hello again traveller');
        await npc.say('can i take you somewhere?');
        await npc.say('i can fly like the birds');

        const menu = await player.ask(
            ['karamja', 'varrock', 'Al kharid', 'white wolf mountain', "I'll stay here thanks"],
            false
        );

        if (menu === 4) {
            await player.say("i'll stay here thanks");
            await npc.say('no worries, let me know if you change your mind');
        } else if (DESTINATIONS[menu]) {
            await player.say(DESTINATIONS[menu].say);
            await fly(player, npc, DESTINATIONS[menu].to);
        }

        return;
    }

    if (stage === 8 || stage === 9) {
        await npc.say('hi, the king said that you need to leave');
        await player.say('yes, apparently humans are invading');
        await npc.say('i find that hard to believe', 'i have lots of human friends');
        await player.say('it seems a bit strange to me');
        await npc.say('well, would you like me to take you somewhere?');

        const menu = await player.ask(['actually yes, take me to karamja', "no thanks i'm going to hang around"], true);

        if (menu === 0) {
            await fly(player, npc, [425, 764]);

            const broken = player.getNearbyEntitiesByID('npcs', PILOT_KARAMJA_BROKEN_ID, 5)[0];

            if (broken) {
                await broken.say('ouch');
                player.message('you crash in south karamja');
                await broken.say('sorry about that, are you ok');
                await player.say("i seem to be fine, can't say the same for your glider");
                await broken.say(
                    "i don't think i can fix this",
                    "looks like we'll be heading back by foot",
                    'i hope you find what you came for adventurer'
                );
                await player.say('me too, take care little man');
                await broken.say('traveller watch out');
            }

            const jogre = player.getNearbyEntitiesByID('npcs', JOGRE_ID, 15).find((n) => !n.locked);

            if (jogre) {
                await jogre.say('grrrrr');
                jogre.attack(player).catch(() => {});
            }
        } else if (menu === 1) {
            await npc.say("ok, i'll be here if you need me");
        }

        return;
    }

    await npc.say('hello traveller');
}

async function returnPilot(player, npc) {
    if (stageOf(player) === -1) {
        await player.say('hello again');
        await npc.say('well hello adventurer');
        await npc.say('would you like to go to the tree gnome stronghold?');

        const menu = await player.ask(['ok then', 'no thanks'], true);

        if (menu === 0) {
            const { world } = player;

            await npc.say('ok, hold on tight');
            await mes(player, 'you both hold onto the wooden beam');
            await mes(player, 'you take a few steps backand rush forwards'); // sic
            await mes(player, 'the glider just lifts of the ground'); // sic
            player.disengage();
            player.teleport(...SKY);
            await world.sleepTicks(2);
            await player.say('whhaaaaaaaaaagghhh');
            player.teleport(...TREE);
        }

        return;
    }

    await player.say('hello');
    await npc.say('hello traveller');
}

async function varrockPilot(player, npc) {
    await player.say('hello again');
    await npc.say(
        'well hello adventurer',
        'as you can see we crashed on impact',
        "i don't think it'll fly again",
        "sorry but you'll have to walk"
    );
}

async function brokenPilot(player) {
    player.message('The Gnome pilot does not appear interested in talking');
}

const DIALOGUES = {
    [PILOT_GRANDTREE_ID]: grandTreePilot,
    [PILOT_KARAMJA_ID]: returnPilot,
    [PILOT_ALKHARID_ID]: returnPilot,
    [PILOT_WHITEMOUNTAIN_ID]: returnPilot,
    [PILOT_VARROCK_ID]: varrockPilot,
    [PILOT_KARAMJA_BROKEN_ID]: brokenPilot
};

async function onTalkToNPC(player, npc) {
    const dialogue = DIALOGUES[npc.id];

    if (!dialogue) {
        return false;
    }

    player.engage(npc);
    await dialogue(player, npc);

    // a flight or a fight has already let go
    if (player.interlocutor) {
        player.disengage();
    }

    return true;
}

async function onGameObjectCommandOne(player, gameObject) {
    if (gameObject.id !== GLIDER_ID) {
        return false;
    }

    player.message('only the gnomes can fly these');
    return true;
}

module.exports = { onTalkToNPC, onGameObjectCommandOne };
