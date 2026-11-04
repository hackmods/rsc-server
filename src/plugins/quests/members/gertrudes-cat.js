// Ported from Open-RSC Core-Framework authentic/quests/members/GertrudesCat.java (AGPL-3.0)
// Gertrude's Cat (quest 48, gertrudesCat). Stages: 0 not started, 1 find Shilop, 2 Shilop paid (find Fluffs in the
// lumber mill north-east of Varrock), 3 kittens returned, -1 done. Fluffs (ground item 1093) sits on the top floor of
// the mill (58,2327); milk then a seasoned sardine (raw sardine + doogle leaves) settle her, and the kittens are in the
// crate 1040 at (64,445). The Lumbridge Carol branch (A_LUMBRIDGE_CAROL) is an Open-RSC custom event and is not ported.

const GERTRUDE_ID = 714;
const SHILOP_ID = 715;
const WILOUGH_ID = 781;
const PHILOP_ID = 782;
const KANEL_ID = 783;

const COINS_ID = 10;
const MILK_ID = 22;
const CHOCOLATE_CAKE_ID = 332;
const STEW_ID = 346;
const RAW_SARDINE_ID = 354;
const GERTRUDES_CAT_ID = 1093;
const SEASONED_SARDINE_ID = 1094;
const KITTENS_ID = 1095;
const KITTEN_ID = 1096;
const DOOGLE_LEAVES_ID = 1100;

const LOW_FENCE_ID = 199;
const CRATE_ID = 1039;
const KITTENS_CRATE_ID = 1040;
const BARREL_ID = 1041;

// the top floor of the lumber mill, where Fluffs sits
const CAT_Y = 2327;

async function giveKittenAndFinish(player, npc) {
    const { world } = player;

    await player.say('hello gertrude', 'fluffs ran off with her two kittens');
    await npc.say(
        "you're back , thank you, thank you",
        'fluffs just came back, i think she was just upset...',
        "...as she couldn't find her kittens"
    );
    player.message('@que@gertrude gives you a hug');
    await world.sleepTicks(3);
    await npc.say(
        "if you hadn't found her kittens they'd have died out there"
    );
    await player.say("that's ok, i like to do my bit");
    await npc.say(
        "i don't know how to thank you",
        'I have no real material possessions..but i do have kittens',
        '..i can only really look after one'
    );
    await player.say('well, if it needs a home');
    await npc.say(
        'i would sell it to my cousin in west ardounge..',
        "i hear there's a rat epidemic there..but it's too far",
        'here you go, look after her and thank you again'
    );
    player.message('@que@gertrude gives you a kitten...');
    await world.sleepTicks(3);
    player.message('@que@...and some food');
    await world.sleepTicks(3);
    player.inventory.add(KITTEN_ID, 1);
    player.inventory.add(CHOCOLATE_CAKE_ID, 1);
    player.inventory.add(STEW_ID, 1);

    // GertrudesCat.handleReward: cooking 700 + 180 per level (quarter points), 1 quest point, then the line
    player.completeQuest('gertrudesCat', {
        questPoints: 1,
        experience: { cooking: player.skills.cooking.base * 180 + 700 }
    });
    player.message('well done, you have completed gertrudes cat quest');
}

async function willHelp(player, npc) {
    await npc.say(
        'really?, thank you so much',
        'i really have no idea where she could be',
        'i think my sons, shilop and Wilough, saw the cat last',
        "they'll be out in the market place"
    );
    await player.say("alright then, i'll see what i can do");
    player.questStages.gertrudesCat = 1;
}

async function gertrude(player, npc) {
    const { world } = player;
    const stage = player.questStages.gertrudesCat || 0;

    switch (stage) {
        case 0: {
            await player.say('hello, are you ok?');
            await npc.say(
                'do i look ok?...those kids drive me crazy',
                "...i'm sorry,  it's just, ive lost her"
            );
            await player.say('lost who?');
            await npc.say('fluffs, poor fluffs, she never hurt anyone');
            await player.say("who's fluffs");
            await npc.say(
                'my beloved feline friend fluffs',
                "she's been purring by my side for almost a decade",
                'please, could you go search for her...',
                '...while i look over the kids?'
            );

            const first = await player.ask(
                [
                    'well, i suppose i could',
                    "what's in it for me?",
                    "sorry, i'm too busy to play pet rescue"
                ],
                true
            );

            if (first === 0) {
                await willHelp(player, npc);
            } else if (first === 1) {
                await npc.say(
                    "i'm sorry, i'm too poor to pay you anything",
                    'the best i could offer is a warm meal',
                    'so, can you help?'
                );

                const second = await player.ask(
                    [
                        'well, i suppose i could',
                        "sorry, i'm too busy to play pet rescue"
                    ],
                    true
                );

                if (second === 0) {
                    await willHelp(player, npc);
                } else if (second === 1) {
                    await npc.say(
                        " well, ok then, i'll have to find someone else"
                    );
                }
            } else if (first === 2) {
                await npc.say(" well, ok then, i'll have to find someone else");
            }
            break;
        }
        case 1:
            await player.say('hello gertrude');
            await npc.say('have you seen my poor fluffs?');
            await player.say("i'm afraid not");
            await npc.say('what about shilop?');
            await player.say('no sign of him either');
            await npc.say('hmmm...strange, he should be at the market');
            break;
        case 2:
            if (!player.cache.cat_milk && !player.cache.cat_sardine) {
                await player.say('hello gertrude');
                await npc.say(
                    'hello again, did you manage to find shilop?',
                    "i can't keep an eye on him for the life of me"
                );
                await player.say('he does seem quite a handfull');
                await npc.say(
                    'you have no idea!.... did he help at all?'
                );
                await player.say("i think so, i'm just going to look now");
                await npc.say('thanks again adventurer');
            } else if (player.cache.cat_milk && !player.cache.cat_sardine) {
                await player.say('hello again');
                await npc.say("hello, how's it going?, any luck?");
                await player.say("yes, i've found fluffs");
                await npc.say(
                    'well well, you are clever, did you bring her back?'
                );
                await player.say("well, that's the thing, she refuses to leave");
                await npc.say(
                    "oh dear, oh dear, maybe she's just hungry",
                    "she loves doogle sardines but i'm all out"
                );
                await player.say('doogle sardines?');
                await npc.say(
                    'yes, raw sardines seasoned with doogle leaves',
                    "unfortunatly i've used all my doogle leaves",
                    'but you may find some in the woods out back'
                );
            } else {
                await player.say('hi');
                await npc.say('hey traveller, did fluffs eat the sardines?');
                await player.say("yeah, she loved them, but she still won't leave");
                await npc.say(
                    'well that is strange, there must be a reason!'
                );
            }
            break;
        case 3:
            await giveKittenAndFinish(player, npc);
            break;
        case -1: {
            await player.say('hello again gertrude');
            await npc.say('well hello adventurer, how are you?');

            if (player.inventory.has(KITTEN_ID) || player.bank.has(KITTEN_ID)) {
                await player.say('pretty good thanks, yourself?');
                await npc.say('same old, running after shilob most of the time');
                await player.say("never mind, i'm sure he'll calm down with age");
                break;
            }

            await player.say("i'm ok, but i lost my kitten");
            await npc.say(
                'that is a shame..as it goes fluffs just had more',
                "i'm selling them at 100 coins each...",
                "...it was shilop's idea"
            );
            await player.say('!');
            await npc.say('would you like one');

            const menu = await player.ask(
                ['yes please', "no thanks, i've paid that boy enough already"],
                true
            );

            if (menu === 0) {
                await npc.say('ok then, here you go');

                if (player.inventory.count(COINS_ID) >= 100) {
                    await player.say('thanks');
                    player.message('@que@gertrude gives you another kitten');
                    await world.sleepTicks(3);
                    player.inventory.remove(COINS_ID, 100);
                    player.inventory.add(KITTEN_ID, 1);
                } else {
                    await player.say(
                        "oops, looks like i'm a bit short",
                        "i'll have to come back later"
                    );
                }
            }
            break;
        }
    }
}

// Shilop and Wilough share their lines
async function sons(player, npc) {
    const { world } = player;
    const stage = player.questStages.gertrudesCat || 0;

    switch (stage) {
        case 0:
            await player.say('hello youngster');
            await npc.say("i don't talk to strange old people");
            break;
        case 1: {
            await player.say("hello there, i've been looking for you");
            await npc.say("i didn't mean to take it!, i just forgot to pay");
            await player.say(
                "what?...i'm trying to help your mum find fluffs"
            );
            await npc.say(
                'ohh..., well, in that case i might be able to help',
                'fluffs followed me to my secret play area..',
                "i haven't seen him since"
            );
            await player.say('and where is this play area?');
            await npc.say("if i told you that, it wouldn't be a secret");

            const first = await player.ask(
                [
                    'tell me sonny, or i will hurt you',
                    'what will make you tell me?',
                    "well never mind, fluffs' loss"
                ],
                false
            );

            if (first === 0) {
                await player.say('tell me sonny, or i will hurt you');
                await npc.say(
                    "w..w..what? y..you wouldn't, a young lad like me",
                    "i'd have you behind bars before nightfall"
                );
                player.message("@que@you decide it's best not to hurt the boy");
                await world.sleepTicks(3);
            } else if (first === 1) {
                await player.say('what will make you tell me?');
                await npc.say('well...now you ask, i am a bit short on cash');
                await player.say('how much?');
                await npc.say('100 coins should cover it');
                await player.say('100 coins!, why should i pay you?');
                await npc.say(
                    "you shouldn't, but i won't help otherwise",
                    'i never liked that cat any way, so what do you say?'
                );

                const second = await player.ask(
                    ["i'm not paying you a penny", "ok then, i'll pay"],
                    true
                );

                if (second === 0) {
                    await npc.say('ok then, i find another way to make money');
                } else if (second === 1) {
                    if (player.inventory.count(COINS_ID) >= 100) {
                        await player.say(
                            'there you go, now where did you see fluffs?'
                        );
                        await npc.say(
                            'i play at an abandoned lumber mill to the north..',
                            'just beyond the jolly boar inn...',
                            'i saw fluffs running around in there'
                        );
                        await player.say('anything else?');
                        await npc.say(
                            "well, you'll have to find a broken fence to get in",
                            "i'm sure you can manage that"
                        );
                        player.message('@que@you give the lad 100 coins');
                        await world.sleepTicks(3);
                        player.inventory.remove(COINS_ID, 100);
                        player.questStages.gertrudesCat = 2;
                    } else {
                        await player.say(
                            "but i'll have to get some money first"
                        );
                        await npc.say("i'll be waiting");
                    }
                }
            } else if (first === 2) {
                await player.say("well, never mind, fluffs' loss");
                await npc.say("i'm sure my mum will get over it");
            }
            break;
        }
        case 2:
        case 3:
            await player.say('where did you say you saw fluffs?');
            await npc.say(
                "weren't you listerning?, i saw the flee bag...",
                '...in the old lumber mill just north east of here',
                'just walk past the jolly boar inn and you should find it'
            );
            break;
        case -1:
            await player.say('hello again');
            await npc.say('you think you\'re tough do you?');
            await player.say('pardon?');
            await npc.say('i can beat anyone up');
            await player.say('really');
            player.message(
                '@que@the boy begins to jump around with his fists up'
            );
            await world.sleepTicks(3);
            player.message("@que@you decide it's best not to kill him just yet");
            await world.sleepTicks(3);
            break;
    }
}

// GertrudesCat.freePlayerDialogue (reconstructed in Open-RSC): a free-to-play world
async function freePlayerDialogue(player, npc) {
    if (npc.id === GERTRUDE_ID) {
        await npc.say(
            'Hello again, adventurer',
            "i'm a bit busy now",
            'come back another time, please'
        );
    } else if (npc.id === SHILOP_ID || npc.id === WILOUGH_ID) {
        await npc.say("i'm busy", "don't bother me around");
    }
}

async function onTalkToNPC(player, npc) {
    if (
        npc.id !== GERTRUDE_ID &&
        npc.id !== SHILOP_ID &&
        npc.id !== WILOUGH_ID &&
        npc.id !== PHILOP_ID &&
        npc.id !== KANEL_ID
    ) {
        return false;
    }

    if (npc.id === PHILOP_ID || npc.id === KANEL_ID) {
        if (player.world.members) {
            player.message("The boy's busy playing");
        }

        player.unlock();
        npc.unlock();
        return true;
    }

    player.engage(npc);

    if (!player.world.members) {
        await freePlayerDialogue(player, npc);
    } else if (npc.id === GERTRUDE_ID) {
        await gertrude(player, npc);
    } else {
        await sons(player, npc);
    }

    player.disengage();
    return true;
}

// the crack in the lumber mill's fence (199 at 51,438)
async function onWallObjectCommandOne(player, wallObject) {
    if (wallObject.id !== LOW_FENCE_ID || wallObject.y !== 438) {
        return false;
    }

    const stage = player.questStages.gertrudesCat || 0;

    if (stage >= 2 || stage === -1) {
        player.message('you find a crack in the fence');
        player.message('you walk through');

        if (player.x <= 50) {
            player.teleport(51, 438, false);
        } else {
            player.teleport(50, 438, false);
        }
    } else {
        player.message('you search the fence');
        player.message("but can't see a way through");
    }

    return true;
}

async function onGroundItemTake(player, groundItem) {
    if (groundItem.id !== GERTRUDES_CAT_ID || groundItem.y !== CAT_Y) {
        return false;
    }

    const { world } = player;
    const damage = Math.floor(Math.random() * 2) + 1;

    player.message('@que@you attempt to pick up the cat');
    await world.sleepTicks(3);
    player.message('but the cat scratches you');
    player.damage(damage);
    await player.say('ouch');

    const stage = player.questStages.gertrudesCat || 0;

    if (stage >= 3 || stage === -1) {
        return true;
    }

    if (player.cache.cat_sardine && player.cache.cat_milk) {
        player.message('@que@the cats seems afraid to leave');
        await world.sleepTicks(3);
        player.message('@que@she keeps meowing');
        await world.sleepTicks(3);
        player.message('@que@in the distance you hear kittens purring');
        await world.sleepTicks(3);
    }

    if (!player.cache.cat_milk) {
        player.message('the cats seems to be thirsty');
    }

    if (player.cache.cat_milk && !player.cache.cat_sardine) {
        player.message('the cats seems to be hungry');
    }

    return true;
}

async function onUseWithGroundItem(player, groundItem, item) {
    if (
        groundItem.id !== GERTRUDES_CAT_ID ||
        (item.id !== MILK_ID &&
            item.id !== SEASONED_SARDINE_ID &&
            item.id !== KITTENS_ID)
    ) {
        return false;
    }

    const { world } = player;

    if (player.questStages.gertrudesCat !== 2) {
        if (item.id === MILK_ID) {
            player.message("the cat doesn't seem to be thirsty");
        } else if (item.id === SEASONED_SARDINE_ID) {
            player.message("the cat doesn't seem to be hungry");
        } else {
            player.message("the cat doesn't seem to be lonely");
        }

        return true;
    }

    if (item.id === MILK_ID) {
        player.message('@que@you give the cat some milk');
        await world.sleepTicks(3);
        player.message('@que@she really enjoys it');
        await world.sleepTicks(3);
        player.message('@que@but she now seems to be hungry');
        await world.sleepTicks(3);
        player.cache.cat_milk = true;
        player.inventory.remove(MILK_ID);
    } else if (item.id === SEASONED_SARDINE_ID) {
        if (player.cache.cat_milk) {
            player.message('@que@you give the cat the sardine');
            await world.sleepTicks(3);
            player.message('@que@the cat gobbles it up');
            await world.sleepTicks(3);
            player.message('@que@she still seems scared of leaving');
            await world.sleepTicks(3);
            player.cache.cat_sardine = true;
            player.inventory.remove(SEASONED_SARDINE_ID);
        }
    } else {
        player.message('@que@you place the kittens by their mother');
        await world.sleepTicks(3);
        player.message('@que@she purrs at you appreciatively');
        await world.sleepTicks(3);
        player.message('@que@and then runs off home with her kittens');
        await world.sleepTicks(3);
        player.inventory.remove(KITTENS_ID);
        player.questStages.gertrudesCat = 3;
        delete player.cache.cat_milk;
        delete player.cache.cat_sardine;
        // the cat leaves; its spawn brings her back for the next player
        world.removeEntity('groundItems', groundItem);
    }

    return true;
}

async function onUseWithInventory(player, item, target) {
    const ids = [item.id, target.id];

    if (!ids.includes(RAW_SARDINE_ID) || !ids.includes(DOOGLE_LEAVES_ID)) {
        return false;
    }

    player.message('@que@you rub the doogle leaves over the sardine');
    await player.world.sleepTicks(3);
    player.inventory.remove(DOOGLE_LEAVES_ID);
    player.inventory.remove(RAW_SARDINE_ID);
    player.inventory.add(SEASONED_SARDINE_ID);
    return true;
}

// no kittens here, but she's near: the hint once Fluffs has eaten
function hearsPurring(player) {
    const stage = player.questStages.gertrudesCat || 0;

    return !(
        player.inventory.has(KITTENS_ID) ||
        !player.cache.cat_sardine ||
        stage >= 3 ||
        stage === -1
    );
}

async function onGameObjectCommandOne(player, gameObject) {
    const { world } = player;

    if (gameObject.id === CRATE_ID || gameObject.id === BARREL_ID) {
        const name = gameObject.id === CRATE_ID ? 'crate' : 'barrel';

        player.message(`@que@you search the ${name}...`);
        await world.sleepTicks(3);
        player.message('@que@...but find nothing...');
        await world.sleepTicks(3);

        if (hearsPurring(player)) {
            player.message("@que@...you hear a cat's purring close by");
            await world.sleepTicks(3);
        }

        return true;
    }

    if (gameObject.id === KITTENS_CRATE_ID) {
        player.message('@que@you search the crate...');
        await world.sleepTicks(3);

        if (!hearsPurring(player)) {
            player.message('@que@you find nothing...');
            await world.sleepTicks(3);
        } else {
            player.message('@que@...and find two kittens');
            await world.sleepTicks(3);
            player.inventory.add(KITTENS_ID, 1);
        }

        return true;
    }

    return false;
}

// dropped kittens run back to the crate
async function onDropItem(player, item) {
    if (!item || item.id !== KITTENS_ID) {
        return false;
    }

    player.message('@que@you drop the kittens');
    await player.world.sleepTicks(3);
    player.message('@que@they run back to the crate');
    await player.world.sleepTicks(3);
    player.inventory.remove(KITTENS_ID);
    return true;
}

module.exports = {
    onTalkToNPC,
    onWallObjectCommandOne,
    onGroundItemTake,
    onUseWithGroundItem,
    onUseWithInventory,
    onGameObjectCommandOne,
    onDropItem
};
