// Ported from Open-RSC Core-Framework authentic/quests/members/grandtree/GrandTree.java (AGPL-3.0): Femi (563 at the
// stronghold gate, 564 inside). At stage 10 the gate is barred (game-objects/members-gates.js) and Femi smuggles you in
// under a sheet in her cart: free if you helped her lift the barrel at the gate before the quest (cache helpedFemi
// true, game-objects/members-gates.js), otherwise for 1000 coins. The barrel itself is asked at the gate on stage 0.

const FEMI_ID = 563;
const FEMI_STRONGHOLD_ID = 564;
const COINS_ID = 10;
const FEE = 1000;

function stageOf(player) {
    return player.questStages.grandTree || 0;
}

async function mes(player, line, ticks = 3) {
    player.message(line);
    await player.world.sleepTicks(ticks);
}

async function intoTheCart(player) {
    await mes(player, 'you hide in the cart');
    await mes(player, 'femi covers you with a sheet...');
    await mes(player, '...and drags the cart to the gate');
}

async function femiDialogue(player, npc) {
    const { world } = player;

    if (stageOf(player) !== 10) {
        player.message('the little gnome is too busy to talk');
        return;
    }

    let smuggled = false;
    let favour = false;

    await player.say("i can't believe they won't let me in");
    await npc.say(
        "i don't believe all this rubbish about an invasion",
        'if mankind wanted to, they could have invaded before now'
    );
    await player.say('i really need to see king shareem', 'could you help sneak me in');

    if (player.cache.helpedFemi === true) {
        await npc.say('well, as you helped me i suppose i could', "we'll have to be careful", "if i get caught i'll be in the cage");
        await player.say('ok, what should i do');
        await npc.say('jump in the back of the cart', "it's a food delivery, we should be fine");
        await intoTheCart(player);
        await mes(player, 'femi pulls you into the stronghold');
        smuggled = true;
        favour = true;
    } else {
        await npc.say("why should i help you, you wouldn't help me");
        await player.say('erm i know, but this is an emergency');
        await npc.say('so was lifting that barrel', "tell you what, let's call it a round 1000 gold piece's");
        await player.say('1000 gold pieces');
        await npc.say("that's right 1000 and i'll sneak you in");

        const option = await player.ask(['no chance', 'ok then, here you go'], true);

        if (option === 1) {
            if (player.inventory.has(COINS_ID, FEE)) {
                await npc.say('alright, jump in the back of the cart', "it's a food delivery, we should be fine");
                await intoTheCart(player);
                await mes(player, 'you give femi 1000 gold coins');
                player.inventory.remove(COINS_ID, FEE);
                await mes(player, 'femi pulls you into the stronghold');
                smuggled = true;
            } else {
                // TODO in the Java: authentic behaviour here not known
                await player.say("Oh dear I don't seem to have enough money");
            }
        }
    }

    if (!smuggled) {
        return;
    }

    player.disengage();
    player.teleport(708, 510);
    await world.sleepTicks(3); // the teleport lands after 2 ticks

    const femi = player.getNearbyEntitiesByID('npcs', FEMI_STRONGHOLD_ID, 2)[0];

    if (femi) {
        await femi.say("ok traveller, you'd better get going");

        if (favour) {
            await player.say('thanks again femi');
            await femi.say("that's ok, all the best");
        }
    }
}

async function onTalkToNPC(player, npc) {
    if (npc.id === FEMI_STRONGHOLD_ID) {
        player.message('the little gnome is too busy to talk');
        return true;
    }

    if (npc.id !== FEMI_ID) {
        return false;
    }

    player.engage(npc);
    await femiDialogue(player, npc);

    if (player.interlocutor) {
        player.disengage();
    }

    return true;
}

module.exports = { onTalkToNPC };
