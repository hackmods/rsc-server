// Ported from Open-RSC Core-Framework authentic/misc/Panning.java (AGPL-3.0): panning for gold at the panning points
// (1058) in the river by the Dig Site.
//
// - Use an empty panning tray (1111) on a panning point: the guide (npc 726) must be within 15 tiles. Until he has had
//   a cup of tea (use one on him) he refuses ("We do not allow the uninvited to pan here"); after that the tray comes
//   up full (1113), +20 mining experience (quarter points, as the Java's incExp).
// - Search a full tray: 40% plain mud, 10% each uncut opal, uncut jade, 1-10 coins, a rock sample (1148), gold nuggets
//   (1118) and an uncut sapphire; the tray is empty again.
// - "take gold" on a tray holding gold (1112) gives the nuggets and empties it.
// The tea permission is the Java cache key unlocked_panning (player.cache.unlocked_panning), not a Dig Site quest
// stage: the Java's own comment ("NOT SURE? if(p.getQuestStage(Quests.DIGSITE) < 2)") left the quest out.
// Java quirk kept: searching a full tray never yields the gold-holding tray (1112); a gold find gives the nuggets
// directly (Panning.java line 166). The Java then prints no message for it (line 179 compares against 1112): the
// message it meant ("You find some gold nuggets within the mud!") is printed here.

const PANNING_POINT_ID = 1058;
const GUIDE_ID = 726;

const PANNING_TRAY_ID = 1111;
const PANNING_TRAY_GOLD_NUGGET_ID = 1112;
const PANNING_TRAY_FULL_ID = 1113;
const GOLD_NUGGETS_ID = 1118;
const ROCK_SAMPLE_ORANGE_ID = 1148;
const CUP_OF_TEA_ID = 739;
const UNCUT_OPAL_ID = 891;
const UNCUT_JADE_ID = 890;
const UNCUT_SAPPHIRE_ID = 160;
const COINS_ID = 10;

const GUIDE_RANGE = 15;
const PAN_EXPERIENCE = 20;
const COIN_AMOUNTS = [1, 2, 5, 10];

// DataConversions.random(low, high): inclusive
const random = (low, high) => low + Math.floor(Math.random() * (high - low + 1));

// what a full tray holds (Panning.java lines 150-169): random(0, 100) against these upper bounds
function rollTray(roll = random(0, 100)) {
    if (roll < 40) return null;
    if (roll < 50) return { id: UNCUT_OPAL_ID, amount: 1 };
    if (roll < 60) return { id: UNCUT_JADE_ID, amount: 1 };
    if (roll < 70) return { id: COINS_ID, amount: COIN_AMOUNTS[random(0, COIN_AMOUNTS.length - 1)] };
    if (roll < 80) return { id: ROCK_SAMPLE_ORANGE_ID, amount: 1 };
    if (roll < 90) return { id: GOLD_NUGGETS_ID, amount: 1 };
    return { id: UNCUT_SAPPHIRE_ID, amount: 1 };
}

const FIND_MESSAGES = {
    [COINS_ID]: 'You find some coins within the mud',
    [ROCK_SAMPLE_ORANGE_ID]: 'You find a rock sample covered in mud',
    [UNCUT_OPAL_ID]: 'You find a gem within the mud!',
    [UNCUT_JADE_ID]: 'You find a gem within the mud!',
    [UNCUT_SAPPHIRE_ID]: 'You find a gem within the mud!',
    [GOLD_NUGGETS_ID]: 'You find some gold nuggets within the mud!'
};

// one add per find, written out so scripts/audit/item-sources.js reads each id as a source
function giveFind(player, { id, amount }) {
    switch (id) {
        case UNCUT_OPAL_ID:
            player.inventory.add(UNCUT_OPAL_ID);
            break;
        case UNCUT_JADE_ID:
            player.inventory.add(UNCUT_JADE_ID);
            break;
        case COINS_ID:
            player.inventory.add(COINS_ID, amount);
            break;
        case ROCK_SAMPLE_ORANGE_ID:
            player.inventory.add(ROCK_SAMPLE_ORANGE_ID);
            break;
        case GOLD_NUGGETS_ID:
            player.inventory.add(GOLD_NUGGETS_ID);
            break;
        case UNCUT_SAPPHIRE_ID:
            player.inventory.add(UNCUT_SAPPHIRE_ID);
            break;
    }
}

async function onGameObjectCommandOne(player, gameObject) {
    if (gameObject.id !== PANNING_POINT_ID) {
        return false;
    }

    player.message('If I had a panning tray I could pan here');
    return true;
}

async function refusePanning(player, guide) {
    player.engage(guide);
    await guide.say("Hey! you can't pan yet!");
    await player.say('Why not ?');
    await guide.say('We do not allow the uninvited to pan here');

    const choice = await player.ask(['Okay, forget it', 'So how do I become invited then ?'], true);

    if (choice === 0) {
        await guide.say('You can of course use this place when you know what you are doing');
    } else if (choice === 1) {
        await guide.say(
            "I'm not supposed to let people pan here",
            'Unless they have permission from the authorities first',
            'Mind you I could let you have a go...',
            "If you're willing to do me a favour"
        );
        await player.say("What's that ?");
        await guide.say('Well...to be honest...', 'What I would really like...', 'Is a nice cup of tea !');
        await player.say('Tea !?');
        await guide.say(
            "Absolutely, I'm parched !",
            'If you could bring me one of those...',
            'I would be more than willing to let you pan here'
        );
    }

    player.disengage();
}

async function pan(player) {
    const { world } = player;

    player.sendBubble(PANNING_TRAY_ID);
    player.sendSound('mix');
    player.message('@que@You scrape the tray along the bottom');
    player.message('You swirl away the excess water');
    await world.sleepTicks(3);
    player.sendBubble(PANNING_TRAY_FULL_ID);
    player.message('@que@You lift the full tray from the water');
    player.inventory.remove(PANNING_TRAY_ID);
    player.inventory.add(PANNING_TRAY_FULL_ID);
    player.addExperience('mining', PAN_EXPERIENCE);
}

async function onUseWithGameObject(player, gameObject, item) {
    if (gameObject.id !== PANNING_POINT_ID) {
        return false;
    }

    if (item.id === PANNING_TRAY_ID) {
        const guide = player.getNearestEntityByID('npcs', GUIDE_ID, GUIDE_RANGE * 2);

        // the Java does nothing at all with no guide in sight
        if (!guide) {
            return true;
        }

        if (!player.cache.unlocked_panning) {
            if (!guide.interlocutor) {
                await refusePanning(player, guide);
            }
        } else {
            await pan(player);
        }
    } else if (item.id === PANNING_TRAY_FULL_ID) {
        player.message('@que@This panning tray already contains something');
    } else if (item.id === PANNING_TRAY_GOLD_NUGGET_ID) {
        player.message('@que@This panning tray already contains gold');
    }

    return true;
}

async function onUseWithNPC(player, npc, item) {
    if (npc.id !== GUIDE_ID) {
        return false;
    }

    if (npc.interlocutor) {
        return true;
    }

    player.engage(npc);

    if (item.id === PANNING_TRAY_ID) {
        player.message('You give the panning tray to the guide');
        await npc.say('Yes, this is a panning tray...');
    } else if (item.id === PANNING_TRAY_FULL_ID) {
        player.message('You give the full panning tray to the guide');
        await npc.say('This is no good to me', "I don't deal with finds");
    } else if (item.id === PANNING_TRAY_GOLD_NUGGET_ID) {
        player.message('You give the full panning tray to the guide');
        await npc.say("I am afraid I don't deal with finds", "That's not my job");
    } else if (item.id === CUP_OF_TEA_ID) {
        if (player.cache.unlocked_panning) {
            await npc.say("No thanks, I've had enough!");
        } else {
            await npc.say('Ah! Lovely!', "You can't beat a good cuppa...", "You're free to pan all you want");
            await player.say('Thanks');
            player.inventory.remove(CUP_OF_TEA_ID);
            player.cache.unlocked_panning = true;
        }
    }

    player.disengage();
    return true;
}

async function onInventoryCommand(player, item) {
    const { world } = player;

    if (item.id === PANNING_TRAY_ID) {
        player.message('@que@You search the contents of the tray');
        await player.say('Err, why am I searching an empty tray ?');
        return true;
    }

    if (item.id === PANNING_TRAY_FULL_ID) {
        player.message('You search the contents of the tray...');
        await world.sleepTicks(3);

        const find = rollTray();

        player.inventory.remove(PANNING_TRAY_FULL_ID);
        player.inventory.add(PANNING_TRAY_ID);

        if (find) {
            player.message(`@que@${FIND_MESSAGES[find.id]}`);
            giveFind(player, find);
        } else {
            player.message('@que@The tray contains only plain mud');
        }

        return true;
    }

    if (item.id === PANNING_TRAY_GOLD_NUGGET_ID) {
        player.inventory.remove(PANNING_TRAY_GOLD_NUGGET_ID);
        player.inventory.add(PANNING_TRAY_ID);
        player.inventory.add(GOLD_NUGGETS_ID);
        player.message('You take the gold form the panning tray', 'You have a handful of gold nuggets');
        return true;
    }

    return false;
}

module.exports = { onGameObjectCommandOne, onUseWithGameObject, onUseWithNPC, onInventoryCommand, rollTray };
