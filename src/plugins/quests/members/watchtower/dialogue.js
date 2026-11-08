// Talking to the Watchtower quest's npcs and showing them items, from authentic/quests/members/watchtower/WatchTowerDialogues.java
// and WatchTowerGorad.java (the stage map is in shared.js). The wizard's item hand-overs and the guards' item uses are in
// mechanism.js and gates.js.

const { NPC, ITEM, stageOf, setStage, give, chase, rng, carries, ticksOf } = require('./shared');

// ---------------------------------------------------------------- the skavids

const SKAVID_WORDS = {
    [NPC.SKAVID_IG]: { cache: 'language_ig', greet: 'Cur bidith...', again: 'Bidith Ig...', menu: 0, reply: ['Ig', 'Bidith Ig'] },
    [NPC.SKAVID_AR]: { cache: 'language_ar', greet: 'Gor cur...', again: 'Ar cur...', menu: 1, reply: ['Ar', 'Ar cur'] },
    [NPC.SKAVID_CUR]: { cache: 'language_cur', greet: 'Bidith tanath...', again: 'Cur tanath...', menu: 2, reply: ['Cur', 'Cur tanath'] },
    [NPC.SKAVID_NOD]: { cache: 'language_nod', greet: 'Tanath gor...', again: 'Gor nod...', menu: 3, reply: ['Nod', 'Gor nod'] }
};

// the menu line (0 Cur, 1 Ar, 2 Ig, 3 Nod, 4 Gor) that is the word of each skavid
const LEARN_MENU = { [NPC.SKAVID_CUR]: 0, [NPC.SKAVID_AR]: 1, [NPC.SKAVID_IG]: 2, [NPC.SKAVID_NOD]: 3 };

function learnedAllWords(player) {
    const { cache } = player;

    return Boolean(cache.language_cur && cache.language_ar && cache.language_ig && cache.language_nod);
}

async function skavidFinalQuiz(player, n) {
    const { cache } = player;

    if (cache.skavid_completed_language || stageOf(player) === -1) {
        await n.say('What, you gots the crystal...');

        const last = await player.ask(['But I\'ve lost it!', 'Oh okay then'], true);

        if (last === 0) {
            if (carries(player, ITEM.POWERING_CRYSTAL2) || stageOf(player) === -1) {
                await n.say('I have no more for you!');
            } else {
                await n.say('All right, take this one then...');
                player.message('The skavid gives you a crystal');
                give(player, ITEM.POWERING_CRYSTAL2, 1);
            }
        } else if (last === 1) {
            await n.say("I'll be on my way then");
        }

        return;
    }

    if (!learnedAllWords(player)) {
        await n.say('Tanath Gor Ar Bidith ?');
        await player.say('???');
        player.message('You cannot communicate with the skavid');
        player.message("It seems you haven't learned enough of thier language yet...");
        return;
    }

    const sayChat = ['Cur tanath...', 'Ar cur...', 'Bidith Ig...', 'Gor nod...'];
    const randomizeChat = rng.int(0, sayChat.length - 1);

    await n.say(sayChat[randomizeChat]);

    const menu = await player.ask(['Cur', 'Ar', 'Bidith', 'Tanath', 'Gor'], true);
    let correctAnswer = false;

    if (menu === 0) {
        correctAnswer = randomizeChat === 2;
    } else if (menu === 2) {
        correctAnswer = randomizeChat === 0;
    } else if (menu === 3) {
        correctAnswer = randomizeChat === 3;
    } else if (menu === 4) {
        correctAnswer = randomizeChat === 1;
    }

    if (menu === -1) {
        return;
    }

    if (correctAnswer) {
        await n.say('Heh-heh! So you speak a little skavid eh?', "I'm impressed, here take this prize...");
        player.message('The skavid gives you a large crystal');
        give(player, ITEM.POWERING_CRYSTAL2, 1);

        if (learnedAllWords(player)) {
            delete cache.language_cur;
            delete cache.language_ar;
            delete cache.language_ig;
            delete cache.language_nod;
            delete cache.skavid_started_language;
            cache.skavid_completed_language = true;
        }
    } else if (menu === 1) {
        await n.say('Grrr!');
        player.message('It seems your response has upset the skavid');
    } else {
        await n.say('???');
        player.message('The response was wrong');
    }
}

async function skavidWord(player, n) {
    const { cache } = player;
    const word = SKAVID_WORDS[n.id];

    // replays not showing what happens immediately after completing the language, very likely "Ar cur!"
    if (cache.skavid_completed_language || stageOf(player) === -1) {
        await n.say('Ar cur!');
        player.message('You have already learned the skavid language');
        return;
    }

    if (cache[word.cache]) {
        await n.say(word.again);
        player.message('You have already talked to this skavid');
        return;
    }

    await n.say(word.greet);

    if (!cache.skavid_started_language) {
        await player.say('???');
        player.message('The skavid is trying to communicate...');
        player.message("You don't know any skavid words yet!");
        return;
    }

    player.message('The skavid is trying to communicate...');

    const learnMenu = await player.ask(['Cur', 'Ar', 'Ig', 'Nod', 'Gor'], true);

    if (learnMenu === -1) {
        return;
    }

    if (learnMenu === LEARN_MENU[n.id]) {
        await n.say(...word.reply);
        cache[word.cache] = true;
        player.message('It seems the skavid understood you');
    } else {
        await n.say('???');
        player.message('It seems that was the wrong reply');
        await player.world.sleepTicks(3);
    }
}

async function skavidInitial(player, n) {
    const { cache } = player;

    if (stageOf(player) === -1) {
        await n.say('Ah master...', 'You did well to master our language...');
        return;
    }

    if (learnedAllWords(player) || cache.skavid_completed_language) {
        await n.say(
            'Master, my kinsmen tell me you have learned skavid',
            'You should speak to the mad ones in their cave...'
        );
        return;
    }

    if (cache.skavid_started_language) {
        await n.say('Master, how are you doing learning our language ?');
        await player.say('I am studying the speech of your kind...');
        return;
    }

    await n.say('Tanath cur, tanath cur');
    await player.say('???');
    await n.say("Don't hurt me, don't hurt me!");
    await player.say('Stop moaning creature', 'I know about you skavids', 'You serve those monsters the ogres');
    await n.say('Please dont touch me!');
    await player.say('You have something that belongs to me...');
    await n.say("I don't have anything, please believe me!");
    await player.say('Somehow I find your words hard to believe');
    await n.say("I'm begging your kindness, I don't have it!");

    const menu = await player.ask(["I don't believe you hand it over!", "Okay okay i'm not going to hurt you"], false);

    if (menu === 0) {
        await player.say("I don't believe you, hand it over!");
        await n.say('Ahhhh, help!');
        player.message('The skavid runs away...');
        // delnpc(n, true): gone, and back on its respawn timer
        player.world.removeEntity('npcs', n);
        await player.say("Oh great...I've scared it off!");
    } else if (menu === 1) {
        await player.say("Okay, okay i'm not going to hurt you");
        // deviation: the Java's player.getText("WatchTowerSkavidThankYouKindHuman") is a text-table line; this is its plain reading
        await n.say(
            'Thank you kind human',
            "I'll tells you where that things you wants is...",
            'The mad skavids have it in their cave in the city',
            'You will have to learn skavid',
            'Otherwise they will not talks to you',
            'Make sure you remembers all that you hear',
            'Let me tells you the most common skavid words...',
            'Ar',
            'Nod',
            'Gor',
            'Ig',
            'Cur',
            'That will gets you started...'
        );
        cache.skavid_started_language = true;
        setStage(player, 5);
    }
}

// ---------------------------------------------------------------- the ogre guards and the city guard

async function ogreSpawnAndAttack(player, n) {
    const { world } = player;

    world.spawnTimedNPC({ id: NPC.OGRE_GENERAL, x: player.x, y: player.y, ticks: ticksOf(60000 * 3) });
    await world.sleepTicks(3);

    const ogre = player.getNearbyEntitiesWithinRadius('npcs', NPC.OGRE_GENERAL, 4).find((npc) => !npc.locked);

    chase(player, ogre);
}

async function ogreGuardCaveEntrance(player, n) {
    const stage = stageOf(player);

    if (stage >= 0 && stage < 5) {
        await n.say('Stop bothering me minion!');
    } else if (stage !== -1) {
        await n.say('What do you want ?');

        const menu = await player.ask(['I want to go in there', 'I want to rid the world of ogres'], true);

        if (menu === 0) {
            await n.say('Oh you do, do you ?', 'How about no ?');
            chase(player, n);
        } else if (menu === 1) {
            await n.say('You dare mock me creature!!!');
            chase(player, n);
        }
    } else {
        player.message('The guard is occupied at the moment');
    }
}

async function cityGuard(player, n) {
    const { cache } = player;

    if (cache.city_guard_riddle !== undefined && cache.city_guard_riddle === true) {
        await n.say('What is it ?');

        const menu = await player.ask(['Do you have any other riddles for me ?', 'I have lost the map you gave me'], true);

        if (menu === 0) {
            await n.say('Yes, what looks good on a plate with salad ?');

            const subMenu = await player.ask(["I don't know...", 'A nice pizza ?'], true);

            if (subMenu === 0) {
                await n.say('You!!!', 'Now go and bother me no more...');
            } else if (subMenu === 1) {
                await n.say('Grr.. think you are a comedian eh ?', 'Get lost!');
            }
        } else if (menu === 1) {
            if (carries(player, ITEM.SKAVID_MAP)) {
                await n.say('Are you blind ? what is that you are carrying ?');
                await player.say('Oh, that map....');
            } else {
                await n.say("What's the point ? take this copy and bother me no more!");
                give(player, ITEM.SKAVID_MAP, 1);
            }
        }

        return;
    }

    await n.say('Grrrr, what business have you here ?');
    await player.say('I am on an errand...');
    await n.say('So what do you want with me ?');

    const menu = await player.ask(['I am an ogre killer come to destroy you!', 'I seek passage into the skavid caves'], true);

    if (menu === 0) {
        await n.say('I would like to see you try!');
        chase(player, n);
    } else if (menu === 1) {
        await n.say(
            'Is that so...',
            'You humour me small thing, answer this riddle and I will help you...',
            'I want you to bring me an item',
            'I will give you all the letters of this item, you work out what it is...',
            'My first is in days, but not in years',
            'My second is in evil, and also in tears',
            'My third is in all, but not in none',
            'My fourth is in hot, but not in sun',
            'My fifth is in heaven, and also in hate',
            'My sixth is in fearing, but not in fate',
            'My seventh is in plush, but not in place',
            'My eighth is in nine, but not in eight',
            'My last is in earth, and also in in great',
            'My whole is an object, that magic will make',
            "It brings wrack and ruin to all in it's wake...",
            'Now how long I wonder, will this riddle take ?'
        );
        // player got the riddle
        cache.city_guard_riddle = false;
    }
}

// ---------------------------------------------------------------- Grew, Og, Toban, Gorad

async function toothDialogue(player, n) {
    await n.say('The morsel is back', 'Does it have our tooth for us ?');

    if (carries(player, ITEM.OGRE_TOOTH)) {
        await player.say('I have it');
        await n.say("It's got it, good good", 'That should annoy gorad wonderfully', 'Heheheheh!');
        player.inventory.remove(ITEM.OGRE_TOOTH);
        await n.say('Heres a token of my gratitude');
        give(player, ITEM.OGRE_RELIC_PART_BASE, 1);
        await n.say('Some old gem I stole from Gorad...', 'And an old part of a statue', 'Heheheheh!');
        player.message('The ogre hands you a large crystal');
        player.message('The ogre gives you part of a statue');
        give(player, ITEM.POWERING_CRYSTAL1, 1);
        delete player.cache.ogre_grew;
        player.cache.ogre_relic_part_2 = true;
    } else {
        await player.say("Err, I don't have it");
        await n.say('Morsel, you dare to return without the tooth!', 'Either you are a fool, or want to be eaten!');
    }
}

async function stolenGoldDialogue(player, n) {
    await n.say('Where is my gold from that traitor toban?');

    const subMenu = await player.ask(['I have your gold', "I haven't got it yet", 'I have lost the key!'], true);

    if (subMenu === 0) {
        if (carries(player, ITEM.STOLEN_GOLD)) {
            await n.say(
                'Well well, the little rat has got it!',
                'take this to show the little rat is a friend to the ogres',
                'Hahahahaha!'
            );
            player.inventory.remove(ITEM.STOLEN_GOLD);
            player.message('The ogre gives you part of a horrible statue');
            give(player, ITEM.OGRE_RELIC_PART_HEAD, 1);
            delete player.cache.ogre_og;
            // very strange setup of quest tbh, but that's what it is
            player.cache.ogre_relic_part_3 = true;
        } else {
            await n.say('That is not what I want rat!', 'If you want to impress me', 'Then get the gold I asked for!');
        }
    } else if (subMenu === 1) {
        await n.say("Don't come back until you have it", "Unless you want to be on tonight's menu!");
    } else if (subMenu === 2) {
        if (carries(player, ITEM.KEY)) {
            await n.say("Oh yeah! what's that then ?");
            player.message('It seems you still have the key...');
        } else {
            await n.say("Idiot! take another and don't lose it!");
            give(player, ITEM.KEY, 1);
        }
    }
}

async function dragonBoneDialogue(player, n) {
    await n.say('Ha ha ha! small thing returns', 'Did you bring the dragon bone ?');

    if (carries(player, ITEM.DRAGON_BONES)) {
        await player.say('When I say I will get something I get it!');
        player.inventory.remove(ITEM.DRAGON_BONES);
        await n.say('Ha ha ha! small thing has done it', 'Toban is glad, take this...');
        player.message('The ogre gives you part of a statue');
        give(player, ITEM.OGRE_RELIC_PART_BODY, 1);
        delete player.cache.ogre_toban;
        player.cache.ogre_relic_part_1 = true;
    } else {
        await player.say('I have nothing for you');
        await n.say('Then you shall get nothing from me!');
    }
}

async function grew(player, n) {
    const { cache } = player;
    const stage = stageOf(player);

    if (stage === -1) {
        // deviation: the Java's Combat Odyssey branch (config WANT_COMBAT_ODYSSEY) is not on this server
        player.message('The ogre is not interested in you anymore');
        return;
    }

    if (stage === 0 || stage === 1) {
        player.message('The ogre has nothing to say at the moment...');
        return;
    }

    if (cache.ogre_relic_part_2) {
        await n.say('What are you doing here morsel ?');

        const menu = await player.ask(
            ['Can I do anything else for you ?', "I've lost the relic part you gave me", "I've lost the crystal you gave me"],
            true
        );

        if (menu === 0) {
            await n.say('I have nothing left for you but the cooking pot!');
        } else if (menu === 1) {
            if (!carries(player, ITEM.OGRE_RELIC_PART_BASE)) {
                await n.say('Stupid morsel, I have another', 'Take it and go now before I lose my temper');
                give(player, ITEM.OGRE_RELIC_PART_BASE, 1);
            } else {
                await n.say('You lie to me morsel!');
            }
        } else if (menu === 2) {
            if (!carries(player, ITEM.POWERING_CRYSTAL1)) {
                await n.say('I suppose you want another ?', 'I suppose just this once I could give you my copy...');
                give(player, ITEM.POWERING_CRYSTAL1, 1);
            } else {
                await n.say('How dare you lie to me Morsel!', 'I will finish you now!');
            }
        }

        return;
    }

    if (cache.ogre_grew) {
        await toothDialogue(player, n);
        return;
    }

    await n.say('What do you want tiny morsel ?', 'You would look good on my plate');
    await player.say('I want to enter the city of ogres');
    await n.say('Perhaps I should eat you instead ?');

    const menu = await player.ask(["Don't eat me, I can help you", 'You will have to kill me first'], true);

    if (menu === 0) {
        await n.say('What can a morsel like you do for me ?');
        await player.say('I am a mighty adventurer', 'Slayer of monsters and user of magic powers');
        await n.say(
            'Well well, perhaps the morsel can help after all...',
            "If you think you're tough",
            'Find Gorad my enemy in the south east settlement',
            "And knock one of his teeth out!",
            'Heheheheh!'
        );
        cache.ogre_grew = true;
    } else if (menu === 1) {
        await n.say('That can be arranged - guards!!');
        await ogreSpawnAndAttack(player, n);
    }
}

async function og(player, n) {
    const { cache } = player;
    const stage = stageOf(player);

    if (stage === -1) {
        player.message('The ogre is not interested in you anymore');
        return;
    }

    if (stage === 0 || stage === 1) {
        player.message("He's busy, try him later");
        return;
    }

    if (cache.ogre_relic_part_3) {
        await n.say("It's the little rat again");

        const menu = await player.ask(['Do you have any other tasks for me ?', 'I have lost the relic part you gave me'], true);

        if (menu === 0) {
            await n.say('No, I have no more tasks for you, now go away');
        } else if (menu === 1) {
            if (!carries(player, ITEM.OGRE_RELIC_PART_HEAD)) {
                await n.say('Grrr, why do I bother ?', "It's a good job I have another part!");
                give(player, ITEM.OGRE_RELIC_PART_HEAD, 1);
            } else {
                await n.say('Are you blind! I can see you have it even from here!');
            }
        }

        return;
    }

    if (cache.ogre_og) {
        await stolenGoldDialogue(player, n);
        return;
    }

    await n.say('Why are you here little rat ?');

    const menu = await player.ask(['I seek entrance to the city of ogres', 'I have come to kill you'], true);

    if (menu === 0) {
        await n.say(
            'You have no business there!',
            'Just a minute...maybe if you did something for me I might help you get in...'
        );
        await player.say('What can I do to help an ogre ?');
        await n.say(
            'South East of here there is another settlement',
            'The name of the chieftan is Toban',
            'He stole some gold from me',
            'And I want it back!',
            "Here is a key to the chest it's in",
            'If you bring it here',
            'I may reward you...'
        );
        give(player, ITEM.KEY, 1);
        cache.ogre_og = true;
    } else if (menu === 1) {
        await n.say('Kill me eh ?', 'you shall be crushed like the vermin you are!', 'Guards!!');
        await ogreSpawnAndAttack(player, n);
    }
}

async function toban(player, n) {
    const { cache } = player;
    const stage = stageOf(player);

    if (stage === -1) {
        player.message('The ogre is not interested in you anymore');
        return;
    }

    if (stage === 0 || stage === 1) {
        player.message('He is busy at the moment...');
        return;
    }

    if (cache.ogre_relic_part_1) {
        await n.say('The small thing returns, what do you want now ?');

        const subMenu = await player.ask(['I seek another task', "I can't find the relic part you gave me"], true);

        if (subMenu === 0) {
            await n.say('Have you arrived for dinner ?', 'Ha ha ha! begone small thing!');
        } else if (subMenu === 1) {
            if (!carries(player, ITEM.OGRE_RELIC_PART_BODY)) {
                await n.say('Small thing, how could you be so careless ?', 'Here, take this one');
                give(player, ITEM.OGRE_RELIC_PART_BODY, 1);
            } else {
                await n.say('Small thing, you lie to me!', 'I always says that small things are big trouble...');
            }
        }

        return;
    }

    if (cache.ogre_toban) {
        await dragonBoneDialogue(player, n);
        return;
    }

    await n.say('What do you want small thing ?');

    const menu = await player.ask(['I seek entrance to the city of ogres', 'Die creature'], true);

    if (menu === 0) {
        await n.say('Ha ha ha! you\'ll never get in there');
        await player.say('I fear not for that city');
        await n.say('Bold words for a thing so small');

        const subMenu = await player.ask(['I could do something for you...', 'Die creature'], true);

        if (subMenu === 0) {
            await n.say(
                'Ha ha ha! this creature thinks it can help me!',
                'I would eat you now, but for your puny size',
                'Prove to me your might',
                'Bring me the bones of a dragon to chew on',
                'And I may spare you from a painful death'
            );
            cache.ogre_toban = true;
        } else if (subMenu === 1) {
            await n.say('Ha ha ha! it thinks it\'s a match for toban does it ?');
            chase(player, n);
        }
    } else if (menu === 1) {
        await n.say('Ha ha ha! it thinks it\'s a match for toban does it ?');
        chase(player, n);
    }
}

async function gorad(player, n) {
    const { cache } = player;

    if (cache.ogre_grew) {
        await player.say("I've come to knock your teeth out!");
        await n.say('How dare you utter that foul language in my prescence!', 'You shall die quickly vermin');
        chase(player, n);
    } else if (cache.ogre_grew_p1 || stageOf(player) > 0) {
        await player.say('Hello');
        await n.say('Do you know who you are talking to ?');

        const menu = await player.ask(['A big ugly brown creature...', "I don't know who you are"], true);

        if (menu === 0) {
            await n.say('The impudence! take that...');
            player.damage(16);
            await player.say('Ouch!');
            player.message('The ogre punched you hard in the face!');
        } else if (menu === 1) {
            await n.say("I am Gorad - who you are dosen't matter", 'Go now and you may live another day!');
        }
    } else {
        player.message('Gorad is busy, try again later');
    }
}

// ---------------------------------------------------------------- the ogre shaman (WatchTowerShaman.java)

async function shaman(player, n) {
    await n.say('Grr! how dare you talk to us', 'We will destroy you!');
    player.message('A magic blast comes from the shaman');
    player.damage(Math.floor(player.skills.hits.current * 0.2 + 10));
    player.message('You are badly injured by the blast');
}

// ---------------------------------------------------------------- the Watchtower wizard

async function fingerNails(player, n) {
    if (stageOf(player) === 1) {
        await player.say('Have a look at these');
        player.inventory.remove(ITEM.FINGERNAILS);
        await n.say(
            'Interesting, very interesting',
            'Long nails...grey in colour',
            'Well chewed...',
            'Of course, they belong to a skavid'
        );
        await player.say('A skavid ?');
        await n.say(
            'A servant race to the ogres',
            'Gray depressed looking creatures',
            'Always loosing nails, teeth and hair',
            'They inhabit the caves in the mendip hills',
            'They normally keep to themselves though',
            "It's unusual for them to venture from their caves"
        );
        await player.ask(['What do you suggest that I do ?', 'Shall I search the caves ?'], true);
        await searchingTheCaves(player, n);
    } else {
        player.message('The wizard has no need for more evidence');
    }
}

async function searchingTheCaves(player, n) {
    await n.say("It's no good searching the caves", 'Well, not yet anyway');
    await player.say('Why not ?');
    await n.say(
        'They are deep and complex',
        'The only way you will navigate the caves is to have a map or something',
        'It may be that the ogres have one'
    );
    await player.say('And how do you know that ?');
    await n.say("Well... I don't");

    const m2 = await player.ask(['So what do I do ?', 'I wont bother then'], false);

    if (m2 === 0) {
        await player.say('So what do I do ?');
        await n.say('You need to be fearless', "And gain entrance to Gu'Tanoth the city of ogres", 'And find out how to navigate the caves');
        await player.say('That sounds scary');
        await n.say('Ogres are nasty creatures yes', 'Only a strong warrior, and a clever one at that', 'Can get the better of the ogres...');
        await player.say('What do I need to do to get into the city');
        await n.say(
            'Well the guards need to be dealt with',
            'You could start by checking out the ogre settlements around here',
            'Tribal ogres often hate their neighbours...'
        );
        setStage(player, 2);
    } else if (m2 === 1) {
        await player.say("I won't bother then");
        await n.say("Won't bother, won't bother ?", '...Perhaps this quest is too hard for you');
        player.message('The wizard walks away');
    }
}

async function wizardStage0(player, n) {
    await n.say('Oh my Oh my!');

    const menu = await player.ask(["What's the matter ?", 'You wizards are always complaining'], true);

    if (menu === 0) {
        await n.say(
            'Oh dear oh dear',
            'Darn and drat',
            'We try hard to keep this town protected',
            "But how can we do that when the watchtower isn't working ?"
        );
        await player.say("What do you mean it isn't working ?");
        await n.say(
            'The watchtower here works by the power of a magical device',
            'An ancient spell designed to ward off ogres',
            'That has been in place here for many moons',
            'The exact knowledge of the spell is lost to us now',
            'But the essence of the spell',
            'Has been infused into 4 powering crystals',
            'To keep the tower protected from the hordes in the mendips...'
        );

        const menu2 = await player.ask(
            ["So how come the spell dosen't work ?", "I'm not interested in the rantings of an old wizard"],
            true
        );

        if (menu2 === 0) {
            await n.say('The crystals! the crystals!', 'They have been taken!');
            await player.say('Taken...');
            await n.say('Stolen!');
            await player.say('Stolen...');
            await n.say('Yes, yes! do I have to repeat myself ?');
            player.message('The wizard seems very stressed...');

            const menu3 = await player.ask(['Can I be of help ?', "I'm not sure I can help", "I'm not interested"], true);

            if (menu3 === 0) {
                await n.say('Help ?', 'Oh wonderful dear traveller', 'Yes I could do with an extra pair of eyes here');
                await player.say('???');
                await n.say(
                    'There must be some evidence of what has happened somewhere',
                    'Perhaps you could assist me in searching for clues'
                );
                await player.say('I would be happy to');
                await n.say('Try searching the surrounding area');
                // QUEST START - STAGE 1
                setStage(player, 1);
            } else if (menu3 === 1) {
                await n.say('Oh dear what am I to do ?', 'The safety of this whole area is in jeopardy!');
            } else if (menu3 === 2) {
                await n.say("That's typical nowadays", "Its left to us wizards to do all the work...");
                player.message('The wizard is not impressed');
            }
        } else if (menu2 === 1) {
            player.message('The wizard gives you a suspicious look');
        }
    } else if (menu === 1) {
        await n.say(
            'Complaining ?.... complaining !',
            "What folks these days don't realize",
            "Is that if it wasn't for us wizards",
            'This entire world would be overrun',
            'With every creature that walks this world!'
        );
        player.message('The wizard angrily walks away');
    }
}

async function wizardStage3(player, n) {
    const { cache } = player;

    if (!cache.has_ogre_companionship && cache.city_guard_riddle === undefined) {
        await n.say('Ah the warrior returns', "Have you found a way into Gu'Tanoth yet ?");
        await player.say("I can't get past the guards");
        await n.say(
            'Well, ogres dislike others apart from their kind',
            'What you need is some form of proof of friendship',
            'Something to trick them into believing you are their friend',
            "...Which shouldn't be too hard considering their intelligence!"
        );

        if (!carries(player, ITEM.OGRE_RELIC)) {
            const lostRelicMenu = await player.ask(['I have lost the relic you gave me', 'I will find my way in, no problem'], true);

            if (lostRelicMenu === 0) {
                await n.say(
                    'What! lost the relic ? How careless!',
                    "It's a good job I copied that design then...",
                    "You can take this copy instead, its just as good"
                );
                give(player, ITEM.OGRE_RELIC, 1);
            } else if (lostRelicMenu === 1) {
                await n.say("Yes, I'm sure you will...good luck");
            }
        }
    } else if (cache.has_ogre_companionship && cache.city_guard_riddle === undefined) {
        await n.say('How are you doing with the ogres ?');
        await player.say('I have gained entry to the city');
        await n.say('Already ? excellent!');
        await player.say("I still can't navigate the skavid caves");
        await n.say('You need a map of some kind...', 'I bet one of the ogres has one');
        await player.say("Okay thanks, I'll go and find out");
    } else {
        await n.say('How is the quest going ?');

        const puzzleMenu = await player.ask(
            ['Some of the city guards have set me a puzzle', 'Can you tell me more about the city ?'],
            true
        );

        if (puzzleMenu === 0) {
            await n.say('Ummm is that so ?', "I can't help you there, I never was much good at puzzles...");
        } else if (puzzleMenu === 1) {
            await n.say(
                'Yes indeed, this city is very ancient',
                "It's not clear whether the ogres actually constructed it",
                'Or whether they took it over from another race',
                'What I can tell you is that the whole city is controlled',
                'By a group of ogre shaman'
            );
            await player.say('Ogre shaman ?');
            await n.say('Indeed, these ogres have harnessed the black arts...', 'They wield great power');
            await player.say('They sound nasty!');
            await n.say('Indeed they are, but you must confront them', 'To break the power of the ogres they must be beaten!');

            const sMenu = await player.ask(["But I'm scared of those shaman!", 'Leave it to me, I fear no ogre'], false);

            if (sMenu === 0) {
                await player.say("But i'm scared of those shaman!");
                await n.say('Scared ? to get this far and to falter now...', 'Perchance you are not ready for the final challenge ?');
            } else if (sMenu === 1) {
                await player.say('Leave it to me, I fear no ogre');
                await n.say("That's the spirit!", 'May your search prove fruitful!');
            }
        }
    }
}

async function wizard(player, n) {
    const { cache } = player;

    switch (stageOf(player)) {
        case -1:
            if (cache.watchtower_scroll) {
                await n.say('Greetings friend', 'I trust all is well with you ?', 'Yanilee is safe at last!');
            } else {
                await n.say('Hello again adventurer', 'Thanks again for your help in keeping us safe');

                const finish = await player.ask(['I lost the scroll you gave me', "That's okay"], true);

                if (finish === 0) {
                    if (!player.bank.has(ITEM.SPELL_SCROLL) && !carries(player, ITEM.SPELL_SCROLL)) {
                        await n.say('Never mind, have another...');
                        give(player, ITEM.SPELL_SCROLL, 1);
                    } else if (player.bank.has(ITEM.SPELL_SCROLL)) {
                        await n.say('Ho ho ho! a comedian to the finish!', 'There it is, in your bank!');
                    } else {
                        await n.say('Ho ho ho! a comedian to the finish!', 'There it is, in your backpack!');
                    }
                } else if (finish === 1) {
                    await n.say('We are always in your debt...');
                }
            }
            break;
        case 0:
            await wizardStage0(player, n);
            break;
        case 1:
            await n.say('Hello again', 'Did you find anything of interest ?');

            if (carries(player, ITEM.FINGERNAILS)) {
                await fingerNails(player, n);
            } else if (
                carries(player, ITEM.EYE_PATCH) ||
                carries(player, ITEM.GOBLIN_ARMOUR) ||
                carries(player, ITEM.IRON_DAGGER) ||
                carries(player, ITEM.WIZARDS_ROBE)
            ) {
                // easter egg? in official rsc the related quest items were not checked but the regular ones (see wiki)
                if (carries(player, ITEM.EYE_PATCH)) {
                    await player.say('I found this eye patch');
                } else if (carries(player, ITEM.GOBLIN_ARMOUR)) {
                    await player.say('Have a look at this goblin armour');
                } else if (carries(player, ITEM.IRON_DAGGER)) {
                    await player.say('I found a dagger');
                } else if (carries(player, ITEM.WIZARDS_ROBE)) {
                    await player.say('I have this robe');
                }

                await n.say('Let me see...', 'No, sorry this is not evidence', 'You need to keep searching im afraid');
            } else {
                await player.say('No nothing yet');
                await n.say('Oh dear oh dear', 'There must be something somewhere');
            }
            break;
        case 2: {
            await n.say("How's it going ?");

            const newM = await player.ask(
                ['I am having difficulty with the tribes', 'I have everything under control', 'I have lost something the ogres gave to me'],
                true
            );

            if (newM === 0) {
                await n.say(
                    'Talk to them face to face',
                    "And don't show any fear",
                    'Make sure you are rested and well-fed',
                    'And fight the good fight!'
                );
            } else if (newM === 1) {
                await n.say('Good, good! I will expect the crystals back shortly then...');
            } else if (newM === 2) {
                await n.say('Oh deary me!', "Well there's nothing I can do about it", "You will have to go back to them i'm afraid");
            }
            break;
        }
        case 3:
            await wizardStage3(player, n);
            break;
        case 4: {
            await n.say('How is the quest going ?');
            await player.say("I have worked out the guard's puzzle");
            await n.say('My my! a wordsmith as well as a hero!');

            const mymyMenu = await player.ask(
                ['I am still trying to navigate the skavid caves', "I am trying to get into the shaman's cave", 'It is going well'],
                true
            );

            if (mymyMenu === 0) {
                await n.say('Take some illumination with you or else it will be dark!');
            } else if (mymyMenu === 1) {
                await n.say(
                    'Yes it will be well-guarded',
                    'Hmmm, let me see...',
                    'Ah yes, I gather some ogres are allergic to certain herbs...',
                    'Now what was it ?',
                    'It had white berries and blue leaves.... I remember that!',
                    'You should try looking through some of the caves...'
                );
            } else if (mymyMenu === 2) {
                await n.say('Thats good to hear', 'We are much closer to fixing the tower now');
            }
            break;
        }
        case 5: {
            await n.say('Hello again, how do you fare?');

            const questMenu5 = await player.ask(
                ['It goes well, I can now navigate the skavid caves', 'I had a crystal but I lost it', 'I am now ready for the shaman'],
                false
            );

            if (questMenu5 === 0) {
                await player.say('It goes well, I can now navigate the skavid caves');
                await n.say('That is good news', 'Let me know if you find anything of interest...');
            } else if (questMenu5 === 1) {
                await player.say('I had a crystal, but I lost it');
                await n.say('Oh no, well you had better go back there again then!');
            } else if (questMenu5 === 2) {
                await player.say('I am now ready for the shaman');
                await n.say(
                    'Remember all I told you, you must distract the guard somehow',
                    'The herbs with blue leaves and berries is what you are looking for',
                    'This herb is very poisonous however, handle it carefully',
                    'Also, be on your guard in that cave',
                    'Who know what monsters may be present in that awful place'
                );
            }
            break;
        }
        case 6:
            await player.say('I have found the cave of ogre shaman', 'But I cannot touch them!');
            await n.say(
                'That is because of their magical powers',
                'We must fight them with their own methods',
                'Do not speak to them!',
                'I suggest a potion...',
                'Collect some guam leaves',
                'and some jangerberries',
                'And mix in some ground bat bones',
                'It is essential to return it to me before you use it',
                'So I can empower it with my magic',
                'Be very careful how you mix it, its extremely volatile',
                'Mixing ingredients of this type in the wrong order can cause explosions!',
                "I hope you've been brushing up in herblaw and magic ?",
                'I must warn you that only experienced magicians can use this potion',
                'It is too dangerous in the hands of the unskilled...'
            );
            setStage(player, 7);
            break;
        case 7:
            await n.say('Any more news ?');

            if (carries(player, ITEM.OGRE_POTION)) {
                await player.say('Yes I have made the potion');
                await n.say("That's great news, let me infuse it with magic...");
                player.message('The wizard mutters strange words over the liquid');
                player.inventory.remove(ITEM.OGRE_POTION);
                give(player, ITEM.MAGIC_OGRE_POTION, 1);

                if (stageOf(player) === 7) {
                    setStage(player, 8);
                }

                await n.say(
                    'Here it is, a dangerous substance',
                    'I must remind you that this potion can only be used',
                    'If your magic ability is high enough'
                );
            } else {
                await player.say('Can you tell me again what I need for the potion ?');
                await n.say(
                    'Yes indeed, you need some guam leaves,',
                    'Jangerberries and ground bat bones',
                    'Then the potion can be powered with magic',
                    'And the ogre shaman can be destroyed'
                );
            }
            break;
        case 8: {
            await n.say('Hello again', 'Did the potion work ?');
            await player.say('I am still working to rid us of these shaman...');
            await n.say('May you have sucess in your task');

            const qMenu = await player.ask(
                ['I had another crystal but I lost it', 'I am looking for another crystal', 'I have found another crystal!'],
                true
            );

            if (qMenu === 0) {
                await n.say('Oh really ?', "It's probably been dropped in the shaman cave", 'Go and have a good search that area again');
            } else if (qMenu === 1) {
                await n.say('I am sure the cave holds the final one', 'Look for the source of the shaman power...');
                await player.say('Okay I will go and have a look');
            } else if (qMenu === 2) {
                await n.say("Good, let's have it here...");
            }
            break;
        }
        case 9:
            if (!cache.crystal_rock) {
                await n.say('Hello again', 'Did the potion work ?');
                await player.say('Indeed it did!', 'I wiped out those ogre shaman!', 'I am looking for another crystal');
                await n.say('I am sure the cave holds the final one', 'Look for the source of the shaman power...');
                await player.say('Okay I will go and have a look');
            } else {
                await n.say('Well, how did it go ?', 'Have you found any more crystals ?');

                const rMenu = await player.ask(
                    ['I did have the crystal but I lost it', "I can't find any more crystals yet...", 'Yes, here it is'],
                    false
                );

                if (rMenu === 0) {
                    await player.say('I did have the crystal but I lost it');
                    await n.say('Dissappointing, dissappointing...', "Well there's not much I can do...", 'You had better go back and search the area again');
                } else if (rMenu === 1) {
                    await player.say("I can't find any more crystals yet...");
                    await n.say(
                        'The rock of the shaman is the key',
                        'I understand their power is linked to it in some way',
                        'You may need something heavy to crack this boulder...'
                    );
                } else if (rMenu === 2) {
                    await player.say('Yes, here it is!');
                    await n.say('Wonderful!', "Show it to me so I can confirm it's the real thing...");
                }
            }
            break;
        case 10:
            await n.say('The system is not activated yet', 'Throw the switch to start it...');
            break;
        default:
            break;
    }
}

const TALK_IDS = new Set([
    NPC.WATCHTOWER_WIZARD,
    NPC.GREW,
    NPC.OG,
    NPC.TOBAN,
    NPC.GORAD,
    NPC.OGRE_SHAMAN,
    NPC.OGRE_CITIZEN,
    NPC.OGRE_TRADER_FOOD,
    NPC.OGRE_GUARD_CAVE_ENTRANCE,
    NPC.OGRE_TRADER_ROCKCAKE,
    NPC.CITY_GUARD,
    NPC.SKAVID_FINALQUIZ,
    NPC.SKAVID_IG,
    NPC.SKAVID_AR,
    NPC.SKAVID_CUR,
    NPC.SKAVID_NOD,
    NPC.SKAVID_INITIAL
]);

async function onTalkToNPC(player, npc) {
    if (!TALK_IDS.has(npc.id)) {
        return false;
    }

    player.engage(npc);

    try {
        switch (npc.id) {
            case NPC.SKAVID_FINALQUIZ:
                await skavidFinalQuiz(player, npc);
                break;
            case NPC.SKAVID_IG:
            case NPC.SKAVID_AR:
            case NPC.SKAVID_CUR:
            case NPC.SKAVID_NOD:
                await skavidWord(player, npc);
                break;
            case NPC.SKAVID_INITIAL:
                await skavidInitial(player, npc);
                break;
            case NPC.WATCHTOWER_WIZARD:
                await wizard(player, npc);
                break;
            case NPC.OGRE_CITIZEN:
                await npc.say('Uh ? what are you doing here ?');
                break;
            case NPC.OGRE_TRADER_FOOD:
                await npc.say('Grrr, little animal.. I shall destroy you!');
                chase(player, npc);
                break;
            case NPC.OGRE_GUARD_CAVE_ENTRANCE:
                await ogreGuardCaveEntrance(player, npc);
                break;
            case NPC.OGRE_TRADER_ROCKCAKE:
                await npc.say('Arr, small thing wants my food does it ?', "I'll teach you to deal with ogres!");
                chase(player, npc);
                break;
            case NPC.CITY_GUARD:
                await cityGuard(player, npc);
                break;
            case NPC.GREW:
                await grew(player, npc);
                break;
            case NPC.OG:
                await og(player, npc);
                break;
            case NPC.TOBAN:
                await toban(player, npc);
                break;
            case NPC.GORAD:
                await gorad(player, npc);
                break;
            case NPC.OGRE_SHAMAN:
                await shaman(player, npc);
                break;
            default:
                break;
        }
    } finally {
        player.disengage();
    }

    return true;
}

// Dialogues.onUseNpc: fingernails to the wizard, the stolen gold to Og, the tooth to Grew, a dragon bone to Toban
async function onUseWithNPC(player, npc, item) {
    const { cache } = player;

    if (npc.id === NPC.WATCHTOWER_WIZARD && item.id === ITEM.FINGERNAILS) {
        player.engage(npc);
        await fingerNails(player, npc);
        player.disengage();
        return true;
    }

    if (npc.id === NPC.OG && item.id === ITEM.STOLEN_GOLD) {
        if (cache.ogre_og || cache.ogre_relic_part_3) {
            player.engage(npc);
            await stolenGoldDialogue(player, npc);
            player.disengage();
        } else {
            player.message('Nothing interesting happens');
        }

        return true;
    }

    if (npc.id === NPC.GREW && item.id === ITEM.OGRE_TOOTH) {
        if (cache.ogre_relic_part_2) {
            await player.say('I am not sure giving him another tooth will have any purpose');
        } else if (cache.ogre_grew) {
            player.engage(npc);
            await toothDialogue(player, npc);
            player.disengage();
        } else {
            player.message('Nothing interesting happens');
        }

        return true;
    }

    if (npc.id === NPC.TOBAN && item.id === ITEM.DRAGON_BONES) {
        if (cache.ogre_toban || cache.ogre_relic_part_1) {
            player.engage(npc);
            await dragonBoneDialogue(player, npc);
            player.disengage();
        } else {
            player.message('Nothing interesting happens');
        }

        return true;
    }

    return false;
}

// WatchTowerGorad.onAttackNpc: nobody picks a fight with Gorad (he starts it himself once ogre_grew is set)
async function onNPCAttack(player, npc) {
    if (npc.id !== NPC.GORAD) {
        return false;
    }

    player.engage(npc);
    await npc.say('Ho Ho! why would I want to fight a worm ?', 'Get lost!');
    player.disengage();

    return true;
}

// WatchTowerGorad.onKillNpc: "He's dropped a tooth, I'll keep that!"
async function onNPCDeath(player, npc) {
    if (npc.id !== NPC.GORAD || !player || !player.questStages) {
        return false;
    }

    player.message('Gorad has gone');
    player.message("He's dropped a tooth, I'll keep that!");
    give(player, ITEM.OGRE_TOOTH, 1);

    // deviation: the Java kill trigger replaces the death; here the default death (loot, removal, respawn) goes on after the tooth
    return false;
}

module.exports = { onTalkToNPC, onUseWithNPC, onNPCAttack, onNPCDeath };
