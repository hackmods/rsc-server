// Ported from Open-RSC Core-Framework authentic/quests/members/legendsquest/mechanism/LegendsQuestInvAction.java,
// LegendsQuestHolyWater.java, LegendsQuestMapJungle.java, LegendsQuestBullRoarer.java and LegendsQuestOnDrop.java (AGPL-3.0): the
// quest's items: the notes and tomes, the Book of Binding, the seeds and the blessed bowl, holy water, the Radimus scrolls and map,
// the bull roarer, the Holy Force Spell, the Gujuo potion and what happens when a bowl or a crystal is dropped. Stage map: shared.js.

const {
    ITEM,
    NPC,
    TICK_MS,
    stageOf,
    cacheHas,
    cacheSet,
    cacheDel,
    cacheInt,
    mes,
    holds,
    give,
    take,
    takeAll,
    worn,
    level,
    setLevel,
    random,
    nextInt,
    nearNpc,
    spawnNpc,
    moveNpc,
    removeNpc,
    changeNpc,
    inKharaziJungle,
    sendBox,
    dropFor,
    startFight
} = require('./shared');
const { echnedTalk, spawnFor, holyForceSpell } = require('./demon');

const HOLY_WATER_TICKS = Math.ceil(300000 / TICK_MS);

// ---- the commands of the items -----------------------------------------------------------------------------------------------------

const NOTES = {
    [ITEM.SCRIBBLED_NOTES]:
        'Daily notes of Ungadulu...% % Day 1...% % I have prepared the incantations and will invoke the spirits of my ancestors and pay them hommage. Though I feel a strange presence in these caves, it is with the heart of the lion that I fight my fears and mark the magical pentagram. % % Day 2... % % What have I done? My spirit is overthrown by a feeling of fear and evil, I am not myself these days and feel helpless and weak. % % From my teachings...                                                               ',
    [ITEM.SCRAWLED_NOTES]:
        'I fear that the spirit of an ancient one resides within me and uses me...I am too weak to cast the curse myself and fight the beast within.% % Day 3....% %...my last hope is that someone will read this and aid me...I am undone and I fear....',
    [ITEM.SCATCHED_NOTES]:
        'Day 4 ...% % These days come so fleetingly, I have no idea how long I have been here now...% % Day 5... % %A wizened charm will release me, but never magic that would would harm...'
};

const BINDING_PAGES = [
    ['Arcana...', 'You read the section entitled Arcana...', 'Arcana...% % Use holy water to determine possesion, slight changes in appearance may be percieved when doused.% % Legendary Silverlight will help to defeat any demon by weakening it.% % Be wary of any demon, it may have special forms of attack. % % Use an Octagram shape to confine unearthly creatures of the underworld - the perfect geometry confuses them.'],
    ['Instructo...', 'You read the section entitled Instructo...', 'Instructo...% % To make Holy water enchant small vials to contain the magic water.% % See later chapters for enchantment. Place sacred water into vial and equip as any other missile.'],
    ['Defeati...', 'You read the section entitled Defeati...', 'Defeati...% %. Hold the book of binding open to the possesed letting the goodlight fall on them completely. Be prepared for as soon as the beast is released it will strike and strike hard.']
];

async function drinkGujuoPotion(player) {
    player.message('Are you sure you want to drink this?');

    if ((await player.ask(["Yes, I'm sure...", "No, I've had second thoughts..."])) === 1) {
        player.message('You decide against drinking the potion...');
        return;
    }

    take(player, ITEM.GUJUO_POTION);
    player.message('You drink the potion...');
    give(player, ITEM.EMPTY_VIAL);
    cacheSet(player, 'gujuo_potion');
    await player.say('Mmmm.....');
    await player.world.sleepTicks(2);
    player.message('It tastes sort of strange...like fried oranges...');
    await player.say('.....!.....');
    await player.world.sleepTicks(2);
    player.message('You feel somehow different...');
    await player.world.sleepTicks(2);
    await player.say("Let's just hope that this isn't a placibo!");
}

async function useHolyForceSpell(player) {
    const echned = nearNpc(player, NPC.ECHNED_ZEKIN, 5);

    if (!echned || stageOf(player) !== 7) {
        await mes(player, 'There is no suitable candidate to cast this spell on.', 1);
        return;
    }

    await mes(player, 'You thrust the Holy Force spell in front of the spirit.', 3);
    await mes(player, 'A bright, holy light streams out from the paper spell.', 2);

    if (cacheHas(player, 'already_cast_holy_spell')) {
        await echned.say('Argghhhhh...not again....!');
    } else {
        await echned.say('Argghhhhh...noooooo!');
        cacheSet(player, 'already_cast_holy_spell');
    }

    await mes(player, 'The spirit lets out an unearthly, blood curdling scream...', 2);

    const { x, y } = echned;

    removeNpc(player, echned);

    const second = spawnFor(player, NPC.NEZIKCHENED, x, y);

    if (!second) {
        return;
    }

    await mes(player, 'The spell seems to weaken the Demon.', 1);
    second.skills.defense.current -= 5;

    if (cacheHas(player, 'ran_from_2nd_nezi')) {
        await second.say('So you have returned and I am prepared for you now!');
    } else {
        await second.say('Now I am revealed to you Vacu, so shall ye perish.');
    }

    startFight(player, second);

    const newPray = Math.ceil(level(player, 'prayer') / 2);

    if (level(player, 'prayer') - newPray < 30) {
        await mes(player, 'A sense of fear comes over you ', 2);
        await mes(player, 'You feel a sense of loss...', 2);
    } else {
        await mes(player, 'An intense sense of fear comes over you ', 2);
        await mes(player, 'You feel a great sense of loss...', 2);
    }

    setLevel(player, 'prayer', newPray);

    if (cacheHas(player, 'ran_from_2nd_nezi')) {
        await player.world.sleepTicks(11);
        await mes(player, 'The Demon takes out a dark dagger and throws it at you...', 2);

        if (random(0, 1) === 1) {
            await mes(player, 'The dagger hits you with an agonising blow...', 2);
            player.damage(14);
        } else {
            await mes(player, 'But you neatly manage to dodge the attack.', 1);
        }
    }
}

async function readBindingBook(player) {
    player.message('You read the Book of Binding...');

    const page = await player.ask(['Arcana..', 'Instructo...', 'Defeati...', 'Enchanto...']);

    if (page < 3) {
        await mes(player, BINDING_PAGES[page][1], 2);
        sendBox(player, BINDING_PAGES[page][2]);
        return;
    }

    await mes(player, 'You read the section entitled Enchanto...', 2);
    await mes(player, 'This looks like an enchantment, it requires some magic and prayer to cast.', 2);
    player.message('Would you like to try and cast this enchantment?');
    // authentic: it did not matter which option was chosen
    await player.ask(["Yes, I'll try.", "No, I don't think I'll bother."]);

    if (level(player, 'prayer') < 10) {
        player.message('You need at least ten prayer points to cast this spell.');
        return;
    }

    if (level(player, 'magic') < 10) {
        player.message('You need at least ten magic points to cast this spell.');
        return;
    }

    if (holds(player, ITEM.EMPTY_VIAL)) {
        await mes(player, 'The spell is cast perfectly..', 3);
        await mes(player, 'You enchant one of the empty vials.', 3);
        take(player, ITEM.EMPTY_VIAL);
        give(player, ITEM.ENCHANTED_VIAL);
    } else {
        player.message('This spell looks as if it needs some other components.');
    }
}

// throwing an equipped vial of holy water at Ungadulu
async function throwHolyWater(player, item) {
    if (!worn(player, ITEM.HOLY_WATER_VIAL)) {
        player.message('You need to equip this item to throw it.');
        return;
    }

    let ungadulu = nearNpc(player, NPC.UNGADULU, 4);

    if (!ungadulu || stageOf(player) > 3) {
        player.message('You see no one suitable to throw it at.');
        return;
    }

    player.message('You throw the holy watervial at Ungadulu.');
    take(player, item.id);

    if (typeof player.sendSound === 'function') {
        player.sendSound('projectile');
    }

    // rethrowing holy water resets the timer; five minutes of holy water effect at most
    const { world } = player;

    if (player.holyWaterTimeout) {
        world.clearTickTimeout(player.holyWaterTimeout);
    }

    cacheSet(player, 'holy_water_neiz');
    player.holyWaterTimeout = world.setTickTimeout(() => {
        cacheDel(player, 'holy_water_neiz');
        player.holyWaterTimeout = null;
    }, HOLY_WATER_TICKS);

    ungadulu = changeNpc(player, ungadulu, NPC.EVIL_UNGADULU);
    await ungadulu.say('Vile serpent...you will pay for that...');
    ungadulu = changeNpc(player, ungadulu, NPC.UNGADULU);
    await ungadulu.say('What...what happened...why am I all wet?');
}

async function onInventoryCommand(player, item) {
    const id = item.id;

    if (id === ITEM.GUJUO_POTION) {
        await drinkGujuoPotion(player);
    } else if (id === ITEM.GILDED_TOTEM_POLE) {
        await mes(player, 'This totem pole is utterly awe inspiring.', 2);
        await mes(player, 'Perhaps you should show it to Radimus Erkle...', 2);
    } else if (id === ITEM.HOLY_FORCE_SPELL) {
        await useHolyForceSpell(player);
    } else if (id === ITEM.A_RED_CRYSTAL) {
        await mes(player, 'As the crystal touches your hands a voice inside of your head says..', 2);
        await mes(player, '@gre@Voice in head: Bring life to the dragons eye.', 2);
    } else if (id === ITEM.GERMINATED_YOMMI_TREE_SEED) {
        await mes(player, 'These seeds have been germinated in pure water...', 2);
        player.message('They can be planted in fertile soil now...');
    } else if (id === ITEM.YOMMI_TREE_SEED) {
        player.message('These seeds need to be germinated in pure water...');
    } else if (id === ITEM.BOOKING_OF_BINDING) {
        await readBindingBook(player);
    } else if (NOTES[id]) {
        player.message('You try your best to decode the writing, this is what you make out.');
        sendBox(player, NOTES[id]);
    } else if (id === ITEM.ROUGH_SKETCH_OF_A_BOWL) {
        await mes(player, 'You look at the rough sketch that Gujuo gave you.', 2);
        player.message('It looks like a picture of a bowl...');
    } else if (id === ITEM.SHAMANS_TOME) {
        await mes(player, 'You read the ancient shamans tome.', 2);
        await mes(player, 'It is written in a strange sort of language but you manage a rough translation.', 6);
        sendBox(
            player,
            '% % ...scattered are my hopes that I will ever be released from this flaming Octagram, it is the only thing which will contain this beast within.% %Although it\'s grip over me is weakened with magic, it is hopeless to know if a saviour would guess this. % % I am doomed...'
        );
    } else if (id === ITEM.HOLY_WATER_VIAL) {
        await throwHolyWater(player, item);
    } else if (id === ITEM.RADIMUS_SCROLLS_COMPLETE || id === ITEM.RADIMUS_SCROLLS) {
        await radimusScrolls(player, item);
    } else if (id === ITEM.BULL_ROARER) {
        await swingBullRoarer(player);
    } else {
        return false;
    }

    return true;
}

// ---- items used on items -----------------------------------------------------------------------------------------------------------

const pair = (a, b, x, y) => (a === x && b === y) || (a === y && b === x);

async function onUseWithInventory(player, item, target) {
    const a = item.id;
    const b = target.id;

    if (pair(a, b, ITEM.YOMMI_TREE_SEED, ITEM.BLESSED_GOLDEN_BOWL_WITH_PURE_WATER)) {
        const seeds = player.inventory.count(ITEM.YOMMI_TREE_SEED);

        for (let i = 0; i < seeds; i += 1) {
            take(player, ITEM.YOMMI_TREE_SEED);
            give(player, ITEM.GERMINATED_YOMMI_TREE_SEED);
        }

        player.message('You place the seeds in the pure sacred water...');
        take(player, ITEM.BLESSED_GOLDEN_BOWL_WITH_PURE_WATER);
        give(player, ITEM.BLESSED_GOLDEN_BOWL);
        await mes(player, 'The pure water in the golden bowl has run out...', 2);
        player.message('You start to see little shoots growing on the seeds.');

        if (stageOf(player) === 4) {
            player.questStages.legendsQuest = 5;
        }

        return true;
    }

    const enchanted = pair(a, b, ITEM.BLESSED_GOLDEN_BOWL_WITH_PURE_WATER, ITEM.ENCHANTED_VIAL);
    const plain = pair(a, b, ITEM.BLESSED_GOLDEN_BOWL_WITH_PURE_WATER, ITEM.EMPTY_VIAL);

    if (enchanted || plain) {
        if (enchanted) {
            await mes(player, 'You pour some of the sacred water into the enchanted vial.', 1);
            await mes(player, 'You now have a vial of holy water.', 1);
            take(player, ITEM.ENCHANTED_VIAL);
            give(player, ITEM.HOLY_WATER_VIAL);
        } else {
            await mes(player, 'You pour some of the water into the empty vial', 1);
            await mes(player, 'The water seems to loose some of it\'s effervescence.', 1);
            take(player, ITEM.EMPTY_VIAL);
            give(player, ITEM.VIAL);
        }

        // simple random for the moment: the bowl holds 1 to 15 pourings
        if (!cacheHas(player, 'remaining_blessed_bowl')) {
            cacheSet(player, 'remaining_blessed_bowl', random(1, 15));
        } else {
            const remain = cacheInt(player, 'remaining_blessed_bowl');

            if (remain > 1) {
                cacheSet(player, 'remaining_blessed_bowl', remain - 1);
            } else {
                player.message('The pure water in the golden bowl has run out...');
                take(player, ITEM.BLESSED_GOLDEN_BOWL_WITH_PURE_WATER);
                give(player, ITEM.BLESSED_GOLDEN_BOWL);
                cacheDel(player, 'remaining_blessed_bowl');
            }
        }

        return true;
    }

    return false;
}

// ---- the Radimus scrolls: mapping the jungle ------------------------------------------------------------------------------------------

function missionBriefing(player) {
    sendBox(
        player,
        '* Legends Guild Quest * % % % %' +
            '1 : Map the Kharazi Jungle (Southern end of Karamja), there are three main areas that need to be mapped.% %' +
            '2 : Try to meet up with the local friendly natives, some are not so friendly so be careful.% %' +
            '3 : See if you can get a trophy or native jungle item from the natives to display in the Legends Guild. You may be given a task or test to earn this.% % %' +
            '* Note - You may need to get help from other people near the jungle, for example, the local woodsmen may have some knowledge of the Jungle area.'
    );
}

const JUNGLE_AREAS = [
    ['JUNGLE_WEST', (p) => p.x >= 432 && p.x <= 477 && p.y >= 872 && p.y <= 909],
    ['JUNGLE_MIDDLE', (p) => p.x >= 384 && p.x <= 431 && p.y >= 874 && p.y <= 909],
    ['JUNGLE_EAST', (p) => p.x >= 338 && p.x <= 383 && p.y >= 875 && p.y <= 909]
];

function currentArea(player) {
    const found = JUNGLE_AREAS.find(([, inside]) => inside(player));

    return found && found[0];
}

async function checkMapComplete(player) {
    await mes(player, cacheHas(player, 'JUNGLE_EAST') ? '@gre@Eastern area of the Kharazi Jungle - *** Completed ***' : '@red@You have yet to map the eastern part of the Kharazi Jungle', 2);
    await mes(player, cacheHas(player, 'JUNGLE_MIDDLE') ? '@gre@Middle area of the Kharazi Jungle- *** Completed ***' : '@red@You have yet to map the mid - part of the Kharazi Jungle.', 2);
    await mes(player, cacheHas(player, 'JUNGLE_WEST') ? '@gre@Western part of the Kharazi Jungle- *** Completed ***' : '@red@You have yet to map the Western part of the Kharazi Jungle.', 2);
}

async function mapArea(player, area) {
    const roll = random(0, 100);

    if (roll <= 29) {
        take(player, ITEM.PAPYRUS);
        await mes(player, 'You neatly add a new section to your map.', 2);
        cacheSet(player, area);

        if (cacheHas(player, 'JUNGLE_EAST') && cacheHas(player, 'JUNGLE_MIDDLE') && cacheHas(player, 'JUNGLE_WEST')) {
            await mes(player, 'Well done !', 2);
            await mes(player, 'You have completed mapping the Kharazai jungle on the southern end of Karamja,', 2);
            await mes(player, 'Grand Vizier Erkle will be pleased.', 3);
            take(player, ITEM.RADIMUS_SCROLLS);
            give(player, ITEM.RADIMUS_SCROLLS_COMPLETE);
            await checkMapComplete(player);
            cacheDel(player, 'JUNGLE_EAST');
            cacheDel(player, 'JUNGLE_MIDDLE');
            cacheDel(player, 'JUNGLE_WEST');
        } else {
            await mes(player, 'You still have some sections of the map to complete.', 3);
            await checkMapComplete(player);
        }
    } else if (roll <= 50) {
        player.message('You fall over, landing on your charcoal and papyrus, destroying them both.');
        take(player, ITEM.PAPYRUS);
        take(player, ITEM.A_LUMP_OF_CHARCOAL);
    } else if (roll <= 70) {
        player.message('You make a mess of the map, the paper is totally ruined.');
        take(player, ITEM.PAPYRUS);
    } else if (roll <= 90) {
        player.message('You snap your stick of charcoal.');
        take(player, ITEM.A_LUMP_OF_CHARCOAL);
    } else {
        player.message('You make a mess of the map, but are able to rescue the paper.');
    }
}

async function radimusScrolls(player, item) {
    if (item.id === ITEM.RADIMUS_SCROLLS_COMPLETE) {
        player.message('The map of Kharazi Jungle is complete, Sir Radimus will be pleased.');

        if ((await player.ask(['Read Mission Briefing', 'Close'])) === 0) {
            missionBriefing(player);
        } else {
            player.message('You put the scrolls away.');
        }

        return;
    }

    player.message('You open and start to read the scrolls that Radimus gave you.');

    if ((await player.ask(['Read Mission Briefing', 'Start Mapping Kharazi Jungle.'])) === 0) {
        missionBriefing(player);
        return;
    }

    const area = currentArea(player);

    if (!area) {
        if (random(0, 1) === 0) {
            await mes(player, "You're not even in the Kharazi Jungle yet.", 2);
            await mes(player, 'You need to get to the Southern end of Karamja ', 2);
            await mes(player, 'before you can start mapping.', 2);
        } else {
            await mes(player, 'You prepare to start mapping this area...', 3);
            await mes(player, "This doesn't look like the Kharazi Jungle! ", 2);
            await mes(player, 'You need to go to the very southern end of the Island of Karamja !', 2);
        }

        return;
    }

    await mes(player, 'You prepare to start mapping this area...', 3);

    if (cacheHas(player, area)) {
        await mes(player, 'You have already completed this part of the map.', 2);
        await checkMapComplete(player);
        return;
    }

    const papyrus = holds(player, ITEM.PAPYRUS);
    const charcoal = holds(player, ITEM.A_LUMP_OF_CHARCOAL);
    let canMap = true;

    if (!papyrus && !charcoal) {
        await mes(player, "You'll need some papyrus and charcoal to complete this map.", 2);
        canMap = false;
    } else if (papyrus && !charcoal) {
        await mes(player, "You'll need some charcoal to complete this map.", 2);
        canMap = false;
    } else if (!papyrus && charcoal) {
        await mes(player, "You'll need some additional Papyrus to complete this map.", 2);
        canMap = false;
    }

    // potentially this check was done earlier?
    if (level(player, 'crafting') < 50) {
        player.message('You need a crafting level of 50 to perform this task.');
        return;
    }

    if (canMap) {
        await mapArea(player, area);
    }
}

// ---- the bull roarer -------------------------------------------------------------------------------------------------------------------

async function swingBullRoarer(player) {
    await mes(player, 'You start to swing the bullroarer above your head.', 2);
    await mes(player, 'You feel a bit silly at first, but soon it makes an interesting sound.', 2);

    if (!inKharaziJungle(player)) {
        await mes(player, 'Nothing much seems to happen though.', 2);

        const forester = nearNpc(player, NPC.JUNGLE_FORESTER, 10);

        if (forester) {
            await forester.say('You might like to use that when you get into the ', 'Kharazi jungle, it might attract more natives...');
        }

        return;
    }

    await mes(player, 'You see some movement in the trees...', 2);
    await attractNatives(player);
}

async function attractNatives(player) {
    const roll = nextInt(4);

    if (roll === 0) {
        await mes(player, '...but nothing else much seems to happen.', 2);
    } else if (roll <= 2) {
        await mes(player, '...and a tall, dark, charismatic looking native approaches you.', 2);

        let gujuo = nearNpc(player, NPC.GUJUO, 15);

        if (!gujuo) {
            gujuo = spawnNpc(player, NPC.GUJUO, player.x, player.y, 0);
            delayedRemoveGujuo(player, gujuo);
        }

        if (gujuo) {
            moveNpc(gujuo, player.x, player.y);
            player.engage(gujuo);

            try {
                await require('./gujuo').gujuoTalk(player, gujuo);
            } finally {
                player.disengage();
            }
        }
    } else {
        const wanted = [NPC.OOMLIE_BIRD, NPC.KARAMJA_WOLF, NPC.JUNGLE_SPIDER, NPC.JUNGLE_SAVAGE];
        const natives = wanted.map((id) => nearNpc(player, id, 5)).filter(Boolean);

        if (natives.length) {
            const native = natives[0];
            const name = native.definition.name;

            await mes(player, `...and a nearby ${name.includes('bird') ? name : `Kharazi ${name.toLowerCase()}`} takes a sudden dislike to you.`, 2);
            await mes(player, 'And attacks...', 1);
            startFight(player, native);
        } else {
            await attractNatives(player);
        }
    }
}

// Gujuo called by the roarer leaves after 150 seconds, or as soon as the player leaves the jungle
function delayedRemoveGujuo(player, npc) {
    const { world } = player;
    const check = async () => {
        if (player.loggedIn === false || !world.npcs.getByIndex || !world.npcs.getByIndex(npc.index)) {
            removeNpc(player, npc);
            return;
        }

        if (!inKharaziJungle(player)) {
            removeNpc(player, npc);
            return;
        }

        const lines = [
            'I am tired Bwana, I must go and rest...',
            'I must visit my people now...',
            'I must go and hunt now Bwana..',
            'I have to collect herbs now Bwana...'
        ];

        await npc.say(lines[nextInt(4)]);
        world.setTickTimeout(() => {
            if (player.loggedIn !== false) {
                player.message('Gujuo disapears into the Kharazi jungle as swiftly as he appeared...');
            }

            removeNpc(player, npc);
        }, 3);
    };

    world.setTickTimeout(() => {
        check().catch(() => {});
    }, Math.ceil(150000 / TICK_MS));
}

// ---- dropping --------------------------------------------------------------------------------------------------------------------------

async function onDropItem(player, item) {
    const id = item.id;

    if (id === ITEM.BLESSED_GOLDEN_BOWL_WITH_PURE_WATER || id === ITEM.BLESSED_GOLDEN_BOWL_WITH_PLAIN_WATER) {
        take(player, id);
        player.message('You drop the bowl on the floor and the water spills out everywhere.');
        dropFor(player, ITEM.BLESSED_GOLDEN_BOWL, player.x, player.y);
        return true;
    }

    if (id === ITEM.GOLDEN_BOWL_WITH_PURE_WATER || id === ITEM.GOLDEN_BOWL_WITH_PLAIN_WATER) {
        take(player, id);
        player.message('You drop the bowl on the floor and the water spills out everywhere.');
        dropFor(player, ITEM.GOLDEN_BOWL, player.x, player.y);
        return true;
    }

    if ([ITEM.A_CHUNK_OF_CRYSTAL, ITEM.A_LUMP_OF_CRYSTAL, ITEM.A_HUNK_OF_CRYSTAL, ITEM.A_RED_CRYSTAL, ITEM.A_GLOWING_RED_CRYSTAL].includes(id)) {
        take(player, id);
        return true;
    }

    return false;
}

module.exports = { onInventoryCommand, onUseWithInventory, onDropItem, radimusScrolls, swingBullRoarer, takeAll, echnedTalk, holyForceSpell };
