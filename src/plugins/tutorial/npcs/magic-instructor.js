// Tutorial Island magic instructor. Port of OpenRSC MagicInstructor.java.
// The Wind strike cast itself (76 -> 77 -> 78) is handled in ../combat.js.

const t = require('../core');

const WATER_RUNE = 32;
const EARTH_RUNE = 34;
const BODY_RUNE = 36;

const RUNES = [
    [t.ITEM.AIR_RUNE, 12],
    [t.ITEM.MIND_RUNE, 8],
    [WATER_RUNE, 3],
    [EARTH_RUNE, 2],
    [BODY_RUNE, 1]
];

const NO_SPACE = '@que@You need some free inventory space to take the runes';

// stackable runes only need a free slot for the ones not yet held
function canHoldRunes(player) {
    if (!player.inventory.isFull()) {
        return true;
    }

    return RUNES.every(([id]) => player.inventory.has(id));
}

const CHICKEN_RANGE = 10;
const CHICKEN_SPAWN = { x: 218, y: 755 };

function chickenNearby(player) {
    const entities = (player.world.npcs && player.world.npcs.entities) || [];

    return [...entities].some(
        (n) =>
            n &&
            n.id === t.NPC.CHICKEN &&
            Math.abs(n.x - player.x) <= CHICKEN_RANGE &&
            Math.abs(n.y - player.y) <= CHICKEN_RANGE
    );
}

// authentic: with no chicken around the wizard conjures one
function summonChicken(player) {
    const NPC = require('../../../model/npc');
    const { x, y } = CHICKEN_SPAWN;

    const chicken = new NPC(player.world, {
        id: t.NPC.CHICKEN,
        x,
        y,
        minX: x - 3,
        maxX: x + 3,
        minY: y - 3,
        maxY: y + 3
    });

    delete chicken.respawn;
    player.world.addEntity('npcs', chicken);
}

function giveRunes(player) {
    for (const [id, amount] of RUNES) {
        t.give(player, id, amount);
    }
}

async function explain(player, npc) {
    await npc.say(
        'Ok move your mouse over the book icon on the menu bar',
        'this is your magic menu',
        'You will see at level 1 magic you can only cast wind strike',
        'move your mouse over the wind strike text',
        'If you look at the bottom of the magic window',
        'You will see more information about the spell',
        'runes required for the spell have two numbers over them',
        'The first number is how many runes you have',
        'The second is how many runes the spell requires',
        'Speak to me again when you have checked this'
    );
    t.setStage(player, 75);
}

async function onTalkToNPC(player, npc) {
    if (npc.id !== t.NPC.MAGIC) {
        return false;
    }

    player.engage(npc);

    if (!t.onTutorial(player)) {
        await npc.say('Magic is a wonderful thing. Use it wisely');
        player.disengage();
        return true;
    }

    const stage = t.stage(player);

    if (stage < 70) {
        await npc.say(
            'You are not ready for magic yet',
            'Speak to the others first'
        );
    } else if (stage === 70) {
        await npc.say(
            "there's good magic potential in this one",
            'Yes definitely something I can work with'
        );

        const choice = await player.ask(
            ['Hmm are you talking about me?', 'teach me some magic'],
            true
        );

        if (choice === 0) {
            await npc.say('Yes that is the one of which I speak');
        } else {
            await npc.say('Teacher, yes I am one of them');
        }

        await explain(player, npc);
    } else if (stage === 75) {
        await player.say("I don't have the runes to cast wind strike");
        await npc.say(
            'How do you expect to do magic without runes?',
            'Ok I shall have to provide you with runes'
        );

        if (!canHoldRunes(player)) {
            player.message(NO_SPACE);
            player.disengage();
            return true;
        }

        player.message('@que@The instructor gives you some runes');
        giveRunes(player);
        await npc.say(
            'Ok look at your spell list now',
            'You will see you have the runes for the spell',
            'And it shows up yellow in your list'
        );
        t.setStage(player, 76);
    } else if (stage === 76 || stage === 77) {
        // the Java only hands runes out at 75; a player who has used them
        // all up would be stuck here, so top them up
        if (
            !player.inventory.has(t.ITEM.AIR_RUNE) ||
            !player.inventory.has(t.ITEM.MIND_RUNE)
        ) {
            if (!canHoldRunes(player)) {
                player.message(NO_SPACE);
                player.disengage();
                return true;
            }

            await npc.say('You have run out of runes', 'Here, take some more');
            player.message('@que@The instructor gives you some runes');
            giveRunes(player);
        }

        if (!chickenNearby(player)) {
            await npc.say('I think we need a chicken');
            player.message('@que@The wizard waves his arms around and chants');
            summonChicken(player);
            player.disengage();
            return true;
        }

        if (stage === 76) {
            await npc.say(
                'Aha a chicken',
                'An Ideal wind strike target',
                'ok click on the wind strike spell in your spell list',
                'then click on the chicken to chose it as a target'
            );
            t.setStage(player, 77);
        } else {
            await npc.say(
                'To shoot a wind strike at a chicken',
                'select the book icon in the menu bar',
                'then click on the yellow wind strike text',
                'then left click on the chicken to cast the spell'
            );
            t.setStage(player, 78);
        }
    } else {
        // authentic: no real check that the player cast anything
        await npc.say(
            'Well done',
            'As you get a higher magic level',
            'You will be able to cast all sorts of interesting spells',
            'Now go through the next door'
        );
        t.setStage(player, 80);
    }

    player.disengage();
    return true;
}

module.exports = { onTalkToNPC };
