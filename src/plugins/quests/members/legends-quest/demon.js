// Ported from Open-RSC Core-Framework authentic/quests/members/legendsquest/npcs/LegendsQuestNezikchened.java,
// LegendsQuestEchnedZekin.java, LegendsQuestViyeldi.java, LegendsQuestSanTojalon.java, LegendsQuestIrvigSenay.java and
// LegendsQuestRanalphDevere.java (AGPL-3.0): the demon Nezikchened (769) in his three fights, the spirit Echned Zekin (740) whose
// rock dams the pool, Viyeldi's animated clothes (772) and the three dead heroes (663, 761, 762) who hold the crystals. Stage map:
// shared.js.
//
// Nezikchened (and every companion called for a player) is spawned for that player: `npc.spawnedFor`. A death hook the Java
// handles with blockKillNpc removes the npc itself and returns true (no loot); the others return false and the npc dies as usual.
// The JS server has no "escape" event: walk.js calls onNPCEscape when a player runs from a fight.

const {
    ITEM,
    NPC,
    END,
    stageOf,
    cacheHas,
    cacheSet,
    cacheDel,
    cacheInt,
    mes,
    holds,
    give,
    take,
    worn,
    level,
    setLevel,
    hurt,
    random,
    spawnNpc,
    removeNpc,
    changeNpc,
    startFight,
    moveNpc,
    runGraph,
    dropFor,
    insideFlameWall,
    aroundBoulderRock,
    aroundTotemPole
} = require('./shared');

const FIVE_HUNDRED_SECONDS = 500000;

const HEROES = [NPC.SAN_TOJALON, NPC.IRVIG_SENAY, NPC.RANALPH_DEVERE];
// the crystal each hero gives (Java: the piece the player must not already hold)
const HERO_CRYSTAL = {
    [NPC.SAN_TOJALON]: ITEM.A_CHUNK_OF_CRYSTAL,
    [NPC.IRVIG_SENAY]: ITEM.A_LUMP_OF_CRYSTAL,
    [NPC.RANALPH_DEVERE]: ITEM.A_HUNK_OF_CRYSTAL
};
const HERO_ATTACK_LINES = {
    [NPC.SAN_TOJALON]: [
        'You have entered the Viyeldi caves and  your bravery must be tested.',
        'Prepare yourself...San Tojalon will test your mettle.'
    ],
    [NPC.IRVIG_SENAY]: ['Greetings Brave warrior, destiny is upon you...', 'Ready your weapon and defend yourself.'],
    [NPC.RANALPH_DEVERE]: ['Upon my honour, I will defend till the end...', 'May your aim be true and the best of us win...']
};
const HERO_NAME = {
    [NPC.SAN_TOJALON]: 'San Tojalon',
    [NPC.IRVIG_SENAY]: 'Irvig Senay',
    [NPC.RANALPH_DEVERE]: 'Ranalph Devere'
};

function spawnFor(player, id, x, y) {
    const npc = spawnNpc(player, id, x, y, FIVE_HUNDRED_SECONDS);

    if (npc) {
        npc.spawnedFor = player;
    }

    return npc;
}

// a talk or use hook: engaged while it runs, and left to the fight if it starts one
async function withTalk(player, npc, fn) {
    const ctx = { fighting: false };

    player.engage(npc);

    try {
        await fn(ctx);
    } finally {
        if (!ctx.fighting) {
            player.disengage();
        }
    }
}

// Java startCombat inside a dialogue: leave the conversation, then the fight
function fightNow(ctx, player, npc) {
    ctx.fighting = true;
    player.disengage();
    startFight(player, npc);
}

// Java delay(n) after startCombat: the rest of a scene plays while the fight goes on
function later(player, ticks, fn) {
    player.world.setTickTimeout(() => {
        if (player.loggedIn === false) {
            return;
        }

        Promise.resolve(fn()).catch(() => {});
    }, Math.max(1, ticks));
}

// the end of an npc the Java removes with blockKillNpc: gone, the fight over, no loot
function finishKill(player, npc) {
    npc.opponent = null;
    player.world.removeEntity('npcs', npc);

    if (player) {
        if (typeof player.retreat === 'function') {
            player.retreat();
        }

        player.opponent = null;
    }
}

function foreign(player, npc) {
    return Boolean(npc.spawnedFor) && npc.spawnedFor !== player;
}

// ---- Nezikchened ---------------------------------------------------------------------------------------------------------------

// the third fight: LegendsQuestNezikchened.demonFight (also called from the totem pole)
async function demonFight(player) {
    const third = spawnFor(player, NPC.NEZIKCHENED, player.x, player.y);

    if (!third) {
        return;
    }

    await player.world.sleepTicks(1);
    await third.say('Now you try to defile my sanctuary...I will teach thee!');

    const companions = cacheInt(player, 'viyeldi_companions');

    if (cacheHas(player, 'viyeldi_companions') && companions <= 3) {
        await third.say('You will pay for your disrespect by meeting some old friends...');
        await mes(player, 'The Demon starts chanting...', 2);
        await mes(player, '@yel@Nezikchened: Protectors of source, alive in death,', 2);
        await mes(player, '@yel@Nezikchened: do not rest while this Vacu draws breath!', 2);
        removeNpc(player, third);
        await mes(player, "The demon is summoning the dead hero's from the Viyeldi caves !", 2);
        await summonCompanion(player);
    } else if (companions === 4) {
        await mes(player, 'The Demon screams in rage...', 2);
        await third.say('Raarrrrghhhh!', "I'll kill you myself !");
        startFight(player, third);
        player.message('You feel a great sense of loss...');
        setLevel(player, 'prayer', Math.ceil(level(player, 'prayer') / 4));
        await third.say('Your faith will help you little here.');
    } else {
        startFight(player, third);
    }
}

async function summonCompanion(player) {
    const which = cacheInt(player, 'viyeldi_companions');
    const id = { 1: NPC.SAN_TOJALON, 2: NPC.IRVIG_SENAY, 3: NPC.RANALPH_DEVERE, 4: NPC.NEZIKCHENED }[which];

    if (!id) {
        return;
    }

    const companion = spawnFor(player, id, player.x, player.y);

    if (companion) {
        await companion.say('Corrupted are we now that Viyeldi is slain..');
        startFight(player, companion);
        await companion.say('Bent to this demons will and forced to bring you pain...');
    }
}

function demonDeath(player, npc) {
    const stage = stageOf(player);

    if (stage === 3 && insideFlameWall(player)) {
        // first fight
        player.questStages.legendsQuest = 4;
        later(player, 0, async () => {
            await npc.say('Ha ha ha...I shall return for you when the time is right.');
            await mes(player, 'Your opponent is retreating', 1);
            await mes(player, 'The demon starts an incantation...', 2);
            await mes(player, '@yel@Nezikchened : But I will leave you with a taste of my power...', 2);
            await mes(player, 'As he finishes the incantation a powerful bolt of energy strikes you.', 2);
            hurt(player, 7);
            await mes(player, '@yel@Nezikchened : Haha hah ha ha ha ha....', 2);
            await mes(player, 'The demon explodes in a powerful burst of flame that scorches you.', 2);

            const ungadulu = player.getNearbyEntitiesWithinRadius('npcs', NPC.UNGADULU, 8).find((n) => !n.locked);

            if (ungadulu) {
                await onTalkToUngadulu(player, ungadulu);
            }
        });
    } else if (stage === 7 && aroundBoulderRock(player)) {
        // second fight
        player.questStages.legendsQuest = 8;
        later(player, 0, async () => {
            await npc.say('Arrrgghhhhh, foul Vacu!');
            await mes(player, 'Your opponent is retreating', 3);
            await npc.say('You would bite the hand that feeds you!', 'Very well, I will ready myself for our next encounter...');
            await mes(player, 'The Demon seems very angry now...', 2);
            await mes(player, 'You deliver a final devastating blow to the demon, ', 2);
            await mes(player, "and it's unearthly frame crumbles into dust.", 2);
        });
    } else if (stage === 8 && aroundTotemPole(player)) {
        // third fight
        player.questStages.legendsQuest = 9;
        dropFor(player, ITEM.ASHES, player.x, player.y);
        later(player, 0, async () => {
            await mes(player, 'You deliver the final killing blow to the foul demon.', 2);
            await mes(player, 'The Demon crumbles into a pile of ash.', 2);
            await mes(player, '@yel@Nezikchened: Arrrghhhh.', 2);
            await mes(player, '@yel@Nezikchened: I am beaten by a mere mortal.', 2);
            await mes(player, '@yel@Nezikchened: I will revenge myself upon you...', 2);
            await player.say('Yeah, yeah, yeah ! ', 'Heard it all before !');
        });
    }
}

// Ungadulu's talk is in ungadulu.js (required lazily: that file does not need this one)
function onTalkToUngadulu(player, npc) {
    return require('./ungadulu').onTalkToNPC(player, npc);
}

// ---- the heroes ----------------------------------------------------------------------------------------------------------------

function crystalRefusal(player, id) {
    return !holds(player, HERO_CRYSTAL[id]) && !cacheHas(player, 'cavernous_opening');
}

function heroInCompanionFight(player) {
    return stageOf(player) === 8 && cacheHas(player, 'viyeldi_companions');
}

async function heroAttackMessage(player, npc) {
    if (!crystalRefusal(player, npc.id)) {
        return;
    }

    const lines = HERO_ATTACK_LINES[npc.id];

    await npc.say(lines[0]);
    startFight(player, npc);
    await npc.say(lines[1]);
}

async function heroKilled(player, npc) {
    const id = npc.id;

    if (heroInCompanionFight(player)) {
        player.world.removeEntity('npcs', npc);
        npc.opponent = null;

        const next = { [NPC.SAN_TOJALON]: [1, 2], [NPC.IRVIG_SENAY]: [2, 3], [NPC.RANALPH_DEVERE]: [3, 4] }[id];

        if (cacheInt(player, 'viyeldi_companions') === next[0]) {
            cacheSet(player, 'viyeldi_companions', next[1]);
        }

        if (typeof player.retreat === 'function') {
            player.retreat();
        }

        player.opponent = null;
        await mes(player, 'A nerve tingling scream echoes around you as you slay the dead Hero.', 2);
        await mes(player, `@yel@${HERO_NAME[id]}: Ahhhggggh`, 2);
        await mes(
            player,
            id === NPC.SAN_TOJALON || id === NPC.IRVIG_SENAY
                ? `@yel@${HERO_NAME[id]}: Forever must I live in this torment till this beast is slain...`
                : `@yel@${HERO_NAME[id]}:Forever must I live in this torment till this beast is slain...`,
            2
        );
        await player.world.sleepTicks(1);
        await demonFight(player);
        return;
    }

    // the crystal fight: the hero yields a piece of crystal once
    const crystal = HERO_CRYSTAL[id];
    const spoken = (line) => npc.say(line);

    if (holds(player, crystal) || holds(player, ITEM.A_RED_CRYSTAL) || holds(player, ITEM.A_GLOWING_RED_CRYSTAL)) {
        await spoken('A fearsome foe you are, and bettered me once have you done already.');
        player.message('Your opponent is retreating');
        player.world.removeEntity('npcs', npc);
    } else {
        await spoken('You have proved yourself of the honour..');
        player.message('Your opponent is retreating');
        await spoken('');
        player.world.removeEntity('npcs', npc);
        await mes(player, 'A piece of crystal forms in midair and falls to the floor.', 2);
        await mes(player, 'You place the crystal in your inventory.', 2);
        give(player, crystal);
    }
}

async function heroEscaped(player, npc) {
    removeNpc(player, npc);
    await mes(player, 'As you try to make your escape,', 2);
    await mes(player, 'the Viyeldi fighter is recalled by the demon...', 2);
    await mes(player, '@yel@Nezikchened : Ha, ha ha!', 2);
    await mes(player, '@yel@Nezikchened : Run then fetid worm...and never touch my totem again...', 2);
}

// ---- Viyeldi -------------------------------------------------------------------------------------------------------------------

async function viyeldiTalk(player, npc) {
    if (stageOf(player) !== 7) {
        return;
    }

    await mes(player, 'The headless, spirit of Viyeldi animates and walks towards you.', 2);

    if (!cacheHas(player, 'killed_viyeldi')) {
        await mes(player, 'And starts talking to you in a shrill, excited voice...', 2);
        await npc.say(
            'Beware adventurer, lest thee loses they head in search of source.',
            'Bravery has thee been tested and not found wanting..'
        );
        await mes(player, 'The spirit wavers slightly and then stands proud...', 2);
        await npc.say(
            'But perilous danger waits for thee,',
            'Tojalon, Senay and Devere makes three,',
            'None hold malice but will test your might,',
            'Pray that you do not lose this fight,',
            'If however, you win this day,',
            'Take heart that see the source you may,',
            'Through dragons eye will you gain new heart,',
            'To see the source and then depart.'
        );
    } else {
        player.message('Viyeldi falls silent...');
        await player.world.sleepTicks(11);
        player.message('...and the clothes slump to the floor.');
        removeNpc(player, npc);
    }
}

async function attackViyeldi(player, npc) {
    if (!worn(player, ITEM.DARK_DAGGER)) {
        await mes(player, 'Your attack passes straight through Viyeldi.', 2);
        await npc.say(
            'Take challenge with me is useless for I am impervious to your attack',
            'Take your fight to someone else, and maybe then get back on track.'
        );
        return;
    }

    take(player, ITEM.DARK_DAGGER);
    give(player, ITEM.GLOWING_DARK_DAGGER);
    await mes(player, 'You thrust the Dark Dagger at Viyeldi...', 2);
    await npc.say("So, you have fallen for the foul one's trick...");
    await mes(player, 'You hit Viyeldi squarely with the Dagger .', 2);
    await npc.say('AhhhhhhhhHH! The Pain!');
    await mes(player, 'You see a flash as something travels from Viyeldi into the dagger.', 2);
    await mes(player, 'The dagger seems to glow as Viyeldi crumpels to the floor.', 1);
    removeNpc(player, npc);
    cacheSet(player, 'killed_viyeldi');
}

// the blue wizard's hat on the floor (426,3708) is Viyeldi's clothes
async function onGroundItemTake(player, groundItem) {
    if (groundItem.id !== ITEM.A_BLUE_WIZARDS_HAT || groundItem.x !== 426 || groundItem.y !== 3708) {
        return false;
    }

    player.teleport(groundItem.x, groundItem.y);
    await mes(player, "Your hand passes through the hat as if it wasn't there.", 2);

    if (stageOf(player) >= 8 || stageOf(player) === -1) {
        return true;
    }

    player.teleport(groundItem.x, groundItem.y - 1);
    await mes(player, 'Instantly the clothes begin to animate and then walk towards you.', 2);

    let viyeldi = player.getNearbyEntitiesWithinRadius('npcs', NPC.VIYELDI, 3).find((n) => !n.locked);

    if (!viyeldi) {
        viyeldi = spawnNpc(player, NPC.VIYELDI, groundItem.x, groundItem.y, 60000);
    }

    if (viyeldi) {
        await withTalk(player, viyeldi, () => viyeldiTalk(player, viyeldi));
    }

    return true;
}

// ---- Echned Zekin ------------------------------------------------------------------------------------------------------------

async function holyForceSpell(player, npc) {
    await mes(player, 'You thrust the Holy Force spell in front of the spirit.', 3);
    await mes(player, 'A bright, holy light streams out from the paper spell.', 2);

    if (cacheHas(player, 'already_cast_holy_spell')) {
        await npc.say('Argghhhhh...not again....!');
    } else {
        await npc.say('Argghhhhh...noooooo!');
        cacheSet(player, 'already_cast_holy_spell');
    }
}

// neziAttack: Echned drops his shape; with the Holy Force Spell the demon is weakened and the prayer halved
async function neziAttack(ctx, player, npc, useHolySpell) {
    if (cacheHas(player, 'ran_from_2nd_nezi')) {
        await npc.say('You have returned and I am ready for you...');
    }

    await npc.say('I will now reveal myself and spell out your doom.');

    const { x, y } = npc;

    removeNpc(player, npc);

    const second = spawnFor(player, NPC.NEZIKCHENED, x, y);

    if (!second) {
        return;
    }

    if (useHolySpell) {
        await holyForceSpell(player, second);
        await mes(player, 'The spirit lets out an unearthly, blood curdling scream...', 2);
        await mes(player, 'The spell seems to weaken the Demon.', 1);
        second.skills.defense.current -= 5;
    }

    fightNow(ctx, player, second);

    if (useHolySpell) {
        const newPray = Math.ceil(level(player, 'prayer') / 2);

        if (level(player, 'prayer') - newPray < 30) {
            await mes(player, 'A sense of fear comes over you ', 2);
            await mes(player, 'You feel a sense of loss...', 2);
        } else {
            await mes(player, 'An intense sense of fear comes over you ', 2);
            await mes(player, 'You feel a great sense of loss...', 2);
        }

        setLevel(player, 'prayer', newPray);
        await daggerThrow(player);
    } else {
        await mes(player, 'A terrible fear comes over you. ', 2);
        await mes(player, 'You feel a terrible sense of loss...', 2);
        setLevel(player, 'prayer', 0);
    }
}

async function daggerThrow(player) {
    await player.world.sleepTicks(11);
    await mes(player, 'The Demon takes out a dark dagger and throws it at you...', 2);

    if (random(0, 1) === 1) {
        await mes(player, 'The dagger hits you with an agonising blow...', 2);
        hurt(player, 14);
    } else {
        await mes(player, 'But you neatly manage to dodge the attack.', 1);
    }
}

const ECHNED = {
    whatCanIDo: {
        npc: [
            'I was brutally murdered by a viscious man called Viyeldi',
            'I sense his presence near by, but I know that he is no longer living',
            'My spirit burns with the need for revenge, I shall not rest while',
            'I sense his spirit still.',
            'If you seek the pure water, you must ensure he meets his end.',
            'If not, you will never see the source and your journey back must ye start.',
            'What is your answer? Will ye put an end to Viyeldi for me?'
        ],
        menu: [
            ["I'll do what I must to get the water.", 'doWhatIMust'],
            ["No, I won't take someone's life for you.", 'wontTakeLife']
        ]
    },
    whyTortured: {
        npc: [
            'I was robbed of my life by a cruel man called Viyeldi',
            'And I hunger for revenge upon him....',
            'It is long since I have walked this world looking for him',
            'to haunt him and raise terror in his life...',
            'but tragedy of tragedies, his spirit is neither living or dead',
            'he serves the needs of the source.',
            'He died trying to collect the water from this stream,',
            'and now I hang in torment for eternity.'
        ],
        menu: [
            ['What can I do about that?', 'whatCanIDo'],
            [
                "Can't I just get some water?",
                async ({ npc }) => {
                    await npc.say(
                        'Yes, you may get some water, but first you must help me.',
                        'Revenge is the only thing that keeps my spirit in this place',
                        'help me take vengeance on Viyeldi and I will gladly remove',
                        'the rocks and allow you access to the water',
                        'What say you?'
                    );
                    return 'chooseAgain';
                }
            ]
        ]
    },
    chooseAgain: {
        menu: [
            ["I'll do what I must to get the water.", 'doWhatIMust'],
            ["No, I won't take someone's life for you.", 'wontTakeLife']
        ]
    },
    illDoIt: {
        run: async ({ player, npc }) => {
            player.message('The formless shape shimmers brightly...');
            await npc.say('You will benefit from this decision, the source will be', 'opened to you.', 'Bring the dagger back to me when you have completed this task.');
            removeNpc(player, npc);
            return END;
        }
    },
    wontTakeLife: {
        run: async ({ player, npc }) => {
            await npc.say(
                'Such noble thoughts, but Viyeldi is not alive.',
                'He is merely a vessel by which the power of the source ',
                'protects itself. ',
                'If that is your decision, so be it, but expect not to ',
                'gain the water from this stream.'
            );
            removeNpc(player, npc);
            return END;
        }
    },
    doWhatIMust: {
        run: async ({ player, npc }) => {
            await mes(player, 'The shapeless spirit seems to crackle with energy.', 2);
            await npc.say(
                'You would release me from my torment and the source would',
                'be available to you.',
                'However, you must realise that this will be no easy task.'
            );

            if (!holds(player, ITEM.DARK_DAGGER)) {
                await npc.say('I will furnish you with a weapon which will help you', 'to achieve your aims...', 'Here, take this...');
                player.message('The spiritless body waves an arm and in front of you appears');
                player.message('a dark black dagger made of pure obsidian.');
                await npc.say('To complete this task you must use this weapon on Viyeldi.');
                give(player, ITEM.DARK_DAGGER);
                player.message('You take the dagger and place it in your inventory.');
                cacheSet(player, 'met_spirit');
            }

            await npc.say('Use the dagger I have provided for you to complete this task.', 'and then bring it to me when Viyeldi is dead.');
        },
        menu: [
            ["Ok, I'll do it.", 'illDoIt'],
            ["I've changed my mind, I can't do it.", 'changedMind'],
            ["No, I won't take someone's life for you.", 'wontTakeLife']
        ]
    },
    changedMind: {
        run: async ({ player, npc }) => {
            await npc.say('The pure water you seek will forever be out of your reach.');
            await player.say("I'll do what I must to get the water.");
            player.message('The shapeless spirit seems to crackle with energy.');
            await npc.say(
                'You would release me from my torment and the source would',
                'be available to you.',
                'However, you must realise that this will be no easy task.',
                'Use the dagger I have provided for you to complete this task.',
                'and then bring it to me when Viyeldi is dead.'
            );
        },
        menu: [
            ["Ok, I'll do it.", 'illDoIt'],
            ["I've changed my mind, I can't do it.", 'changedMindAgain']
        ]
    },
    changedMindAgain: {
        npc: [
            'The decision is yours but you will have no other way to ',
            'get to the source.',
            'The pure water you seek will forever be out of your reach.'
        ],
        menu: [
            ["I'll do what I must to get the water.", 'doWhatIMust'],
            ["No, I won't take someone's life for you.", 'wontTakeLife']
        ]
    },
    whoToKill: {
        npc: ['Avenge upon me the death of Viyeldi, the cruel.', 'And I will give you access to source...'],
        menu: [
            ["Er I've had second thoughts.", 'secondThoughts'],
            ['I have to be going...', 'goingNow']
        ]
    },
    secondThoughts: {
        npc: ['It is too late for second thoughts...', 'Do as you have agreed and return to me in all haste...', 'His presence tortures me so...'],
        menu: [
            ['Who am I supposed to kill again?', 'whoToKill'],
            ['I have to be going...', 'goingNow']
        ]
    },
    goingNow: {
        run: async ({ player, npc }) => {
            await npc.say('Return swiftly with the weapon as soon as your task is complete.');
            player.message('The spirit slowly fades and then disapears.');
            removeNpc(player, npc);
            return END;
        }
    },
    noDagger: {
        run: async ({ player, npc }) => {
            await mes(player, 'The spirit seems to shake with anger...', 2);
            await npc.say(
                'Bring it to me with all haste.',
                'Or torment and pain will I bring to you...',
                'the spirit extends a wraithlike finger which touches you.',
                'You feel a searing pain jolt through your body...'
            );
            hurt(player, random(8, 15));
        },
        menu: [
            ["I haven't slayed Viyeldi yet.", 'notSlain'],
            ['I have something else in mind!', 'elseInMind'],
            ['I have to be going...', 'goingNow']
        ]
    },
    notSlain: {
        npc: ['Go now and slay him, as you agreed.', 'If you are forfeit on this.', 'And I will take you as a replacement for Viyeldi !'],
        menu: [
            ["I don't have the dagger.", 'noDagger'],
            ['I have something else in mind!', 'elseInMind'],
            ['I have to be going...', 'goingNow']
        ]
    },
    elseInMind: {
        npc: [
            'You worthless Vacu, how dare you seek to trick me.',
            'Go and slay Viyeldi as you promised ',
            'or I will layer upon you all the pain and ',
            "torment I have endured all these long years!"
        ],
        menu: [
            ["I don't have the dagger.", 'noDagger'],
            ["I haven't slayed Viyeldi yet.", 'notSlain'],
            ['I have to be going...', 'goingNow']
        ]
    }
};

async function echnedTalk(player, npc) {
    if (stageOf(player) !== 7) {
        return;
    }

    await withTalk(player, npc, async (ctx) => {
        if (cacheHas(player, 'gave_glowing_dagger')) {
            await neziAttack(ctx, player, npc, holds(player, ITEM.HOLY_FORCE_SPELL));
            return;
        }

        if (holds(player, ITEM.HOLY_FORCE_SPELL)) {
            await npc.say(
                'Something seems different about you...',
                'Your sense of purpose seems not bent to my will...',
                'Give me the dagger that you used to slay Viyeldi or taste my wrath!'
            );
            await runGraph(player, npc, {
                ...ECHNED,
                start: {
                    menu: [
                        ["I don't have the dagger.", 'noDagger'],
                        ["I haven't slayed Viyeldi yet.", 'notSlain'],
                        ['I have something else in mind!', 'elseInMind'],
                        ['I have to be going...', 'goingNow']
                    ]
                }
            }, 'start');
        } else if (holds(player, ITEM.GLOWING_DARK_DAGGER)) {
            await npc.say('Aha, I see you have completed your task. ', "I'll take that dagger from you now.");
            take(player, ITEM.GLOWING_DARK_DAGGER);
            cacheSet(player, 'gave_glowing_dagger');
            await mes(player, 'The formless shape of Echned Zekin takes the dagger from you.', 2);
            await mes(player, 'As a ghostly hand envelopes the dagger, something seems to move', 2);
            await mes(player, 'from the black weapon into the floating figure...', 2);
            await npc.say('Aahhhhhhhhh! As I take the spirit of one departed,', 'I will now reveal myself and spell out your doom.');
            await mes(player, 'A terrible fear comes over you. ', 2);

            const { x, y } = npc;

            removeNpc(player, npc);

            const second = spawnFor(player, NPC.NEZIKCHENED, x, y);

            if (second) {
                await player.world.sleepTicks(1);
                fightNow(ctx, player, second);
                player.message('You feel a terrible sense of loss...');
                setLevel(player, 'prayer', 0);
            }
        } else if (holds(player, ITEM.DARK_DAGGER)) {
            await mes(player, 'The shapeless entity of Echned Zekin appears in front of you.', 3);
            await npc.say('Why do you return when your task is still incomplete?');
            await mes(player, 'There is an undercurrent of anger in his voice.', 3);
            await runGraph(player, npc, {
                ...ECHNED,
                start: {
                    menu: [
                        ['Who am I supposed to kill again?', 'whoToKill'],
                        ["Er I've had second thoughts.", 'secondThoughts'],
                        ['I have to be going...', 'goingNow']
                    ]
                }
            }, 'start');
        } else {
            await mes(player, 'In a rasping, barely audible voice you hear the entity speak.', 2);
            await npc.say('Who disturbs the rocks of Zekin?');
            await mes(player, 'There seems to be something slightly familiar about this presence.', 2);

            const menu = await player.ask(['Er...me?', "Who's asking?"], true);

            if (menu === 0) {
                await npc.say('So, you desire the water that flows here?');

                const opt1 = await player.ask(['Yes, I need it for my quest.', 'Not really, I just wondered if I could push that big rock.'], true);

                if (opt1 === 0) {
                    await npc.say(
                        'The water babbles so loudly and I am already so tortured.',
                        'I cannot abide the sound so I have stoppered the streams...',
                        'Care you not for my torment and pain?'
                    );
                } else {
                    await npc.say(
                        'The rock must remain, it stoppers the waters that babble.',
                        'The noise troubles my soul and I seek some rest...',
                        'rest from this terrible torture...'
                    );
                }

                await runGraph(player, npc, {
                    ...ECHNED,
                    start: { menu: [['Why are you tortured?', 'whyTortured'], ['What can I do about that?', 'whatCanIDo']] }
                }, 'start');
            } else {
                await mes(player, 'The hooded, headless figure faces you...it\'s quite unnerving..', 2);
                await npc.say('I am Echned Zekin...and I seek peace from my eternal torture...');

                const opt3 = await player.ask(['What can I do about that?', 'Do I know you?', 'Why are you tortured?'], true);

                if (opt3 === 0) {
                    await runGraph(player, npc, ECHNED, 'whatCanIDo');
                } else if (opt3 === 1) {
                    await npc.say(
                        'I am long since dead and buried, lost in the passages of time.',
                        'Long since have my kin departed and have I been forgotten...',
                        'It is unlikely that you know me...',
                        'I am a poor tortured soul looking for rest and eternal peace...'
                    );
                    await runGraph(player, npc, {
                        ...ECHNED,
                        start: { menu: [['Why are you tortured?', 'whyTortured'], ['What can I do about that?', 'whatCanIDo']] }
                    }, 'start');
                } else {
                    await runGraph(player, npc, ECHNED, 'whyTortured');
                }
            }
        }
    });
}

// ---- hooks ---------------------------------------------------------------------------------------------------------------------

async function onTalkToNPC(player, npc) {
    if (npc.id === NPC.ECHNED_ZEKIN) {
        await echnedTalk(player, npc);
        return true;
    }

    if (npc.id === NPC.VIYELDI) {
        await withTalk(player, npc, () => viyeldiTalk(player, npc));
        return true;
    }

    return false;
}

function demonBlocked(player, npc) {
    return foreign(player, npc) || ![3, 7, 8].includes(stageOf(player));
}

async function onNPCAttack(player, npc) {
    if (npc.id === NPC.NEZIKCHENED) {
        if (!demonBlocked(player, npc)) {
            return false;
        }

        await mes(player, 'Your attack glides straight through the Demon.', 2);
        await mes(player, "as if it wasn't really there.", 1);
        removeNpc(player, npc);

        return true;
    }

    if (npc.id === NPC.VIYELDI) {
        await attackViyeldi(player, npc);
        return true;
    }

    if (HEROES.includes(npc.id) && crystalRefusal(player, npc.id)) {
        await heroAttackMessage(player, npc);
        return true;
    }

    return false;
}

// a spell or a ranged attack
async function onAttackAtRange(player, npc) {
    if (npc.id === NPC.NEZIKCHENED && foreign(player, npc)) {
        player.message('Your attack passes through');
        removeNpc(player, npc);

        return true;
    }

    if (npc.id === NPC.VIYELDI) {
        await attackViyeldi(player, npc);
        return true;
    }

    if (HEROES.includes(npc.id) && crystalRefusal(player, npc.id)) {
        await heroAttackMessage(player, npc);
        return true;
    }

    return false;
}

async function onNPCRangedAttack(player, npc) {
    return onAttackAtRange(player, npc);
}

async function onCastOnNPC(player, npc) {
    return onAttackAtRange(player, npc);
}

async function onNPCDeath(player, npc) {
    if (!player) {
        return false;
    }

    if (npc.id === NPC.NEZIKCHENED) {
        finishKill(player, npc);
        demonDeath(player, npc);

        return true;
    }

    if (HEROES.includes(npc.id) && (heroInCompanionFight(player) || !cacheHas(player, 'cavernous_opening'))) {
        finishKill(player, npc);
        await heroKilled(player, npc);

        return true;
    }

    return false;
}

async function onNPCEscape(player, npc) {
    if (npc.id === NPC.NEZIKCHENED) {
        const stage = stageOf(player);

        if (stage === 3) {
            await npc.say('Run like the coward you are, I will return stronger than before.');
            moveNpc(npc, 453, 3707);
            await npc.say('Next time we meet, your end will you greet!');
            removeNpc(player, npc);
        } else if (stage === 7) {
            cacheSet(player, 'ran_from_2nd_nezi');
            await npc.say('Run for your life coward...');
            await player.world.sleepTicks(3);
            await npc.say('The next time you come, I will be ready for you!');
            await player.world.sleepTicks(3);
            changeNpc(player, npc, NPC.ECHNED_ZEKIN);
            await player.world.sleepTicks(2);
            const echned = player.getNearbyEntitiesWithinRadius('npcs', NPC.ECHNED_ZEKIN, 5);

            echned.forEach((n) => removeNpc(player, n));
        } else if (stage === 8) {
            await npc.say('Ha, ha ha!', 'Yes, see how fast the little Vacu runs...!', 'Trouble me not, or I will crush you like the worm you are.');
            removeNpc(player, npc);
        } else {
            return false;
        }

        return true;
    }

    if (HEROES.includes(npc.id) && heroInCompanionFight(player)) {
        await heroEscaped(player, npc);
        return true;
    }

    return false;
}

module.exports = {
    onTalkToNPC,
    onGroundItemTake,
    onNPCAttack,
    onNPCRangedAttack,
    onCastOnNPC,
    onNPCDeath,
    onNPCEscape,
    demonFight,
    echnedTalk,
    neziAttack,
    holyForceSpell,
    spawnFor,
    cacheDel
};
