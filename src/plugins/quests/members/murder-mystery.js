// Ported from Open-RSC Core-Framework authentic/quests/members/MurderMystery.java (AGPL-3.0)
//
// Stages (player.questStages.murderMystery): 0 not started, 1 investigating, -1 complete.
// Cache keys (all stored as true):
//   murder_david|anna|carol|bob|frank|eliz  who the murderer is, picked when the quest starts
//   thread        the window thread was taken (the murderer's trouser colour clears the servants)
//   poison_opt    the poison salesman named the six buyers
//   poison_opt2   a suspect gave a poison alibi; the matching object can now be investigated
//   p_<name>      the murderer (only) gave an alibi at their object; p_<name>2 means it was proven false
//                 (p_anna, p_bob, p_carol, p_david, p_eliza, p_frank and the same with a 2 suffix)
//   evidence      a false poison alibi was proven (set with p_<name>2)
//   culprit        the murderer's fingerprint was matched to the dagger's print
// The guard accepts any of thread / evidence / culprit; all three finish the quest.
//
// Differences from Java: player.completeQuest prints the completion message before the quest point message (Java prints
// the quest points first); mes(x) + delay(3) is player.message(x) then sleepTicks(3).

const GUARD_ID = 747;
const POISON_SALESMAN_ID = 763;
const DAVID_ID = 754;
const ANNA_ID = 751;
const FRANK_ID = 756;
const BOB_ID = 752;
const ELIZABETH_ID = 755;
const CAROL_ID = 753;
const HOBBES_ID = 743;
const LOUISA_ID = 744;
const STANFORD_ID = 746;
const PIERRE_ID = 742;
const DONOVAN_ID = 741;
const MARY_ID = 745;
const MAN_ID = 750;

const COINS_ID = 10;
const POT_ID = 135;
const POT_OF_FLOUR_ID = 136;
const THREAD_RED_ID = 1200;
const THREAD_GREEN_ID = 1201;
const THREAD_BLUE_ID = 1202;
const FLYPAPER_ID = 1203;
const MURDER_SCENE_POT_ID = 1204;
const A_SILVER_DAGGER_ID = 1205;
const MURDERERS_FINGERPRINT_ID = 1206;
const UNIDENTIFIED_FINGERPRINT_ID = 1223;
const A_SILVER_DAGGER_FLOUR_ID = 1230;

const WINDOW_ID = 205;
const FLOUR_BARREL_ID = 1138;
const SACKS_ID = 1139;

const THREADS = [THREAD_GREEN_ID, THREAD_BLUE_ID, THREAD_RED_ID];

// the six family members: cache keys, trouser thread, pronouns and the evidence lines
const FAMILY = {
    david: {
        name: 'David',
        murder: 'murder_david',
        p: 'p_david',
        p2: 'p_david2',
        thread: THREAD_GREEN_ID,
        poss: 'his',
        obj: 'him',
        place: 'the spiders nest',
        evidence: 'you tell the guard about the spiders nest'
    },
    anna: {
        name: 'Anna',
        murder: 'murder_anna',
        p: 'p_anna',
        p2: 'p_anna2',
        thread: THREAD_GREEN_ID,
        poss: 'her',
        obj: 'her',
        place: 'the compost heap',
        evidence: 'you tell the guard about the compost heap'
    },
    carol: {
        name: 'Carol',
        murder: 'murder_carol',
        p: 'p_carol',
        p2: 'p_carol2',
        thread: THREAD_RED_ID,
        poss: 'her',
        obj: 'her',
        place: 'the drain',
        evidence: 'you tell the guard about the drain'
    },
    bob: {
        name: 'Bob',
        murder: 'murder_bob',
        p: 'p_bob',
        p2: 'p_bob2',
        thread: THREAD_RED_ID,
        poss: 'his',
        obj: 'him',
        place: 'the beehive',
        evidence: 'you tell the guard about the beehive'
    },
    frank: {
        name: 'Frank',
        murder: 'murder_frank',
        p: 'p_frank',
        p2: 'p_frank2',
        thread: THREAD_BLUE_ID,
        poss: 'his',
        obj: 'him',
        place: 'the Sinclair Crest',
        evidence: 'you tell the guard about the tarnished family crest'
    },
    eliz: {
        name: 'Elizabeth',
        murder: 'murder_eliz',
        p: 'p_eliza',
        p2: 'p_eliza2',
        thread: THREAD_BLUE_ID,
        poss: 'her',
        obj: 'her',
        place: 'the fountain',
        evidence: 'you tell the guard about the mosquitos at the fountain'
    }
};

// the order the Java checks the murder_* keys in, per use
const MURDER_ORDER = ['david', 'anna', 'carol', 'bob', 'frank', 'eliz'];
const RANDOM_MURDERER = MURDER_ORDER; // DataConversions.random(1, 6) picks index - 1
const EVIDENCE_ORDER = ['anna', 'carol', 'eliz', 'bob', 'frank', 'david'];
const FINGERPRINT_ORDER = ['david', 'bob', 'anna', 'eliz', 'frank', 'carol'];

const SILVER_ITEMS = {
    anna: { plain: 1194, flour: 1224, print: 1207 },
    bob: { plain: 1195, flour: 1225, print: 1208 },
    carol: { plain: 1196, flour: 1226, print: 1209 },
    david: { plain: 1197, flour: 1227, print: 1210 },
    eliz: { plain: 1198, flour: 1228, print: 1211 },
    frank: { plain: 1199, flour: 1229, print: 1212 }
};

// everything handed back to the guard when the case is closed
const EVIDENCE_ITEM_IDS = [
    THREAD_GREEN_ID,
    THREAD_BLUE_ID,
    THREAD_RED_ID,
    MURDER_SCENE_POT_ID,
    A_SILVER_DAGGER_ID,
    MURDERERS_FINGERPRINT_ID,
    1207,
    1208,
    1209,
    1210,
    1211,
    1212,
    UNIDENTIFIED_FINGERPRINT_ID,
    1194,
    1195,
    1196,
    1197,
    1198,
    1199,
    1224,
    1225,
    1226,
    1227,
    1228,
    1229
];

function stageOf(player) {
    return player.questStages.murderMystery || 0;
}

function hasKey(player, key) {
    return Boolean(player.cache[key]);
}

function store(player, ...keys) {
    for (const key of keys) {
        player.cache[key] = true;
    }
}

function drop(player, ...keys) {
    for (const key of keys) {
        delete player.cache[key];
    }
}

function delay(player, ticks) {
    return player.world.sleepTicks(ticks);
}

// mes(): a message then a short pause
async function mes(player, line) {
    player.message(line);
    await delay(player, 3);
}

// scripted dialogue. a step is ['n', ...lines] (npc says), ['p', ...lines] (player says), ['m', line] (message),
// ['M', line] (message then a 3 tick pause) or ['d', ticks]
async function play(player, npc, script) {
    for (const [kind, ...lines] of script || []) {
        if (kind === 'n') {
            await npc.say(...lines);
        } else if (kind === 'p') {
            await player.say(...lines);
        } else if (kind === 'm') {
            player.message(...lines);
        } else if (kind === 'M') {
            await mes(player, lines[0]);
        } else if (kind === 'd') {
            await delay(player, lines[0]);
        }
    }
}

function murderer(player, order = MURDER_ORDER) {
    for (const name of order) {
        if (hasKey(player, FAMILY[name].murder)) {
            return FAMILY[name];
        }
    }

    return null;
}

// player.cache.remove for the finished case
function clearCase(player) {
    drop(
        player,
        'evidence',
        'culprit',
        'p_anna',
        'p_bob',
        'p_carol',
        'p_eliza',
        'p_david',
        'p_frank',
        'p_anna2',
        'p_bob2',
        'p_carol2',
        'p_eliza2',
        'p_david2',
        'p_frank2',
        'murder_anna',
        'murder_bob',
        'murder_frank',
        'murder_eliz',
        'murder_david',
        'thread',
        'poison_opt',
        'poison_opt2'
    );
}

// ---------------------------------------------------------------------------------------------------------------
// the Sinclair family
// ---------------------------------------------------------------------------------------------------------------

// per family NPC: the greeting, the two stock answers, the thread reaction and the poison answer
const SUSPECTS = {
    [CAROL_ID]: {
        who: 'carol',
        pronoun: 'she',
        thread: THREAD_RED_ID,
        greeting: [['n', 'Well, ask what you want to know then']],
        responsible: [
            [
                'n',
                "I don't know. I think its very convenient",
                'that you have arrived here so soon after it happened.',
                'Maybe it was you'
            ]
        ],
        where: [
            [
                'n',
                'Why? Are you accusing me of something?',
                'You seem to have a very high opinion of yourself',
                'I was in my room if you must know, alone.'
            ]
        ],
        threadWithout: [
            ['m', 'you show Carol the thread found at the crime scene'],
            ['n', 'Its some thread. Sorry, do you have a point here?', 'Or do you just enjoy wasting peoples time?']
        ],
        threadWith: [
            ['m', 'You show her the thread from the study window'],
            [
                'n',
                'Its some red thread... it kind of looks like the',
                'Same material as my trousers. But obviously its not.'
            ]
        ],
        poison: [
            [
                'n',
                "I don't see what on earth it has to",
                'do with you, but the drain outside was',
                'blocked, and as nobody else here has the',
                'intelligence to even unblock a simple drain',
                'I felt I had to do it myself'
            ]
        ]
    },
    [ELIZABETH_ID]: {
        who: 'eliz',
        pronoun: 'she',
        thread: THREAD_BLUE_ID,
        greeting: [['n', "What's so important you need to bother me with then?"]],
        responsible: [
            ['n', 'Could have been anyone. The old man was an', 'idiot. Hes been asking for it for years.']
        ],
        where: [
            ['n', 'I was out'],
            ['p', 'Care to be any more specific?'],
            [
                'n',
                "not really. I don't have to justify myself to the likes of you.",
                'I know the king personally you know. Now are we finished here?'
            ]
        ],
        threadWithout: [
            ['m', 'You show her the thread from the study window'],
            ['n', "Its some thread. You're not very good", 'at this whole investigation thing are you?']
        ],
        threadWith: [
            ['m', 'You show her the thread from the study window'],
            [
                'n',
                'Looks like Blue thread to me.',
                "If you can't work that out for yourself I",
                "don't hold much hope of you solving this crime"
            ],
            ['p', 'It looks a lot like the material your trousers', "are made of doesn't it?"],
            ['n', 'I suppose it does. So what?']
        ],
        poison: [
            [
                'n',
                'there was a nest of mosquitos under the fountain',
                'in the garden, which I killed with poison the other day.',
                "You can see for yourself if you're capable",
                'of managing that, which I somehow doubt'
            ],
            ['p', 'I hate mosquitos'],
            ['n', "Doesn't everyone?"]
        ]
    },
    [ANNA_ID]: {
        who: 'anna',
        pronoun: 'she',
        thread: THREAD_GREEN_ID,
        greeting: [['n', 'Oh really? what do you want to know then?']],
        responsible: [
            ['n', 'It was clearly an intruder.'],
            ['p', "Well, I don't think it was"],
            ['n', 'It was one of our lazy servants then']
        ],
        where: [['n', 'in the library. Noone else was there so', "you'll just have to take my word for it"]],
        threadWithout: [
            ['m', 'You show Anna the thread from the study'],
            ['n', 'Not really, no. Thread is fairly common']
        ],
        threadWith: [
            ['m', 'You show Anna the thread from the study'],
            ['n', "Its some Green thread. Its not exactly uncommon is it?", 'My trousers are made of the same material']
        ],
        poison: [
            [
                'n',
                'That useless Gardener Stanford has let his',
                'Compost heap fester. Its an eyesore to the garden',
                'So I bought some poison from a travelling salesman',
                'So that I could kill off some of the wildlife living in it'
            ]
        ]
    },
    [FRANK_ID]: {
        who: 'frank',
        pronoun: 'he',
        thread: THREAD_BLUE_ID,
        greeting: [['n', 'Good for you. Now what do you want?', "And can you spare me any money? I'm a little short..."]],
        responsible: [
            [
                'n',
                "I don't know.",
                "You don't know how long it takes an inheritance",
                'to come through do you? I could really use that',
                'money pretty soon...'
            ]
        ],
        where: [
            [
                'n',
                "I don't know, somewhere around here probably.",
                'Could you spare me a few coins?',
                "I'll be able to pay you double tomorrow",
                'its just theres this poker night tonight in town...'
            ]
        ],
        threadWithout: [
            ['m', 'Frank examines the thread from the crime scene'],
            [
                'n',
                "It looks like thread to me, but I'm not exactly",
                'an expert. Is it worth something?',
                'Can I have it? Actually, can you spare me a few gold?'
            ]
        ],
        threadWith: [
            ['m', 'Frank examines the thread from the crime scene'],
            [
                'n',
                'it kind of looks like the same material as',
                'my trousers are made of... same colour anyway',
                'think its worth anything? Can I have it? Or just some money?'
            ]
        ],
        poison: [
            [
                'n',
                "Would you like to buy some? I'm kind of strapped",
                "for cash right now, I'll sell it to you cheap, its hardly",
                'been used at all, I just used a bit to clean that family',
                'crest outside up a bit. Do you think I can get much money',
                'For the family crest, actually? Its cleaned up a bit now'
            ]
        ]
    },
    [BOB_ID]: {
        who: 'bob',
        pronoun: 'he',
        thread: THREAD_RED_ID,
        greeting: [['n', 'I suppose I had better talk to you then.']],
        responsible: [
            [
                'n',
                "I don't really care as long as noone thinks its me",
                'Maybe that strange poison seller who headed towards the seers village.'
            ]
        ],
        where: [
            ['n', 'I was walking by myself in the garden.'],
            ['p', 'And can anyone vouch for that?'],
            ['n', 'No. But I was.']
        ],
        threadWithout: [
            ['m', 'you show him the thread you discovered'],
            ['n', 'Its some thread. great clue. No, really.']
        ],
        threadWith: [
            ['m', 'you show him the thread you discovered'],
            [
                'n',
                'Its some red thread. I suppose you think',
                'thats some kind of clue? It looks like',
                'the material my trousers are made of'
            ]
        ],
        poison: [
            [
                'n',
                "what's it to you anyway?",
                'If you absolutely must know, we had a problem',
                'with the beehive in the garden, and as all of our',
                'servants are so pathetically useless, I decided',
                'I would deal with it myself. So I did.'
            ]
        ]
    },
    [DAVID_ID]: {
        who: 'david',
        pronoun: 'he',
        thread: THREAD_GREEN_ID,
        greeting: [
            ['n', 'And? Make this quick, I have better things to', 'do than be interrogated by halfwits all day']
        ],
        responsible: [
            [
                'n',
                "I don't really know or care",
                'Frankly, the old man deserved to die',
                'There was a suspicious red headed man who came',
                'to the house the other day selling poison now I',
                'think about it. Last I saw he was headed towards',
                'the tavern in the Seers village.'
            ]
        ],
        where: [
            [
                'n',
                'that is none of your business.',
                'Are we finished now, or are you just going',
                'to stand there irritating me with your',
                'idiotic questions all day?'
            ]
        ],
        threadWithout: [
            ['m', 'You show him the thread you found on the study window'],
            ['n', 'No. Can I go yet? your face irritates me.']
        ],
        threadWith: [
            ['m', 'You show him the thread you found on the study window'],
            [
                'n',
                'Its some Green thread, like my trousers are made of.',
                "Are you finished? I'm not sure which I dislike more",
                'about you, your face or your general bad odour'
            ]
        ],
        poison: [
            [
                'n',
                'There was a nest of spiders upstairs between the',
                'Two Servants quarters. Obviously I had to kill them before',
                'our pathetic servants whined at my father some more',
                'Honestly, its like they expect to be treated like royalty',
                'If I had my way I would fire the whole workshy lot of them'
            ]
        ]
    }
};

async function sinclairSuspectDialogue(player, npc) {
    const suspect = SUSPECTS[npc.id];
    const family = FAMILY[suspect.who];
    const hasThread = hasKey(player, 'thread');
    const hasPoison = hasKey(player, 'poison_opt');

    await player.say("I'm here to help the guards with their investigation");
    await play(player, npc, suspect.greeting);

    const options = ['Who do you think was responsible?', 'Where were you when the murder happened?'];
    const topics = ['responsible', 'where'];

    if (hasThread) {
        options.push('Do you recognise this thread?');
        topics.push('thread');
    }

    if (hasPoison) {
        options.push('Why did you buy poison the other day?');
        topics.push('poison');
    }

    const topic = topics[await player.ask(options, true)];

    if (topic === 'responsible' || topic === 'where') {
        await play(player, npc, suspect[topic]);
    } else if (topic === 'thread') {
        await play(player, npc, player.inventory.has(suspect.thread) ? suspect.threadWith : suspect.threadWithout);
    } else if (topic === 'poison') {
        await play(player, npc, suspect.poison);

        if (hasKey(player, family.murder)) {
            store(player, family.p, 'poison_opt2');
        }
    }
}

// ---------------------------------------------------------------------------------------------------------------
// the servants
// ---------------------------------------------------------------------------------------------------------------

const SERVANTS = {
    [HOBBES_ID]: {
        notStarted: [['n', 'This is private property! Please leave!']],
        responsible: [
            [
                'n',
                'Well, in my considered opinion it must be',
                'David. The man is nothing more than a bully',
                'And I happen to know that poor Lord Sinclair',
                'and David had a massive argument about the way',
                'he treats the staff in the living room the',
                'other day. I did not intend to overhear their conversation',
                'But they were shouting so loudly I could not help but',
                "Overhear it. David definitely used the words",
                "'I am going to kill you!' as well",
                'I think he should be the prime suspect.',
                'He has a nasty temper that one.'
            ]
        ],
        where: [
            [
                'n',
                'I was assisting the cook with the evening meal',
                'I gave Mary His Lordships dinner, and sent her',
                'to take it to him, then heard the scream as she',
                'found the body.'
            ]
        ],
        noises: [
            ['n', 'how do you mean suspicious?'],
            ['p', 'Any sounds of a struggle with Lord Sinclair?'],
            ['n', "No, I definitely didn't hear anything like that."],
            ['p', 'How about the guard dog barking at all?'],
            [
                'n',
                'You know, now you come to mention it',
                "I don't believe I did. I suppose that is",
                'Proof enough that it could not have been an',
                'intruder who is responsible.'
            ]
        ],
        poison: [
            [
                'n',
                'Well, I do know that Elizabeth was extremely',
                'annoyed by the mosquito nest under the fountain',
                'in the garden, and was going to do something about',
                'it. I suspect any poison she bought would have been',
                'to get rid of it. A Good job too,',
                'I hate mosquitos.'
            ],
            ['p', 'Yeah, so do I'],
            ['n', "you'd really have to ask her though."]
        ]
    },
    [STANFORD_ID]: {
        notStarted: [['n', 'Have you no shame? we are all grieving at the moment']],
        responsible: [
            [
                'n',
                'It was Anna. She is seriously unbalanced.',
                'She trashed the garden once then tried to blame it on me!',
                "I bet it was her. Its just the kind of thing she'd do",
                'She really hates me and was arguing with Lord Sinclair',
                'about trashing the garden a few days ago.'
            ]
        ],
        where: [['n', 'Right here, by my little shed.', 'Its very cosy to sit and think in']],
        noises: [
            ['n', 'Not that I remember.'],
            ['p', 'So no sounds of a struggle between Lord Sinclair and an intruder?'],
            ['n', 'Not to the best of my recollection'],
            ['p', 'How about the guard dog barking?'],
            ['n', 'Not that I can recall']
        ],
        poison: [
            [
                'n',
                'Well, Bob mentioned to me the other day',
                'he wanted to get rid of the bees in that hive',
                'over there. I think I saw him buying poison',
                'from that poison salesman the other day',
                'I assume it was to sort out those bees',
                "you'd really have to ask him though."
            ]
        ]
    },
    [PIERRE_ID]: {
        notStarted: [['n', 'The Guards told me not to talk to anyone']],
        responsible: [
            [
                'n',
                'honestly? I think it was Carol.',
                'I saw her in a huge argument with Lord Sinclair',
                'in the library the other day. It was something',
                'to do with stolen books. She definitely seemed',
                'upset enough to have done it afterwards'
            ]
        ],
        where: [
            [
                'n',
                'I was in town at the inn. When I got back',
                'The house was swarming with guards who told',
                'me what had happened. Sorry.'
            ]
        ],
        noises: [
            ['n', 'well, like what?'],
            ['p', 'Any sounds of a struggle with Lord Sinclair?'],
            ['n', "No, I don't remember hearing anything like that."],
            ['p', 'How about the guard dog barking at all?'],
            [
                'n',
                'I hear him bark all the time.',
                'its one of his favorite things to do.',
                "I can't say I did the night of the murder though",
                "As I wasn't close enough to hear either way"
            ]
        ],
        poison: [
            [
                'n',
                'Well, I know David said that he was',
                'going to do something about the spiders nest thats',
                'between the two servants quarters upstairs',
                'He made a big deal about it to Mary the Maid, calling',
                'her useless and incompetent. I felt quite sorry',
                'for her actually.',
                "you'd really have to ask him though."
            ]
        ]
    },
    [LOUISA_ID]: {
        notStarted: [['n', "I'm far too upset to talk to random people right now"]],
        responsible: [
            [
                'n',
                'Elizabeth.',
                'Her father confronted her about her',
                'constant petty thieving, and was',
                'devestated to find she had stolen a silver',
                'needle which meant a lot to him.',
                'You could hear their argument from Lumbridge!'
            ]
        ],
        where: [['n', 'I was right here with Hobbes and Mary.', "You can't suspect me surely!"]],
        noises: [
            ['n', 'suspicious? what do you mean suspicious?'],
            ['p', 'Any sounds of a struggle with an intruder for example?'],
            ['n', "No, I'm sure I don't recall any such thing."],
            ['p', 'How about the guard dog barking at an intruder?'],
            [
                'n',
                "No, I didn't.",
                "If you don't have anything else to ask can",
                'You go and leave me alone now? I have a lot',
                'Of cooking to do for this evening.'
            ]
        ],
        poison: [
            [
                'n',
                'I told Carol to buy some from that strange',
                'poison salesman and clean the drains before they',
                'began to smell any worse. She was the one who',
                'blocked them in the first place with a load',
                'of beans that she bought for some reason.',
                'There were far too many to eat, and they',
                'were almost rotten when she bought them anyway',
                "you'd really have to ask her though."
            ]
        ]
    },
    [MARY_ID]: {
        notStarted: [['m', 'she is ignoring you']],
        responsible: [
            [
                'n',
                "Oh I don't know...",
                'Frank was acting kind of funny...',
                'After that big argument him and the Lord',
                'had the other day by the beehive... so',
                'I guess maybe him... but its really scary',
                'to think someone here might have been responsible.',
                'I actually hope it was a burglar'
            ]
        ],
        where: [
            [
                'n',
                'I was with hobbes and Louisa in the Kitchen',
                "helping to prepare Lord Sinclair's meal, and then",
                'when I took it to his study...',
                'I saw... oh, it was horrible... he was....'
            ],
            ['M', 'She seems to be on the verge of crying.'],
            ['M', 'You decide not to push her anymore for details.']
        ],
        noises: [
            ['n', "I don't really remember hearing anything out of the ordinary"],
            ['p', 'no sounds of a struggle then?'],
            ['n', "No, I don't remember hearing anything like that."],
            ['p', 'How about the guard dog barking?'],
            ['n', 'Oh that horrible dog is always barking at nothing', "but I don't think I did..."]
        ],
        poison: [
            [
                'n',
                'I overheard Anna saying to Stanford',
                "that if he didn't do something about the",
                'state of his compost heap, she was going to.',
                "She really doesn't get on well with Stanford",
                'I really have no idea why',
                "you'd really have to ask her though."
            ]
        ]
    },
    [DONOVAN_ID]: {
        notStarted: [['n', 'I have no interest in talking to gawkers']],
        responsible: [
            [
                'n',
                "Oh... I really couldn't say.",
                "I wouldn't really want to point any fingers at anybody",
                "If I had to make a guess I'd have to say it was probably",
                'Bob though. I saw him arguing with Lord Sinclair about',
                'some missing silverware from the Kitchen',
                'It was a very heated argument.'
            ]
        ],
        where: [
            [
                'n',
                'Me? I was sound asleep here in the servants',
                'Quarters. Its very hard work as a handyman',
                "around here, theres always something to do"
            ]
        ],
        noises: [
            ['n', "hmmm..... No, I didn't, but I sleep very soundly at night."],
            ['p', "So you didn't hear any sounds of a struggle or any", 'barking from the guard dog next to his study window?'],
            [
                'n',
                "Now you mention it, no. it is odd I didn't hear anything",
                'like that. But I do sleep very soundly as I said and',
                "wouldn't necessarily have heard it if there was any such noise"
            ]
        ],
        poison: [
            [
                'n',
                'Well, I do know Frank bought some poison',
                'recently to clean the family crest thats outside',
                "Its very old and rusty, and I couldn't clean it",
                'myself, so he said he would buy some cleaner and',
                'clean it himself. He probably just got some from that',
                'Poison Salesman who came to the door the other day',
                "you'd really have to ask him though."
            ]
        ]
    }
};

async function otherSuspectDialogue(player, npc) {
    const servant = SERVANTS[npc.id];

    await player.say("I'm here to help the guards with their investigation");
    await npc.say('How can I help?');

    const options = [
        'Who do you think is responsible?',
        'Where were you at the time of the murder?',
        'Did you hear any suspicious noises at all?'
    ];
    const topics = ['responsible', 'where', 'noises'];

    if (hasKey(player, 'poison_opt')) {
        options.push('Do you know why so much poison was bought recently?');
        topics.push('poison');
    }

    await play(player, npc, servant[topics[await player.ask(options, true)]]);
}

async function servantDialogue(player, npc) {
    const stage = stageOf(player);
    const servant = SERVANTS[npc.id];

    if (stage === 0) {
        await play(player, npc, servant.notStarted);
    } else if (stage === -1) {
        await npc.say('Thank you for all your help in solving the murder');
    } else {
        await otherSuspectDialogue(player, npc);
    }
}

async function sinclairDialogue(player, npc) {
    const stage = stageOf(player);
    const suspect = SUSPECTS[npc.id];

    if (stage === 0) {
        player.message(suspect.pronoun === 'he' ? 'he is ignoring you' : 'she is ignoring you');
    } else if (stage === -1) {
        await npc.say("Apparently you aren't as stupid as you look");
    } else {
        await sinclairSuspectDialogue(player, npc);
    }
}

// ---------------------------------------------------------------------------------------------------------------
// the guard
// ---------------------------------------------------------------------------------------------------------------

const GUARD_WHAT_TO_DO = [
    'Look around and investigate who might be responsible',
    'the sarge said every murder leaves clues to who done it',
    "but frankly we're out of our depth here"
];

async function whoYouSuspect(player, npc) {
    player.message('You tell the guard who you suspect of the crime');
    await npc.say(
        'Great work, show me the evidence',
        "and we'll take them to the dungeons",
        'you *DO* have evidence of their crime, right?'
    );
    await player.say('uh....');
    await npc.say(
        "tch. You wouldn't last a day in the guards",
        'with sloppy thinking like that.',
        'come see me when you have some proof of your accusations'
    );
}

async function butlerDidIt(player, npc) {
    await npc.say(
        'I hope you have proof to that effect.',
        'we have to arrest someone for this and it seems to me that',
        'only the actual murderer would gain by falsely accusing someone'
    );
    await delay(player, 3); // kosher: small pause to continue dialogue
    await npc.say('although having said that', 'the butler is kind of shifty looking...');
}

async function threadDialogue(player, npc) {
    await player.say("I have proof that it wasn't any of the servants");
    player.message('you show the guard the thread you found on the window');
    await player.say('All the servants dress in black so', "it couldn't have been one of them");
    await npc.say(
        "Thats some good work there. I guess it wasn't a servant.",
        'You still havent proved who did do it though'
    );
}

async function evidenceDialogue(player, npc) {
    for (const name of EVIDENCE_ORDER) {
        const family = FAMILY[name];

        if (hasKey(player, family.p2)) {
            await player.say(`I have proof that ${family.name} is lying about the poison`);
            await npc.say('Oh really? How did you get that?');
            player.message(family.evidence);
            break;
        }
    }

    await npc.say(
        'Hmm. thats some good detective work there.',
        'We need more evidence before we can close the case though',
        'Keep up the good work'
    );
}

async function fingerprintDialogue(player, npc) {
    await player.say('I have the fingerprints of the culprit');

    const family = murderer(player, FINGERPRINT_ORDER);

    if (family) {
        await player.say(`I have ${family.name}s' Fingerprints here.`);
    }

    await player.say('You can see for yourself they match the', 'Fingerprints on the murder weapon exactly');
    player.message('You show the guard the finger prints evidence');
    await npc.say('...');
    await npc.say(
        "I'm impressed. How on earth did you think",
        "of something like that? I've never heard",
        'of such a technique for finding criminals before',
        'This will come in very handy in the future',
        "But we can't arrest someone on just this.",
        "I'm afraid you'll still need to find more evidence",
        'Before we can close this case completely'
    );
}

// all three pieces: the case is solved
async function solveCase(player, npc) {
    drop(player, 'poison_opt');

    await player.say('I have conclusive Proof who the killer was');
    await npc.say("You do? thats excellent work. Lets hear it then");
    await player.say(
        "I don't think it was an intruder, and I don't think Lord",
        'Sinclair was killed by being stabbed.'
    );
    await npc.say('hmmm? really? why not?');
    await player.say(
        'nobody heard the guard dog barking, which it would have if',
        'it had been an intruder who was responsible.',
        'nobody heard any signs of a struggle either.',
        'I think the knife was there to throw suspicion away from the real culprit.'
    );
    await npc.say('Yes, that makes sense. But who did do it then?');

    const suspect = murderer(player);

    if (suspect) {
        player.message(`You prove to the guard the thread matches ${suspect.name}s clothes`);
    }

    await npc.say("Yes, I'd have to agree with that... but we need more evidence");

    if (suspect) {
        player.message(`You prove to the guard ${suspect.name} did not use poison on ${suspect.place}`);
    }

    await npc.say(
        'Excellent work - have you considered a career as a detective?',
        "But i'm afraid its still not quite enough..."
    );

    if (suspect) {
        player.message(`You match ${suspect.name}s fingerprints with those on the dagger`);
    }

    player.message('Found in the body of Lord Sinclair');
    await npc.say('...', 'Yes. theres no doubt about it.');

    let objPronoun = '';

    for (const name of MURDER_ORDER) {
        const family = FAMILY[name];

        if (hasKey(player, family.murder) && hasKey(player, family.p2)) {
            await npc.say(`It must have been ${family.name} who killed ${family.poss} father`);
            drop(player, family.murder);
            objPronoun = family.obj;
            break;
        }
    }

    await npc.say(
        'All of the guards must congratulate you on your',
        'Excellent work in helping us to solve this case',
        "We don't have many murders here in RuneScape",
        "And i'm afraid we wouldn't have been able to solve it",
        'by ourselves. We will hold ' + objPronoun + ' here under house arrest',
        'Until such time as we can bring ' + objPronoun + ' to trial',
        "You have our gratitude, and I'm sure the rest of the",
        'families as well, in helping to apprehend the murderer',
        "I'll just take the evidence from you now"
    );
    player.message('You hand over all the evidence');

    // removes every murder mystery item, however many are carried
    for (const id of EVIDENCE_ITEM_IDS) {
        const amount = player.inventory.count(id);

        for (let i = 0; i < amount; i += 1) {
            player.inventory.remove(id);
        }
    }

    // Java sendQuestComplete: 3 quest points, crafting experience 750 + 150 per level (quarter points)
    player.completeQuest('murderMystery', {
        questPoints: 3,
        experience: { crafting: 750 + 150 * player.skills.crafting.base },
        message: 'You have completed the Murder Mystery Quest'
    });

    await npc.say('Please accept this reward from the family!');
    player.message('You received 2000 gold!');
    player.inventory.add(COINS_ID, 2000);
    clearCase(player);
}

async function accuse(player, npc) {
    const hasThread = hasKey(player, 'thread');
    const hasEvidence = hasKey(player, 'evidence');
    const hasCulprit = hasKey(player, 'culprit');
    const pieces = [hasThread, hasEvidence, hasCulprit].filter(Boolean).length;

    if (pieces === 0) {
        await accuseWithoutProof(player, npc);
    } else if (pieces === 3) {
        await solveCase(player, npc);
    } else if (pieces === 1) {
        if (hasThread) {
            await threadDialogue(player, npc);
        } else if (hasEvidence) {
            await evidenceDialogue(player, npc);
        } else {
            await fingerprintDialogue(player, npc);
        }
    } else {
        const choices = [];

        if (hasThread) {
            choices.push(["I have proof that it wasn't any of the servants", threadDialogue]);
        }

        if (hasEvidence) {
            choices.push(['I have proof one of the family lied about the poison', evidenceDialogue]);
        }

        if (hasCulprit) {
            choices.push(['I have the fingerprints of the culprit', fingerprintDialogue]);
        }

        // do not send over
        const choice = await player.ask(
            choices.map(([label]) => label),
            false
        );

        if (choices[choice]) {
            await choices[choice][1](player, npc);
        }
    }
}

// 0 pieces: the player guesses
async function accuseWithoutProof(player, npc) {
    await npc.say('Really? That was quick work! Who?');

    const suspect = await player.ask(
        ['It was an intruder!', 'the butler did it!', 'It was one of the servants', 'It was one of his family'],
        true
    );

    if (suspect === 0) {
        await npc.say(
            'Thats what we were thinking too.',
            'That someone broke in, to steal something',
            'was discovered by Lord Sinclair, stabbed him and ran.',
            'Its odd that apparently nothing was stolen though.',
            'Find out something has been stolen, and the case is closed',
            'But the murdered man was a friend of the king',
            'and its more than my jobs worth not to investigate fully'
        );
    } else if (suspect === 1) {
        await butlerDidIt(player, npc);
    } else if (suspect === 2) {
        await npc.say('Oh really? Which one?');

        const gender = await player.ask(['It was one of the women', 'It was one of the men'], true);

        if (gender === 0) {
            await npc.say('Oh really? Which one?');

            // do not send over
            const pick = await player.ask(['it was so obviously Louisa The Cook', 'It must have been Mary The Maid'], false);

            if (pick >= 0) {
                await whoYouSuspect(player, npc);
            }
        } else if (gender === 1) {
            await npc.say('Oh really? Which one?');

            // do not send over
            const pick = await player.ask(
                [
                    'it can only be Donovan the Handyman',
                    'Pierre the Dog Handler. No question.',
                    'Hobbes the Butler. the butler *always* did it',
                    'you must know it was Stanford The Gardener'
                ],
                false
            );

            if (pick >= 0 && pick !== 2) {
                await whoYouSuspect(player, npc);
            } else if (pick === 2) {
                // butler has the same dialogue
                await player.say('the butler did it!');
                await butlerDidIt(player, npc);
            }
        }
    } else if (suspect === 3) {
        await npc.say('Oh really? Which one?');

        const gender = await player.ask(['It was one of the women', 'It was one of the men'], true);

        if (gender === 0) {
            await npc.say('Oh really? Which one?');

            // do not send over
            const pick = await player.ask(
                ['I know it was Anna', 'I am so sure it was Carol', 'Ill bet you anything it was Elizabeth'],
                false
            );

            if (pick >= 0) {
                await whoYouSuspect(player, npc);
            }
        } else if (gender === 1) {
            await npc.say('Oh really? Which one?');

            // do not send over
            const pick = await player.ask(
                ["I'm certain it was Bob", 'It was David. No doubt about it.', "If it wasn't Frank I'll eat my shoes"],
                false
            );

            if (pick >= 0) {
                await whoYouSuspect(player, npc);
            }
        }
    }
}

async function guardDialogue(player, npc) {
    const stage = stageOf(player);

    if (stage === 0) {
        await player.say("What's going on here?");
        await npc.say(
            'Oh, its terrible.',
            'Lord Sinclair has been murdered',
            "And we don't have any clues as to",
            "who or why. We're totally baffled",
            'If you can help us',
            'we will be very grateful'
        );

        const choice = await player.ask(["Sure, I'll help", 'You should do your own dirty work'], true);

        if (choice === 0) {
            await npc.say('thanks a lot!');
            await player.say('What should I be doing to help?');
            await npc.say(...GUARD_WHAT_TO_DO);

            // QUEST STARTED: PERMISSION TO INVESTIGATE
            player.questStages.murderMystery = 1;

            const randomMurder = 1 + Math.floor(Math.random() * 6);

            store(player, FAMILY[RANDOM_MURDERER[randomMurder - 1]].murder);
        } else if (choice === 1) {
            await npc.say('get lost then, this is private property.', "...unless you'd like to be taken for questioning yourself");
        }
    } else if (stage === 1) {
        const choice = await player.ask(
            ['What should I be doing to help again?', 'How did Lord Sinclair die?', 'I know who did it!'],
            true
        );

        if (choice === 0) {
            await npc.say(...GUARD_WHAT_TO_DO);
        } else if (choice === 1) {
            await npc.say(
                'well its all very mysterious.',
                'Mary the maid found the body in the study next to his bedroom',
                'on the east wing of the ground floor, the door was found locked,',
                'from the inside, and he seemed to have been stabbed',
                "but there was an odd smell in the room. Frankly, I'm stumped"
            );
        } else if (choice === 2) {
            // 3 pieces completes the quest, 2 gives a menu, 1 jumps straight in, 0 guesses
            await accuse(player, npc);
        }
    } else if (stage === -1) {
        await npc.say(
            'Excellent work on solving the murder',
            'All of the guards I know are very impressed',
            "And don't worry, we have the murderer under guard",
            'until they can be taken to trial'
        );
    }
}

// ---------------------------------------------------------------------------------------------------------------
// the man on the road
// ---------------------------------------------------------------------------------------------------------------

const MAN_BOYS = [
    [
        'Bob is an odd character indeed...',
        "I'm not one to gossip, but I heard",
        "Bob is addicted to Tea. He can't make it through the day",
        'Without having at least 20 cups!',
        "You might not think thats such a big thing,",
        'But he has spent thousands of gold to feed his habit',
        'At one point he stole a lot of silverware from the kitchen',
        'and pawned it just so he could afford to buy his daily',
        'tea allowance. If his father ever found out, he would',
        'be in so much trouble... he might even get disowned'
    ],
    [
        'David... oh david...',
        'not many people know this, but David really',
        'has an anger problem. Hes always screaming and shouting',
        'at the household servants when hes angry, and they live',
        'in a state of fear, always walking on eggshells around him',
        'but none of them have the courage to talk to his father about',
        'his behaviour. If they did Lord Sinclair would almost certainly',
        'kick him out of the house, as some of the servants have',
        'been there longer than he has, and he definitely',
        'has no right to treat them like he does... but',
        "I'm not one to gossip about people."
    ],
    [
        "I'm not one to talk ill of people behind their back",
        'but frank is a real piece of work. He is an absolutely',
        "terrible gambler... he can't pass 2 dogs in the street",
        'without putting a bet on which one will bark first',
        'He has already squandered all of his allowance, and I heard',
        'he had stolen a number of paintings of his Fathers to sell',
        'to try and cover his debts, but he still owes a lot of',
        'people a lot of money. If his Father ever found out, he would',
        'stop his income, and then he would be in serious trouble'
    ]
];

const MAN_GIRLS = [
    [
        'Anna... ah yes...',
        'Anna has 2 great loves:',
        'Sewing and Gardening. But one thing',
        'she has kept secret is that she once had',
        'an affair with Stanford the gardener',
        'and tried to get him fired when they broke up',
        'by killing all of the flowers in the garden',
        'If her father ever found out she had done that',
        'He would be so furious he would probably disown her'
    ],
    [
        'Oh Carol... she is such a fool',
        "You didn't hear this from me, but I heard",
        'a while ago she was conned out of a lot of money',
        'by a travelling salesman who sold her a box full',
        "of beans by telling her they were magic. But they weren't.",
        'She sold some rare books from the library to cover her debts',
        'But her father would be incredibly annoyed',
        'If he ever found out - he might even throw her out of the house'
    ],
    [
        'Elizabeth? Elizabeth has a strange problem',
        'She cannot help herself, but is always stealing small',
        'objects - its pretty sad that she is rich enough to afford',
        'to buy things, but would rather steal them instead.',
        "Now, I don't want to spread stories, but I heard",
        'She even stole a silver needle from her father that',
        'had great sentimental value for him. He was devestated when',
        'it was lost, and cried for a week thinking he had lost it',
        'If he ever found out that it was her who had stolen it',
        'He would go absolutely mental, maybe even disowning her'
    ]
];

const MAN_HINTS = [
    [
        'well, I dont know if its related',
        'But I heard from that Poison Salesman in town',
        'That he sold some poison to one of the family the other day',
        "I don't think he has any stock left now though..."
    ],
    [
        "Well I don't know how much help this is",
        'but I heard that their guard dog will bark loudly at anyone',
        "it doesn't recognise",
        'maybe you should find out if anyone heard anything suspicious?'
    ],
    [
        'Well, this might be of some help to you',
        'My father was in the guards when he was younger',
        "and he always said that there isn't a crime that can't be",
        'solved through careful examination of the crime scene',
        'and all surrounding areas'
    ],
    [
        "I don't know how much help this is to you",
        'but my dad was in the guard once',
        'and he told me that the marks on your hands',
        "Are totally unique. He called them 'finger prints'",
        'He said you can find them easily on any shiny metallic surface',
        'By using a fine powder to mark out where the marks are',
        'and then using some sticky paper to lift the print from the object',
        "I bet if you could find a way to get everyones 'finger prints'",
        'you could solve the crime pretty easily'
    ],
    [
        'My father used to be in the guard.',
        'He always wrote himself notes on a piece of paper',
        'so he could keep track of information easily.',
        'Maybe you should try that?',
        "Don't forget to thank me if I help you solve the case!"
    ]
];

async function manDialogue(player, npc) {
    const stage = stageOf(player);

    if (stage === 0) {
        await npc.say(
            'Theres some kind of commotion up at the Sinclair place',
            'I hear. Not surprising all things considered'
        );

        return;
    }

    if (stage === -1) {
        await npc.say('I heard you solved the murder', 'Was I of any help to you at all?');

        return;
    }

    await player.say("I'm investigating the murder up at the Sinclair place");
    await npc.say('Murder is it?', "Well, i'm not really surprised...");

    const menu = await player.ask(
        [
            'What can you tell me about the Sinclairs?',
            'Who do you think was responsible?',
            'Why do the Sinclairs live so far from town?',
            'I think the butler did it',
            'I am so confused about who did it'
        ],
        true
    );

    if (menu === 0) {
        await npc.say('Well, what do you want to know?');

        const menu2 = await player.ask(
            ['Tell me about Lord Sinclair', 'what can you tell me about his sons?', 'what can you tell me about his daughters?'],
            true
        );

        if (menu2 === 0) {
            await npc.say(
                'Old Lord Sinclair was a great man with a lot of',
                'respect in these parts. More than his worthless',
                'children have anyway'
            );
            await player.say('His children? They have something to gain by his death?');
            await npc.say('yes. you could say that. not that im one to gossip');
        } else if (menu2 === 1) {
            await npc.say(
                'His sons eh? They all have their own skeletons',
                "In their cupboards. You'll have to be more specific.",
                'Who are you interested in exactly?'
            );

            const menu3 = await player.ask(['Tell me about Bob', 'Tell me about David', 'Tell me about Frank'], true);

            if (MAN_BOYS[menu3]) {
                await npc.say(...MAN_BOYS[menu3]);
            }
        } else if (menu2 === 2) {
            await npc.say(
                "His daughters eh? They're all nasty pieces of work",
                'which of them specifically did you want to know about?'
            );

            const menu4 = await player.ask(['Tell me about Anna', 'Tell me about Carol', 'Tell me about Elizabeth'], true);

            if (MAN_GIRLS[menu4]) {
                await npc.say(...MAN_GIRLS[menu4]);
            }
        }
    } else if (menu === 1) {
        await npc.say(
            'well, I guess it could have been an intruder',
            'but with that big guard dog of theirs',
            'I seriously doubt it.',
            'I suspect it was someone closer to home...',
            'Especially as I heard that that poison salesman',
            'in the seers village made a big sale to one',
            'of the family the other day.'
        );
    } else if (menu === 2) {
        await npc.say(
            'Well, they used to live in the big castle',
            'but old Lord Sinclair gave it up so that those',
            'strange knights could live there instead',
            'So the king built him a new house to the North',
            'Its more cramped than his old place, but he seemed to like it',
            'his children were furious at him for doing it though'
        );
    } else if (menu === 3) {
        await npc.say(
            "And I think you've been reading too many",
            'cheap detective novels',
            'Hobbes is kind of uptight, but his loyalty',
            'to Old Lord Sinclair is beyond question'
        );
    } else if (menu === 4) {
        await player.say('think you could give me any hints?');
        await npc.say(...MAN_HINTS[Math.floor(Math.random() * 5)]);
    }
}

// ---------------------------------------------------------------------------------------------------------------
// the poison salesman
// ---------------------------------------------------------------------------------------------------------------

async function poisonSalesmanDialogue(player, npc) {
    const stage = stageOf(player);

    if (stage === 0) {
        await player.say('Hi.');
        await npc.say(
            "I'm afraid I'm all sold out of poison at the moment.",
            'People know a bargain when they see it!'
        );
    } else if (stage === 1) {
        await player.say("I'm investigating the murder at the Sinclair house.");
        await npc.say(
            'There was a murder at the Sinclair House???',
            'Thats terrible! And I was only there the other day too',
            'They bought the last of my Patented Multi Purpose Poison!'
        );

        const options = [
            'Patented Multi Purpose Poison?',
            'Who did you sell Poison to at the house?',
            'Can I buy some Poison?'
        ];

        if (player.inventory.has(MURDER_SCENE_POT_ID)) {
            options.push('I have this pot I found at the murder scene...');
        }

        const menu = await player.ask(options, true);

        if (menu === 0) {
            await npc.say(
                'Aaaaah... a miracle of modern apothecarys, this exclusive',
                'concoction has been tested on all known forms of life',
                'and been proven to kill them all in varying dilutions',
                'from cockroaches to king dragons',
                'so incredibly versatile, it can be used as pest',
                'control, a cleansing agent, drain cleaner, metal polish',
                'and washes whiter than white, all with our uniquely',
                'fragrant concoction that is immediately recognisable',
                'across the land as Peter Potters Patented Poison potion'
            );
            await mes(player, 'The salesman stops for breath');
            await npc.say(
                "I'd love to sell you some but I've sold out recently",
                'Thats just how good it is! Three hundred and Twenty',
                'Eight people in this area alone cannot be wrong!',
                'Nine out of Ten poisoners prefer it in controlled tests!',
                'Can I help you with anything else?',
                'Perhaps I can take your name and add it to our mailing list',
                'Of poison users? We will only send you information related to',
                'the use of poison and other Peter Potter Products'
            );
            await player.say('uh... no, its ok');
        } else if (menu === 1) {
            await npc.say(
                'Well, Peter Potters Patented Multi Purpose Poison',
                'is a product of such obvious quality that I am',
                'glad to say I managed to sell a bottle to each of the',
                'Sinclairs - Anna, Bob, Carol, David, Elizabeth and Frank',
                'all bought a bottle - in fact they bought the last of my supplies',
                'Maybe I can take your name and address, and I will',
                'personally come and visit you when stocks return?'
            );

            if (!hasKey(player, 'poison_opt')) {
                store(player, 'poison_opt');
            }

            await player.say('uh... no, its ok');
        } else if (menu === 2) {
            await npc.say(
                "I'm afraid I am totally out of stock at the moment",
                "After my successful trip to the Sinclair's House the other day",
                "but don't worry, our factories are working overtime",
                'to produce Peter Potters Patented Multi Purpose Poison',
                'possibly the finest multi purpose poison and cleaner yet',
                'available to the general market. And its unique fragrance',
                'makes it the number one choice for cleaners, and exterminators',
                'the whole country over'
            );
        } else if (menu === 3) {
            player.message('You show the poison salesman the pot you found at');
            player.message('The murder scene with the unusual smell');
            await npc.say(
                'hmmm... yes, that smells exactly like my',
                "Patented Multi Purpose Poison, but I don't see how it could be",
                'It quite clearly says on the label of all bottles',
                'not to be taken internally - extremely poisonous'
            );
            await player.say('Perhaps someone else put it in his wine?');
            await npc.say('yes... I suppose that could have happened...');
        }
    }
}

const TALK = {
    [GUARD_ID]: guardDialogue,
    [POISON_SALESMAN_ID]: poisonSalesmanDialogue,
    [MAN_ID]: manDialogue,
    [HOBBES_ID]: servantDialogue,
    [LOUISA_ID]: servantDialogue,
    [STANFORD_ID]: servantDialogue,
    [PIERRE_ID]: servantDialogue,
    [DONOVAN_ID]: servantDialogue,
    [MARY_ID]: servantDialogue,
    [BOB_ID]: sinclairDialogue,
    [FRANK_ID]: sinclairDialogue,
    [DAVID_ID]: sinclairDialogue,
    [ANNA_ID]: sinclairDialogue,
    [ELIZABETH_ID]: sinclairDialogue,
    [CAROL_ID]: sinclairDialogue
};

async function onTalkToNPC(player, npc) {
    const dialogue = TALK[npc.id];

    if (!dialogue) {
        return false;
    }

    player.engage(npc);

    try {
        await dialogue(player, npc);
    } finally {
        player.disengage();
    }

    return true;
}

// ---------------------------------------------------------------------------------------------------------------
// the crime scene: dagger, pot, window
// ---------------------------------------------------------------------------------------------------------------

const SCENE_ITEMS = {
    [A_SILVER_DAGGER_ID]: {
        found: "This knife doesn't seem sturdy enough to have killed Lord Sinclair",
        have: 'You already have the murderweapon',
        done: ['you cannot take the flimsy dagger.', 'The guards will need it as Evidence.']
    },
    [MURDER_SCENE_POT_ID]: {
        found: 'It seems like Lord Sinclair was drinking from this before he died',
        have: 'You already have the sickly smelling pot',
        done: ['you cannot take the strange smelling pot.', 'The guards will need it as Evidence.']
    }
};

async function onGroundItemTake(player, groundItem) {
    const scene = SCENE_ITEMS[groundItem.id];

    if (!scene) {
        return false;
    }

    // the item always stays on the floor; the player is given a copy
    const stage = stageOf(player);

    if (stage === 0 || stage === 1) {
        player.message(scene.found);

        if (!player.inventory.has(groundItem.id)) {
            player.inventory.add(groundItem.id, 1);
        } else {
            player.message(scene.have);
        }
    } else if (stage === -1) {
        player.message(scene.done[0]);
        player.message(scene.done[1]);
    }

    return true;
}

async function onWallObjectCommandOne(player, wallObject) {
    if (wallObject.id !== WINDOW_ID) {
        return false;
    }

    const stage = stageOf(player);

    if (stage === 0 || stage === -1) {
        player.message('You need the guards permission to do that');

        return true;
    }

    if (stage !== 1) {
        return true;
    }

    const family = murderer(player);
    const giveThread = () => {
        if (family) {
            player.inventory.add(family.thread, 1);
        }
    };
    const carrying = THREADS.some((id) => player.inventory.has(id));
    const taken = hasKey(player, 'thread');

    await mes(player, 'Some thread seems to have been caught');
    await mes(player, 'on a loose nail on the window');

    if (!taken && !carrying) {
        giveThread();
        await mes(player, 'You take the thread');
        store(player, 'thread');
    } else if (taken && !carrying) {
        giveThread();
        await mes(player, 'Lucky for you theres some thread left');
        await mes(player, 'You should be less careless in future');
    } else {
        player.message('You have already taken the thread');
    }

    return true;
}

// ---------------------------------------------------------------------------------------------------------------
// the grounds: barrels, sacks, flour barrel and the poison alibis
// ---------------------------------------------------------------------------------------------------------------

const BARRELS = {
    1133: { item: SILVER_ITEMS.bob.plain, take: 'You take Bobs silver cup', have: 'You already have Bobs cup' },
    1132: {
        item: SILVER_ITEMS.anna.plain,
        take: 'You take Annas Silver Necklace',
        have: 'You already have Annas Necklace'
    },
    1136: {
        item: SILVER_ITEMS.eliz.plain,
        take: 'You take Elizabeths silver needle',
        have: 'You already have Elizabeths Needle'
    },
    1137: { item: SILVER_ITEMS.frank.plain, take: 'You take franks silver pot', have: 'You already have Franks pot' },
    1135: { item: SILVER_ITEMS.david.plain, take: 'You take Davids silver book', have: 'You already have Davids book' },
    1134: {
        item: SILVER_ITEMS.carol.plain,
        take: 'You take Carols silver bottle',
        have: 'You already have Carols bottle'
    }
};

// the poison alibi sites: the murderer's alibi was a lie (evidence), everyone else's was true (a faint smell)
const SITES = {
    1126: {
        family: 'anna',
        lie: [
            ['M', 'The compost is teeming with maggots'],
            ['M', 'Somebody should really do something about it'],
            ['M', 'Its certainly clear nobodies used poison here.']
        ],
        truth: [['M', 'There is a faint smell of poison behind the smell of the compost']],
        plain: 'Its a heap of Compost'
    },
    1130: {
        family: 'eliz',
        lie: [
            ['M', 'The fountain is swarming with mosquitos'],
            ['M', 'Theres a nest of them underneath the fountain'],
            ['p', "I hate mosquitos, they're so annoying"],
            ['M', 'Its certainly clear nobodies used poison here.']
        ],
        truth: [
            ['M', 'There are a lot of dead mosquitos around'],
            ['M', 'the base of the fountain. A faint smell of'],
            ['M', 'poison is in the air, but the water seems clean']
        ],
        plain: 'A fountain with large numbers of insects around the base'
    },
    1127: {
        family: 'bob',
        lie: [
            ['M', 'The beehive buzzes with activity'],
            ['M', "These bees definitely don't seem poisoned at all"]
        ],
        truth: [
            ['M', 'The hive is empty. There are a few dead bees and'],
            ['M', 'a faint smell of poison']
        ],
        plain: 'Its a very old beehive'
    },
    1128: {
        family: 'carol',
        lie: [
            ['M', 'The drain is totally blocked'],
            ['M', 'It really stinks. No, it *Really* smells bad.'],
            ['M', 'Its certainly clear nobodies cleaned it recently.']
        ],
        truth: [
            ['M', 'The drain seems to have been recently cleaned'],
            ['M', 'You can still smell the faint aroma of poison']
        ],
        plain: 'Its the drains from the kitchen'
    },
    1131: {
        family: 'frank',
        lie: [
            ['M', 'It looks like the Sinclair Family Crest'],
            ['M', 'but it is very dirty.'],
            ['M', 'you can barely make it out under all of the grime'],
            ['M', 'Its certainly clear nobodies cleaned it recently.']
        ],
        truth: [
            ['M', 'The sinclair family crest'],
            ['M', 'its shiny and freshly polished'],
            ['M', 'And has a slight smell of poison']
        ],
        plain: 'The Sinclair Family Crest is hung up here'
    },
    1129: {
        family: 'david',
        lie: [
            ['M', 'There is a spiders nest here'],
            ['M', 'You estimate there must be at least a few hundred spiders ready to hatch'],
            ['M', 'Its certainly clear nobodies used poison here.']
        ],
        truth: [
            ['M', 'A faint smell of poison and a few dead spiders'],
            ['M', 'is all that remains of the spiders nest']
        ],
        plain: 'It looks like a Spiders Nest of some kind'
    }
};

const DOG_GATE_ID = 1140;

const GROUND_OBJECT_IDS = new Set([
    ...Object.keys(BARRELS).map(Number),
    ...Object.keys(SITES).map(Number),
    SACKS_ID,
    FLOUR_BARREL_ID,
    DOG_GATE_ID
]);

async function investigateObject(player, id) {
    if (BARRELS[id]) {
        const barrel = BARRELS[id];

        player.message('Theres something shiny hidden at the bottom');

        if (!player.inventory.has(barrel.item)) {
            player.message(barrel.take);
            player.inventory.add(barrel.item, 1);
        } else {
            player.message(barrel.have);
        }
    } else if (id === SACKS_ID) {
        player.message('Theres some flypaper in there.');
        player.message('Do you take it?');

        const sack = await player.ask(['Yes, it might be useful', "No, I don't see any need for it"], true);

        if (sack === 0) {
            player.message('You take a piece of fly paper');
            player.message('There is still plenty of fly paper left');
            player.inventory.add(FLYPAPER_ID, 1);
        } else if (sack === 1) {
            player.message('you leave the paper in the sack');
        }
    } else if (SITES[id]) {
        const site = SITES[id];
        const family = FAMILY[site.family];

        if (hasKey(player, 'poison_opt2') && hasKey(player, family.murder)) {
            await play(player, null, site.lie);
            store(player, 'evidence', family.p2);
        } else if (hasKey(player, 'poison_opt2')) {
            await play(player, null, site.truth);
        } else {
            player.message(site.plain);
        }
    } else if (id === DOG_GATE_ID) {
        await mes(player, 'As you approach the gate the Guard Dog starts barking loudly at you');
        await mes(player, 'There is no way an intruder could have committed the murder');
        await mes(player, 'It must have been someone the dog knew to get past it quietly');
    } else if (id === FLOUR_BARREL_ID) {
        player.message('A barrel full of finely sifted flour');

        if (!player.inventory.has(POT_ID) && !player.inventory.has(MURDER_SCENE_POT_ID)) {
            player.message('You need something to put the flour in');
        } else if (player.inventory.has(POT_ID)) {
            player.message('You take some flour from the barrel');
            player.inventory.remove(POT_ID);
            player.inventory.add(POT_OF_FLOUR_ID);
            player.message('Theres still plenty of flour left');
        } else {
            await mes(player, "You probably shouldn't use evidence from a crime");
            await mes(player, 'scene to keep flour in...');
        }
    }
}

// the commands are [WalkTo, Investigate/Search] so the action is command two
async function onGameObjectCommandTwo(player, gameObject) {
    if (!GROUND_OBJECT_IDS.has(gameObject.id)) {
        return false;
    }

    const stage = stageOf(player);

    if (stage === 0 || stage === -1) {
        player.message('You need the guards permission to do that');
    } else if (stage === 1) {
        await investigateObject(player, gameObject.id);
    }

    return true;
}

async function onUseWithGameObject(player, gameObject, item) {
    if (gameObject.id !== FLOUR_BARREL_ID || (item.id !== MURDER_SCENE_POT_ID && item.id !== POT_ID)) {
        return false;
    }

    if (item.id === MURDER_SCENE_POT_ID) {
        await mes(player, "You probably shouldn't use evidence from a crime");
        await mes(player, 'scene to keep flour in...');

        return true;
    }

    player.message('You take some flour from the barrel');
    player.inventory.remove(POT_ID);
    player.inventory.add(POT_OF_FLOUR_ID);
    player.message('Theres still plenty of flour left');

    return true;
}

// ---------------------------------------------------------------------------------------------------------------
// fingerprints: flour, flypaper and the match
// ---------------------------------------------------------------------------------------------------------------

// flour on a silver item: [floury item, message 1, message 2]
const FLOURING = {
    [A_SILVER_DAGGER_ID]: [
        A_SILVER_DAGGER_FLOUR_ID,
        'You sprinkle a small amount of flour on the murderweapon',
        'the murderweapon is now coated with a thin layer of flour'
    ],
    [SILVER_ITEMS.anna.plain]: [
        SILVER_ITEMS.anna.flour,
        'You sprinkle the flour on Annas Necklace',
        'the necklace is now coated with a thin layer of flour'
    ],
    [SILVER_ITEMS.bob.plain]: [
        SILVER_ITEMS.bob.flour,
        'You sprinkle the flour on Bobs Cup',
        'the cup is now coated with a thin layer of flour'
    ],
    [SILVER_ITEMS.carol.plain]: [
        SILVER_ITEMS.carol.flour,
        'You sprinkle the flour on Carols Bottle',
        'the bottle is now coated with a thin layer of flour'
    ],
    [SILVER_ITEMS.david.plain]: [
        SILVER_ITEMS.david.flour,
        'You sprinkle the flour on Davids Book',
        'the book is now coated with a thin layer of flour'
    ],
    [SILVER_ITEMS.eliz.plain]: [
        SILVER_ITEMS.eliz.flour,
        'You sprinkle the flour on Elizabeths Needle',
        'the needle is now coated with a thin layer of flour'
    ],
    [SILVER_ITEMS.frank.plain]: [
        SILVER_ITEMS.frank.flour,
        'You sprinkle the flour on Franks Pot',
        'the pot is now coated with a thin layer of flour'
    ]
};

// flypaper on a floury item: [plain item, fingerprint, message 1, message 2]
const LIFTING = {
    [A_SILVER_DAGGER_FLOUR_ID]: [
        A_SILVER_DAGGER_ID,
        UNIDENTIFIED_FINGERPRINT_ID,
        'You use the flypaper on the floury dagger',
        'You have a clean impression of the murderers finger prints'
    ],
    [SILVER_ITEMS.anna.flour]: [
        SILVER_ITEMS.anna.plain,
        SILVER_ITEMS.anna.print,
        'You use the flypaper on the flour covered Necklace',
        'You have a clean impression of Annas finger prints'
    ],
    [SILVER_ITEMS.bob.flour]: [
        SILVER_ITEMS.bob.plain,
        SILVER_ITEMS.bob.print,
        'You use the flypaper on the flour covered Cup',
        'You have a clean impression of Bobs finger prints'
    ],
    [SILVER_ITEMS.carol.flour]: [
        SILVER_ITEMS.carol.plain,
        SILVER_ITEMS.carol.print,
        'You use the flypaper on the flour covered Bottle',
        'You have a clean impression of Carols finger prints'
    ],
    [SILVER_ITEMS.david.flour]: [
        SILVER_ITEMS.david.plain,
        SILVER_ITEMS.david.print,
        'You use the flypaper on the flour covered Book',
        'You have a clean impression of Davids finger prints'
    ],
    [SILVER_ITEMS.eliz.flour]: [
        SILVER_ITEMS.eliz.plain,
        SILVER_ITEMS.eliz.print,
        'You use the flypaper on the flour covered Needle',
        'You have a clean impression of Elizabeths finger prints'
    ],
    [SILVER_ITEMS.frank.flour]: [
        SILVER_ITEMS.frank.plain,
        SILVER_ITEMS.frank.print,
        'You use the flypaper on the flour covered Pot',
        'You have a clean impression of Franks finger prints'
    ]
};

// named fingerprint id -> the family member it belongs to, in the order the Java tests them
const PRINT_OWNERS = [
    [SILVER_ITEMS.david.print, 'david'],
    [SILVER_ITEMS.bob.print, 'bob'],
    [SILVER_ITEMS.eliz.print, 'eliz'],
    [SILVER_ITEMS.anna.print, 'anna'],
    [SILVER_ITEMS.carol.print, 'carol'],
    [SILVER_ITEMS.frank.print, 'frank']
];

// the id of the other item when one of the pair is `id`, else null
function partner(item, target, id) {
    if (item.id === id) {
        return target.id;
    }

    if (target.id === id) {
        return item.id;
    }

    return null;
}

async function matchFingerprint(player, printId, ownerName) {
    const family = FAMILY[ownerName];

    if (hasKey(player, family.murder)) {
        player.message(`The fingerprints are an exact match to ${family.name}s`);
        player.inventory.remove(UNIDENTIFIED_FINGERPRINT_ID);
        player.inventory.add(MURDERERS_FINGERPRINT_ID);

        if (!hasKey(player, 'culprit')) {
            store(player, 'culprit');
        }
    } else {
        player.message("They don't seem to be the same");
        player.inventory.remove(printId);
        player.message(`I guess that clears ${family.name} of the crime`);
        await delay(player, 2);
        player.message('You destroy the useless fingerprint');
    }
}

async function onUseWithInventory(player, item, target) {
    const withFlour = partner(item, target, POT_OF_FLOUR_ID);

    if (withFlour !== null && FLOURING[withFlour]) {
        const [floury, first, second] = FLOURING[withFlour];

        player.message(first);
        player.message(second);
        player.inventory.remove(POT_OF_FLOUR_ID);
        player.inventory.add(POT_ID);
        player.inventory.remove(withFlour);
        player.inventory.add(floury);

        return true;
    }

    if (withFlour === MURDER_SCENE_POT_ID) {
        player.message('You sprinkle a small amount of flour on the strange smelling pot');
        player.message("The surface isn't shiny enough to take a fingerprint from");
        player.inventory.remove(POT_OF_FLOUR_ID);
        player.inventory.add(POT_ID);

        return true;
    }

    const withPaper = partner(item, target, FLYPAPER_ID);

    if (withPaper !== null && LIFTING[withPaper]) {
        const [plain, print, first, second] = LIFTING[withPaper];

        player.message(first);
        player.message(second);
        player.inventory.remove(withPaper);
        player.inventory.add(plain);
        player.inventory.add(print, 1);
        player.inventory.remove(FLYPAPER_ID);

        return true;
    }

    const withPrint = partner(item, target, UNIDENTIFIED_FINGERPRINT_ID);
    const owner = withPrint === null ? null : PRINT_OWNERS.find(([id]) => id === withPrint);

    if (owner) {
        await matchFingerprint(player, owner[0], owner[1]);

        return true;
    }

    return false;
}

module.exports = {
    onTalkToNPC,
    onGroundItemTake,
    onWallObjectCommandOne,
    onGameObjectCommandTwo,
    onUseWithGameObject,
    onUseWithInventory
};
