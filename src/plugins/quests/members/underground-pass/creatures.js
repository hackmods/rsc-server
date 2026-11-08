// Ported from Open-RSC Core-Framework authentic/quests/members/undergroundpass/npcs/UndergroundPassIbanDisciple.java,
// UndergroundPassKalrag.java, UndergroundPassPaladin.java, UndergroundPassSlaves.java and UndergroundPassDemons.java
// (AGPL-3.0): the disciples (658), Kalrag (641), the two paladins (632, 633), the seven slaves (634-640) and the three demons
// (645-647). Stage map: shared.js.
//
// A KillNpcTrigger of the Java runs and the npc then dies as usual (loot and all), so the death hooks here do their work and
// return false. Their messages are paced with ticks in the Java; they run beside the death instead of holding it, and
// `settle()` waits for them (tests).

const {
    ITEM,
    NPC,
    stageOf,
    cacheHas,
    cacheSet,
    mes,
    give,
    holds,
    worn,
    nextInt,
    attackSoon,
    dropFor
} = require('./shared');

const pending = new Set();

function later(promise) {
    const tracked = promise.catch(() => {}).then(() => pending.delete(tracked));

    pending.add(tracked);

    return tracked;
}

function settle() {
    return Promise.all([...pending]);
}

// ---- the disciples ---------------------------------------------------------------------------------------------------

async function discipleTalk(player, npc) {
    await player.say('hi');

    if (!worn(player, ITEM.ROBE_OF_ZAMORAK_TOP) || !worn(player, ITEM.ROBE_OF_ZAMORAK_BOTTOM)) {
        await npc.say('an imposter....die scum');
        attackSoon(player, npc);
        return;
    }

    const selected = nextInt(4);

    if (selected === 1) {
        await npc.say('hail the great one, my lord iban', 'i die for you again and again');
        await player.say('is that possible?');
        await npc.say('under iban anything is possible', 'death is only the beginning');
    } else if (selected === 2) {
        await npc.say('som molica aniul demonte');
        await player.say('pardon');
        await npc.say('som molica aniul demonte');
    } else if (selected === 3) {
        await npc.say('iban is our father, our guide', 'soon he will rule all life');
    }
}

async function discipleKilled(player) {
    if (stageOf(player) === -1) {
        await mes(player, 'you search the diciples remains');

        if (!holds(player, ITEM.STAFF_OF_IBAN) && !holds(player, ITEM.STAFF_OF_IBAN_BROKEN)) {
            player.message('and find a staff of iban');
            give(player, ITEM.STAFF_OF_IBAN_BROKEN);
        } else {
            player.message('but find nothing');
        }
    } else {
        dropFor(player, ITEM.ROBE_OF_ZAMORAK_TOP, player.x, player.y);
        dropFor(player, ITEM.ROBE_OF_ZAMORAK_BOTTOM, player.x, player.y);
    }
}

// ---- Kalrag ----------------------------------------------------------------------------------------------------------------

async function kalragKilled(player) {
    await mes(player, 'kalrag slumps to the floor');
    await mes(player, 'poison flows from the corpse over the soil');

    if (!cacheHas(player, 'poison_on_doll') && stageOf(player) === 6) {
        if (holds(player, ITEM.A_DOLL_OF_IBAN)) {
            await mes(player, 'you smear the doll of iban in the poisoned blood');
            player.message('it smells horrific');
            cacheSet(player, 'poison_on_doll');
        } else {
            await mes(player, 'it quikly seeps away into the earth');
            player.message('you dare not collect any without ibans doll');
        }
    }
}

// ---- the paladins ----------------------------------------------------------------------------------------------------------

function giveFood(player) {
    player.message('the paladin gives you some food');
    give(player, ITEM.MEAT_PIE, 2);
    give(player, ITEM.STEW, 1);
    give(player, ITEM.BREAD, 2);
    give(player, ITEM.TWO_ATTACK_POTION, 1);
    give(player, ITEM.TWO_RESTORE_PRAYER_POTION, 1);
    cacheSet(player, 'paladin_food');
}

async function paladinTalk(player, npc) {
    switch (stageOf(player)) {
        case 4:
            await player.say('hello paladin');

            if (nextInt(2) === 0) {
                if (!cacheHas(player, 'paladin_food')) {
                    await npc.say("you've done well to get this far traveller, here eat");
                    giveFood(player);
                    await player.say('thanks');
                }

                await npc.say(
                    'you should leave this place now traveller',
                    'i heard the crashing of rocks further down the cavern',
                    'iban must be restless',
                    'i have no doubt that zamorak still controls these caverns',
                    'a little further on lies the great door of iban',
                    "we've tried everything, but it will not let us enter",
                    "leave now before iban awakes and it's too late"
                );
            } else {
                await npc.say('traveller, what are you doing in this most unholy place?');
                await player.say("i'm looking for safe route through the caverns", 'under order of king lathas');

                if (!cacheHas(player, 'paladin_food')) {
                    await npc.say("you've done well to come this far, here eat");
                    giveFood(player);
                }

                await npc.say(
                    "There's no doubt Iban still controls these caverns..",
                    "we've also been looking for a passage through..",
                    'a little further on lies the great door of iban..',
                    "we've tried everything, but it will not let us enter..",
                    "leave now before iban awakes and it's too late"
                );
            }

            break;
        case 5:
        case 6:
        case 7:
        case 8:
        case -1:
            await player.say('hello');
            await npc.say('you again, die zamorakian scum');
            attackSoon(player, npc);
            break;
        default:
    }
}

async function paladinKilled(player, npc) {
    await mes(player, 'the paladin slumps to the floor');
    await mes(player, 'you search his body');

    if (npc.id === NPC.PALADIN_UNDERGROUND_BEARD) {
        if (!holds(player, ITEM.COAT_OF_ARMS_RED)) {
            give(player, ITEM.COAT_OF_ARMS_RED);
            player.message('and find a paladin coat of arms');
        } else {
            player.message('but find nothing');
        }
    } else if (!holds(player, ITEM.COAT_OF_ARMS_BLUE, 2)) {
        give(player, ITEM.COAT_OF_ARMS_BLUE);
        player.message('and find a paladin coat of arms');
    } else {
        player.message('but find nothing');
    }
}

// ---- the slaves ------------------------------------------------------------------------------------------------------------

async function slaveTalk(player, npc) {
    player.message('the man seems to be in a weak state of mind');

    switch (npc.id - NPC.SLAVE_1 + 1) {
        case 1:
            await player.say('hello');
            await npc.say(
                'Eating me...they keep eating me!',
                'Eating me from the inside. Please stop  them eating me',
                '... I can feel them wriggling around inside me right now',
                '... please  stop them!'
            );
            attackSoon(player, npc);
            break;
        case 2:
            await player.say('hi');
            await npc.say(
                'Blood, blood... never enough blood to go round',
                'When I lift up my arm like this,it all pours back into my body',
                'I hope it remembers to go back inside my arm',
                "And don't even ask me about my legs..",
                'how much blood are they going to need?',
                'Blood is important',
                'We must offer it to Zamorak every day as proof of our devotion',
                "I just hope I don't run out."
            );
            player.message('the prisoner has clearly been here too long');
            break;
        case 3:
            await player.say('hello, are you ok?');
            await npc.say(
                "Oh yes, you're a fine one. Nice red cheeks, shiny hair",
                "Let's see now, some potatoes, some cabbage,",
                'maybe half a clove of garlic',
                "...yes  I think you'd  make a fine soup",
                "You don't mind do you?"
            );
            await player.say('actually i do');
            await npc.say("You're welcome to have some with me of course.");
            attackSoon(player, npc);
            break;
        case 4:
            await player.say('hi');
            await npc.say('Mwaarrr fnnntchh. Gbpp dng sktd delp?');
            await player.say('pardon?');
            await npc.say('Kjp lar falut: Gbpp dng sktd delp?');
            await player.say('sorry, i dont under..');
            await npc.say('Mwaarrr fnnntchh. Gbpp dng sktd delp?', 'GBPP DNG SKTD DELP! GBPP DNG SKTD DELP!');
            attackSoon(player, npc);
            break;
        case 5:
            await player.say('hi');
            await npc.say(
                'Kill the villagers, burn them all- every last one',
                'I want nothing to survive: nothing but the sweet smell of burning flesh'
            );
            await player.say("you're ill");
            await npc.say("What's that - you've never smelt it before", "Well, let's just say that it's an acquired taste");
            attackSoon(player, npc);
            break;
        case 6:
            await player.say('hello');
            await npc.say(
                'Danger, everywhere danger! But not from man nor beast-',
                'no this is the danger that is inside you.',
                'Bring it out, nurture it, cherish it',
                'Stroke it like you would stroke a wounded bird-',
                'then strangle it before it takes hold of your very being',
                "Don't say I didn't warn you"
            );
            break;
        case 7:
            await player.say('hello');
            await npc.say(
                "What's that...is that a dagger I see before me?",
                'Why should I bear the slings and arrows of outrageous fortune',
                'for what is a man but this quintessence of dust?',
                'And so I say goodnight sweet prince. The rest is silence.'
            );
            break;
        default:
    }
}

// ---- the demons ------------------------------------------------------------------------------------------------------------

// where the player is put after the fight (teleportPlayer of the Java)
const DEMON_EXITS = {
    [NPC.OTHAINIAN]: [796, 3541],
    [NPC.DOOMION]: [807, 3541],
    [NPC.HOLTHION]: [807, 3528]
};

async function demonKilled(player, npc) {
    const exit = DEMON_EXITS[npc.id];

    if (!cacheHas(player, 'doll_of_iban') && stageOf(player) !== 6) {
        player.message('the demon slumps to the floor');
        player.teleport(...exit);
        return;
    }

    player.teleport(...exit);
    await mes(player, 'the demon slumps to the floor');

    // the amulet of each demon: its id + 364 (1009 Othainian, 1010 Doomion, 1011 Holthion)
    if (!holds(player, npc.id + 364)) {
        player.message("around it's neck you find a strange looking amulet");
        give(player, npc.id + 364);
    }
}

// ---- hooks -----------------------------------------------------------------------------------------------------------------

async function onTalkToNPC(player, npc) {
    let handler;

    if (npc.id === NPC.IBAN_DISCIPLE) {
        handler = discipleTalk;
    } else if (npc.id === NPC.PALADIN_UNDERGROUND_BEARD) {
        handler = paladinTalk;
    } else if (npc.id >= NPC.SLAVE_1 && npc.id <= NPC.SLAVE_7) {
        handler = slaveTalk;
    } else {
        return false;
    }

    player.engage(npc);

    try {
        await handler(player, npc);
    } finally {
        if (player.interlocutor) {
            player.disengage();
        }
    }

    return true;
}

async function onNPCDeath(player, npc) {
    if (!player || !player.questStages) {
        return false;
    }

    if (npc.id === NPC.IBAN_DISCIPLE) {
        later(discipleKilled(player));
    } else if (npc.id === NPC.KALRAG) {
        later(kalragKilled(player));
    } else if (npc.id === NPC.PALADIN_UNDERGROUND_BEARD || npc.id === NPC.PALADIN_UNDERGROUND) {
        later(paladinKilled(player, npc));
    } else if (DEMON_EXITS[npc.id]) {
        later(demonKilled(player, npc));
    }

    // the Java trigger never keeps the npc from dying
    return false;
}

module.exports = { onTalkToNPC, onNPCDeath, settle };
