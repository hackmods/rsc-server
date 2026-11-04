// Ported from Open-RSC Core-Framework authentic/minigames/mage_arena/MageArena.java and the god-spell rules of
// server/src/com/openrsc/server/net/rsc/handlers/SpellHandler.java (handleMobCast: the arena casts counter and the
// 100-cast rule; the maged_kolodion flag) (AGPL-3.0)
//
// The Mage Arena (members, deep Wilderness, Point.inMageArena 217,119 - 239,141). Progress is player.cache.mageArena:
//   (unset) Kolodion (712, his cave 446,3371) explains the arena; magic 60 to be let in
//   1       the duel started: Kolodion teleports you in (229,130), attack and strength drop to 0 and he fights you in
//           five forms (713 human, 757 ogre, 759 spider, 758 souless, 760 demon), each spawned for you alone; the form
//           reached is cache.kolodionStage, so a lost duel resumes there
//   2       won: Kolodion's pool (1155, object-tele-points.js) takes you to the chamber of the god stones
//   3       a sacred cape: chanting at a god stone (1152 Saradomin, 1153 Guthix, 1154 Zamorak) gives its cape (the
//           Chamber Guardian's first talk also moves 2 -> 3)
//   4       a god staff: the Chamber Guardian (npcs/wilderness/chamber-guardian.js) hands out the matching staff, then
//           sells more; the arena barrier (1027) now lets you in, unarmed
// Rules ported with it:
//   - no weapons or armour into the arena (cantGo: staves, capes and necklaces, low magic/prayer gear and very basic
//     armour are allowed; Combat Odyssey's potion ban is a custom config and is not ported);
//   - one sacred cape at a time (a second cape cannot be picked up; the stones give none while you own one, banked too);
//   - the god spells (33 Claws of Guthix, 34 Saradomin strike, 35 Flames of Zamorak) count casts in the arena
//     (cache "<spell name>_casts", the Java's key) and work outside it only after 100 (Charge reads the same counters in
//     packet-handlers/magic.js);
//   - Kolodion's forms belong to the player they were spawned for ("that mage is busy."), and the battle mages
//     (789-791) refuse you until Kolodion is beaten;
//   - Kolodion strikes with god spells between melee rounds (1 in 100 a tick, or right after you cast at him); inside
//     the arena at stage 4 the battle mages answer a spell with their god's spell.
// Not ported: the god spells' stat drain and visual object on the victim when the player casts them (spell effects are
// packet-handlers/magic.js's), and the minigame-complete broadcast (no minigame log here).

const GameObject = require('../../model/game-object');
const items = require('@2003scape/rsc-data/config/items');
const wieldables = require('@2003scape/rsc-data/wieldable');

const KOLODION_ID = 712;
const KOLODION_HUMAN_ID = 713;
const KOLODION_OGRE_ID = 757;
const KOLODION_SPIDER_ID = 758;
const KOLODION_SOULESS_ID = 759;
const KOLODION_DEMON_ID = 760;
const KOLODION_FORMS = [KOLODION_HUMAN_ID, KOLODION_OGRE_ID, KOLODION_SPIDER_ID, KOLODION_SOULESS_ID, KOLODION_DEMON_ID];

const BATTLE_MAGE_GUTHIX_ID = 789;
const BATTLE_MAGE_ZAMORAK_ID = 790;
const BATTLE_MAGE_SARADOMIN_ID = 791;
const BATTLE_MAGES = [BATTLE_MAGE_GUTHIX_ID, BATTLE_MAGE_ZAMORAK_ID, BATTLE_MAGE_SARADOMIN_ID];

const GATE_IDS = [1019, 1020];
const BARRIER_ID = 1027;
const SARADOMIN_STONE_ID = 1152;
const GUTHIX_STONE_ID = 1153;
const ZAMORAK_STONE_ID = 1154;

const ZAMORAK_CAPE_ID = 1213;
const SARADOMIN_CAPE_ID = 1214;
const GUTHIX_CAPE_ID = 1215;
const CAPE_IDS = [ZAMORAK_CAPE_ID, SARADOMIN_CAPE_ID, GUTHIX_CAPE_ID];

// staff, magic staff, the four elemental staves and the three god staves
const STAVES = new Set([100, 198, 101, 102, 103, 197, 1218, 1216, 1217]);
const ICE_GLOVES_ID = 556;

// god spell ids (rsc-data config/spells) and the visual object each leaves on its target
const CLAWS_OF_GUTHIX = 33;
const SARADOMIN_STRIKE = 34;
const FLAMES_OF_ZAMORAK = 35;
const GOD_SPELLS = new Set([CLAWS_OF_GUTHIX, SARADOMIN_STRIKE, FLAMES_OF_ZAMORAK]);
const SPELL_OBJECTS = { [CLAWS_OF_GUTHIX]: 1142, [SARADOMIN_STRIKE]: 1031, [FLAMES_OF_ZAMORAK]: 1036 };
const SPELL_OBJECT_TICKS = 2;
const CASTS_REQUIRED = 100;

const ARENA = { minX: 217, minY: 119, maxX: 239, maxY: 141 };
const ARENA_START = [229, 130];
const KOLODION_SPAWN = [227, 130];
const KOLODION_CAVE = [446, 3370];
const BARRIER_OUTSIDE = [228, 118];
const BARRIER_INSIDE = [228, 120];

// addnpc(..., 516 s): 806 ticks of 640 ms
const KOLODION_TICKS = Math.round(516000 / 640);
// Mob.withinRange(entity): VIEW_DISTANCE * 8 - 1 = 15 tiles (withinRange here takes twice the tiles)
const KOLODION_LEASH = 30;
const MAGIC_LEVEL = 60;

function random(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
}

function inMageArena({ x, y }) {
    return x >= ARENA.minX && x <= ARENA.maxX && y >= ARENA.minY && y <= ARENA.maxY;
}

function stage(player) {
    return player.cache.mageArena;
}

async function mes(player, ...steps) {
    for (const step of steps) {
        if (typeof step === 'number') {
            await player.world.sleepTicks(step);
        } else {
            player.message(step);
        }
    }
}

// MageArena.isNotAllowed: weapons and armour stay out of the arena
function isNotAllowed(item) {
    const definition = items[item.id];
    const wieldable = wieldables[item.id];

    if (!definition || !definition.equip || !wieldable) {
        return false;
    }

    const equip = definition.equip || [];

    // anything in the necklace and cape slots
    if (equip.includes('chest') || equip.includes('cape')) {
        return false;
    }

    if (STAVES.has(item.id)) {
        return false;
    }

    if (equip.includes('right-hand') || equip.includes('left-hand') || equip.includes('2-handed')) {
        return true;
    }

    // ItemDefinition.getMeleeBonus is armour + aim + aim (sic)
    const melee = wieldable.armour + wieldable.weaponAim * 2;
    const magic = wieldable.magic;
    const prayer = wieldable.prayer;

    // low-tier magic or prayer gear with a low melee bonus
    if (((magic > 0 && magic <= 10) || (prayer > 0 && prayer <= 10)) && melee <= 5) {
        return false;
    }

    // very basic armour (leather boots and gloves), and ice gloves
    if ((wieldable.armour <= 2 && wieldable.weaponPower === 0 && wieldable.weaponAim === 0) || item.id === ICE_GLOVES_ID) {
        return false;
    }

    return true;
}

// the inventory holds the worn items too
function cantGo(player) {
    return player.inventory.items.some((item) => isNotAllowed(item));
}

async function cantGoMessage(player) {
    await mes(player, 'You cannot enter the arena...', 3, '...while carrying weapons or armour', 3);
}

function alreadyHasCape(player) {
    return CAPE_IDS.some((id) => player.inventory.has(id) || (player.bank && player.bank.has(id)));
}

function zeroMelee(player) {
    player.skills.attack.current = 0;
    player.skills.strength.current = 0;
    player.sendStats();
}

// a god spell's object on a tile for two ticks (MageArena.godSpellObject)
function godSpellObject(world, { x, y }, spellID) {
    const effect = new GameObject(world, { id: SPELL_OBJECTS[spellID], direction: 0, x, y });

    world.addEntity('gameObjects', effect);

    world.setTickTimeout(() => {
        if (world.gameObjects.getByIndex(effect.index) === effect) {
            world.removeEntity('gameObjects', effect);
        }
    }, SPELL_OBJECT_TICKS);
}

function isKolodionForm(npc) {
    return KOLODION_FORMS.includes(npc.id);
}

function busyForm(player, npc) {
    return isKolodionForm(npc) && npc.spawnedFor && npc.spawnedFor !== player;
}

// ---- Kolodion's duel ------------------------------------------------------------------------------------------

// how hard a Kolodion god spell hits (MageArena.startKolodionEvent): grows with the form and the player's hits
function kolodionDamage(currentHits, maxHits, transformStage) {
    const reciprocalSlope = Math.floor(1 / (0.06 - (0.01 / 48) * maxHits));
    const shiftPerPhase = Math.round((0.004 * maxHits + 0.4) * reciprocalSlope);

    return Math.ceil(Math.max(currentHits + (transformStage - 1) * shiftPerPhase, 0) / reciprocalSlope) + 1;
}

function transformStageOf(npc) {
    switch (npc.id) {
        case KOLODION_SPIDER_ID:
            return 1;
        case KOLODION_SOULESS_ID:
            return 2;
        case KOLODION_DEMON_ID:
            return 3;
        default:
            return 0;
    }
}

// one tick of the Kolodion event; false stops it
async function kolodionStep(player) {
    const { world } = player;
    const npc = player.spawnedKolodion;

    if (!npc) {
        return false;
    }

    if (!player.loggedIn) {
        world.removeEntity('npcs', npc);
        return false;
    }

    if (!world.npcs.getByIndex || world.npcs.getByIndex(npc.index) !== npc) {
        return false;
    }

    // the player left the arena
    if (!npc.withinRange(player, KOLODION_LEASH)) {
        world.removeEntity('npcs', npc);
        return false;
    }

    if (player.opponent || !npc.withinRange(player, 16)) {
        return true;
    }

    const maged = !!player.magedKolodion;

    if (random(1, 100) !== 1 && !maged) {
        return true;
    }

    if (maged && random(0, 1) === 1) {
        player.message(random(0, 1) ? '@yel@kolodion: die you foolish mortal' : '@yel@kolodion: the bigger the better');
        player.magedKolodion = false;
        return true;
    }

    const transformStage = transformStageOf(npc);
    const spellType = random(0, transformStage >= 2 ? 2 : 1);
    const spellID = [CLAWS_OF_GUTHIX, SARADOMIN_STRIKE, FLAMES_OF_ZAMORAK][spellType];

    godSpellObject(world, player, spellID);

    const messages = [
        ['@yel@kolodion: roooaar', 'claws grab you from below'],
        ['@yel@kolodion: aaarrgghhh', '@yel@kolodion: feel the power of the elements', 'you are hit by a lightning bolt'],
        ['@yel@kolodion: feel the power of the elements mortal', 'you burst into flames']
    ];

    if (transformStage === 3 && spellType === 2 && random(0, 1)) {
        messages[2] = ['@yel@kolodion: burn fool ....burn', 'you burst into flames'];
    }

    player.magedKolodion = false;

    for (const message of messages[spellType]) {
        player.message(message);
        await world.sleepTicks(2);
    }

    await world.sleepTicks(3);

    if (player.loggedIn && player.skills.hits.current > 0) {
        player.damage(kolodionDamage(player.skills.hits.current, player.skills.hits.base, transformStage));
    }

    return true;
}

function startEvent(player, key, step, ticks) {
    const { world } = player;

    if (player[key]) {
        return;
    }

    player[key] = true;

    const run = async () => {
        let keep = false;

        try {
            keep = await step(player);
        } finally {
            if (keep) {
                world.setTickTimeout(run, ticks);
            } else {
                player[key] = false;
            }
        }
    };

    world.setTickTimeout(run, ticks);
}

function spawnKolodion(player, id, isContinue = false) {
    const { world } = player;
    const [x, y] = KOLODION_SPAWN;
    const npc = world.spawnTimedNPC({ id, x, y, ticks: KOLODION_TICKS });

    npc.spawnedFor = player;
    player.spawnedKolodion = npc;

    if (!isContinue) {
        player.cache.kolodionStage = id;
        player.message(
            `kolodion blasts you ${id === KOLODION_HUMAN_ID || id === KOLODION_OGRE_ID ? 'with his staff' : 'again'}`
        );
        player.damage(random(7, 15));
        player.sendTeleportBubble(player.x, player.y, 'telegrab');
    }

    startEvent(player, 'kolodionEventRunning', kolodionStep, 1);

    return npc;
}

async function enterDuel(player, formID, isContinue) {
    player.disengage();
    player.teleport(...ARENA_START);
    await player.world.sleepTicks(1);
    zeroMelee(player);
    spawnKolodion(player, formID, isContinue);
}

// ---- the battle mages answer (MageArena.learnSpellEvent) --------------------------------------------------------

async function battleMageStep(player) {
    const { world } = player;

    if (!player.loggedIn || !inMageArena(player)) {
        return false;
    }

    if (player.opponent || !player.magedKolodion) {
        return true;
    }

    if (random(0, 1) === 1) {
        player.magedKolodion = false;
        return true;
    }

    if (player.skills.attack.current > 0 || player.skills.strength.current > 0) {
        zeroMelee(player);
    }

    player.magedKolodion = false;

    const near = (id) =>
        world.npcs.getInArea(player.x, player.y, 4).find((npc) => npc.id === id && npc.withinRange(player, 2));

    const answers = [
        [BATTLE_MAGE_GUTHIX_ID, CLAWS_OF_GUTHIX, '@yel@guthix mage: feel the wrath of guthix'],
        [BATTLE_MAGE_ZAMORAK_ID, FLAMES_OF_ZAMORAK, '@yel@zamorak mage: feel the wrath of zamarok'],
        [BATTLE_MAGE_SARADOMIN_ID, SARADOMIN_STRIKE, '@yel@Saradomin mage: feel the wrath of Saradomin']
    ];

    for (const [mageID, spellID, message] of answers) {
        if (near(mageID)) {
            godSpellObject(world, player, spellID);
            player.message(message);

            const hits = player.skills.hits.current;
            player.damage(hits < 20 ? 2 : Math.ceil(hits * 0.08));
            break;
        }
    }

    return true;
}

// ---- Kolodion -----------------------------------------------------------------------------------------------

async function joinFight(player, npc) {
    await npc.say(
        'good..good, you have a healthy sense of competition',
        'remember traveller in my arena hand to hand combat is useless',
        'your strength will diminish as you enter the arena',
        'but the spells you can learn are amongst the most powerful in runescape',
        'before i can accept you in, we must duel',
        'you may not take armour or weapons into the arena'
    );

    if (cantGo(player)) {
        await cantGoMessage(player);
        return;
    }

    const choice = await player.ask(["ok let's fight", 'no thanks'], true);

    if (choice !== 0) {
        if (choice === 1) {
            await npc.say('your loss');
        }

        return;
    }

    await npc.say('I must check that you\'re up to scratch');
    await player.say("you don't need to worry about that");
    await npc.say(
        'not just any magician can enter traveller',
        'only the most powerful, the most feared',
        'before you use the power of this arena',
        'you must prove yourself against me',
        'now!'
    );

    if (typeof stage(player) === 'undefined') {
        player.cache.mageArena = 1;
    }

    // first time
    await enterDuel(player, KOLODION_HUMAN_ID, false);
}

async function yesOrNo(player, npc) {
    const choice = await player.ask(['yes indeedy', "no, i don't"], true);

    if (choice === 0) {
        await joinFight(player, npc);
    } else if (choice === 1) {
        await npc.say('your loss');
    }
}

async function canIFight(player, npc) {
    await npc.say(
        'my arena is open to any high level wizard',
        'but this is no game traveller, wizards fall in this arena..',
        '..never to rise again, the strongest of mage\'s have been destroyed',
        "but if you're sure you want in?"
    );
    await yesOrNo(player, npc);
}

async function barbaric(player, npc) {
    await npc.say("nope, it's magic, but I know what you mean", 'so do you want to join us?');
    await yesOrNo(player, npc);
}

async function whatsThePoint(player, npc) {
    await npc.say(
        'we learn how to use our magic to it fullest...',
        '..,how to channel forces of the cosmos into our world..',
        '..,but mainly I just like blasting people into dust'
    );

    const choice = await player.ask(['can i fight here?', "that's barbaric"], true);

    if (choice === 0) {
        await canIFight(player, npc);
    } else if (choice === 1) {
        await barbaric(player, npc);
    }
}

async function howAmIDoing(player, npc) {
    const report = [
        ['Saradomin strike_casts', 'strike'],
        ['Claws of Guthix_casts', 'claw'],
        ['Flames of Zamorak_casts', 'flame']
    ];

    for (const [key, name] of report) {
        if ((player.cache[key] || 0) >= CASTS_REQUIRED) {
            await npc.say(`you're fully trained to use the ${name} spell anywhere`);
        } else {
            await npc.say(
                `you still need to train with the ${name} spell...`,
                '...inside the arena before you can use it outside'
            );
        }
    }
}

async function talkToKolodion(player, npc) {
    const progress = stage(player);

    if (player.skills.magic.base < MAGIC_LEVEL) {
        await player.say('hello there', 'what is this place?');
        await npc.say(
            'do not waste my time with trivial questions!',
            'i am the great kolodion, master of battle magic',
            'i have an arena to run'
        );
        await player.say('can i enter?');
        await npc.say("hah, a wizard of your level..don't be absurd");
    } else if (progress === 1) {
        // started but failed
        await player.say('hi');
        await npc.say(
            'you return young conjurer..',
            '..you obviously have a taste for the darkside of magic',
            'let us continue with the battle...now'
        );

        if (cantGo(player)) {
            await cantGoMessage(player);
            return;
        }

        await enterDuel(player, player.cache.kolodionStage || KOLODION_HUMAN_ID, true);
    } else if (progress === 2) {
        await player.say('hello kolodion');
        await npc.say("hello  young mage.. you're a tough one you");
        await player.say('what now?');
        await npc.say(
            'step into the magic pool, it will take you to the chamber',
            "there you must decide which god you'll represent in the arena"
        );
        await player.say('ok .. thanks kolodion');
        await npc.say("that's what i'm here for");
    } else if (progress >= 3) {
        await player.say('hello kolodion');
        await npc.say('hey there, how are you?, enjoying the bloodshed?');
        await player.say("it's not bad, i've seen worse");

        const choice = await player.ask(
            ["i think i've had enough for now", 'how can i use my new spells outside of the arena?'],
            true
        );

        if (choice === 0) {
            await npc.say("shame , you're a good battle mage", 'hope to see you soon');
        } else if (choice === 1) {
            await npc.say(
                'experience my friend, experience',
                "once you've used the spell enough times in the arena...",
                "...you'll be able to use them in the rest of runescape"
            );
            await player.say('good stuff');
            await npc.say("not so good for the citizens, they won't stand a chance");
            await player.say('how am i doing so far?');
            await howAmIDoing(player, npc);
        }
    } else {
        await player.say('hello there', 'what is this place?');
        await npc.say(
            'i am the great kolodion, master of battle magic ...',
            '... and this is my battle arena',
            'top wizards travel from all over to fight here'
        );

        const choice = await player.ask(['can i fight here?', "what's the point of that?", "that's barbaric"], true);

        if (choice === 0) {
            await canIFight(player, npc);
        } else if (choice === 1) {
            await whatsThePoint(player, npc);
        } else if (choice === 2) {
            await barbaric(player, npc);
        }
    }
}

async function onTalkToNPC(player, npc) {
    if (npc.id !== KOLODION_ID) {
        return false;
    }

    player.engage(npc);

    try {
        await talkToKolodion(player, npc);
    } finally {
        player.disengage();
    }

    return true;
}

// the five forms: each death spawns the next; the demon's ends the duel (MageArena.onKillNpc)
const TRANSFORMS = {
    [KOLODION_HUMAN_ID]: [
        KOLODION_OGRE_ID,
        ['kolodion slumps to the floor..', '..his body begins to grow and he changes form', 'He becomes an intimidating ogre']
    ],
    [KOLODION_OGRE_ID]: [
        KOLODION_SPIDER_ID,
        [
            'kolodion slumps to the floor once more..',
            '..but again his body begins to grow and he changes form',
            'He becomes an enormous spider'
        ]
    ],
    [KOLODION_SPIDER_ID]: [
        KOLODION_SOULESS_ID,
        [
            'kolodion again slumps to the floor..',
            '..but again his body begins to grow as he changes form',
            'He becomes an ethereal being'
        ]
    ],
    [KOLODION_SOULESS_ID]: [
        KOLODION_DEMON_ID,
        [
            'kolodion again slumps to the floor..motionless',
            '..but again his body begins to grow as he changes form',
            '...larger this time',
            'He becomes a vicious demon'
        ]
    ]
};

async function wonDuel(player) {
    const { world } = player;

    await mes(
        player,
        'kolodion again slumps to the floor..motionless',
        3,
        '..he slowly rises to his feet in his true form',
        3,
        '@yel@Kolodion: "well done young adventurer"',
        3,
        '@yel@Kolodion: "you truly are a worthy battle mage"',
        3
    );

    player.message('kolodion teleports you to his cave');
    player.teleport(...KOLODION_CAVE);

    const kolodion = world.npcs.getInArea(player.x, player.y, 16).find((npc) => npc.id === KOLODION_ID);

    if (!kolodion || kolodion.interlocutor) {
        player.message('kolodion is currently busy');
    } else {
        player.engage(kolodion);

        try {
            await player.say('what now kolodion? how can i learn some of those spells?');
            await kolodion.say(
                'these spells are gifts from the gods',
                'first you must choose which god...',
                '...you will represent in the mage arena'
            );
            await player.say('cool');
            await kolodion.say('step into the magic pool, it will carry you to the chamber');
            await player.say('the chamber?');
            await kolodion.say('there you must decide your loyalty');
            await player.say('ok kolodion , thanks for the battle');
            await kolodion.say(
                'remember young mage, you must use the spells...',
                '...many times in the arena before you can use them outside'
            );
            await player.say('no problem');
        } finally {
            player.disengage();
        }
    }

    player.cache.mageArena = 2;
    delete player.cache.kolodionStage;
}

async function onNPCDeath(player, npc) {
    if (!isKolodionForm(npc)) {
        return false;
    }

    const { world } = npc;

    world.removeEntity('npcs', npc);
    npc.opponent = null;

    // the owner wins the duel even when someone else landed the last hit
    const duelist = npc.spawnedFor || player;

    if (player) {
        player.retreat();
        player.opponent = null;
    }

    if (!duelist || !duelist.loggedIn) {
        return true;
    }

    if (duelist.spawnedKolodion === npc) {
        duelist.spawnedKolodion = null;
    }

    const next = TRANSFORMS[npc.id];

    if (next) {
        const [formID, lines] = next;

        for (const line of lines) {
            duelist.message(line);
            await world.sleepTicks(3);
        }

        if (duelist.loggedIn) {
            spawnKolodion(duelist, formID);
        }
    } else {
        await wonDuel(duelist);
    }

    return true;
}

// ---- the arena's objects -----------------------------------------------------------------------------------------

async function chant(player, god, capeID) {
    const progress = stage(player);

    if (progress >= 3) {
        await mes(player, `you kneel and chant to ${god}`, 3);

        if (!alreadyHasCape(player)) {
            await mes(player, 'you feel a rush of energy charge through your veins', 3, '...and a cape appears before you', 3);
            player.inventory.add(capeID);
        } else {
            await mes(player, 'but there is no response', 3);
        }
    } else if (progress === 2) {
        // first time
        await mes(player, `you kneel and begin to chant to ${god}`, 3, 'you feel a rush of energy charge through your veins', 3);
        player.sendTeleportBubble(player.x, player.y, 'telegrab');
        player.inventory.add(capeID);
        player.cache.mageArena = 3;
    }
}

async function onGameObjectCommandOne(player, gameObject) {
    const { id } = gameObject;

    if (GATE_IDS.includes(id)) {
        player.message('you open the gate ...', '... and walk through');
        await player.enterGate(gameObject);

        if (stage(player) === 4) {
            startEvent(player, 'battleMageEventRunning', battleMageStep, 3);
        }

        return true;
    }

    if (id === BARRIER_ID) {
        if (player.y >= 120) {
            player.message('you pass through the mystical barrier');
            player.teleport(...BARRIER_OUTSIDE);

            if (player.spawnedKolodion) {
                player.world.removeEntity('npcs', player.spawnedKolodion);
                player.spawnedKolodion = null;
            }
        } else if (stage(player) >= 4) {
            await mes(player, 'the barrier is checking your person for weapons', 3);

            if (!cantGo(player)) {
                player.teleport(...BARRIER_INSIDE);
            } else {
                await cantGoMessage(player);
            }
        } else {
            player.message('you cannot enter without the permission of kolodion');
        }

        return true;
    }

    if (id === SARADOMIN_STONE_ID) {
        await chant(player, 'saradomin', SARADOMIN_CAPE_ID);
        return true;
    }

    if (id === GUTHIX_STONE_ID) {
        await chant(player, 'guthix', GUTHIX_CAPE_ID);
        return true;
    }

    if (id === ZAMORAK_STONE_ID) {
        await chant(player, 'zamorak', ZAMORAK_CAPE_ID);
        return true;
    }

    return false;
}

async function onGroundItemTake(player, groundItem) {
    if (!CAPE_IDS.includes(groundItem.id) || !alreadyHasCape(player)) {
        return false;
    }

    player.message('you may only possess one sacred cape at a time');
    return true;
}

// ---- spells and attacks ----------------------------------------------------------------------------------------

async function onCastOnNPC(player, npc, spell, id) {
    if (busyForm(player, npc)) {
        player.message('that mage is busy.');
        return true;
    }

    if (BATTLE_MAGES.includes(npc.id) && !((stage(player) || 0) >= 2)) {
        player.message('you are not yet ready to fight the battle mages');
        return true;
    }

    if (GOD_SPELLS.has(id)) {
        const key = `${spell.name}_casts`;
        const casts = player.cache[key];

        if (!inMageArena(player)) {
            if (!(casts >= CASTS_REQUIRED)) {
                player.message(
                    'this spell can only be used in the mage arena',
                    `You must learn this spell first, you need ${
                        typeof casts === 'number' ? CASTS_REQUIRED - casts : CASTS_REQUIRED
                    } more casts in the mage arena`
                );
                return true;
            }
        } else if (typeof casts === 'number') {
            player.cache[key] = casts + 1;

            if (casts === CASTS_REQUIRED - 1) {
                player.message(`Well done .. you can now use the ${spell.name} outside the arena`);
            }
        } else {
            player.cache[key] = 1;
        }
    }

    if ((isKolodionForm(npc) || BATTLE_MAGES.includes(npc.id)) && inMageArena(player)) {
        player.magedKolodion = true;
    }

    return false;
}

async function onNPCAttack(player, npc) {
    if (busyForm(player, npc)) {
        player.message('that mage is busy.');
        return true;
    }

    if (BATTLE_MAGES.includes(npc.id) && !((stage(player) || 0) > 2)) {
        player.message('you are not yet ready to fight the battle mages');
        return true;
    }

    return false;
}

async function onPlayerDeath(player) {
    if (player.spawnedKolodion) {
        player.spawnedKolodion = null;
    }

    return false;
}

module.exports = {
    onTalkToNPC,
    onNPCDeath,
    onGameObjectCommandOne,
    onGroundItemTake,
    onCastOnNPC,
    onNPCAttack,
    onPlayerDeath,
    // tests
    cantGo,
    isNotAllowed,
    inMageArena,
    kolodionDamage,
    kolodionStep,
    battleMageStep,
    spawnKolodion,
    KOLODION_FORMS,
    KOLODION_TICKS
};
