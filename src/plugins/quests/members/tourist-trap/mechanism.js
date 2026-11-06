// Ported from Open-RSC Core-Framework authentic/quests/members/touristtrap/Tourist_Trap_Mechanism.java (AGPL-3.0) and
// the Tourist Trap items of authentic/itemactions/InvAction.java (technical plans, Ana in a barrel): the mine's objects (the
// disturbed sand, the experimental anvil 1006, the mining caves 963/964, mine carts 976/1025, the track 974, mining barrels
// 967, the lift 977/966), taking Ana out in a barrel (1039) by the lift, the cart or Irena's gate, the cart driver (711),
// the prototype dart (bronze bar -> dart tip -> + 10 feathers) and what happens when a slave takes his robes off.
//
// Cache keys (player.cache): tried_ana_barrel, ana_lift (the barrel waits on the lift), ana_is_up (the barrel is on the
// surface), ana_cart (in the cart below), ana_in_cart (in the surface cart), rescue (the driver takes the player out too),
// tech_plans, sailing, tourist_chest. See dialogue.js for the stage map.
// Not ported: nothing (the desert heat is not implemented on this server, and the quest does not need it).

const { indirectTalktoAlShabim } = require('./dialogue');
const {
    ITEM,
    NPC,
    stageOf,
    setStage,
    inTouristTrapCave,
    cacheHas,
    cacheGet,
    cacheSet,
    cacheDel,
    mes,
    randomInt,
    nearNpc,
    spawnNpc,
    removeNpc,
    moveNpc,
    attackPlayer,
    withAttacks
} = require('./shared');

const MINING_CAVE = 963;
const MINING_CART = 976;
const MINING_CAVE_BACK = 964;
const TRACK = 974;
const MINING_BARREL = 967;
const LIFT_PLATFORM = 977;
const LIFT_UP = 966;
const MINING_CART_ABOVE = 1025;
const DISTURBED_SAND1 = 944;
const DISTURBED_SAND2 = 945;
const EXPERIMENTAL_ANVIL = 1006;

const OBJECT_IDS = new Set([
    DISTURBED_SAND1,
    DISTURBED_SAND2,
    EXPERIMENTAL_ANVIL,
    MINING_CAVE,
    MINING_CAVE_BACK,
    MINING_CART,
    MINING_BARREL,
    TRACK,
    LIFT_PLATFORM,
    LIFT_UP,
    MINING_CART_ABOVE
]);

const RepeatLift = { USETHIS: 0, THING: 1 };
const CartDriver = {
    PSSST: 0,
    PSSST2: 1,
    PSSST3: 2,
    PSSSTFINAL: 3,
    OKSORRY: 4,
    NICECART: 5,
    WAGON: 6,
    HELPYOU: 7,
    WONDERIF: 8,
    HECKOUT: 9
};

// Formulae.interp: the chance in [0, 1] at a level
function interp(low, high, level) {
    const value = Math.floor((low * (99 - level)) / 98) + Math.floor((high * (level - 1)) / 98) + 1;

    return Math.min(Math.max(value / 256, 0), 1);
}

// The success rates are the OSRS ones of 2021 that Open-RSC uses (prototype dart: smithing 20+, dart tip: fletching 10+)
function protoDartSmithSuccessful(smithingLevel) {
    return smithingLevel >= 20 && interp(61, 245, smithingLevel) > Math.random();
}

function protoDartFletchSuccessful(fletchingLevel) {
    return fletchingLevel >= 10 && interp(61, 254, fletchingLevel) > Math.random();
}

// TODO in the Java: "entirely made up", 60% successful cart
function getIntoCartSuccessful() {
    return Math.floor(Math.random() * 5) < 3;
}

function compareItemsIds(item1, item2, id1, id2) {
    return (item1.id === id1 && item2.id === id2) || (item1.id === id2 && item2.id === id1);
}

// Tourist_Trap_Mechanism.isPineappleBased
function isPineappleBased(item) {
    return [ITEM.TENTI_PINEAPPLE, ITEM.PINEAPPLE, ITEM.FRESH_PINEAPPLE, ITEM.PINEAPPLE_CHUNKS, ITEM.PINEAPPLE_RING].includes(item.id);
}

// Tourist_Trap_Mechanism.outsideCamp
function outsideCamp(player) {
    return (
        player.y < 795 ||
        (player.x >= 92 && player.y >= 795 && player.y <= 814) ||
        (player.x <= 78 && player.y >= 795 && player.y <= 814)
    );
}

async function makeDartTip(player, obj) {
    if (obj.id === 1006) {
        if (!player.inventory.has(ITEM.TECHNICAL_PLANS)) {
            await mes(player, "This anvil is experimental...", 2);
            await mes(player, "You need detailed plans of the item you want to make in order to use it.");
            return;
        }
        await mes(player, "Do you want to follow the technical plans ?");
        const menu = await player.ask(["Yes. I'd like to try.", "No, not just yet."], true);
        if (menu === 0) {
            if (!player.inventory.has(ITEM.HAMMER)) {
                player.message("You need a hammer to work anything on the anvil.");
                return;
            }
            if (player.skills.smithing.current < 20) {
                player.message("You need level 20 in smithing before you can attempt this.");
                return;
            }
            await mes(player, "You begin experimenting in forging the weapon...", 2);
            player.inventory.remove(ITEM.BRONZE_BAR, 1);
            await mes(player, "You follow the plans carefully.", 2);
            await mes(player, "And after a long time of careful work.", 2);
            if (protoDartSmithSuccessful(player.skills.smithing.current)) {
                await mes(player, "You finally manage to forge a sharp, pointed...", 2);
                await mes(player, "... dart tip...", 2);
                if (!player.inventory.has(ITEM.PROTOTYPE_DART_TIP)) {
                    player.inventory.add(ITEM.PROTOTYPE_DART_TIP, 1);
                }
                await mes(player, "You study the technical plans even more...");
                await mes(player, "You need to attach feathers to the tip to complete the weapon.");
            } else {
                await mes(player, "You waste the bronze bar through an unlucky accident.");
            }
        } else if (menu === 1) {
            player.message("You decide not follow the technical plans.");
        }
    }
}


async function attachFeathersToPrototype(player, i, i2) {
    if (compareItemsIds(i, i2, ITEM.FEATHER, ITEM.PROTOTYPE_DART_TIP)) {
        if (!player.inventory.has(ITEM.FEATHER, 10)) {
            player.message("You need at least ten feathers to make this item.");
            return;
        }
        if (player.skills.fletching.current < 10) {
            player.message("You need a fletching level of at least 10 to complete this.");
            return;
        }
        await mes(player, "You try to attach feathers to the bronze dart tip.", 2);
        await mes(player, "Following the plans is tricky, but you persevere.", 2);
        if (!player.inventory.has(ITEM.FEATHER, 10)) return;
        player.inventory.remove(ITEM.FEATHER, 10);
        if (protoDartFletchSuccessful(player.skills.fletching.current)) {
            await mes(player, "You succesfully attach the feathers to the dart tip.", 2);
            if (!player.inventory.has(ITEM.PROTOTYPE_DART_TIP, 1)) return;
        player.inventory.remove(ITEM.PROTOTYPE_DART_TIP, 1);
            player.inventory.add(ITEM.PROTOTYPE_THROWING_DART);
            // dependent on the fletching level
            player.addExperience('fletching', player.skills.fletching.base * 50);
        } else {
            await mes(player, "An unlucky accident causes you to waste the feathers.", 2);
            await mes(player, "But you feel that you're close to making this item though.");
        }
    }
}

// TODO: this is entirely made up as far as I know. 60% successful cart.

async function getOutWithAnaInCart(player, n, cID) {
    if (cID === -1) {
        await mes(player, "The cart driver seems to be festidiously cleaning his cart.");
        await mes(player, "It doesn't look as if he wants to be disturbed.");
        const menu = await player.ask([//do not send over
            "Hello.", "Nice cart.", "Pssst..."], false);
        if (menu === 0) {
            await player.say("Hello");
            await n.say("Can't you see I'm busy?", "Now get out of here!");
            const getGo = await player.ask(["Oh, ok, sorry.", "Nice cart.", "Pssst..."], true);
            if (getGo === 0) {
                await getOutWithAnaInCart(player, n, CartDriver.OKSORRY);
            } else if (getGo === 1) {
                await getOutWithAnaInCart(player, n, CartDriver.NICECART);
            } else if (getGo === 2) {
                await getOutWithAnaInCart(player, n, CartDriver.PSSST);
            }
        } else if (menu === 1) {
            await player.say("Nice cart.");
            await getOutWithAnaInCart(player, n, CartDriver.NICECART);
        } else if (menu === 2) {
            await player.say("Pssst...");
            await getOutWithAnaInCart(player, n, CartDriver.PSSST);
        }
    }
    switch (cID) {
        case CartDriver.PSSST:
            await mes(player, "The cart driver completely ignores you.");
            const pst = await player.ask(["Psssst...", "Psssssst...", "Pssssssssttt!!!"], true);
            if (pst === 0) {
                await getOutWithAnaInCart(player, n, CartDriver.PSSST2);
            } else if (pst === 1) {
                await getOutWithAnaInCart(player, n, CartDriver.PSSST3);
            } else if (pst === 2) {
                await getOutWithAnaInCart(player, n, CartDriver.PSSSTFINAL);
            }
            break;
        case CartDriver.PSSST2:
            await mes(player, "The driver completely ignores you.");
            const m = await player.ask(["Psssssst...", "Pssst...", "Pssssssssttt!!!"], true);
            if (m === 0) {
                await getOutWithAnaInCart(player, n, CartDriver.PSSST3);
            } else if (m === 1) {
                await getOutWithAnaInCart(player, n, CartDriver.PSSST);
            } else if (m === 2) {
                await getOutWithAnaInCart(player, n, CartDriver.PSSSTFINAL);
            }
            break;
        case CartDriver.PSSST3:
            await mes(player, "The driver completely ignores you.");
            const me = await player.ask(["Psssst...", "Pssst...", "Pssssssssttt!!!"], true);
            if (me === 0) {
                await getOutWithAnaInCart(player, n, CartDriver.PSSST2);
            } else if (me === 1) {
                await getOutWithAnaInCart(player, n, CartDriver.PSSST);
            } else if (me === 2) {
                await getOutWithAnaInCart(player, n, CartDriver.PSSSTFINAL);
            }
            break;
        case CartDriver.PSSSTFINAL:
            await mes(player, "The cart driver turns around quickly to face you.");
            await n.say("What!", "Can't you see I'm busy?");
            const shh = await player.ask(["Oh, ok, sorry.", "Shhshhh!"], true);
            if (shh === 0) {
                await getOutWithAnaInCart(player, n, CartDriver.OKSORRY);
            } else if (shh === 1) {
                await n.say("Shush yourself!");
                player.message("The cart driver goes back to his work.");
            }
            break;
        case CartDriver.OKSORRY:
            await n.say("Look just leave me alone!");
            player.message("The cart driver goes back to his work.");
            break;
        case CartDriver.NICECART:
            await mes(player, "The cart driver looks around at you and tries to weigh you up.");
            await n.say("Hmmm.");
            await mes(player, "He tuts to himself and starts checking the wheels.");
            await n.say("Tut !");
            const tut = await player.ask(
                ["I wonder if you could help me?",
                    "One wagon wheel says to the other,'I'll see you around'.",
                    "Can I help you at all?"
                ],
                true
            );
            if (tut === 0) {
                await getOutWithAnaInCart(player, n, CartDriver.WONDERIF);
            } else if (tut === 1) {
                await getOutWithAnaInCart(player, n, CartDriver.WAGON);
            } else if (tut === 2) {
                await getOutWithAnaInCart(player, n, CartDriver.HELPYOU);
            }
            break;
        case CartDriver.WAGON:
            await mes(player, "The cart driver smirks a little.");
            await mes(player, "He starts checking the steering on the cart.");
            const menu = await player.ask(
                ["'One good turn deserves another'",
                    "Can you get me the heck out of here please?"
                ],
                false
            );
            if (menu === 0) {
                await player.say("'One good turn deserves another.");
                await mes(player, "The cart driver smiles a bit and then turns to you.");
                await n.say("Are you trying to get me fired?");
                const menu2 = await player.ask(["No", "Yes", "Fired...no, shot perhaps!"], true);
                if (menu2 === 0) {
                    await n.say(
                        "It certainly sounds like it, now leave me alone.",
                        "If you bug me again, I'm gonna call the guards."
                    );
                    player.message("The cart driver goes back to his work.");
                } else if (menu2 === 1) {
                    await n.say("And why would you want to do a crazy thing like that for?", "I ought to teach you a lesson!");
                    await driverCallGuards(player, n);
                } else if (menu2 === 2) {
                    await n.say("Ha ha ha! You're funny!");
                    await mes(player, "The cart driver checks that the guards aren't watching him.");
                    await n.say("What're you in fer?");
                    const menu3 = await player.ask(
                        ["Oh, I'm not supposed to be here at all actually.",
                            "I'm in for murder, so you'd better get me out of here!",
                            "In for a penny in for a pound."
                        ],
                        true
                    );
                    if (menu3 === 0) {
                        await n.say(
                            "Hmmm, interesting...let me guess.",
                            "You're completely innocent...",
                            "like all the other inmates in here.",
                            "Ha ha ha!"
                        );
                        player.message("The Cart driver goes back to his work.");
                    } else if (menu3 === 1) {
                        await n.say("Hmm, well, I wonder what the guards are gonna say about that!");
                        await driverCallGuards(player, n);
                    } else if (menu3 === 2) {
                        await mes(player, "The cart driver laughs at your pun...");
                        await n.say("Ha ha ha, oh Stoppit!");
                        await mes(player, "The cart driver seems much happier now.");
                        await n.say("What can I do for you anyway?");
                        const menu4 = await player.ask(
                            ["Can you smuggle me out on your cart?",
                                "Can you smuggle my friend Ana out on your cart?",
                                "Well, you see, it's like this..."
                            ],
                            false
                        );
                        if (menu4 === 0) {
                            await player.say("Can you smuggle me out on your cart?");
                            await mes(player, "The cart driver points at a nearby guard.");
                            await n.say("Ask that man over there if it's OK and I'll consider it!", "Ha ha ha!");
                            player.message("The cart driver goes back to his work, laughing to himself.");
                        } else if (menu4 === 1) {
                            await player.say("Can you smuggle my friend out on your cart?");
                            await n.say(
                                "As long as your friend is a barrel full of rocks.",
                                "I don't think it would be a problem at all!",
                                "Ha ha ha!"
                            );
                            player.message("The cart driver goes back to his work, laughing to himself.");
                        } else if (menu4 === 2) {
                            await player.say("Well, you see, it's like this...");
                            await n.say("yeah!");
                            const menu5 = await player.ask(
                                ["Prison riot in ten minutes, get your cart out of here!",
                                    "There's ten gold in it for you if you leave now - no questions asked."
                                ],
                                true
                            );
                            if (menu5 === 0) {
                                player.message("The cart driver seems visibly shaken...");
                                await n.say("Oh, right..yes...yess, Ok...");
                                await mes(player, "The cart driver quickly starts preparing the cart.");
                                const menu6 = await player.ask(["Good luck!", "You can't leave me here, I'll get killed!"], true);
                                if (menu6 === 0) {
                                    await n.say("Yeah, you too!");
                                    await mes(player, "The cart sets off at a hectic pace.");
                                    await mes(player, "The guards at the gate get suspiscious and search the cart.");
                                    await mes(player, "They find Ana in the Barrel and take her back into the mine.");
                                    if (cacheHas(player, "ana_in_cart")) {
                                        cacheDel(player, "ana_in_cart");
                                    }
                                } else if (menu6 === 1) {
                                    await n.say("Oh, right...ok, you'd better jump in the cart then!", "Quickly!");
                                    if (cacheHas(player, "ana_in_cart")) {
                                        cacheDel(player, "ana_in_cart");
                                        cacheSet(player, "rescue", true);
                                    }
                                }
                            } else if (menu5 === 1) {
                                await n.say(
                                    "If you're going to bribe me, at least make it worth my while.",
                                    "Now, let's say 100 Gold pieces should we?",
                                    "Ha ha ha!"
                                );
                                const menu6 = await player.ask([//do not send over
                                    "A hundred it is!", "Forget it!"], false);
                                if (menu6 === 0) {
                                    await player.say("A hundred it is.");
                                    await n.say("Great!");
                                    if (player.inventory.has(ITEM.COINS, 100)) {
                                        await n.say("Ok, get in the back of the cart then!");
                                        player.inventory.remove(ITEM.COINS, 100);
                                        if (cacheHas(player, "ana_in_cart")) {
                                            cacheDel(player, "ana_in_cart");
                                            cacheSet(player, "rescue", true);
                                        }
                                    } else {
                                        await n.say("You little cheat, trying to trick me!", "I'll show you!");
                                        await driverCallGuards(player, n);
                                    }
                                } else if (menu6 === 1) {
                                    await player.say("Forget it!");
                                    await n.say("Ok, fair enough!", "But don't bother me anymore.");
                                    player.message("The cart driver goes back to work.");
                                }
                            }
                        }
                    }
                }
            } else if (menu === 1) {
                await player.say("Can you get me the heck out of here please?");
                await getOutWithAnaInCart(player, n, CartDriver.HECKOUT);
            }
            break;
        case CartDriver.HELPYOU:
            await n.say("I'm quite capable thanks...", "Now get lost before I call the guards.");
            const help = await player.ask(["Can you get me the heck out of here please?", "I could help, I know a lot about carts."], true);
            if (help === 0) {
                await getOutWithAnaInCart(player, n, CartDriver.HECKOUT);
            } else if (help === 1) {
                await n.say("Are you saying I don't know anything about carts?", "Why you cheeky little....");
                await mes(player, "The cart driver seems mortally offended...");
                await mes(player, "his temper explodes as he shouts the guards.");
                await driverCallGuards(player, n);
            }
            break;
        case CartDriver.WONDERIF:
            await n.say("Sorry friend, I'm busy, go bug the guards,", "I'm sure they'll give ya the time of day.");
            await mes(player, "The cart driver chuckles to himself.");
            const ok = await player.ask(["Can I help you at all?", "Can you get me the heck out of here please?"], true);
            if (ok === 0) {
                await getOutWithAnaInCart(player, n, CartDriver.HELPYOU);
            } else if (ok === 1) {
                await getOutWithAnaInCart(player, n, CartDriver.HECKOUT);
            }
            break;
        case CartDriver.HECKOUT:
            await n.say("No way, and if you bug me again, I'm gonna call the guards.");
            await mes(player, "The cart driver goes back to his work.");
            break;
    }
}

async function driverCallGuards(player, n) {
    let succeed = randomInt(0, 1);
    await n.say("Guards! Guards!");
    if (succeed === 0) {
        await mes(player, "Some guards notice you and come over.");
        let mercenary = nearNpc(player, NPC.MERCENARY, 15);
        if (mercenary !== null) {
            mercenary = spawnNpc(player, NPC.MERCENARY, player.x, player.y, 60000);
            await player.world.sleepTicks(2);
        }
        await mercenary.say("Oi, what are you two doing?");
        attackPlayer(player, mercenary);
        await mes(player, "The Guards search you!");
        await mes(player, "More guards rush to catch you.");
        await mes(player, "You are roughed up a bit by the guards as you're manhandlded to a cell.");
        await mercenary.say("Into the cell you go! I hope this teaches you a lesson.");
        player.teleport(89, 801);
    } else {
        await mes(player, "You quickly slope away and hide from the guards.");
    }
}

async function repeatLiftDialogue(player, n, cID) {
    switch (cID) {
        case RepeatLift.THING:
            await n.say("It is quite clearly a lift.", "Any fool can see that it's used to transport rock to the surface.");
            const opt = await player.ask(["Can I use this?", "Ok, thanks."], true);
            if (opt === 0) {
                await repeatLiftDialogue(player, n, RepeatLift.USETHIS);
            }
            break;
        case RepeatLift.USETHIS:
            await n.say(
                "Of course not, you'd be doing me out of a job.",
                "Anyway, you haven't got any barrels that need to go to the surface.",
                "Now, move along and get some work done before you get a good beating."
            );
            const options = await player.ask([//do not send over
                "What is this thing?,", "Ok, thanks."], false);
            if (options === 0) {
                await player.say("What is this thing?");
                await repeatLiftDialogue(player, n, RepeatLift.THING);
            } else if (options === 1) {
                await player.say("Ok, thanks.");
            }
            break;
    }
}

async function failCaveAnaInBarrel(player, n) {
    if (player.inventory.has(ITEM.ANA_IN_A_BARREL)) {
        n = spawnNpc(player, NPC.MERCENARY, player.x, player.y, 60000);
        await player.world.sleepTicks(1);
        await n.say("Hey, where d'ya think you're going with that Barrel?");
        player.message("A guard comes over and takes the barrel off you.");
        player.inventory.remove(ITEM.ANA_IN_A_BARREL, 1);
        await n.say("'Cor! This barrel is really heavy!", "Have you been mining lead?", "Har, har har!");
        await mes(player, "@gre@Ana: How rude! Why I ought to teach you a lesson.");
        await n.say("What was that!");
        player.message("The guards kick the barrel open.!");
        let ana = spawnNpc(player, NPC.ANA, player.x, player.y, 30000);
        await player.world.sleepTicks(1);
        await ana.say("How dare you say that I'm as heavy as lead?");
        player.message("The guards drag Ana of and then throw you into a cell.");
        if (ana !== null) {
            removeNpc(player, ana);
        }
        await mes(player, "@yel@Guards: Into the cell you go!");
        await mes(player, "@yel@I hope this teaches you a lesson.");
        if (n !== null) {
            removeNpc(player, n);
        }
        player.teleport(75, 3626);
    }
}

async function anaToLift(player, n) {
    player.message("The guard notices the barrel (with Ana in it) that you're carrying.");
    await n.say("Hey, that Barrel looks heavy, do you need a hand?");
    const menu = await player.ask(["Yes please.", "No thanks, I can manage."], true);
    if (menu === 0) {
        player.message("The guard comes over and helps you. He takes one end of the barrel.");
        await n.say("Blimey! This is heavy!");
        await mes(player, "@gre@Ana in a barrel: Why you cheeky....!");
        await mes(player, "The guard looks around suprised at Ana's outburst.");
        await n.say("What was that?");
        await player.say("Oh, it was nothing.");
        await n.say("I could have sworn I heard something!");
        player.message("@gre@Ana in a barrel: Yes you did you ignaramus.");
        await n.say("What was that you said?");
        const opt = await player.ask(["I said you were very gregarious!", "Oh, nothing."], true);
        if (opt === 0) {
            await mes(player, "@gre@Ana in a barrel: You creep!");
            await n.say("Oh, right, how very nice of you to say so.");
            player.message("The guard seems flattered.");
            await n.say("Anyway, let's get this barrel up to the surface, plenty more work to you to do!");
            player.message("The guard places the barrel carefully on the lift platform.");
            await n.say(
                "Oh, there's no one operating the lift up top, hope this barrel isn't urgent?",
                "You'd better get back to work!"
            );
            player.inventory.remove(ITEM.ANA_IN_A_BARREL, 1);
            if (!cacheHas(player, "ana_lift")) {
                cacheSet(player, "ana_lift", true);
            }
            // use cache again maybe?
        } else if (opt === 1) {
            await n.say("I heard you say something, now spit it out!");
        }
    } else if (menu === 1) {
        await n.say("Ok, fair enough, I was only offering.");
    }
}

async function mechanismObject(player, obj, command) {
    //closest to irena
    if (obj.id === DISTURBED_SAND1) {
        if (command === "look") {
            if (stageOf(player) <= 0) {
                await mes(player, "You see some footsteps in the sand.");
            } else {
                await mes(player, "This looks like some disturbed sand.");
                await mes(player, "footsteps seem to be heading of towards the south west.");
            }
        } else if (command === "search") {
            if (stageOf(player) <= 0) {
                await mes(player, "You just see some footsteps in the sand.");
            } else {
                await mes(player, "You search the footsteps more closely.");
                await mes(player, "You can see that there are five sets of footprints.");
                await mes(player, "One set of footprints seems lighter than the others.");
                await mes(player, "The four other footsteps were made by heavier people with boots.");
            }
        }
    }
    //closest to camp
    else if (obj.id === DISTURBED_SAND2) {
        if (command === "look") {
            if (stageOf(player) <= 0) {
                await mes(player, "You just see some footsteps in the sand.");
            } else {
                await mes(player, "You find footsteps heading south.");
                await mes(player, "And this time evidence of a struggle...");
                await mes(player, "The footsteps head off due south.");
            }
        } else if (command === "search") {
            if (stageOf(player) <= 0) {
                await mes(player, "You just see some footsteps in the sand!");
            } else {
                await mes(player, "You search the area thoroughly...");
                await mes(player, "You notice something colourful in the sand.");
                await mes(player, "You dig around and find a piece of red silk scarf.");
                await mes(player, "It looks as if Ana has been this way!");
            }
        }
    }
    else if (obj.id === 1006) {
        await makeDartTip(player, obj);
    }
    else if (obj.id === MINING_CAVE_BACK) {
        if (player.inventory.has(ITEM.ANA_IN_A_BARREL)) {
            await failCaveAnaInBarrel(player, null);
            return;
        }
        await mes(player, "You walk into the dark of the cavern...");
        player.message("And emerge in a different part of this huge underground complex.");
        player.teleport(84, 3640);
    }
    else if (obj.id === MINING_CAVE) {
        let n = nearNpc(player, NPC.MERCENARY_ESCAPEGATES, 10);
        if ((!player.inventory.isEquipped(ITEM.SLAVES_ROBE_BOTTOM)
            || !player.inventory.isEquipped(ITEM.SLAVES_ROBE_TOP)) && stageOf(player) !== -1) {
            player.message("This guard looks as if he's been down here a while.");
            if (n === null) {
                n = spawnNpc(player, NPC.MERCENARY, player.x, player.y, 30000);
            }
            await n.say("Hey, you're no slave!");
            await n.say("What are you doing down here?");
            attackPlayer(player, n);
            await mes(player, "More guards rush to catch you.");
            await mes(player, "You are roughed up a bit by the guards as you're manhandlded to a cell.");
            await n.say("Into the cell you go! I hope this teaches you a lesson.");
            player.teleport(89, 801);
            return;
        }
        if (stageOf(player) >= 9 || stageOf(player) === -1) {
            await mes(player, "You walk into the dark of the cavern...");
            player.message("And emerge in a different part of this huge underground complex.");
            player.teleport(76, 3640);
            return;
        }
        player.message("Two guards block your way further into the caves");
        if (n !== null) {
            await n.say("Hey you, move away from there!");
        }
    }
    else if (obj.id === MINING_CART) {
        if (command === "look") {
            if (obj.x === 62 && obj.y === 3639) {
                player.message("This cart is being unloaded into this section of the mine.");
                player.message("Before being sent back for another load.");
            } else {
                player.message("This mine cart is being loaded up with new rocks and stone.");
                player.message("It gets sent to a different section of the mine for unloading.");
            }
        } else if (command === "search") {
            player.message("You search the mine cart.");
            if (player.inventory.has(ITEM.ANA_IN_A_BARREL)) {
                player.message("There isn't enough space for both you and Ana in the cart.");
                return;
            }
            player.message("There may be just enough space to squeeze yourself into the cart.");
            player.message("Would you like to try?");
            const menu = await player.ask(["Yes, of course.", "No Thanks, it looks pretty dangerous."], true);
            if (menu === 0) {
                if (getIntoCartSuccessful(player)) {
                    player.message("You succeed!");
                    if (obj.x === 56 && obj.y === 3631) {
                        player.teleport(62, 3640);
                    } else if (obj.x === 62 && obj.y === 3639) {
                        player.teleport(55, 3632);
                    }
                } else {
                    player.message("You fail to fit yourself into the cart in time before it starts it's journey.");
                    player.message("You fall and hurt yourself.");
                    player.damage(2);
                }
            } else if (menu === 1) {
                player.message("You decide not to get into the dangerous looking mine cart.");
            }
        }
    }
    else if (obj.id === TRACK) {
        player.message("You see that this track is too dangerous to cross.");
        player.message("High speed carts are crossing the track most of the time.");
    }
    else if (obj.id === MINING_BARREL) {
        if (cacheHas(player, "ana_is_up")) {
            if (player.inventory.has(ITEM.MINING_BARREL)) {
                player.message("You can only manage one of these at a time.");
                return;
            }
            await mes(player, "You find the barrel with ana in it.");
            await mes(player, "@gre@Ana: Let me out of here, I feel sick!");
            player.inventory.add(ITEM.ANA_IN_A_BARREL, 1);
            cacheDel(player, "ana_is_up");
            return;
        }
        if (cacheHas(player, "ana_cart")) {
            if (player.inventory.has(ITEM.MINING_BARREL)) {
                player.message("You can only manage one of these at a time.");
                return;
            }
            player.message("You search the barrels and find the one with Ana in it.");
            player.message("@gre@Ana: Let me out!");
            player.inventory.add(ITEM.ANA_IN_A_BARREL, 1);
            cacheDel(player, "ana_cart");
            return;
        }
        if (player.inventory.has(ITEM.ANA_IN_A_BARREL)) {
            player.message("You cannot carry another barrel while you're carrying Ana.");
            return;
        }
        if (cacheHas(player, "ana_lift")) {
            player.message("You search for Ana, but cannot find her.");
        }
        player.message("This barrel is quite big, but you may be able to carry one. ");
        player.message("Would you like to take one?");
        const menu = await player.ask(["Yeah, cool!", "No thanks."], true);
        if (menu === 0) {
            if (player.inventory.has(ITEM.MINING_BARREL)) {
                player.message("You can only manage one of these at a time.");
            } else {
                player.message("You take the barrel, it's not that heavy, just awkward.");
                player.inventory.add(ITEM.MINING_BARREL, 1);
            }
        } else if (menu === 1) {
            player.message("You decide not to take the barrel.");
        }
    }
    else if (obj.id === LIFT_PLATFORM) {
        let n = nearNpc(player, NPC.MERCENARY_LIFTPLATFORM, 5);
        if (n !== null) {
            if (player.inventory.has(ITEM.ANA_IN_A_BARREL)) {
                await anaToLift(player, n);
                return;
            }
            await n.say("Hey there, what do you want?");
            const menu = await player.ask(["What is this thing?", "Can I use this?"], true);
            if (menu === 0) {
                await repeatLiftDialogue(player, n, RepeatLift.THING);
            } else if (menu === 1) {
                await repeatLiftDialogue(player, n, RepeatLift.USETHIS);
            }
        }
    }
    else if (obj.id === LIFT_UP) {
        player.message("You pull on the winch");
        if (cacheHas(player, "ana_lift")) {
            await mes(player, "You see a barrel coming to the surface.");
            await mes(player, "Before too long you haul it onto the side.");
            await mes(player, "The barrel seems quite heavy and you hear a muffled sound coming from inside.");
            player.message("@gre@Ana: Get me OUT OF HERE!");
            cacheDel(player, "ana_lift");
            if (!cacheHas(player, "ana_is_up")) {
                cacheSet(player, "ana_is_up", true);
            }
        } else {
            player.message("You pull on the winch and a heavy barrel filled with stone comes to the surface.");
        }
    }
    else if (obj.id === MINING_CART_ABOVE) {
        player.message("You search the mine cart.");
        if (player.inventory.has(ITEM.ANA_IN_A_BARREL)) {
            await mes(player, "There should be enough space for Ana (in the barrel) to go on here.");
        }
        if (cacheHas(player, "ana_in_cart")) {
            await mes(player, "You can see the barrel with Ana in it on the cart already.");
        }
        await mes(player, "There is space on the cart for you get on, would you like to try?");
        const menu = await player.ask(["Yes, I'll get on.", "No, I've got other plans.", "Attract mine cart drivers attention."], true);
        if (menu === 0) {
            player.message("You decide to climb onto the cart.");
            if (cacheHas(player, "ana_in_cart")) {
                await mes(player, "You hear Ana starting to bang on the barrel for her to be let out.");
                await mes(player, "@gre@Ana: Get me out of here, I'm suffocating!");
                await mes(player, "@gre@Ana: It smells like dwarven underwear in here!");
            }
            player.teleport(86, 808);
            if (cacheHas(player, "rescue")) {
                await mes(player, "As soon as you get on the cart, it starts to move.");
                await mes(player, "Before too long you are past the gates.");
                await mes(player, "You jump off the cart taking Ana with you.");
                player.teleport(106, 806);
                cacheDel(player, "rescue");
                player.inventory.add(ITEM.ANA_IN_A_BARREL, 1);
            }
        } else if (menu === 1) {
            player.message("You decide not to get onto the cart.");
        } else if (menu === 2) {
            let cartDriver = nearNpc(player, NPC.MINING_CART_DRIVER, 10);
            if (cartDriver !== null) {
                await cartDriver.say("Ahem.");
                if (cacheHas(player, "rescue")) {
                    await cartDriver.say("Hurry up, get in the cart or I'll go without you!");
                    return;
                }
                if (cacheHas(player, "ana_in_cart")) {
                    await getOutWithAnaInCart(player, cartDriver, -1);
                    return;
                }
                if (player.inventory.has(ITEM.ANA_IN_A_BARREL)) {
                    await cartDriver.say(
                        "What're you doing carrying that big barrel around?",
                        "Put it in the back of the cart like all the others!"
                    );
                    return;
                }
                player.message("The cart driver is busy loading the cart up ...");
            }
        }
    }
}

// ---- hooks ----------------------------------------------------------------------------------------------------------------

// the Java's command strings are the object definition's, lower case
function commandOf(gameObject, index) {
    const commands = (gameObject.definition && gameObject.definition.commands) || [];

    return (commands[index] || '').toLowerCase();
}

async function onGameObjectCommandOne(player, gameObject) {
    if (!OBJECT_IDS.has(gameObject.id)) {
        return false;
    }

    await withAttacks(player, () => mechanismObject(player, gameObject, commandOf(gameObject, 0)));

    return true;
}

async function onGameObjectCommandTwo(player, gameObject) {
    if (!OBJECT_IDS.has(gameObject.id)) {
        return false;
    }

    const command = commandOf(gameObject, 1);

    // "Examine" is the client's own
    if (command === 'examine') {
        return false;
    }

    await withAttacks(player, () => mechanismObject(player, gameObject, command));

    return true;
}

// Tourist_Trap_Mechanism.onRemoveObj: a slave's robes off in the mine bring a guard (the item comes off first)
async function onRemoveItem(player, item) {
    return withAttacks(player, () => onRemoveItemBody(player, item));
}

async function onRemoveItemBody(player, item) {
    if (
        !item ||
        (item.id !== ITEM.SLAVES_ROBE_BOTTOM && item.id !== ITEM.SLAVES_ROBE_TOP) ||
        !inTouristTrapCave(player) ||
        stageOf(player) === -1
    ) {
        return false;
    }

    const index = player.inventory.items.indexOf(item);

    if (index >= 0 && item.equipped) {
        player.inventory.unequip(index);
    }

    const n = nearNpc(player, NPC.MERCENARY, 5);

    if (n) {
        moveNpc(n, player.x, player.y);
        player.teleport(player.x, player.y);
        await player.world.sleepTicks(1);
        await n.say('Oi! What are you doing down here?', "You're no slave!");
        attackPlayer(player, n);
    } else {
        player.teleport(player.x, player.y);

        const newNpc = spawnNpc(player, NPC.MERCENARY, player.x, player.y, 30000);

        await player.world.sleepTicks(1);
        await newNpc.say('Oi! What are you doing down here?', "You're no slave!");
        attackPlayer(player, newNpc);
    }

    return true;
}

async function onUseWithNPC(player, npc, item) {
    if (item.id === ITEM.TECHNICAL_PLANS && npc.id === NPC.BEDABIN_NOMAD_GUARD) {
        if (stageOf(player) > 7 || stageOf(player) === -1) {
            await npc.say(
                "Sorry, but you can't use the tent without permission.",
                'But thanks for all your help with the Bedabin people.',
                "And we'll take those plans off your hands as well!"
            );
        } else if (stageOf(player) === 6 || stageOf(player) === 7) {
            await npc.say('Ok, you can go in, Al Shabim has told me about you.');
            player.teleport(171, 792);
        } else if (stageOf(player) >= 0) {
            await npc.say(
                'Hmm, those plans look interesting.',
                'Go and show them to Al Shabim...',
                "I'm sure he'll be pleased to see them."
            );
        }

        return true;
    }

    if (item.id === ITEM.TECHNICAL_PLANS && npc.id === NPC.AL_SHABIM) {
        await indirectTalktoAlShabim(player, npc);
        return true;
    }

    if (isPineappleBased(item) && npc.id === NPC.MERCENARY_ESCAPEGATES) {
        if (item.id === ITEM.TENTI_PINEAPPLE) {
            player.inventory.remove(ITEM.TENTI_PINEAPPLE, 1);
            await npc.say(
                "Great! Just what I've been looking for!",
                'Mmmmmmm, delicious!!',
                'Oh, this is soo nice!',
                'Mmmmm, *SLURP*',
                'Yummmm....Oh yes, this is great.'
            );

            if (stageOf(player) === 8) {
                setStage(player, 9);
            }
        } else {
            await npc.say('Oh great!');
            await mes(player, 'The guard rolls his eyes in glee.', 2);
            await mes(player, 'and takes a bite of the pineapple.', 2);
            await mes(player, 'His face turns from pleasure to pain as he spits the mouthful of pineapple out.');
            await npc.say(
                'Yeuch!',
                "That's awful! That's not Tenti pineapple,",
                "Get me some Tenti pineapple if you know what's good for you."
            );
        }

        return true;
    }

    if (item.id === ITEM.MINING_BARREL && npc.id === NPC.ANA) {
        if (stageOf(player) === -1) {
            player.message('You have already completed this quest.');
            await npc.say('I think you might have me confused with someone else.');
            return true;
        }

        if (!player.inventory.has(ITEM.ANA_IN_A_BARREL)) {
            const isFirstTime = !cacheHas(player, 'tried_ana_barrel');

            if (cacheHas(player, 'ana_lift') || cacheHas(player, 'ana_cart') || cacheHas(player, 'ana_in_cart')) {
                await mes(player, 'Oh, here\'s Ana, the guards must have discovered her.');
                await mes(player, 'And sent her back to the mines...');
            }

            if (isFirstTime) {
                await npc.say('Hey, what do you think you\'re doing?', 'Harumph!');
            } else {
                await npc.say(
                    "Hey, what do you think you're doing?",
                    'Leave me alone and let me get on with my work.',
                    "Else we'll both be in trouble.",
                    'Oh no, NOT AGAIN!',
                    'Harumph!'
                );
            }

            await player.say("Shush...It's for your own good!");
            await mes(player, 'You manage to squeeze Ana into the barrel,');
            await mes(player, 'despite her many complaints.');
            player.inventory.remove(ITEM.MINING_BARREL, 1);
            player.inventory.add(ITEM.ANA_IN_A_BARREL);
            removeNpc(player, npc);

            if (isFirstTime) {
                cacheSet(player, 'tried_ana_barrel', true);
            }
        } else {
            player.message("You already have Ana in a barrel, you can't get two in there!");
        }

        return true;
    }

    return false;
}

async function onUseWithGameObject(player, gameObject, item) {
    if (gameObject.id === EXPERIMENTAL_ANVIL && item.id === ITEM.BRONZE_BAR) {
        if (player.inventory.has(ITEM.PROTOTYPE_DART_TIP)) {
            player.message('You have already made the prototype dart tip.');
            player.message("You don't need to make another one.");
        } else if (player.inventory.has(ITEM.PROTOTYPE_THROWING_DART)) {
            player.message('You have already made the prototype dart.');
            player.message("You don't need to make another one.");
        } else {
            await makeDartTip(player, gameObject);
        }

        return true;
    }

    if (item.id !== ITEM.ANA_IN_A_BARREL) {
        return false;
    }

    if (gameObject.id === MINING_CART) {
        await mes(player, 'You carefully place Ana in the barrel into the mine cart.');
        await mes(player, 'Soon the cart moves out of sight and then it returns.');
        player.inventory.remove(ITEM.ANA_IN_A_BARREL, 1);

        if (!cacheHas(player, 'ana_cart')) {
            cacheSet(player, 'ana_cart', true);
        }

        return true;
    }

    if (gameObject.id === LIFT_PLATFORM) {
        const n = nearNpc(player, NPC.MERCENARY_LIFTPLATFORM, 5);

        if (n) {
            await anaToLift(player, n);
        }

        return true;
    }

    if (gameObject.id === MINING_CART_ABOVE) {
        await mes(player, 'You place Ana (In the barrel) carefully on the cart.');
        await mes(player, 'This was the last barrel to go on the cart,');
        await mes(player, "but the cart driver doesn't seem to be in any rush to get going.");
        await mes(player, 'And the desert heat will soon get to Ana.');
        player.inventory.remove(ITEM.ANA_IN_A_BARREL, 1);

        if (!cacheHas(player, 'ana_in_cart')) {
            cacheSet(player, 'ana_in_cart', true);
        }

        return true;
    }

    return false;
}

async function onUseWithInventory(player, item, target) {
    if (!compareItemsIds(item, target, ITEM.FEATHER, ITEM.PROTOTYPE_DART_TIP)) {
        return false;
    }

    await attachFeathersToPrototype(player, item, target);

    return true;
}

// Ana in a barrel on the ground: she runs off
async function onGroundItemTake(player, groundItem) {
    if (groundItem.id !== ITEM.ANA_IN_A_BARREL) {
        return false;
    }

    player.message("@gre@Ana: Don't think for one minute ...");
    player.message('@gre@Ana: You can just come back and pick me up');
    player.message('Ana goes out running away');
    player.world.removeEntity('groundItems', groundItem);

    return true;
}

async function onDropItem(player, item) {
    return withAttacks(player, () => onDropItemBody(player, item));
}

async function onDropItemBody(player, item) {
    if (!item || item.id !== ITEM.ANA_IN_A_BARREL) {
        return false;
    }

    if (stageOf(player) === -1) {
        player.inventory.remove(ITEM.ANA_IN_A_BARREL, 1);
        return true;
    }

    player.message('Are you sure you want to drop this?');

    const menu = await player.ask(["Yes, I'm sure.", "Erm, no I've had second thoughts."], true);

    if (menu === 0) {
        if (outsideCamp(player)) {
            await mes(player, "@gre@Ana: You can't drop me here!");
            await mes(player, "@gre@Ana: I'll die in the desert on my own!");
            await mes(player, '@gre@Ana: Take me back to the Shantay pass.');
            return true;
        }

        let diffX = 0;

        // inside the mining prison cell: the mercenary does not get placed in jail if the player is there
        if (player.x >= 72 && player.x <= 77 && player.y >= 3613 && player.y <= 3631) {
            diffX = -8;
        }

        await mes(player, 'You drop the barrel to the floor and Ana gets out.');
        player.inventory.remove(ITEM.ANA_IN_A_BARREL, 1);

        const Ana = spawnNpc(player, NPC.ANA, player.x, player.y, 20000);

        await player.world.sleepTicks(1);
        await Ana.say('How dare you put me in that barrel you barbarian!');
        await mes(player, "Ana's outburst attracts the guards, they come running over.");

        let guard = nearNpc(player, NPC.MERCENARY, 15);

        if (guard === null || guard.opponent) {
            guard = spawnNpc(player, NPC.MERCENARY, player.x + diffX, player.y, 30000);
        }

        await player.world.sleepTicks(1);
        await guard.say("Hey! What's going on here then?");

        if (diffX === 0) {
            attackPlayer(player, guard);
        }

        await mes(player, 'The guards drag Ana away and then throw you into a cell.');
        player.teleport(75, 3626);
    } else if (menu === 1) {
        await mes(player, 'You think twice about dropping the barrel to the floor.');
    }

    return true;
}

async function onTalkToNPC(player, n) {
    return withAttacks(player, () => onTalkToNPCBody(player, n));
}

async function onTalkToNPCBody(player, n) {
    if (n.id !== NPC.MINING_CART_DRIVER) {
        return false;
    }

    if (stageOf(player) === -1) {
        await n.say("Don't trouble me, can't you see I'm busy?");
        return true;
    }

    if (cacheHas(player, 'rescue')) {
        await n.say("Hurry up, get in the cart or I'll go without you!");
        return true;
    }

    if (cacheHas(player, 'ana_in_cart')) {
        await getOutWithAnaInCart(player, n, -1);
        return true;
    }

    if (player.inventory.has(ITEM.ANA_IN_A_BARREL)) {
        await n.say("What're you doing carrying that big barrel around?", 'Put it in the back of the cart like all the others!');
        return true;
    }

    player.message('The cart driver is busy loading the cart up ...');

    return true;
}

// InvAction.handleTechnicalPlans / handleAnaInABarrel
async function onInventoryCommand(player, item) {
    if (item.id === ITEM.TECHNICAL_PLANS) {
        await mes(player, 'The plans look very technical!');
        await mes(player, 'But you can see that this item will require ');
        await mes(player, 'a bronze bar and at least 10 feathers.');
        return true;
    }

    if (item.id === ITEM.ANA_IN_A_BARREL) {
        await mes(player, 'Ana looks pretty angry, she starts shouting at you.');
        await mes(player, '@gre@Ana: Get me out of here!');
        await mes(player, '@gre@Ana: Do you hear me!');
        await mes(player, '@gre@Ana: Get me out of here I say!');
        return true;
    }

    return false;
}

module.exports = {
    onGameObjectCommandOne,
    onGameObjectCommandTwo,
    onRemoveItem,
    onUseWithNPC,
    onUseWithGameObject,
    onUseWithInventory,
    onGroundItemTake,
    onDropItem,
    onTalkToNPC,
    onInventoryCommand,
    protoDartSmithSuccessful,
    protoDartFletchSuccessful
};
