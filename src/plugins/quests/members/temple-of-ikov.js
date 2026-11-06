// Ported from Open-RSC Core-Framework authentic/quests/members/TempleOfIkov.java, with the doors from
// authentic/defaults/DoorAction.java (DOOR_LUCIEN_HIDEOUT, DOOR_TEMPLE_IKOV_FIRE_WARRIOR, _LEVER_PULL and _ICE_ARROW; the
// fear room and bridge doors 104 and 105 are wall-objects/doors.js) and the Lucien Edge spell refusal from
// net/rsc/handlers/SpellHandler.java (AGPL-3.0). https://classic.runescape.wiki/w/Temple_of_Ikov
//
// questStages.templeOfIkov (the Java stages; the quest is done at -1, and also at -2 when the staff went to Lucien):
//   0  Lucien (360) in East Ardougne (615,587) asks for a hero to fetch the staff of Armadyl from the tunnels under the
//      deserted temple near Hemenster: "That sounds like fun" gives the Pendant of Lucien (721) -> 1
//   1  Lucien's hideout door (109 at 161,465) opens from stage 1; Lucien (364) waits inside. The temple tunnels:
//        stairs 370 (537,3337) down into the dark (a lit candle 601/602 or lit torch 774 lights it, else back out), 369 up
//        the fear room door 104 (pendant of Lucien worn), the bridge door 105 (Boots of lightfootedness 722 worn)
//        the lever 361 (533,3305): "Searchfortraps" (thieving 42) disables its trap (cache ikovLever), "Pull" then opens the
//          ice spider door 106 (cache openSpiderDoor); a Lever (724) fitted to the Lever Bracket 367 (544,3307) is a Lever
//          368 whose pull opens the door 107 (cache completeLever)
//        Ice Arrows (723) lie at (560,3352) and (563,3354) in the cave of ice spiders (taking one puts you back at 538,3348,
//          the ground item stays); the Fire warrior of Lesarkus (361) can only be shot with them from a yew or magic bow
//          (cache shot_ice), and his death (cache killedLesarkus) opens the jail door 108 (546,3302)
//        Winelda (365) at the lava stream takes 20 limpwurt roots (220) and carries you over (557,3290)
//        the staff of Armadyl (725) at (540,3273) is guarded by the guardians of Armadyl (362, 363): taking it with one within
//          5 tiles makes it attack. Wearing the pendant of Lucien makes them attack on sight
//      Lucien (364) takes the staff: the Pendant of Lucien's side, reward, stage -2 and he leaves
//      A guardian who is told "A guy named Lucien is paying me" and cleansed ("Yes I could do with a bath") gives the
//      Pendant of Armadyl (726) for helping against Lucien -> 2
//   2  with the pendant of Armadyl worn Lucien (364) can be attacked (spells and arrows too); beaten, he says he will be
//      back and the quest is done (-1). Lucien's hit points are restored (the Java keeps him alive: he is "removed")
// Reward (QuestRewardRegistrar): 1 quest point, ranged 2000 + 1000 x level and fletching 2000 + 1000 x level quarter points.
// Differences: the Java's `give` into a full pack drops the item, here it is added to the pack as in the neighbouring ports; the
// teleport bubble delay of Winelda's carry is dropped. The fire warrior can be meleed, as in the Java (no hook stops it).

const LUCIEN_ID = 360;
const FIRE_WARRIOR_ID = 361;
const GUARDIAN_MALE_ID = 362;
const GUARDIAN_FEMALE_ID = 363;
const LUCIEN_EDGE_ID = 364;
const WINELDA_ID = 365;

const TALK_IDS = new Set([LUCIEN_ID, LUCIEN_EDGE_ID, WINELDA_ID, GUARDIAN_MALE_ID, GUARDIAN_FEMALE_ID]);
const GUARDIAN_IDS = [GUARDIAN_MALE_ID, GUARDIAN_FEMALE_ID];

const LIMPWURT_ROOT_ID = 220;
const LIT_CANDLE_ID = 601;
const LIT_BLACK_CANDLE_ID = 602;
const LIT_TORCH_ID = 774;
const PENDANT_OF_LUCIEN_ID = 721;
const ICE_ARROWS_ID = 723;
const LEVER_ITEM_ID = 724;
const STAFF_OF_ARMADYL_ID = 725;
const PENDANT_OF_ARMADYL_ID = 726;

const YEW_LONGBOW_ID = 654;
const YEW_SHORTBOW_ID = 655;
const MAGIC_LONGBOW_ID = 656;
const MAGIC_SHORTBOW_ID = 657;
const GOOD_BOWS = [YEW_LONGBOW_ID, YEW_SHORTBOW_ID, MAGIC_LONGBOW_ID, MAGIC_SHORTBOW_ID];

const STAIR_UP_ID = 369;
const STAIR_DOWN_ID = 370;
const LEVER_ID = 361;
const LEVER_BRACKET_ID = 367;
const COMPLETE_LEVER_ID = 368;

const DOOR_ICE_ARROW_ID = 106;
const DOOR_LEVER_PULL_ID = 107;
const DOOR_FIRE_WARRIOR_ID = 108;
const DOOR_LUCIEN_HIDEOUT_ID = 109;

// delayedSpawnObject(..., 15000) as 640 ms ticks
const BRACKET_TICKS = Math.ceil(15000 / 640);

function stageOf(player) {
    return player.questStages.templeOfIkov || 0;
}

function setStage(player, stage) {
    player.questStages.templeOfIkov = stage;
}

function isDone(player) {
    const stage = stageOf(player);

    return stage === -1 || stage === -2;
}

// Open-RSC mes(...) followed by delay(3)
async function mes(player, message) {
    player.message(`@que@${message}`);
    await player.world.sleepTicks(3);
}

// the Java's `n.startCombat(player)` / `n.setChasing(player)`: the npc goes for the player once the talk is over
function chase(player, npc) {
    if (npc && typeof npc.attack === 'function') {
        Promise.resolve(npc.attack(player)).catch(() => {});
    }
}

function nearGuardian(player, radius = 5) {
    for (const id of GUARDIAN_IDS) {
        const guardian = player.getNearbyEntitiesByID('npcs', id, radius).find((npc) => !npc.locked);

        if (guardian) {
            return guardian;
        }
    }

    return null;
}

// TempleOfIkov.handleReward: 1 quest point, ranged and fletching 2000 + 1000 x level (quarter points)
function completeQuest(player) {
    delete player.cache.openSpiderDoor;
    delete player.cache.completeLever;
    delete player.cache.killedLesarkus;

    player.completeQuest('templeOfIkov', {
        questPoints: 1,
        experience: {
            ranged: 2000 + 1000 * player.skills.ranged.base,
            fletching: 2000 + 1000 * player.skills.fletching.base
        },
        message: 'Well done you have completed the temple of Ikov quest'
    });
}

// ---------------------------------------------------------------- Lucien (360), East Ardougne

async function lucienPay(player, npc) {
    await npc.say('Ah the mercenary type I see');
    await player.say("It's a living");
    await npc.say('I shall adequately reward you', 'With both money and power');
    await player.say('Sounds rather too vague for me');
}

async function lucienSoundsFun(player, npc) {
    await npc.say(
        "Well it's not that easy",
        'The fire warrior can only be killed with a weapon of ice',
        'And there are many other traps and hazards in those tunnels'
    );
    await player.say('Well I am brave I shall give it a go');
    await npc.say('Take this pendant you will need it to get through the chamber of fear');
    player.inventory.add(PENDANT_OF_LUCIEN_ID, 1);
    await npc.say(
        'It is not safe for me to linger here much longer',
        'When you have done meet me in the forest north of Varrock',
        'I have a small holding up there'
    );
    setStage(player, 1);
}

async function lucien(player, npc) {
    const stage = stageOf(player);

    if (stage === 0) {
        await npc.say('I come here seeking a hero who can help me');

        const menu = await player.ask(['I am a hero', 'Yep lots of heroes about here'], true);

        if (menu !== 0) {
            return;
        }

        await npc.say(
            'I need someone who can enter the tunnels under the deserted temple of Ikov',
            'Near Hemenster, to the north of here',
            'Kill the fire warrior of Lesarkus',
            'And retrieve the staff of Armardyl'
        );

        const next = await player.ask(
            [
                "Why can't you do it yourself?",
                'That sounds like fun',
                'That sounds too dangerous for me',
                'How much will you pay me?'
            ],
            false
        );

        if (next === 0) {
            await player.say("Why can't you do that yourself?");
            await npc.say(
                'The guardians of the staff of Armardyl fear me',
                'They know my kind is powerful',
                'So they have set up magical wards against are race'
            );

            const again = await player.ask(
                [
                    'How much will you pay me?',
                    'That sounds like fun',
                    'Who are your kind?',
                    'That sounds too dangerous for me'
                ],
                false
            );

            if (again === 0) {
                await player.say('How much will you pay me');
                await lucienPay(player, npc);
            } else if (again === 1) {
                await player.say('That sounds like fun');
                await lucienSoundsFun(player, npc);
            } else if (again === 2) {
                await player.say('Who are your kind?');
                await npc.say(
                    'An ancient and powerful race',
                    'Back in the second age we held great influence in this world',
                    'There are few of us left now'
                );
            } else if (again === 3) {
                await player.say('That sounds too dangerous for me');
                await npc.say('Fortune favours the bold');
            }
        } else if (next === 1) {
            await player.say('That sounds like fun');
            await lucienSoundsFun(player, npc);
        } else if (next === 2) {
            await player.say('That sounds too dangerous for me');
            await npc.say('Fortune favours the bold');
        } else if (next === 3) {
            await player.say('How much will you pay me');
            await lucienPay(player, npc);
        }
    } else if (stage === 1 || stage === 2 || stage === -1 || stage === -2) {
        await npc.say('I thought I told you not to meet me here again');

        if (player.inventory.has(PENDANT_OF_LUCIEN_ID)) {
            await player.say('Yes you did, sorry');
            return;
        }

        const menu = await player.ask(['I lost that pendant you gave me', 'Yes you did sorry'], true);

        if (menu === 0) {
            await npc.say('Hmm', 'Imbecile');
            player.message('Lucien gives you another pendant');
            player.inventory.add(PENDANT_OF_LUCIEN_ID, 1);
        }
    }
}

// ---------------------------------------------------------------- Winelda (365)

async function wineldaYes(player, npc) {
    await npc.say(
        'Well keep it under your helmet',
        "But I'm knowing some useful magic tricks",
        'I could get you over there easy as that'
    );
    await player.say('Okay get me over there');
    await npc.say(
        'Okay brace yourself',
        'Actually no no',
        'Why should I do it for free',
        "Bring me a bite to eat and I'll be a touch more helpful",
        'How about some nice tasty limpwurt roots to chew on',
        "Yes yes that's good, bring me 20 limpwurt roots and over you go"
    );
}

async function winelda(player, npc) {
    if (player.inventory.has(LIMPWURT_ROOT_ID, 20)) {
        await player.say('I have the 20 limpwurt roots, now transport me please');
        await npc.say('Oh marverlous', 'Brace yourself then');
        player.inventory.remove(LIMPWURT_ROOT_ID, 20);
        player.teleport(557, 3290, true);
        await player.world.sleepTicks(1);
        return;
    }

    await npc.say('Hehe in a bit of a pickle are we?', 'Want to be getting over the nasty lava stream do we?');

    const menu = await player.ask(['Not really, no', 'Yes we do', 'Yes I do'], true);

    if (menu === 0) {
        await npc.say("Hehe ye'll come back later", 'They always come back later');
    } else if (menu === 1 || menu === 2) {
        await wineldaYes(player, npc);
    }
}

// ---------------------------------------------------------------- the guardians of Armadyl (362, 363)

async function guardianWorkingForLucien(player, npc, out) {
    await npc.say('Thou art working for him?', 'Thy fool', 'Quick you must be cleansed to save your soul');

    const menu = await player.ask(
        ['How dare you call me a fool?', "Erm I think I'll be leaving now", 'Yes I could do with a bath'],
        false
    );

    if (menu === 0) {
        await player.say('How dare you call me a fool', 'I will work for who I please');
        await npc.say('This one is too far gone', 'He must be cut down to stop the spread of the blight');
        out.fight = npc;
    } else if (menu === 1) {
        await player.say("Erm, I think I'll be leaving now");
        await npc.say('We cannot allow an agent of Lucien to roam free');
        out.fight = npc;
    } else if (menu === 2) {
        await player.say('Yes I could do with a bath');
        player.message('The guardian splashes holy water over you');
        await npc.say(
            'That should do the trick',
            'Now you say that Lucien sent you to retrieve the staff',
            'He must not get a hold of it',
            'He would become too powerful with the staff',
            'Hast thou heard of the undead necromancer?',
            'Who raised an undead army against Varrock a few years past',
            'That was Lucien',
            'If thou knowest where to find him maybe you can help us against him'
        );

        const last = await player.ask(
            ['Ok I will help', "No I shan't turn against my employer", 'I need time to consider this'],
            true
        );

        if (last === 0) {
            await npc.say('So you know where he lurks?');
            await player.say('Yes');
            await npc.say(
                'He must be growing in power again if he is after the staff',
                'If you can defeat him, it may weaken him for a time',
                'You will need to use this pendant to even be able to attack him'
            );
            player.message('The guardian gives you a pendant');
            player.inventory.add(PENDANT_OF_ARMADYL_ID, 1);
            setStage(player, 2);
        } else if (last === 1) {
            await npc.say('This one is too far gone', 'He must be cut down to stop the spread of the blight');
            out.fight = npc;
        } else if (last === 2) {
            await npc.say('Come back when you have made your choice');
        }
    }
}

async function guardianStageOne(player, npc, out) {
    if (player.inventory.isEquipped(PENDANT_OF_LUCIEN_ID) && !player.inventory.has(STAFF_OF_ARMADYL_ID)) {
        await npc.say('Ahh tis a foul agent of Lucien', "Get ye from our master's house");
        out.fight = npc;
        return;
    }

    if (player.inventory.has(STAFF_OF_ARMADYL_ID)) {
        await npc.say('Stop', 'You cannot take the staff of Armadyl');
        out.fight = npc;
        return;
    }

    await npc.say(
        'Thou dost venture deep in the tunnels',
        'It has been many a year since someone has passed thus far'
    );

    const menu = await player.ask(['I seek the staff of Armadyl', 'Out of my way fool', 'Who are you?'], true);

    if (menu === 0) {
        await npc.say(
            'We guard that here',
            'As did our fathers',
            "And our father's fathers",
            'Why dost thou seeketh it?'
        );

        const seek = await player.ask(
            [
                'A guy named Lucien is paying me',
                'Just give it to me',
                'I am a collector of rare and powerful artifacts'
            ],
            false
        );

        if (seek === 0) {
            await player.say('A guy named Lucien is paying me');
            await guardianWorkingForLucien(player, npc, out);
        } else if (seek === 1) {
            await player.say('Just give it to me');
            await npc.say('The staff is a sacred object', 'Not to be given away to anyone who asks');
        } else if (seek === 2) {
            await player.say('I am a collector of rare and powerful objects');
            await npc.say('The staff is not yours to collect');
        }
    } else if (menu === 1) {
        await npc.say('I may be a fool, but I will not step aside');

        const fool = await player.ask(['Why not?', 'Then I must strike you down', 'Then I guess I will turn back'], true);

        if (fool === 0) {
            await npc.say('Only members of our order are allowed further');
        } else if (fool === 1) {
            out.fight = npc;
        }
    } else if (menu === 2) {
        await npc.say(
            'I am a guardian of Armadyl',
            'We have kept this place safe and holy',
            'For many generations',
            'Many evil souls would like to get their hands on what lies here',
            'Especially the Mahjarrat'
        );

        const who = await player.ask(['What is an Armadyl?', 'Who are the Mahjarrat?', 'Wow you must be old'], true);

        if (who === 0) {
            await npc.say(
                'Armadyl is our God',
                'We are his servants',
                'Who have the honour to stay here',
                'And guard his artifacts',
                'Till he needs them to smite his enemies'
            );

            const bla = await player.ask(["Ok that's nice to know", 'Someone told me there were only three gods'], false);

            if (bla === 0) {
                await player.say('I am a collector of rare and powerful objects');
                await npc.say('The staff is not yours to collect');
            } else if (bla === 1) {
                await player.say('Someone told me there were only three gods', 'Saradomin, Zamorak and Guthix');
                await npc.say(
                    'Was that someone a Saradominist?',
                    'I hear Saradominism is the principle doctrine',
                    'Out in the world currently',
                    'They only Acknowledge those three gods',
                    'They are wrong',
                    'Depending on what you define as a god',
                    'We are aware of at least twenty'
                );
            }
        } else if (who === 1) {
            await npc.say(
                'Ancient powerful beings',
                'They are very evil',
                'They were said to once dominate this plane of existance',
                'Zamorak was said to once have been of their stock',
                'They are few in number and have less power these days',
                'Some still have presence in this world in their liche forms',
                'Mahjarrat such as Lucien and Azzanadra would become extremely powerful',
                'If they got their hands on the staff of Armadyl'
            );

            const maj = await player.ask(['Did you say Lucien?', 'You had better guard it well then'], false);

            if (maj === 0) {
                await player.say('Did you say Lucien?', "He's the one who sent me to fetch the staff");
                await guardianWorkingForLucien(player, npc, out);
            } else if (maj === 1) {
                await player.say('You had better guard it well them'); // sic
                await npc.say("Don't fret, for we shall");
            }
        } else if (who === 2) {
            await npc.say(
                'No no, I have not guarded here for all those generations',
                'Many generations of my family have though'
            );
        }
    }
}

async function guardian(player, npc, out) {
    const stage = stageOf(player);

    if (stage === 1) {
        await guardianStageOne(player, npc, out);
    } else if (stage === 2) {
        await npc.say('Any luck against Lucien?');

        if (!player.inventory.has(PENDANT_OF_ARMADYL_ID)) {
            const option = await player.ask(['Not yet', "No I've lost the pendant you gave me"], true);

            if (option === 0) {
                await npc.say('Well good luck on your quest');
            } else if (option === 1) {
                await npc.say('Thou art a careless buffoon', 'Have another one');
                player.message('The guardian gives you a pendant');
                player.inventory.add(PENDANT_OF_ARMADYL_ID, 1);
            }
        } else {
            await player.say('Not yet');
            await npc.say('Well good luck on your quest');
        }
    } else if (stage === -1) {
        await player.say('I have defeated Lucien');
        await npc.say('Well done', 'We can only hope that will keep him quiet for a while');
    } else if (stage === -2) {
        await npc.say('Get away from here', 'Thou evil agent of Lucien');
    }
}

// ---------------------------------------------------------------- Lucien (364), the hideout in the forest north of Varrock

async function lucienEdge(player, npc) {
    if (isDone(player)) {
        player.message('You have already completed this quest');
        return false;
    }

    await npc.say('Have you got the staff of Armadyl yet?');

    if (!player.inventory.has(STAFF_OF_ARMADYL_ID)) {
        await player.say('No not yet');
        return false;
    }

    const menu = await player.ask(['Yes here it is', 'No not yet'], true);

    if (menu !== 0) {
        return false;
    }

    await mes(player, 'You give the staff to Lucien');
    player.inventory.remove(STAFF_OF_ARMADYL_ID, 1);
    await npc.say(
        'Muhahahaha',
        'Already I can feel the power of this staff running through my limbs',
        'Soon I shall be exceedingly powerful',
        'I suppose you would like a reward now',
        'I shall grant you much power'
    );
    player.message('A glow eminates from Lucien\'s helmet');
    completeQuest(player);
    setStage(player, -2);
    await npc.say('I must be away now to make preparations for my conquest', 'Muhahahaha');

    return true;
}

async function onTalkToNPC(player, npc) {
    if (!TALK_IDS.has(npc.id)) {
        return false;
    }

    player.engage(npc);

    const out = { fight: null, remove: false };

    try {
        if (npc.id === LUCIEN_EDGE_ID) {
            out.remove = await lucienEdge(player, npc);
        } else if (npc.id === LUCIEN_ID) {
            await lucien(player, npc);
        } else if (npc.id === WINELDA_ID) {
            await winelda(player, npc);
        } else {
            await guardian(player, npc, out);
        }
    } finally {
        if (player.interlocutor) {
            player.disengage();
        }
    }

    if (out.remove) {
        player.world.removeEntity('npcs', npc);
    }

    chase(player, out.fight);

    return true;
}

// ---------------------------------------------------------------- doors (DoorAction.java)

async function onWallObjectCommandOne(player, wallObject) {
    const { id } = wallObject;

    if (id === DOOR_LUCIEN_HIDEOUT_ID) {
        if (stageOf(player) >= 1 || isDone(player)) {
            player.message('You go through the door');
            await player.enterDoor(wallObject);
        } else {
            await mes(player, "The door doesn't open");
            await mes(player, 'No one seems to be in');
        }

        return true;
    }

    if (id === DOOR_FIRE_WARRIOR_ID) {
        if (player.cache.killedLesarkus || isDone(player)) {
            player.message('You go through the door');
            await player.enterDoor(wallObject);
        } else {
            await mes(player, "The fire warrior's eyes glow");
            await mes(player, 'The fire warrior glares at the door');
            await mes(player, 'The door handle is too hot to handle');
        }

        return true;
    }

    if (id === DOOR_LEVER_PULL_ID) {
        if (player.cache.completeLever || isDone(player)) {
            player.message('You go through the door');
            await player.enterDoor(wallObject);
        } else {
            player.message("The door won't open");
        }

        return true;
    }

    if (id === DOOR_ICE_ARROW_ID) {
        if (player.cache.openSpiderDoor || player.x >= 536 || isDone(player)) {
            player.message('You go through the door');
            await player.enterDoor(wallObject);
        } else {
            player.message("The door won't open");
        }

        return true;
    }

    return false;
}

// ---------------------------------------------------------------- stairs and levers

async function onGameObjectCommandOne(player, gameObject) {
    const { id } = gameObject;

    if (id === STAIR_DOWN_ID) {
        if (
            player.inventory.has(LIT_CANDLE_ID) ||
            player.inventory.has(LIT_BLACK_CANDLE_ID) ||
            player.inventory.has(LIT_TORCH_ID)
        ) {
            player.message('Your flame lights up the room');
            player.teleport(537, 3372);
        } else {
            player.message('You cannot see any further into the room');
            player.teleport(537, 3394);
            await player.world.sleepTicks(3);
            player.message('It is too dark');
        }

        return true;
    }

    if (id === STAIR_UP_ID) {
        player.teleport(536, 3338);
        return true;
    }

    if (id === LEVER_ID) {
        // the "Pull" command
        if (!player.cache.ikovLever) {
            player.message('You have activated a trap on the lever');
            player.damage(Math.floor(player.skills.hits.current / 5));
        } else {
            await mes(player, 'You pull the lever');
            await mes(player, 'You hear a clunk');
            await mes(player, 'The trap on the lever resets');

            delete player.cache.ikovLever;

            if (!player.cache.openSpiderDoor) {
                player.cache.openSpiderDoor = true;
            }
        }

        return true;
    }

    if (id === COMPLETE_LEVER_ID) {
        await mes(player, 'You pull the lever');
        await mes(player, 'You hear the door next to you make a clunking noise');

        if (!player.cache.completeLever) {
            player.cache.completeLever = true;
        }

        return true;
    }

    return false;
}

async function onGameObjectCommandTwo(player, gameObject) {
    if (gameObject.id !== LEVER_ID) {
        return false;
    }

    // "Searchfortraps"
    player.message('You search the lever for traps');

    if (player.skills.thieving.current < 42) {
        player.message('You have not high thieving enough to disable this trap');
        return true;
    }

    await mes(player, 'You find a trap on the lever');
    await mes(player, 'You disable the trap');

    if (!player.cache.ikovLever) {
        player.cache.ikovLever = true;
    }

    return true;
}

// a Lever (724) fitted to the Lever Bracket (367) becomes a Lever (368) for 15 seconds
async function onUseWithGameObject(player, gameObject, item) {
    if (gameObject.id !== LEVER_BRACKET_ID || item.id !== LEVER_ITEM_ID) {
        return false;
    }

    player.message('You fit the lever into the bracket');
    player.inventory.remove(LEVER_ITEM_ID, 1);
    player.world.replaceTimed('gameObjects', gameObject, COMPLETE_LEVER_ID, BRACKET_TICKS);

    return true;
}

// ---------------------------------------------------------------- ground items

async function onGroundItemTake(player, groundItem) {
    if (groundItem.id === ICE_ARROWS_ID) {
        const inCave =
            (groundItem.x === 560 && groundItem.y === 3352) || (groundItem.x === 563 && groundItem.y === 3354);

        if (inCave) {
            player.inventory.add(ICE_ARROWS_ID, 1);
            player.teleport(538, 3348, true);
            await player.world.sleepTicks(3);
            player.message('Suddenly your surroundings change');
        } else {
            await mes(player, 'You can only take ice arrows from the cave of ice spiders');
            await mes(player, 'In the temple of Ikov');
        }

        return true;
    }

    if (groundItem.id === STAFF_OF_ARMADYL_ID) {
        const guardianNear = nearGuardian(player);

        if (!guardianNear) {
            return false;
        }

        const stage = stageOf(player);

        if (stage === 2 || stage === -1 || stage === -2) {
            player.message("I shouldn't steal this");
            return true;
        }

        if (player.inventory.has(STAFF_OF_ARMADYL_ID)) {
            player.message('I already have one of those');
            return true;
        }

        player.engage(guardianNear);
        await guardianNear.say('That is not thine to take');
        player.disengage();
        chase(player, guardianNear);

        return true;
    }

    return false;
}

// ---------------------------------------------------------------- the fire warrior (361) and Lucien (364) in a fight

async function lucienWontFight(player, npc) {
    if (isDone(player)) {
        player.message('You have already completed this quest');
        return;
    }

    player.engage(npc);
    await npc.say("I'm sure you don't want to attack me really", 'I am your friend');
    player.disengage();
    await mes(player, "You decide you don't want to attack Lucien really");
    await mes(player, 'He is your friend');
}

// melee on Lucien needs the pendant of Armadyl worn
async function onNPCAttack(player, npc) {
    if (npc.id !== LUCIEN_EDGE_ID) {
        return false;
    }

    if (isDone(player) || !player.inventory.isEquipped(PENDANT_OF_ARMADYL_ID)) {
        await lucienWontFight(player, npc);
        return true;
    }

    return false;
}

// spells on Lucien (SpellHandler.java) and on the fire warrior (onSpellNpc)
async function onCastOnNPC(player, npc) {
    if (npc.id === LUCIEN_EDGE_ID) {
        if (isDone(player)) {
            player.message('You have already completed this quest');
            return true;
        }

        if (!player.inventory.isEquipped(PENDANT_OF_ARMADYL_ID)) {
            await lucienWontFight(player, npc);
            return true;
        }

        return false;
    }

    if (npc.id === FIRE_WARRIOR_ID) {
        if (player.cache.killedLesarkus || isDone(player)) {
            player.message('You have already killed the fire warrior');
        } else {
            player.message('You need to kill the fire warrior with ice arrows');
        }

        return true;
    }

    return false;
}

function hasGoodBow(player) {
    return GOOD_BOWS.some((id) => player.inventory.isEquipped(id));
}

// arrows at Lucien need the pendant; the fire warrior takes only ice arrows from a yew or magic bow (cache shot_ice)
async function onNPCRangedAttack(player, npc) {
    if (npc.id === LUCIEN_EDGE_ID) {
        if (isDone(player) || !player.inventory.isEquipped(PENDANT_OF_ARMADYL_ID)) {
            await lucienWontFight(player, npc);
            return true;
        }

        return false;
    }

    if (npc.id !== FIRE_WARRIOR_ID) {
        return false;
    }

    if (player.cache.killedLesarkus || isDone(player)) {
        player.message('You have already killed the fire warrior');
        return true;
    }

    if ((player.inventory.has(ICE_ARROWS_ID) && hasGoodBow(player)) || player.cache.shot_ice) {
        player.cache.shot_ice = true;
        return false;
    }

    player.message('You need to kill the fire warrior with ice arrows');

    return true;
}

async function onNPCDeath(player, npc) {
    if (!player || !player.questStages) {
        return false;
    }

    if (npc.id === FIRE_WARRIOR_ID) {
        if (!player.cache.killedLesarkus) {
            player.cache.killedLesarkus = true;
        }

        // the default death drops his loot, removes him and pays the kill
        return false;
    }

    if (npc.id !== LUCIEN_EDGE_ID) {
        return false;
    }

    npc.skills.hits.current = npc.skills.hits.base;
    npc.abandonFight();

    if (isDone(player)) {
        player.message('You have already completed this quest');
        return true;
    }

    await npc.say('You may have defeated me for now', 'But I will be back');
    completeQuest(player);
    player.world.removeEntity('npcs', npc);

    return true;
}

module.exports = {
    onTalkToNPC,
    onWallObjectCommandOne,
    onGameObjectCommandOne,
    onGameObjectCommandTwo,
    onUseWithGameObject,
    onGroundItemTake,
    onNPCAttack,
    onCastOnNPC,
    onNPCRangedAttack,
    onNPCDeath
};
