// Ported from Open-RSC Core-Framework authentic/quests/members/grandtree/GrandTree.java (AGPL-3.0): the Karamja
// shipyard south of Brimhaven. The gate (624 at 401,762) and its worker (557), the shipyard workers (558, 559), the
// foreman on the pier (560) and in his hut (561). Stages 8-10: the stage table is in narnode.js.
// Cache flags: gtShipyardQ1, gtShipyardQ2 (Java gt_shipyard_q1/q2) record the first two parts of the password.
// Java drops gt_q1/gt_q2 (the Hazelmere flags) after a right password, a slip that leaves the shipyard flags set; the
// port drops the shipyard flags there, so a later wrong guess cannot ride on an earlier right one.
// The gate is not drawn open (Java doGate swaps in 623 for a moment); the player is moved through as in the Java.

const SHIPYARD_WORKER_ENTRANCE_ID = 557;
const SHIPYARD_WORKER_WHITE_ID = 558;
const SHIPYARD_WORKER_BLACK_ID = 559;
const SHIPYARD_FOREMAN_ID = 560;
const SHIPYARD_FOREMAN_HUT_ID = 561;

const SHIPYARD_GATE_ID = 624;
const SHIPYARD_GATE_Y = 762;

const INVOICE_ID = 922;

function stageOf(player) {
    return player.questStages.grandTree || 0;
}

function setStage(player, stage) {
    player.questStages.grandTree = stage;
}

async function mes(player, line, ticks = 3) {
    player.message(line);
    await player.world.sleepTicks(ticks);
}

// npc.setChasing(player): the npc goes for the player
function attacks(player, npc) {
    player.disengage();
    npc.attack(player).catch(() => {});
}

// npcYell: an overhead shout, not dialogue
function yell(npc, message) {
    if (typeof npc.broadcastChat === 'function') {
        npc.broadcastChat(message);
    }
}

// one of fourteen random exchanges (the white and black workers differ by one word in the last)
const WORKER_TALK = [
    async (p, n) => {
        await n.say('ouch');
        await p.say("what's wrong?");
        await n.say('i cut my finger', 'do you have a bandage?');
        await p.say("i'm afraid not");
        await n.say("that's ok, i'll use my shirt");
    },
    async (p, n) => {
        await p.say('you look busy');
        await n.say('we need double the men to get..', '...this order out on time');
    },
    async (p, n) => {
        await n.say('hello matey');
        await p.say('how are you?');
        await n.say('tired');
        await p.say("you shouldn't work so hard");
    },
    async (p, n) => {
        await p.say('what are you building?');
        await n.say('are you serious?');
        await p.say('of course not', "you're obviously building a boat");
    },
    async (p, n) => {
        await p.say('looks like hard work');
        await n.say('i like to keep busy');
    },
    async (p, n) => {
        await n.say('no time to talk', "we've a fleet to build");
    },
    async (p, n) => {
        await p.say('quite an impressive set up');
        await n.say('it needs to be...', "..there's no other way to build a fleet of this size");
    },
    async (p, n) => {
        await p.say("quite a few ships you're building");
        await n.say('this is just the start', 'the completed fleet will be awesome');
    },
    async (p, n) => {
        await p.say('so where are you sailing?');
        await n.say('what do you mean?');
        await p.say("don't worry, just kidding!");
    },
    async (p, n) => {
        await p.say('how are you?');
        await n.say('too busy to waste time gossiping');
        await p.say('touchy');
    },
    async (p, n) => {
        await n.say('can i help you');
        await p.say("i'm just looking around");
        await n.say("well there's plenty of work to be done", "so if you don't mind...");
        await p.say('of course, sorry to have disturbed you');
    },
    async (p, n) => {
        await n.say('hello there', 'are you too lazy to work as well');
        await p.say('something like that');
        await n.say("i'm just sun bathing");
    },
    async (p, n) => {
        await n.say('hello there');
        await n.say("i haven't seen you before");
        await p.say("i'm new");
        await n.say("well it's hard work, but the pay is good");
    },
    async (p, n) => {
        await n.say('what do you want?');
        await p.say(
            n.id === SHIPYARD_WORKER_BLACK_ID
                ? 'is that anyway to talk to your new superior?'
                : 'is that any way to talk to your new superior?'
        );
        await n.say("oh, i'm sorry, i didn't realise");
    }
];

async function workerDialogue(player, npc) {
    await player.say('hello');
    await WORKER_TALK[Math.floor(Math.random() * WORKER_TALK.length)](player, npc);
}

async function foremanQuiz(player, hutForeman) {
    await hutForeman.say('so tell me again why you\'re here');
    await player.say('erm...glough sent me?');
    await hutForeman.say('ok and how is glough..still with his wife?');

    const wife = await player.ask(
        ["yes, they're both getting on great", 'always arguing as usual', 'his wife is no longer with us'],
        true
    );

    if (wife === 0 || wife === 1) {
        setStage(player, 9);
        await hutForeman.say('really...', "..that's strange, considering she died last year", 'die imposter');
        attacks(player, hutForeman);
        return;
    }

    if (wife !== 2) {
        return;
    }

    await hutForeman.say(
        'right answear, i have to watch out for imposters', // sic
        'if really know glough...',
        'you know his favourite gnome dish'
    );

    const dish = await player.ask(['he loves tangled toads legs', 'he loves worm holes', 'he loves choc bombs'], true);

    if (dish === 0 || dish === 2) {
        setStage(player, 9);
        await hutForeman.say('he hates them', 'die imposter');
        attacks(player, hutForeman);
        return;
    }

    if (dish !== 1) {
        return;
    }

    await hutForeman.say('ok, one more question', "what's the name of his new girlfriend");

    const girlfriend = await player.ask(['Alia', 'Anita', 'Elena'], false);

    if (girlfriend === 0 || girlfriend === 2) {
        setStage(player, 9);
        await player.say(girlfriend === 0 ? 'alia' : 'elena');
        await hutForeman.say('you almost fooled me', 'die imposter');
        attacks(player, hutForeman);
        return;
    }

    if (girlfriend !== 1) {
        return;
    }

    await player.say('anita');
    await hutForeman.say('well, well ,well, you do know glough', "sorry for the interrogation but i'm sure you understand");
    await player.say('of course, security is paramount');
    await hutForeman.say('as you can see the ship builders are ready');
    await player.say('indeed');
    await hutForeman.say(
        'when i was asked to build a fleet large enough...',
        '..to invade port sarim and carry 300 gnome troops...',
        '..i said if anyone can, i can'
    );
    await player.say("that's a lot of troops");
    await hutForeman.say('true but if the gnomes are really going to..', "..take over runescape, they'll need at least that");
    await player.say('take over?');
    await hutForeman.say(
        "of course, why else would glough want 30 battleships",
        "between you and me, i don't think he stands a chance"
    );
    await player.say('no');
    await hutForeman.say(
        "i mean, for the kind of battleships glough's ordered..",
        "..i'll need ton's and ton's of timber",
        'more than any forest i can think of could supply',
        "still, if he say's he can supply the wood i'm sure he can",
        "any way, here's the invoice"
    );
    await player.say('ok, thanks');
    await hutForeman.say('i\'ll need the wood as soon as possible', "if the orders going to be finished in time");
    await player.say("ok i'll tell glough");
    await mes(player, 'the foreman hands you the invoice');
    player.inventory.add(INVOICE_ID);
    setStage(player, 10);
}

async function foremanDialogue(player, npc) {
    const { world } = player;

    if (stageOf(player) >= 10) {
        player.message('the forman is too busy to talk'); // sic
        return;
    }

    await player.say('hello, are you in charge?');
    await npc.say("that's right, and you are?");
    await player.say('glough sent me to check up on things');
    await npc.say('is that right, glough sent a human');
    await player.say('his gnomes were all busy');
    await npc.say('ok, we had better go inside, follow me');

    player.disengage();
    player.teleport(408, 753);
    await world.sleepTicks(2);

    const hutForeman = player.getNearbyEntitiesByID('npcs', SHIPYARD_FOREMAN_HUT_ID, 4)[0];

    if (stageOf(player) === 8) {
        player.message('you follow the foreman into the wooden hut');

        if (hutForeman) {
            await foremanQuiz(player, hutForeman);
        }
    } else if (stageOf(player) === 9 && hutForeman) {
        yell(npc, 'die imposter');
        attacks(player, hutForeman);
    }
}

async function hutForemanDialogue(player, npc) {
    if (stageOf(player) === 10) {
        player.message('the forman is too busy to talk');
        return;
    }

    yell(npc, 'die imposter');
    attacks(player, npc);
}

const DIALOGUES = {
    [SHIPYARD_WORKER_WHITE_ID]: workerDialogue,
    [SHIPYARD_WORKER_BLACK_ID]: workerDialogue,
    [SHIPYARD_FOREMAN_ID]: foremanDialogue,
    [SHIPYARD_FOREMAN_HUT_ID]: hutForemanDialogue
};

async function onTalkToNPC(player, npc) {
    const dialogue = DIALOGUES[npc.id];

    if (!dialogue) {
        return false;
    }

    player.engage(npc);
    await dialogue(player, npc);

    // a dialogue that ends in a fight has already let go (the fight holds the player now)
    if (player.interlocutor) {
        player.disengage();
    }

    return true;
}

async function wrongPassword(player, worker) {
    await worker.say('you have no idea');
    attacks(player, worker);
    delete player.cache.gtShipyardQ1;
    delete player.cache.gtShipyardQ2;
}

async function password(player, worker) {
    const first = await player.ask(['Ka', 'ko', 'ke'], true);

    if (first === 0) {
        player.cache.gtShipyardQ1 = true;
    }

    const second = await player.ask(['lo', 'lu', 'le'], true);

    if (second === 1 && player.cache.gtShipyardQ1) {
        player.cache.gtShipyardQ2 = true;
    }

    const third = await player.ask(['mon', 'min', 'men'], true);

    if (third !== 1) {
        await wrongPassword(player, worker);
        return;
    }

    if (!player.cache.gtShipyardQ1 || !player.cache.gtShipyardQ2) {
        // Java: nothing happens
        return;
    }

    delete player.cache.gtShipyardQ1;
    delete player.cache.gtShipyardQ2;

    await player.say('ka lu min');
    await worker.say("i'm sorry to have kept you", 'but obviously high security is essential');
    player.teleport(402, 760);
    player.message('the worker opens the gate');
    player.message('you walk through');
    await worker.say("you'll need to speak to the foreman", "he's on the pier, it'll give you a chance..", '...to see the fleet');
}

async function gateWorker(player, worker) {
    await worker.say('hey you, what are you up to?');
    await player.say("i'm trying to open the gate");
    await worker.say('i can see that, but why?');

    const options = ["i've come to check that you're working safley"]; // sic

    if (stageOf(player) === 8) {
        options.push('glough sent me');
    }

    options.push('i just fancied looking around');

    const choice = options[await player.ask(options, true)];

    if (choice === "i've come to check that you're working safley") {
        await worker.say('what business is that of yours?');
        await player.say('as a runescape resident i have a right to know');
        await worker.say('get out of here before you get a beating');
        await player.say("that's not very friendly");
        await worker.say("right, i'll show you friendly");
        attacks(player, worker);
    } else if (choice === 'glough sent me') {
        await worker.say('hmm, really, what for?');
        await player.say('your wasting my time, take me to your superior'); // sic
        await worker.say('ok, i can let you in but i need the password');
        await password(player, worker);
    } else if (choice === 'i just fancied looking around') {
        await worker.say("this isn't a museum", 'leave now');
        await player.say("i'll leave when i choose");
        await worker.say("we'll see");
        attacks(player, worker);
    }
}

async function onGameObjectCommandOne(player, gameObject) {
    if (gameObject.id !== SHIPYARD_GATE_ID) {
        return false;
    }

    if (player.y < SHIPYARD_GATE_Y) {
        // from inside the yard the gate just opens
        player.message('you open the gate');
        player.message('and walk through');
        player.teleport(401, 763);
        return true;
    }

    const stage = stageOf(player);

    await mes(player, 'the gate is locked');

    if (stage < 8 || stage > 9) {
        return true;
    }

    const worker = player.getNearbyEntitiesByID('npcs', SHIPYARD_WORKER_ENTRANCE_ID, 5)[0];

    if (!worker) {
        return true;
    }

    player.engage(worker);
    await gateWorker(player, worker);

    // a dialogue that ends in a fight has already let go (the fight holds the player now)
    if (player.interlocutor) {
        player.disengage();
    }

    return true;
}

// the foreman in the hut is not to be fought once he has handed over the invoice
async function onNPCAttack(player, npc) {
    if (npc.id !== SHIPYARD_FOREMAN_HUT_ID || stageOf(player) !== 10) {
        return false;
    }

    player.message('the forman is too busy to talk');
    return true;
}

// never claims: the foreman dies like any npc; at stage 9 his pocket holds the invoice
async function onNPCDeath(player, npc) {
    if (npc.id !== SHIPYARD_FOREMAN_HUT_ID || !player || !player.questStages || stageOf(player) !== 9) {
        return false;
    }

    // the invoice and the stage first: the body is cleared while the messages play
    player.inventory.add(INVOICE_ID);
    setStage(player, 10);

    (async () => {
        await mes(player, 'you kill the foreman');
        await mes(player, 'inside his pocket you find an invoice..');
        await mes(player, 'it seems to be an order for timber');
    })().catch(() => {});

    return false;
}

module.exports = { onTalkToNPC, onGameObjectCommandOne, onNPCAttack, onNPCDeath };
