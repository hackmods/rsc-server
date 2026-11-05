// Ported from Open-RSC Core-Framework authentic/quests/members/FightArena.java (AGPL-3.0)
// Reward from plugins/shared/QuestRewardRegistrar.java (FIGHT_ARENA: 2 quest points, attack 700 + 800 per level and
// thieving 700 + 800 per level) and FightArena.handleReward (1000 coins). The arena doors are in
// wall-objects/level-doors.js (DOOR_KHAZARD_HOUSE 113, DOOR_KHAZARD_BFIELD_LOBBY 114), the khali brew comes from
// npcs/khazard/khazard-bartender.js.
//
// Stages (player.questStages.fightArena):
//   0 / undefined  not started: Lady Servil (by her broken cart, 575,679) asks you to free her family
//   1              started: the guards' cupboard 382 (607,683) gives the khazard helmet 733 and chainmail 734; worn,
//                  they get you past the Khazard lodgings doors 113
//   2              Jeremy Servil spoke from his cell 371 (604,716): the bribable guard (374) takes a khali brew 735 and
//                  gives the cell keys 736 (cache "guard_sleeping"); opening the cell frees Jeremy (cache
//                  "freed_servil", the arena lobby doors 114 now open). Talk to Jeremy in the arena (613,709): a
//                  Khazard ogre (384) attacks; its death (cache "killed_ogre") brings General Khazard, who locks you
//                  in the cell at 609,715. Hengrad there sends you to the arena (609,705): Khazard scorpion (386),
//                  then Bouncer (388)
//   3              Bouncer killed: General Khazard (383) attacks; back to Lady Servil
//   -1             done: 1000 coins, 2 quest points, attack and thieving experience
//
// The kills are onNPCDeath hooks that return false: the default death (drops, removal, kill experience, the end of
// the fight) runs first and the Java's follow-up (dialogue, spawns, the jail teleport) one tick later, as the Java
// plugin thread does after the NPC is gone.
// The Guard GUARD_KHAZARD (375) dialogue is in the Java onTalkNpc but missing from its blockTalkNpc list, so Open-RSC
// never runs it; it is claimed here (375 and the mace guard 376 have no spawn in rsc-data, so neither is reachable).

const COINS_ID = 10;
const KHAZARD_HELMET_ID = 733;
const KHAZARD_CHAINMAIL_ID = 734;
const KHALI_BREW_ID = 735;
const KHAZARD_CELL_KEYS_ID = 736;

const LADY_SERVIL_ID = 372;
const GUARD_KHAZARD_BYPRISONER_ID = 373;
const GUARD_KHAZARD_BRIBABLE_ID = 374;
const GUARD_KHAZARD_ID = 375;
const GUARD_KHAZARD_MACE_ID = 376;
const JEREMY_SERVIL_ID = 377;
const JUSTIN_SERVIL_ID = 378;
const FIGHTSLAVE_JOE_ID = 379;
const FIGHTSLAVE_KELVIN_ID = 380;
const LOCAL_ID = 381;
const GENERAL_KHAZARD_ID = 383;
const KHAZARD_OGRE_ID = 384;
const KHAZARD_SCORPION_ID = 386;
const HENGRAD_ID = 387;
const BOUNCER_ID = 388;

const GUARDS_CUPBOARD_CLOSED = 381;
const GUARDS_CUPBOARD_OPEN = 382;
const CELL_GATE_ID = 371;
const CELL_GATE_OPEN_ID = 181;

// Java addnpc despawn times in ms (30000, TimeUnit.SECONDS.toMillis(1000)) as 640 ms ticks
const GENERAL_TICKS = 47;
const ARENA_TICKS = 1563;
// Java delayedSpawnObject(loc, 3000)
const CELL_GATE_OPEN_TICKS = 5;

function wearsKhazardArmour(player) {
    return player.inventory.isEquipped(KHAZARD_HELMET_ID) && player.inventory.isEquipped(KHAZARD_CHAINMAIL_ID);
}

// Java ifnearvisnpc(player, id, range): getNearestEntityByID's range is the side of the box
function nearbyNpc(player, id, range) {
    return player.getNearestEntityByID('npcs', id, range * 2);
}

// Java setChasing / startCombat: the NPC runs at the player and fights
function setChasing(npc, player) {
    Promise.resolve(npc.attack(player)).catch(() => {});
}

// Java n.teleport(x, y) on an NPC: the JS model has no NPC teleport, so move it and tell the players who see it
function moveNpc(npc, x, y) {
    npc.x = x;
    npc.y = y;

    if (typeof npc.broadcastMove === 'function') {
        npc.broadcastMove();
    }
}

async function messages(player, ...lines) {
    for (const line of lines) {
        player.message(line);
        await player.world.sleepTicks(3);
    }
}

function stageAtLeast3(player) {
    const stage = player.questStages.fightArena;
    return stage === 3 || stage === -1;
}

// ---- Lady Servil ---------------------------------------------------------------------------------------------

async function completeQuest(player) {
    await messages(
        player,
        'you have completed the fight arena quest',
        'Lady Servil gives you 1000 gold coins',
        'you gain two quest points'
    );
    player.inventory.add(COINS_ID, 1000);
    player.completeQuest('fightArena', {
        questPoints: 2,
        experience: {
            attack: 700 + player.skills.attack.base * 800,
            thieving: 700 + player.skills.thieving.base * 800
        }
    });
    delete player.cache.freed_servil;
    delete player.cache.killed_ogre;
}

async function ladyServil(player, npc) {
    const stage = player.questStages.fightArena;

    if (!stage) {
        await player.say("hi there, looks like you're in some trouble");
        await npc.say('oh, i wish this broken cart was my only problem');
        await npc.say("sob.. i've got to find my family.. sob");

        const choice = await player.ask(['I hope you can, good luck', 'can i help you?'], true);

        if (choice === 0) {
            await npc.say(' sob..sob');
        } else if (choice === 1) {
            await npc.say(
                'sob.. would you? please?',
                "i'm Lady Servil, my husband's Sir Servil",
                'we were travelling north with my son',
                "when we were ambushed by general Khazard's men"
            );
            await player.say("general Khazard? i haven't heard of him");
            await npc.say(
                "he's been after me ever since i",
                'declined his hand in marriage',
                "now he's kidnapped my husband and son",
                'to fight slaves in his',
                'battle arena, to the south of here',
                "i hate to think what he'll do to them",
                "he's a sick, twisted man"
            );
            await player.say("I'll try my best to return your family");
            await npc.say("please do, i'm a wealthy woman", 'and can reward you handsomely', "i'll be waiting for you here");
            player.questStages.fightArena = 1;
        }
    } else if (stage === 1 || stage === 2) {
        if (!('freed_servil' in player.cache)) {
            await player.say('hello Lady Servil');
            await npc.say('Brave traveller, please..bring back my family');
        } else {
            await player.say(
                "Lady Servil, i've freed your son",
                'but he has returned to the arena to try and help your husband'
            );
            await npc.say("oh no, they won't stand a chance", 'please go back and help');
        }
    } else if (stage === 3) {
        await player.say('Lady Servil');
        await npc.say(
            "you're alive, i thought Khazard's men took you",
            'My son and husband are safe and recovering at home',
            'without you they would certainly be dead',
            'I am truly grateful for your service',
            'all i can offer in return is material wealth',
            'please take these coins and enjoy'
        );
        await completeQuest(player);
    } else if (stage === -1) {
        await player.say('Hello lady Servil');
        await npc.say('oh hello my dear', 'my husband and son are resting', 'while i wait for the cart fixer');
        await player.say("hope he's not too long");
        await npc.say('thanks again for everything');
    }
}

// ---- the arena prisoners -------------------------------------------------------------------------------------

async function hengrad(player, npc) {
    if (player.questStages.fightArena !== 2 || !('killed_ogre' in player.cache)) {
        return;
    }

    const { world } = player;

    await player.say('Are you ok stranger?');
    await npc.say("I'm fine thanks, my name's Hengrad", 'So khazard got his hands on you too?');
    await player.say("I'm afraid so");
    await npc.say("If you're lucky you may last as long as me");
    await player.say('How long have you been here?');
    await npc.say(
        "I've been in khazard's prisons ever since i can remember",
        'I was a child when his men kidnapped me',
        'My whole life has been spent killing and fighting',
        "All in the hope that one day I'll escape"
    );
    await player.say("Don't give up");
    await npc.say('Thanks friend..wait..sshh,the guard is coming', "He'll be taking one of us to the arena");
    await messages(player, 'A guard approaches the cell');
    await npc.say("Looks like it's you,good luck friend");
    await messages(player, 'The guard leads you to the arena', 'For your battle');
    player.teleport(609, 705, false);
    await messages(
        player,
        'From above you hear a voice...',
        'Ladies and gentlemen!',
        'Todays first fight between the outsider',
        "And everyone's favorite scorpion has begun"
    );

    const scorpion = world.spawnTimedNPC({ id: KHAZARD_SCORPION_ID, x: 609, y: 707, ticks: ARENA_TICKS });

    if (scorpion) {
        player.disengage();
        setChasing(scorpion, player);
    }
}

async function jeremyServil(player, jeremy) {
    const stage = player.questStages.fightArena;

    if (stage >= 3 || stage === -1) {
        player.message('You need to kill the creatures in the arena');
        return;
    }

    if (stage !== 2 || !('freed_servil' in player.cache)) {
        return;
    }

    const { world } = player;

    await player.say("Jeremy where's your father?");
    await jeremy.say('Quick, help him! that beast will kill him', "He can't fight! he's too old!");
    await messages(player, "You see Jeremy's father Justin", 'Trying to escape an ogre');
    await jeremy.say('Please help him!');

    const ogre = world.spawnTimedNPC({ id: KHAZARD_OGRE_ID, x: 611, y: 706, ticks: ARENA_TICKS });

    if (ogre) {
        player.disengage();
        setChasing(ogre, player);
    }
}

// ---- the guards and the locals -------------------------------------------------------------------------------

async function guardKhazard(player, npc) {
    if (stageAtLeast3(player)) {
        await player.say('hello');
        await npc.say("You're the outsider who killed bouncer!", 'on-guard fiend!');
        player.disengage();
        setChasing(npc, player);
        return;
    }

    if (wearsKhazardArmour(player)) {
        await player.say('hello');
        await npc.say('damn thieves, that was good armour', 'did you see anyone around here?');
        await player.say('me? no, no one');
        await npc.say('hmmmmm');
    } else {
        await player.say('Hello');
        await npc.say('Who goes there?');
        await player.say('..er .. i\'m..');
        await npc.say("I don't know you", 'Get out of my house strange');
        player.message("He doesn't seem too friendly");
    }
}

async function maceGuard(player, npc) {
    if (stageAtLeast3(player)) {
        await player.say('hello');
        await npc.say("you're the outsider who killed bouncer", 'die traitor!');
        player.disengage();
        setChasing(npc, player);
        return;
    }

    await player.say('hello');

    if (wearsKhazardArmour(player)) {
        await npc.say(
            'can i help you stranger?',
            "oh.. you're a guard as well",
            "that's ok then",
            "we don't like outsiders around here"
        );
    } else {
        await npc.say("i don't know you stranger", 'get of our land');
        player.disengage();
        setChasing(npc, player);
    }
}

async function prisonGuard(player, npc) {
    const stage = player.questStages.fightArena;

    if (stage >= 2 || stage === -1) {
        if (wearsKhazardArmour(player)) {
            if (Math.random() < 0.5) {
                await player.say('hello again');
                await npc.say("i hope you're keeping busy?");
                await player.say('of course');
            } else {
                await player.say('hello');
                await npc.say("hello, hope you're keeping busy?");
                await player.say('of course');
            }

            if (stage !== 2) {
                await npc.say(
                    "General Khazard doesn't tolerate the lazy",
                    "if you're not keeping busy",
                    "i'll practice my combat skills on your hide"
                );
            }
        } else {
            await npc.say('this area is restricted, leave now', "OUT and don't come back!");
            await messages(player, 'the guard has thrown you out');
            player.teleport(602, 717, false);
        }

        return;
    }

    await player.say('long live General Khazard');
    await npc.say('erm.. yes.. soldier', "i take it you're new");
    await player.say('you could say that');
    await npc.say(
        'Khazard died two hundred years ago',
        'however his dark spirit remains',
        'in the form of the undead maniac...General Khazard',
        'remember he is your master, always watching',
        'you got that, newbie?'
    );
    await player.say('undead, maniac, master, got it - loud and clear');
}

async function giveBrew(player, npc) {
    await player.say('do you still fancy a drink?');
    await npc.say("I really shouldn't... ok then, just the one", 'this stuff looks good');
    player.inventory.remove(KHALI_BREW_ID);
    await messages(player, 'the guard takes a mouthful of drink');
    await npc.say('blimey this stuff is pretty good', "it's not too strong is it?");
    await player.say("no, not at all, you'll be fine");
    await messages(player, 'the guard finishes the bottle');
    await npc.say('that is some gooood stuff', 'yeah... woooh... yeah');
    await messages(player, 'the guard seems quite typsy');
    await player.say('are you alright?');
    await npc.say("yeesshh, ooohh, 'hiccup'", 'maybe i should relax for a while....');
    await player.say("good idea, i'll look after the prisoners");
    await npc.say("ok then, here, 'hiccup',", 'take these keys', "any trouble you give 'em a good beating");
    await player.say("no problem, i'll keep them in line");
    await npc.say('zzzzz zzzzz zzzzz');
    await messages(player, 'the guard is asleep');
    player.cache.guard_sleeping = true;
    player.inventory.add(KHAZARD_CELL_KEYS_ID);
}

async function bribableGuard(player, npc) {
    const stage = player.questStages.fightArena;

    if (stageAtLeast3(player)) {
        if (wearsKhazardArmour(player)) {
            await player.say('hello');
            await npc.say('less chat and more work', "i can't stand lazy guards");
        } else {
            await npc.say('this area is restricted, leave now', "OUT and don't come back!");
            await messages(player, 'the guard has thrown you out');
            player.teleport(621, 698, false);
        }

        return;
    }

    if ('guard_sleeping' in player.cache || 'freed_servil' in player.cache) {
        if (player.inventory.has(KHAZARD_CELL_KEYS_ID)) {
            await npc.say('please, let me rest');
        } else {
            await player.say("i've lost the keys");
            await npc.say("what?! you're foolish..", "hiccup.. and i'm drunk", "here, i've got another set");
            player.inventory.add(KHAZARD_CELL_KEYS_ID);
        }

        return;
    }

    if (stage === 2) {
        await player.say('hello again');
        await npc.say(
            'bored, bored, bored',
            'you would think the slaves would be more entertaining',
            "selfish.. the lot of 'em"
        );

        if (player.inventory.has(KHALI_BREW_ID)) {
            await giveBrew(player, npc);
        }

        return;
    }

    await player.say('long live General Khazard');
    await npc.say(
        'erm.. yes.. quite right',
        'have you come to laugh at the fight slaves?',
        'i used to really enjoy it',
        'but after a while they become quite boring',
        'now i just want a decent drink',
        "mind you, too much khali brew and i'll fall asleep"
    );
}

async function local(player, npc) {
    const stage = player.questStages.fightArena;

    if (stageAtLeast3(player)) {
        if (wearsKhazardArmour(player)) {
            await player.say('hello');
            await npc.say("please, i haven't done anything");
            await player.say('what?');
            await npc.say('i love General Khazard, please believe me');
        } else {
            await player.say('hello');
            await npc.say('hello stranger', "Khazard's got some great fights lined up this week", "i can't wait");
        }

        return;
    }

    if (stage === 2) {
        await player.say('hello');
        await npc.say('are you enjoying the arena?', 'i heard the servil family are fighting soon', 'should be very entertaining');
        return;
    }

    if (stage === 1) {
        await player.say('hello');
        await npc.say('hello stranger are you new to these parts?');
        await player.say('i suppose i am');
        await npc.say("what's your business?");
        await player.say('just visiting friends in the cells');
        await npc.say(
            "visiting, that's funny",
            'only khazard guards are allowed to see prisoners',
            'so unless you know where to get some khazard armour',
            "you won't be visiting anyone"
        );
        return;
    }

    await player.say('hello');
    await npc.say(
        'hello stranger are you new to these parts?',
        'you look lost',
        "i suppose you're here for the fight arena?",
        'there are some rich folk fighting tomorrow',
        'should be entertaining'
    );
}

async function generalKhazard(player, npc) {
    if (stageAtLeast3(player)) {
        await player.say('i thought i was rid of you');
        await npc.say("you might not believe it young one", "but you can't kill what's already dead", 'die, foul smelling creature');
    } else {
        // unsure if at stage 2 would have had different (Java comment)
        await player.say('hello');
        await npc.say('who dares enter my home?', 'you, a feeble traveller');
        await player.say('..feeble!');
        await npc.say("i'll enjoy spilling your blood", 'face your doom!');
    }

    player.disengage();
    setChasing(npc, player);
}

const TALKERS = {
    [LADY_SERVIL_ID]: ladyServil,
    [LOCAL_ID]: local,
    [GUARD_KHAZARD_BRIBABLE_ID]: bribableGuard,
    [GUARD_KHAZARD_BYPRISONER_ID]: prisonGuard,
    [GUARD_KHAZARD_ID]: guardKhazard,
    [GUARD_KHAZARD_MACE_ID]: maceGuard,
    [JEREMY_SERVIL_ID]: jeremyServil,
    [HENGRAD_ID]: hengrad,
    [GENERAL_KHAZARD_ID]: generalKhazard
};

async function onTalkToNPC(player, npc) {
    const talk = TALKERS[npc.id];

    if (!talk) {
        return false;
    }

    player.engage(npc);
    await talk(player, npc);
    // the handlers that start a fight have disengaged already
    if (player.interlocutor) {
        player.disengage(npc);
    }

    return true;
}

// ---- kills ---------------------------------------------------------------------------------------------------

async function ogreKilled(player) {
    const { world } = player;

    player.cache.killed_ogre = true;
    player.message('You kill the ogre');
    await messages(player, "Jeremy's father survives");

    const justin = nearbyNpc(player, JUSTIN_SERVIL_ID, 15);

    if (justin) {
        await justin.say("You saved my life and my son's", 'I am eternally in your debt brave traveller');
    }

    const general = world.spawnTimedNPC({ id: GENERAL_KHAZARD_ID, x: 613, y: 708, ticks: GENERAL_TICKS });
    await world.sleepTicks(2);

    if (!general) {
        return;
    }

    await general.say(
        'Haha, well done, well done that was rather entertaining',
        "I'm the great General Khazard",
        'And the two men you just saved are my property'
    );
    await player.say('They belong to no one');
    await general.say('I suppose we could find some arrangement', 'for their freedom... hmmmm');
    await player.say('What do you mean?');
    await general.say(
        "I'll let them go but you must stay and fight for me",
        "You'll make me double the gold if you manage to last a few fights",
        'Guards! take him away!'
    );
    player.message("Khazard's men have locked you in a cell");
    player.teleport(609, 715, false);
    world.removeEntity('npcs', general);
}

async function scorpionKilled(player) {
    const { world } = player;

    player.message('You defeat the scorpion');

    const general = world.spawnTimedNPC({ id: GENERAL_KHAZARD_ID, x: 613, y: 708, ticks: GENERAL_TICKS });
    await world.sleepTicks(2);

    if (general) {
        await general.say(
            'Not bad, not bad at all',
            'I think you need a tougher challenge',
            'Time for my puppy',
            'Guards, guards bring on bouncer'
        );
        world.removeEntity('npcs', general);
    }

    await messages(player, 'From above you hear a voice...', 'Ladies and gentlemen!', 'Todays second round');

    const bouncer = world.spawnTimedNPC({ id: BOUNCER_ID, x: 612, y: 708, ticks: ARENA_TICKS });
    player.message('between the Outsider and bouncer');

    if (bouncer) {
        setChasing(bouncer, player);
    }
}

async function bouncerKilled(player) {
    const { world } = player;

    player.message('You defeat bouncer');

    const general = world.spawnTimedNPC({ id: GENERAL_KHAZARD_ID, x: 613, y: 708, ticks: ARENA_TICKS });
    await world.sleepTicks(2);

    if (general) {
        await general.say('nooooo! bouncer, how dare you?', "you've taken the life of my only friend!");
        player.message('Khazard looks very angry');
        await general.say("now you'll suffer traveller, prepare to meet your maker");
        await messages(
            player,
            "No, he doesn't look happy at all",
            'You might want to run for it',
            'Go back to lady servil to claim your reward'
        );
        setChasing(general, player);
    }

    player.questStages.fightArena = 3;
}

const KILLS = {
    [KHAZARD_OGRE_ID]: ogreKilled,
    [KHAZARD_SCORPION_ID]: scorpionKilled,
    [BOUNCER_ID]: bouncerKilled
};

// returns the follow-up's promise so tests can wait on it; the hook itself never blocks the default death
function afterKill(player, npc) {
    const followUp = KILLS[npc.id];

    if (!followUp || (npc.id === BOUNCER_ID && player.questStages.fightArena !== 2)) {
        return null;
    }

    return new Promise((resolve) => {
        player.world.setTickTimeout(() => {
            followUp(player)
                .catch(() => {})
                .then(resolve);
        }, 1);
    });
}

async function onNPCDeath(player, npc) {
    if (!player) {
        return false;
    }

    if (npc.id === GENERAL_KHAZARD_ID) {
        player.message('You kill general khazard');
        player.message('but he shall return');
        return false;
    }

    afterKill(player, npc);

    return false;
}

// ---- objects -------------------------------------------------------------------------------------------------

function isCupboard(gameObject) {
    return (
        (gameObject.id === GUARDS_CUPBOARD_OPEN || gameObject.id === GUARDS_CUPBOARD_CLOSED) &&
        (gameObject.y === 683 || gameObject.y === 1623)
    );
}

function searchCupboard(player) {
    if (
        !player.inventory.has(KHAZARD_CHAINMAIL_ID) &&
        !player.inventory.has(KHAZARD_HELMET_ID) &&
        (player.questStages.fightArena || 0) >= 1
    ) {
        player.message('You search the cupboard...');
        player.message('You find a khazard helmet');
        player.message('You find a khazard chainmail');
        player.inventory.add(KHAZARD_CHAINMAIL_ID);
        player.inventory.add(KHAZARD_HELMET_ID);
    } else {
        player.message('You search the cupboard, but find nothing');
    }
}

async function talkThroughBars(player, npc, said, armoured, plain) {
    if (!npc) {
        return;
    }

    await player.say(said);
    await npc.say(...(wearsKhazardArmour(player) ? armoured : plain));
}

async function slavesCells(player) {
    await talkThroughBars(
        player,
        nearbyNpc(player, FIGHTSLAVE_JOE_ID, 5),
        'are you ok?',
        ['spare me your fake pity', "I spit on Khazard's grave and all who do his bidding"],
        ["you're not safe here traveller", 'leave while you still can']
    );
    await talkThroughBars(
        player,
        nearbyNpc(player, FIGHTSLAVE_KELVIN_ID, 5),
        'hello there',
        ['get away, get away', "one day i'll have my revenge", "and i'll have all your heads!"],
        ["you're a brave man", 'if the guards get you', "you'll be in here next"]
    );
}

async function jeremysCell(player, gate) {
    const { world } = player;

    if ('freed_servil' in player.cache || stageAtLeast3(player)) {
        player.message('You have already freed jeremy');
        return;
    }

    const jeremy = nearbyNpc(player, JEREMY_SERVIL_ID, 5);

    if (!jeremy) {
        return;
    }

    if ('guard_sleeping' in player.cache && player.inventory.has(KHAZARD_CELL_KEYS_ID)) {
        await player.say('Jeremy, look, I have the cell keys');
        await jeremy.say('Wow! Please help me');
        await player.say('ok, keep quiet');
        await jeremy.say('Set me free then we can find dad');
        await messages(player, 'You use your key to open the cell door', 'The gate swings open');
        player.sendSound('opendoor');
        world.replaceTimed('gameObjects', gate, CELL_GATE_OPEN_ID, CELL_GATE_OPEN_TICKS);
        moveNpc(jeremy, 605, 718);
        await player.say('There you go, now we need to find your father');
        await jeremy.say('I overheard a guard talking', "I think they've taken him to the arena");
        await player.say("OK we'd better hurry");
        await jeremy.say(" I'll run ahead");
        // Java servil.remove(): the cell Jeremy goes and comes back on his respawn timer
        world.removeEntity('npcs', jeremy);
        player.cache.freed_servil = true;
        delete player.cache.guard_sleeping;

        const guard = nearbyNpc(player, GUARD_KHAZARD_BYPRISONER_ID, 5);

        if (guard) {
            await guard.say('What are you doing?', "It's an imposter!");
            await world.sleepTicks(2);
            setChasing(guard, player);
        }

        return;
    }

    await jeremy.say("I'm Jeremy Servil", "Please sir, don't hurt me");
    await player.say("I'm here to help", 'Where do they keep the keys?');
    await jeremy.say('The guard keeps them.. always');
    player.questStages.fightArena = 2;
}

// command one: cupboard "open" (381) / "Search" (382), the cell gates' "open"
async function onGameObjectCommandOne(player, gameObject) {
    if (isCupboard(gameObject)) {
        if (gameObject.id === GUARDS_CUPBOARD_CLOSED) {
            player.world.replaceEntity('gameObjects', gameObject, GUARDS_CUPBOARD_OPEN);
            player.message('You open the cupboard');
        } else {
            searchCupboard(player);
        }

        return true;
    }

    if (gameObject.id === CELL_GATE_ID && (gameObject.y === 700 || gameObject.y === 707)) {
        await slavesCells(player);
        return true;
    }

    if (gameObject.id === CELL_GATE_ID && gameObject.y === 716) {
        await jeremysCell(player, gameObject);
        return true;
    }

    return false;
}

// command two: cupboard "close" (382)
async function onGameObjectCommandTwo(player, gameObject) {
    if (!isCupboard(gameObject) || gameObject.id !== GUARDS_CUPBOARD_OPEN) {
        return false;
    }

    player.world.replaceEntity('gameObjects', gameObject, GUARDS_CUPBOARD_CLOSED);
    player.message('You close the cupboard');

    return true;
}

async function onUseWithGameObject(player, gameObject, item) {
    if (gameObject.id !== CELL_GATE_ID || gameObject.y !== 716 || item.id !== KHAZARD_CELL_KEYS_ID) {
        return false;
    }

    player.message('To unlock the gate, left click on it');

    return true;
}

module.exports = {
    onTalkToNPC,
    onNPCDeath,
    onGameObjectCommandOne,
    onGameObjectCommandTwo,
    onUseWithGameObject,
    afterKill
};
