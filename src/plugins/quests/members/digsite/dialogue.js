// The talking of the Dig Site (quests/members/digsite/shared.js has the stage map): the panning guide (DigsiteGuide.java), the
// workmen (DigsiteWorkman.java), the Examiner (DigsiteExaminer.java), the three students (DigsiteStudents.java) and the
// archaeological expert (DigsiteExpert.java), and the items used on them. AGPL-3.0.

const { NPC, ITEM, stageOf, setStage, mes, give, completeQuest } = require('./shared');

const TALK_IDS = new Set([
    NPC.WORKMAN,
    NPC.WORKMAN_UNDERGROUND,
    NPC.EXAMINER,
    NPC.STUDENT_PURPLE,
    NPC.STUDENT_GREEN,
    NPC.GUIDE,
    NPC.STUDENT_ORANGE,
    NPC.EXPERT
]);

// ---------------------------------------------------------------- the panning guide (726)

async function guide(player, npc) {
    await player.say('Hello, who are you ?');
    await npc.say("Hello, I am the panning guide", "I'm here to teach you how to pan for gold");
    await player.say('Excellent!');
    await npc.say(
        'Let me explain how panning works...',
        'First You need a panning tray',
        'Use the tray in the panning points in the water',
        'Then examine your tray',
        'If you find any gold, take it to the expert',
        'Up in the museum storage facility',
        "He will calculate it's value for you"
    );
    await player.say('Okay thanks');
}

// ---------------------------------------------------------------- the workmen (722, 738)

async function workman(player, npc) {
    const stage = stageOf(player);

    if (stage === -1) {
        await player.say('Hello there');
        await npc.say("Ah it's the great archaeologist!", 'Congratulations on your discovery');
        return;
    }

    await player.say('Hello there');
    await npc.say('Good day, what can I do for you ?');

    const menu = await player.ask(['What do you do here ?', "I'm not sure...", 'Can I dig around here ?'], true);

    if (menu === 0) {
        await npc.say(
            'I am involved in various stages of the dig',
            'From the initial investigation to the installation of the mine shafts'
        );
        await player.say('Oh okay, thanks');
    } else if (menu === 1) {
        await npc.say('Well, let me know when you are');
    } else if (menu === 2) {
        await npc.say('You can only use the site you have the appropriate exam level for');

        const sub = await player.ask(['Appropriate exam level ?', 'I am already skilled in digging'], true);

        if (sub === 0) {
            await npc.say(
                'Yes, only persons with the correct certificate of earth sciences can dig here',
                'A level 1 certificate will let you dig in a level 1 site and so on...'
            );
            await player.say('Oh, okay I understand');
        } else if (sub === 1) {
            await npc.say('Well that\'s nice for you...', "You can't dig around here without a certificate though");
        }
    }
}

async function keyBegging(player, npc) {
    // the chain of "please"s: each further menu keeps the begging option first; the buy / "my key" options end it
    const BEGS = [
        'I don\'t suppose I could use it ?',
        'Please',
        'Aww...go on',
        'Pretty please!',
        'Pretty please with sugar on top!'
    ];
    const REPLIES = [
        ['Aww, but I need it...'],
        ['I am not sure about this...'],
        ['Hmmm...well I don\'t know'],
        ['You are trying to change my mind']
    ];

    for (let i = 0; i < BEGS.length; i += 1) {
        const menu = await player.ask([BEGS[i], 'Can I buy it from you ?', "Hey that's my key!"], true);

        if (menu === 1) {
            await npc.say('Ooo no, I need it!');
            return;
        }

        if (menu === 2) {
            await npc.say("You don't think im going to fall for that do you ?", 'Get lost!');
            return;
        }

        if (i === BEGS.length - 1) {
            give(player, ITEM.CHEST_KEY, 1);
            await npc.say('All right, all right!', "Stop begging I can't stand it.", "Here's the key...take care of it");
            await player.say('Thanks');
            return;
        }

        await npc.say(...REPLIES[i]);

        if (i === 3) {
            await player.say('Of course!');
        }
    }
}

async function workmanUnderground(player, npc) {
    await player.say('Hello');
    await npc.say('Well well...', 'I have a visitor', 'What are you doing here ?');

    const menu = await player.ask(
        ['I have been invited to research here', 'I am not sure really', "I'm here to get rich rich rich!"],
        true
    );

    if (menu === 0) {
        await npc.say('Indeed you must be someone special to be allowed down here...');

        const next = await player.ask(
            ['Do you know where to find a specimen jar ?', 'Do you know where to find a chest key'],
            true
        );

        if (next === 0) {
            await npc.say('Hmmm, let me think...', "Nope, can't help you there i'm afraid");
        } else if (next === 1) {
            await npc.say('Yes I might have one...');
            await keyBegging(player, npc);
        }
    } else if (menu === 1) {
        await npc.say('A miner without a clue - how funny');
    } else if (menu === 2) {
        await npc.say("Oh, well don't forget that wealth and riches isn't everything...");
    }
}

// ---------------------------------------------------------------- the Examiner (723)

// "I have lost my trowel!"
async function lostTrowel(player, npc) {
    if (player.inventory.has(ITEM.TROWEL)) {
        await npc.say('Really ?', 'Look in your backpack and make sure first');
    } else {
        give(player, ITEM.TROWEL, 1);
        await npc.say('Deary me.. that was a good one as well', "It's a good job I have another", 'Here you go');
    }
}

// the three exams: questions with the options once the three students have told the answers (`informed`) and without. In
// the Java the options differ by cache state and an answer counts only when informed and it is the right one
const EXAMS = {
    1: {
        key: 'c',
        intro: [
            'Okay, we will start with the first level exam:',
            'Earth sciences level 1 - Beginner',
            'Question 1 - Earth sciences overview...',
            'Can you tell me what earth sciences is ?'
        ],
        questions: [
            {
                informed: [
                    "The study of the earth, It's contents and It's history",
                    'The study of planets, and the history of forming worlds',
                    'The combination of all skills applied to the working of the earth'
                ],
                right: 0,
                other: [
                    'The study of gardening, planting and fruiting vegetation',
                    'The study of planets, and the history of worlds',
                    'The combination of all skills applied to the working of the earth'
                ]
            },
            {
                before: [
                    'Okay, next question...',
                    'Earth sciences level 1',
                    'Question 2 - Elligibility',
                    'Can you tell me what people are allowed to use the digsite ?'
                ],
                informed: [
                    'Professors, students and workmen only',
                    'Local residents, and contractors only',
                    'All that have passed the appropriate earth sciences exam'
                ],
                right: 2,
                other: [
                    'Magic users, miners and their escorts',
                    'Professors, students and workmen only',
                    'Local residents, and contractors only'
                ]
            },
            {
                before: [
                    'Okay, next question...',
                    'Earth sciences level 1',
                    'Question 3 - Health and safety',
                    'Can you tell me the proper safety points when working in a digsite ?'
                ],
                informed: [
                    'Overcoats and facemasks to be worn at all times',
                    'Gloves and boots to be worn at all times, proper tools must be used',
                    'Protective clothing to be worn, tools kept away from site'
                ],
                right: 1,
                other: [
                    'Heat-resistant clothing to be worn at all times',
                    'Overcoats and facemasks to be worn at all times',
                    'Protective clothing to be worn, tools kept away from site'
                ]
            }
        ],
        closing: ['Okay, that covers level 1 Earthsciences exam', "Let's see how you did..."],
        closingTicks: 5
    },
    2: {
        key: 'exam2',
        intro: [
            'Okay, this is the next part of the earth sciences exam',
            'Earth sciences level 2- Intermediate',
            'Question 1 - Sample transportation',
            'Can you tell me how we transport samples ?'
        ],
        questions: [
            {
                informed: [
                    'Samples ground and suspended in an acid solution',
                    'Samples to be left at digsite for examination',
                    'Samples taken in rough form, kept only in sealed containers'
                ],
                right: 2,
                other: [
                    'Samples cut and cleaned before transportation',
                    'Samples ground and suspended in an acid solution',
                    'Samples to be left at digsite for examination'
                ]
            },
            {
                before: [
                    'Okay, next question...',
                    'Earth sciences level 2',
                    'Question 2 - handling of finds',
                    'What is the proper way to handle finds ?'
                ],
                informed: [
                    'Finds must be carefully handled, and gloves worn',
                    'Finds to be given to the site workmen',
                    'Finds are kept together for safekeeping'
                ],
                right: 0,
                other: [
                    'Finds must not be handled by anyone',
                    'Finds to be given to the site workmen',
                    'Finds are kept together for safekeeping'
                ]
            },
            {
                before: [
                    'Okay, next question...',
                    'Earth sciences level 2',
                    'Question 3 - Rockpick usage',
                    'Can you tell me the proper usage for a rockpick ?'
                ],
                informed: [
                    'Rockpick must be used flat and with strong force',
                    "Always handle with care, strike the rock cleanly on it's cleaving point",
                    'Rockpicks to be used only in emergencies'
                ],
                right: 1,
                other: [
                    'Strike rock repeatedly until powdered',
                    'Rockpick must be used flat and with strong force',
                    'Rockpicks to be used only in emergencies'
                ]
            }
        ],
        closing: ['Okay, that covers level 2 Earthsciences exam', 'Let me add up your total...'],
        closingTicks: 3
    },
    3: {
        key: 'exam3',
        intro: [
            'Attention, this is the final part of the earth sciences exam',
            'Earth sciences level 3 - Advanced',
            'Question 1 - Sample preparation',
            'Can you tell me how we prepare samples ?'
        ],
        questions: [
            {
                informed: [
                    'Samples cleaned and carried only in specimen jars',
                    'Sample types catalogued and carried by hand only',
                    'Samples not to be prepared by any means'
                ],
                right: 0,
                other: [
                    'Samples may be mixed together safely',
                    'Sample types catalogued and carried by hand only',
                    'Samples not to be prepared by any means'
                ]
            },
            {
                before: [
                    'Okay, next question...',
                    'Earth sciences level 3',
                    'Question 2 - Specimen brush use',
                    'What is the proper way to use the specimen brush ?'
                ],
                informed: [
                    'Brush carefully and slowly, using short strokes',
                    'Brush pre-cleaned samples only',
                    'Brush quickly and with force'
                ],
                right: 0,
                other: [
                    'Brush quickly using a wet brush',
                    'Brush pre-cleaned samples only',
                    'Brush quickly and with force'
                ]
            },
            {
                before: [
                    'Okay, next question...',
                    'Earth sciences level 3',
                    'Question 3 - Advanced techniques',
                    'Can you tell me the proper technique for dealing with bones ?'
                ],
                informed: [
                    'Bones must be suspended in a sterile solution',
                    'Bones to be ground and tested for mineral content',
                    'Handle bones very carefully, and keep away from other samples'
                ],
                right: 2,
                other: [
                    'Bones must not be taken from the digsite',
                    'Bones must be suspended in a sterile solution',
                    'Bones to be ground and tested for mineral content'
                ]
            }
        ],
        closing: ['Okay, that concludes level 3 Earthsciences exam', 'Let me add up the results..."'],
        closingTicks: 3
    }
};

const COLOURS = ['orange', 'green', 'purple'];

function informed(player, level) {
    const suffix = EXAMS[level].key;

    return COLOURS.every((colour) => player.cache[`student_${colour}_${suffix}`]);
}

// the pass and fail lines of each exam
async function examResult(player, npc, level, correct) {
    if (correct === 3) {
        // only reachable when informed: nothing else counts
        if (level === 1) {
            await npc.say('You got all the questions correct, well done');
            await player.say('Hey! Excellent!');
            await npc.say(
                'You have now passed the Earth sciences level 1 general exam',
                'Here is your certificate to prove it',
                'You also get a decent trowel to dig with'
            );
            await npc.say('Here you go...');
            player.message('The examiner hands you a trowel');
            give(player, ITEM.TROWEL, 1);
            give(player, ITEM.LEVEL_1_CERTIFICATE, 1);
            setStage(player, 3);
        } else if (level === 2) {
            await npc.say('You got all the questions correct, well done!');
            await player.say("Great, I'm getting good at this");
            await npc.say(
                'You have now passed the Earth sciences level 2 intermediate exam',
                'Here is your certificate'
            );
            give(player, ITEM.LEVEL_2_CERTIFICATE, 1);
            setStage(player, 4);
        } else {
            await npc.say('You got all the questions correct, well done!');
            await player.say('Hooray!');
            await npc.say(
                'Congratulations, You have now passed the Earth sciences level 3 advanced exam',
                'Here is your level 3 certificate'
            );
            give(player, ITEM.LEVEL_3_CERTIFICATE, 1);
            await player.say('I can dig wherever I want now...');
            setStage(player, 5);
        }

        for (const colour of COLOURS) {
            delete player.cache[`student_${colour}_${EXAMS[level].key}`];
        }

        return;
    }

    if (level === 1) {
        if (correct === 0) {
            await npc.say('Oh deary me!', 'This is appauling, none correct at all!', 'I suggest you go and study properly...');
            await player.say('Oh dear...');
        } else if (correct === 1) {
            await npc.say('You got 1 question correct', 'Better luck next time');
            await player.say('Oh bother!');
        } else {
            await npc.say('You got 2 questions correct', 'Not bad, just a little more revision needed');
            await player.say('Oh well...');
        }
    } else if (level === 2) {
        if (correct === 0) {
            await npc.say('No no no!', 'This will not do', 'They are all wrong, start again!');
            await player.say('Oh no!');
        } else if (correct === 1) {
            await npc.say('You got 1 question correct', "At least it's a start");
            await player.say('Oh well...');
        } else {
            await npc.say('You got 2 questions correct', 'Not too bad, but you can do better...');
            await player.say('Nearly got it');
        }
    } else if (correct === 0) {
        await npc.say(
            'I cannot believe this!',
            'Absolutely none right at all',
            'I doubt you did any research before you took this exam...'
        );
        await player.say('Ah...yes...erm....', 'I think I had better go and revise first!');
    } else if (correct === 1) {
        await npc.say('You got 1 question correct', 'Try harder!');
        await player.say('Oh bother!');
    } else {
        await npc.say('You got 2 questions correct', 'A little more study and you will pass it');
        await player.say("I'm nearly there...");
    }
}

async function runExam(player, npc, level) {
    const exam = EXAMS[level];
    const wise = informed(player, level);
    let correct = 0;

    await npc.say(...exam.intro);

    for (const question of exam.questions) {
        if (question.before) {
            await npc.say(...question.before);
        }

        const options = wise ? question.informed : question.other;
        const answer = await player.ask(options, true);

        if (wise && answer === question.right) {
            correct += 1;
        }
    }

    await npc.say(...exam.closing);
    await player.world.sleepTicks(exam.closingTicks);
    await examResult(player, npc, level, correct);
}

async function examiner(player, npc) {
    const stage = stageOf(player);

    if (stage === -1) {
        await npc.say(
            'Hi there',
            'My colleague tells me you helped to uncover',
            'A hidden altar to the god zaros',
            'A great scholar and archaeologist indeed!',
            'Good health and prosperity to you'
        );

        const menu = await player.ask(['Thanks!', 'I have lost my trowel!'], true);

        if (menu === 1) {
            await lostTrowel(player, npc);
        }
    } else if (stage === 0) {
        await player.say('Hello');
        await npc.say(
            'Ah hello there',
            'I am the resident lecturer on antiquities and artifacts',
            'I also set the earth sciences exams'
        );
        await player.say('earth sciences ?');
        await npc.say('That is right dear', "The world of RuneScape holds many wonders beneath it's surface");

        const menu = await player.ask(['Can I take an exam ?', 'Interesting...'], true);

        if (menu === 0) {
            await npc.say(
                'You can if you get this letter of recommendation stamped',
                'By the curator of varrock museum'
            );
            await player.say("Oh right, I'll see what I can do");
            give(player, ITEM.UNSTAMPED_LETTER, 1);
            setStage(player, 1);
        } else if (menu === 1) {
            await npc.say('You could gain much with an understanding of the world below');
        }
    } else if (stage === 1) {
        await player.say('Hello');
        await npc.say('Hello again');

        if (player.inventory.has(ITEM.STAMPED_LETTER)) {
            await player.say('Here is the stamped letter you asked for');
            player.inventory.remove(ITEM.STAMPED_LETTER);
            setStage(player, 2);
            await npc.say('Good good, we will begin the exam...');
            await runExam(player, npc, 1);
        } else {
            await npc.say('I am still waiting for your stamped letter of recommendation');

            const menu = await player.ask(['I have lost the letter you gave me', "All right I'll try and get it"], false);

            if (menu === 0) {
                await player.say('I have lost the letter you gave me');

                if (player.inventory.has(ITEM.UNSTAMPED_LETTER)) {
                    await npc.say('Oh now come on', 'You have it with you!');
                } else {
                    await npc.say('That was foolish!', 'Take this one and keep it safe this time...');
                    give(player, ITEM.UNSTAMPED_LETTER, 1);
                }
            } else if (menu === 1) {
                await player.say("All right i'll try and get it");
                await npc.say('I am sure you wont get any problems');
            }
        }
    } else if (stage === 2) {
        await player.say('Hello');
        await npc.say('Hello again', 'Are you ready for another shot at the exam ?');

        const menu = await player.ask(['Yes I certainly am', 'No, not at the moment'], false);

        if (menu === 0) {
            await player.say('Yes I certainly am');
            await runExam(player, npc, 1);
        } else if (menu === 1) {
            await player.say("Sorry, I didn't mean to disturb you...");
            await npc.say('Oh, no problem at all');
        }
    } else if (stage === 3 || stage === 4) {
        await player.say('Hello');
        await npc.say(stage === 3 ? 'Hi there' : 'Ah hello again');

        const menu = await player.ask(
            [
                stage === 3 ? 'I am ready for the next exam section' : 'I am ready for the last part of the exam',
                'I am stuck on a question',
                "Sorry, I didn't mean to disturb you...",
                'I have lost my trowel!'
            ],
            true
        );

        if (menu === 0) {
            await runExam(player, npc, stage === 3 ? 2 : 3);
        } else if (menu === 1) {
            await npc.say(
                'Well well, have you not been doing your studies ?',
                'I am not going to give you the answers',
                'Talk to the other students and remember the answers'
            );
        } else if (menu === 2) {
            await npc.say('Oh, no problem at all');
        } else if (menu === 3) {
            await lostTrowel(player, npc);
        }
    } else if (stage === 5 || stage === 6) {
        await player.say('Hello');
        await npc.say(
            'Hi',
            'You have finished all the earth science exams now',
            'Congratulations on your graduation',
            'You now have free access to dig anywhere on the digsite'
        );

        const menu = await player.ask(['Thanks!', 'I have lost my trowel!'], true);

        if (menu === 1) {
            await lostTrowel(player, npc);
        }
    }
}

// ---------------------------------------------------------------- the students (727 orange, 725 green, 724 purple)

// correct rock passed at the correct time
async function giveRock(player, npc) {
    if (npc.id === NPC.STUDENT_ORANGE) {
        await player.say('Look what I found');
        player.inventory.remove(ITEM.ROCK_SAMPLE_ORANGE);
        player.cache.student_orange_c = true;
        delete player.cache.student_orange_s;
        await npc.say(
            'Excellent!',
            "I'm so happy",
            'Let me now help you with your exams...',
            'The elligible people to use the digsite are:',
            'All that have passed the appropriate earth sciences exams'
        );
        await player.say('Thanks for the information');
    } else if (npc.id === NPC.STUDENT_GREEN) {
        await player.say('Hi, is this your rock sample ?');
        player.inventory.remove(ITEM.ROCK_SAMPLE_GREEN);
        player.cache.student_green_c = true;
        delete player.cache.student_green_s;
        await npc.say(
            'Oh wow! you\'ve found it!',
            'Thank you so much',
            "I'll be glad to tell you what I know about the exam",
            'The study of earthsciences is:',
            "The study of the earth, It's contents and It's history"
        );
        await player.say("Okay I'll remember that");
    } else if (npc.id === NPC.STUDENT_PURPLE) {
        await player.say('Guess what I found ?');
        player.inventory.remove(ITEM.ROCK_SAMPLE_PURPLE);
        player.cache.student_purple_c = true;
        delete player.cache.student_purple_s;
        await npc.say(
            'Hey! my sample!',
            'Thanks ever so much',
            'Let me help you with those questions now',
            'The proper health and safety points are:',
            'Gloves and boots to be worn at all times, proper tools must be used'
        );
        await player.say('Great, thanks for your advice');
    }
}

async function studentOrange(player, npc) {
    const stage = stageOf(player);

    if (stage === 0 || stage === 1) {
        await player.say('Hello there');
        await npc.say('Hello there, as you can see I am a student');
        await player.say('What are you doing here ?');
        await npc.say("Oh I'm studying for the earth sciences exam");
        await player.say('Interesting....perhaps I should study it as well...');
    } else if (stage === 2) {
        await player.say('Hello there');

        if (player.cache.student_orange_c) {
            await npc.say('How\'s it going ?');
            await player.say("There are more exam questions I'm stuck on");
            await npc.say(
                "Hey, i'll tell you what I've learned, that may help",
                'The elligible people to use the digsite are:',
                'All that have passed the appropriate earth sciences exams'
            );
            await player.say('Thanks for the information');
        } else if (player.cache.student_orange_s) {
            if (player.inventory.has(ITEM.ROCK_SAMPLE_ORANGE)) {
                await giveRock(player, npc);
            } else {
                await player.say("How's the study going ?");
                await npc.say("I'm getting there", 'Have you found my rock sample yet ?');
                await player.say('No sorry, not yet');
                await npc.say("Oh dear, I hope it didn't fall into the stream", 'I might never find it again...');
            }
        } else {
            await player.say('Can you help me with the earth sciences exams at all?');
            await npc.say("I can't do anything unless I find my rock sample");
            await player.say('Hey this rings a bell');
            await npc.say('?');
            await player.say("So if I find it you'll help me ?");
            await npc.say('I sure will');
            await player.say('Any ideas where it may be ?');
            await npc.say('All I remember is that I was working near the tents when I lost it...');
            await player.say("Okay I'll see what I can do ");
            player.cache.student_orange_s = true;
        }
    } else if (stage === 3) {
        await player.say('Hello there');
        await npc.say("How's it going ?");
        await player.say("There are more exam questions I'm stuck on");
        await npc.say(
            "Hey, i'll tell you what I've learned, that may help",
            'Correct sample transportation:',
            'Samples taken in rough form, kept only in sealed containers'
        );
        await player.say('Thanks for the information');
        player.cache.student_orange_exam2 = true;
    } else if (stage === 4) {
        await player.say('Hello there');
        await npc.say("How's it going ?");
        await player.say("There are more exam questions I'm stuck on");
        await npc.say(
            "Hey, i'll tell you what I've learned, that may help",
            'The proper technique for handling bones is:',
            'Handle bones very carefully, and keep away from other samples'
        );
        await player.say('Thanks for the information');
        player.cache.student_orange_exam3 = true;
    } else if (stage === 5) {
        await player.say('Hello there');
        await npc.say('Thanks a lot for finding my rock sample', 'See you again');
    } else {
        await npc.say("Hey it's the great explorer!", 'Well done for finding the altar');
    }
}

async function studentGreen(player, npc) {
    const stage = stageOf(player);

    if (stage === 0 || stage === 1) {
        await player.say('Hello there');
        await npc.say("Oh hi, i'm studying hard for an exam");
        await player.say('What exam is that ?');
        await npc.say("It's the earth sciences exam");
        await player.say('Interesting....');
    } else if (stage === 2) {
        await player.say('Hello there');

        if (player.cache.student_green_c) {
            await npc.say("How's it going ?");
            await player.say('I need more help with the exam');
            await npc.say(
                'Well okay, this is what I have learned since I last spoke to you...',
                'The study of earthsciences is:',
                "The study of the earth, It's contents and It's history"
            );
            await player.say("Okay I'll remember that");
        } else if (player.cache.student_green_s) {
            if (player.inventory.has(ITEM.ROCK_SAMPLE_GREEN)) {
                await giveRock(player, npc);
            } else {
                await player.say("How's the study going ?");
                await npc.say('Very well thanks', 'Have you found my rock sample yet ?');
                await player.say('No sorry, not yet');
                await npc.say('Oh well...', "I am sure it's been picked up", "Couldn't you try looking through some pockets ?");
            }
        } else {
            await player.say('Can you help me with the earth sciences exams at all?');
            await npc.say('Well...maybe I will if you help me with something');
            await player.say("What's that ?");
            await npc.say('I have lost my rock sample');
            await player.say('What does it look like ?');
            await npc.say('Err....like a rock!');
            await player.say("Well that's not too helpful", 'Can you remember where you last had it ?');
            await npc.say("It was around here for sure", 'Maybe someone picked it up ?');
            await player.say("Okay I'll have a look for you");
            player.cache.student_green_s = true;
        }
    } else if (stage === 3) {
        await player.say('Hello there');
        await npc.say("How's it going ?");
        await player.say('I need more help with the exam');
        await npc.say(
            'Well okay, this is what I have learned since I last spoke to you...',
            'Correct rockpick usage:',
            "Always handle with care, strike the rock cleanly on it's cleaving point"
        );
        await player.say("Okay I'll remember that");
        player.cache.student_green_exam2 = true;
    } else if (stage === 4) {
        await player.say('Hello there');
        await npc.say("How's it going ?");
        await player.say('I need more help with the exam');
        await npc.say(
            'Well okay, this is what I have learned since I last spoke to you...',
            'Specimen brush use:',
            'Brush carefully and slowly, using short strokes'
        );
        await player.say("Okay I'll remember that");
        player.cache.student_green_exam3 = true;
    } else if (stage === 5) {
        await player.say('Hello there');
        await npc.say("Thanks for your help, I'll pass these exams yet!", 'See you later');
    } else {
        await npc.say('Oh hi again', 'News of your find has spread fast', 'You are quite famous around here now');
    }
}

async function studentPurple(player, npc) {
    const stage = stageOf(player);

    if (stage === 0 || stage === 1) {
        await player.say('Hello there');
        await npc.say("Hi there, I'm studying for the earth sciences exam");
        await player.say('Interesting....This exam seems to be a popular one!');
    } else if (stage === 2) {
        await player.say('Hello there');

        if (player.cache.student_purple_c) {
            await npc.say("How's it going ?");
            await player.say('I am stuck on some more exam questions');
            await npc.say(
                "Okay, I'll tell you my latest notes...",
                'The proper health and safety points are:',
                'Gloves and boots to be worn at all times, proper tools must be used'
            );
            await player.say('Great, thanks for your advice');
        } else if (player.cache.student_purple_s) {
            if (player.inventory.has(ITEM.ROCK_SAMPLE_PURPLE)) {
                await giveRock(player, npc);
            } else {
                await player.say("How's the study going ?");
                await npc.say('Very well thanks', 'Have you found my rock sample yet ?');
                await player.say('No sorry, not yet');
                await npc.say("I'm sure it's just outside the digsite somewhere...");
            }
        } else {
            await player.say('Can you help me with the exams at all?');
            await npc.say('I can if you help me...');
            await player.say('How can I do that');
            await npc.say('I have lost my rock sample');
            await player.say('What you as well ?');
            await npc.say("Err, yes it's gone somewhere");
            await player.say('Do you know where you dropped it ?');
            await npc.say(
                'Well, I was doing a lot of walking that day...',
                "Oh yes, that's right...",
                'We were studying ceramics in fact',
                'I found some pottery...',
                'And it seemed to match the design that is on those large urns...',
                '...I was in the process of checking this out',
                'And when we got back to the centre...',
                'My rock sample had gone'
            );
            await player.say("Leave it to me, I'll find it");
            await npc.say('Oh great!');
            player.cache.student_purple_s = true;
        }
    } else if (stage === 3) {
        await player.say('Hello there');
        await npc.say("How's it going ?");
        await player.say('I am stuck on some more exam questions');
        await npc.say(
            "Okay, I'll tell you my latest notes...",
            'Finds handling:',
            'Finds must be carefully handled, and gloves worn'
        );
        await player.say('Great, thanks for your advice');
        player.cache.student_purple_exam2 = true;
    } else if (stage === 4) {
        if (player.cache.student_purple_exam3) {
            await player.say('Hello there');
            await npc.say('Hi, the opal looks magnificent', "Thanks for everything you've done for me");
        } else if (player.cache.student_purple_opal) {
            await player.say('Hello there');
            await npc.say('Oh hi again', 'Did you bring me the opal ?');

            if (player.inventory.has(ITEM.UNCUT_OPAL)) {
                await player.say('Would that opal look like this by any chance ?');
                player.inventory.remove(ITEM.UNCUT_OPAL);
                player.cache.student_purple_exam3 = true;
                delete player.cache.student_purple_opal;
                await npc.say(
                    'Wow, great you\'ve found one',
                    'This will look beautiful set in my necklace',
                    "Thanks for that, now I'll tell you what I know...",
                    'Sample preparation:',
                    'Samples cleaned and carried only in specimen jars'
                );
                await player.say('Great, thanks for your advice');
            } else {
                await player.say("I haven't found one yet");
                await npc.say('Oh well, tell me when you do');
            }
        } else {
            await player.say('Hello there');
            await npc.say('What, you want more help ?');
            await player.say('Err... yes please!');
            await npc.say("Well.. it's going to cost you...");
            await player.say('Oh, well how much ?');
            await npc.say(
                "I'll tell you what I would like...",
                "A precious stone, I don't find many of these",
                'My favourite is an opal, they are beautiful',
                '...Just like me',
                'Tee hee hee !'
            );
            await player.say("Err... okay I'll see what I can do");
            player.cache.student_purple_opal = true;
        }
    } else if (stage === 5) {
        await player.say('Hello there');
        await npc.say("Thanks for your help, I'll pass these exams yet!", 'See you later');
    } else {
        await npc.say(
            'Hi there',
            "Thanks again, hey maybe I'll be asking you",
            'For help next time...',
            "It seems you are something of an expert now !"
        );
    }
}

// ---------------------------------------------------------------- the archaeological expert (728)

async function expert(player, npc) {
    if (stageOf(player) === -1) {
        await npc.say(
            'Hello again',
            'I am now studying this mysterious altar and its inhabitants',
            'The markings are strange, but it refers to a god I have never',
            'heard of before named Zaros. It must be some pagan superstition.',
            'That was a great find, who knows what other secrets',
            'Lie buried beneath the surface of our land...'
        );
        return;
    }

    await player.say('Hello, who are you ?');
    await npc.say(
        'Good day to you',
        'My name is Terry balando',
        'I am an expert on digsite finds',
        'I am employed by the museum in varrock',
        'To oversee all finds in this digsite',
        'Anything you find must be reported to me'
    );
    await player.say('Oh, okay if I find anything of interest I will bring it here');
    await npc.say('Very good', 'Can I help you at all ?');

    const menu = await player.ask(
        ['I have something I need checking out', 'No thanks', 'Can you tell me anything about the digsite?'],
        false
    );

    if (menu === 0) {
        await player.say('I have something I need checking out');
        await npc.say("Okay, give it to me and I'll have a look for you");
    } else if (menu === 1) {
        await player.say('No thanks');
        await npc.say('Good, let me know if you find anything unusual');
    } else if (menu === 2) {
        await player.say('Can you tell me anything about the digsite ?');
        await npc.say(
            'Yes indeed, I am currently studying the lives of the settlers',
            'During the end of the third age, this used to be a great city',
            "It's inhabitants were humans, supporters of the god Saradomin",
            "It's not recorded what happened to the community here",
            'I suspect nobody has lived here for over a millenium!'
        );
    }
}

// ---------------------------------------------------------------- talking

async function onTalkToNPC(player, npc) {
    if (!TALK_IDS.has(npc.id)) {
        return false;
    }

    player.engage(npc);

    try {
        switch (npc.id) {
            case NPC.GUIDE:
                await guide(player, npc);
                break;
            case NPC.WORKMAN:
                await workman(player, npc);
                break;
            case NPC.WORKMAN_UNDERGROUND:
                await workmanUnderground(player, npc);
                break;
            case NPC.EXAMINER:
                await examiner(player, npc);
                break;
            case NPC.STUDENT_ORANGE:
                await studentOrange(player, npc);
                break;
            case NPC.STUDENT_GREEN:
                await studentGreen(player, npc);
                break;
            case NPC.STUDENT_PURPLE:
                await studentPurple(player, npc);
                break;
            default:
                await expert(player, npc);
        }
    } finally {
        if (player.interlocutor) {
            player.disengage();
        }
    }

    return true;
}

// ---------------------------------------------------------------- items used on the students

const STUDENT_ROCKS = {
    [NPC.STUDENT_ORANGE]: ITEM.ROCK_SAMPLE_ORANGE,
    [NPC.STUDENT_GREEN]: ITEM.ROCK_SAMPLE_GREEN,
    [NPC.STUDENT_PURPLE]: ITEM.ROCK_SAMPLE_PURPLE
};

const STUDENT_KEYS = {
    [NPC.STUDENT_ORANGE]: 'orange',
    [NPC.STUDENT_GREEN]: 'green',
    [NPC.STUDENT_PURPLE]: 'purple'
};

async function useOnStudent(player, npc, item) {
    const colour = STUDENT_KEYS[npc.id];
    const sample = STUDENT_ROCKS[npc.id];
    const stage = stageOf(player);
    const ALREADY = 1;
    const WRONG = 2;
    const CRACKED = 3;
    let outcome = -1;

    if (item.id === ITEM.CRACKED_ROCK_SAMPLE) {
        outcome = CRACKED;
    } else {
        const gave = stage >= 3 || stage === -1 || player.cache[`student_${colour}_c`];
        const asked = player.cache[`student_${colour}_s`];

        if (gave) {
            outcome = item.id === sample ? ALREADY : WRONG;
        } else if (asked) {
            if (item.id === sample) {
                await giveRock(player, npc);
            } else {
                outcome = WRONG;
            }
        } else if (item.id === sample) {
            await mes(player, 'I am not sure why I am giving this rock to the student...');
        } else {
            await mes(player, `Perhaps I should speak to ${colour === 'purple' ? 'her' : 'him'} first`);
        }
    }

    if (outcome === ALREADY) {
        await npc.say("Uh? you've already given me my rock sample back!");
    } else if (outcome === WRONG || outcome === CRACKED) {
        player.message('You give the rock sample to the student');
        await player.say('Is this your sample ?');

        if (outcome === WRONG) {
            await npc.say('Oh dear, no it\'s not', 'It looks a bit like this, but not the same...');
        } else if (npc.id === NPC.STUDENT_GREEN) {
            await npc.say('This ? oh no...', "mine wasn't in two pieces");
        } else if (npc.id === NPC.STUDENT_ORANGE) {
            await npc.say('This broken rock ?', 'I hope not!');
        } else {
            // deviation: no captured dialogue in the Java sources either ("recreated")
            await npc.say('This one cracked ?', "don't think so.");
        }
    }
}

// ---------------------------------------------------------------- items used on the expert

const EXPERT_RESPONSES = {
    [ITEM.PANNING_TRAY_FULL]: async (player, npc) => {
        player.message('You give the panning tray to the expert');
        await npc.say('Have you searched this tray yet ?');
        await player.say('Not that I remember');
        await npc.say("It may contain something, I don't want to get my hands dirty");
        player.message('The expert hands the tray back to you');
    },
    [ITEM.PANNING_TRAY_GOLD_NUGGET]: async (player, npc) => {
        player.message('You give the panning tray to the expert');
        await npc.say('Did you realize there is something in this tray ?');
        await player.say('Err, not really');
        await npc.say('Check it out thoroughly first');
        player.message('The expert hands you back the tray');
    },
    [ITEM.PANNING_TRAY]: async (player, npc) => {
        player.message('You give the panning tray to the expert');
        await npc.say('I have no need for panning trays');
    },
    [ITEM.CRACKED_ROCK_SAMPLE]: async (player, npc) => {
        await player.say('I found this rock...');
        await npc.say("What a shame it's cracked, this looks like it would have been a good sample");
    },
    [ITEM.UNIDENTIFIED_LIQUID]: async (player, npc) => {
        await player.say('Do you know what this is ?');
        await npc.say('Where did you get this ?');
        await player.say('From one of the barrels at the digsite');
        await npc.say('This is a dangerous liquid called nitroglycerin', 'Be careful how you handle it');
        player.inventory.remove(ITEM.UNIDENTIFIED_LIQUID);
        player.inventory.add(ITEM.NITROGLYCERIN);
    },
    [ITEM.NITROGLYCERIN]: async (player, npc) => {
        await player.say('Can you tell me any more about this ?');
        await npc.say(
            'nitroglycerin...this is a dangerous substance',
            'This is normally mixed with other chemicals',
            'To produce a potent compound...',
            'Be sure not to drop it!',
            'That stuff is highly volatile...'
        );
    },
    [ITEM.UNIDENTIFIED_POWDER]: async (player, npc) => {
        await player.say('Do you know what this powder is ?');
        await npc.say(
            'Really you do find the most unusual items',
            'I know what this is...',
            "It's called ammonium nitrate - A strong chemical",
            "Why you want this i'll never know..."
        );
        player.inventory.remove(ITEM.UNIDENTIFIED_POWDER);
        player.inventory.add(ITEM.AMMONIUM_NITRATE);
    },
    [ITEM.MIXED_CHEMICALS_1]: async (player, npc) => {
        await player.say('Hey, look at this');
        await npc.say('Hmmm, that looks dangerous...', "Handle it carefully and don't drop it!");
    },
    [ITEM.EXPLOSIVE_COMPOUND]: async (player, npc) => {
        await player.say('What do you think about this ?');
        await npc.say('What have you concocted now ?', 'Just be careful when playing with chemicals...');
    },
    [ITEM.MIXED_CHEMICALS_2]: async (player, npc) => {
        await player.say('See what I have done with the compound now');
        await npc.say('Seriously, I think you have a death wish!', 'What on earth are you going to do with that stuff ?');
        await player.say("I'll find a use for it");
    },
    [ITEM.BELT_BUCKLE]: async (player, npc) => {
        await player.say('Have a look at this unusual item');
        await npc.say('Let me see..', 'This is a belt buckle', 'I should imagine it came from a guard');
    },
    [ITEM.BONES]: async (player, npc) => {
        await player.say('Have a look at these bones');
        await npc.say(
            'Ah yes, a fine bone example',
            'No noticeable fractures, and in good condition',
            'There are common cow bones however',
            'They have no archaeological value'
        );
    },
    [ITEM.BROKEN_ARROW]: async (player, npc) => {
        await player.say('Have a look at this arrow');
        await npc.say(
            'No doubt this arrow was shot by a strong warrior',
            "It's split in half!",
            'It is not a valuable object though...'
        );
    },
    [ITEM.BROKEN_GLASS_LVL_2]: async (player, npc) => {
        await player.say('Have a look at this glass');
        await npc.say('Hey you should be careful of that', 'It might cut your fingers, throw it away!');
    },
    [ITEM.BROKEN_STAFF]: async (player, npc) => {
        await player.say('Have a look at this staff');
        await npc.say(
            'Look at this...interesting',
            'This appers to belong to a cleric of some kind',
            'Certainly not a follower of saradomin however...',
            'I wonder if there was another civilization before the saradominists ?'
        );
    },
    [ITEM.BUTTONS]: async (player, npc) => {
        await player.say('I found these buttons');
        await npc.say(
            "Let's have a look",
            'Ah, I think these are from the nobility',
            'Perhaps a royal servant ?',
            'Not valuable but an unusual find for this area'
        );
    },
    [ITEM.CERAMIC_REMAINS]: async (player, npc) => {
        await player.say('I found some potery pieces');
        await npc.say('Yes many parts are discovered', 'The inhabitants of these parts were great potters...');
        await player.say('You mean they were good at using potions ?');
        await npc.say('No no silly - they are were known for their skill with clay');
    },
    [ITEM.DAMAGED_ARMOUR_1]: async (player, npc) => {
        await player.say('I found some old armour');
        await npc.say(
            'Hmm...unusual',
            "This armour dosen't seem to match with the other finds",
            'Keep looking, this could be evidence of an older civilization!'
        );
    },
    [ITEM.DAMAGED_ARMOUR_2]: async (player, npc) => {
        await player.say('I found some armour');
        await npc.say('It looks like the wearer of this fought a mighty battle');
    },
    [ITEM.NEEDLE]: async (player, npc) => {
        await player.say('I found a needle');
        await npc.say(
            'Hmm yes, I wondered why this race were so well dressed!',
            'It looks like they had a mastery of needlework'
        );
    },
    [ITEM.OLD_BOOT]: async (player, npc) => {
        await player.say('Have a look at this');
        await npc.say('Ah yes, an old boot', 'Not really an ancient artifact is it?');
    },
    [ITEM.OLD_TOOTH]: async (player, npc) => {
        await player.say('Hey look at this');
        await npc.say('Oh, an old tooth', '..It looks like it has come from a mighty being');
    },
    [ITEM.DIGSITE_SCROLL]: async (player, npc) => {
        await npc.say("There's no point in giving me this back!");
    },
    [ITEM.ROCK_SAMPLE_GREEN]: rockSample,
    [ITEM.ROCK_SAMPLE_ORANGE]: rockSample,
    [ITEM.ROCK_SAMPLE_PURPLE]: rockSample,
    [ITEM.ROTTEN_APPLES]: async (player, npc) => {
        await player.say('I found these...');
        await npc.say('Ew! throw them away this instant!');
    },
    [ITEM.RUSTY_SWORD]: async (player, npc) => {
        await player.say('I found an old sword');
        await npc.say("Oh, its very rusty isn't it ?", "I'm not sure this sword belongs here", 'It looks very out of place...');
    },
    [ITEM.VASE]: async (player, npc) => {
        await player.say('I found a vase');
        await npc.say('Ah yes these are commonly found in these parts', 'Not a valuable item');
    }
};

async function rockSample(player, npc, item) {
    await player.say('Have a look at this rock');

    if (item.id === ITEM.ROCK_SAMPLE_ORANGE) {
        await npc.say('This rock has been picked at', 'It looks like it could belong to someone...');
    } else if (item.id === ITEM.ROCK_SAMPLE_GREEN) {
        await npc.say('This has been partly prepared', 'It looks like it may belong to someone...');
    } else {
        await npc.say('This rock is not naturally formed', 'It looks like it might belong to someone...');
    }
}

async function expertGoldNuggets(player, npc) {
    await player.say('I have these gold nuggets');

    if (player.inventory.has(ITEM.GOLD_NUGGETS, 3)) {
        player.message('You give the nuggets to the expert');
        player.inventory.remove(ITEM.GOLD_NUGGETS, 3);
        give(player, ITEM.GOLD, 1);
        await npc.say("Good, that's 3, I can exchange them for normal gold now", 'You can get this refined and make a profit!');
        await player.say('Excellent!');
    } else {
        await npc.say("I can't do much with these nuggets yet", 'Come back when you have 3, and I will exchange them for you');
        await player.say('Okay I will, thanks');
    }
}

async function expertTalisman(player, npc) {
    await player.say('What about this ?');
    await npc.say('Unusual...', "This object doesn't appear right...", 'Hmmmm.....');
    await player.world.sleepTicks(3);
    await npc.say(
        'I wonder...Let me check my guide...',
        'Could it be ? surely not...',
        'From the markings on it it seems to be',
        'a ceremonial ornament to a god named...',
        'Zaros? I have never heard of him before',
        'This is a great discovery, we know very little',
        'of the pagan gods that people worshipped',
        'in the olden days. There is some strange writing',
        "embossed upon it - it says",
        "'Zaros will return and wreak his vengeance",
        "upon Zamorak the pretender' - I wonder what",
        'it means by that? Some silly superstition probably.',
        'Still, I wonder what this is doing around here...',
        "I'll tell you what, as you have found this",
        'I will allow you to use the private dig shaft',
        'You obviously have a keen eye...',
        'Take this letter and give it to one of the workmen',
        'And they will allow you to use it'
    );
    player.message('The expert hands you a letter');
    player.inventory.remove(ITEM.TALISMAN_OF_ZAROS);
    player.inventory.add(ITEM.DIGSITE_SCROLL);
}

async function expertStoneTablet(player, npc) {
    const stage = stageOf(player);

    if (stage === -1) {
        await npc.say("I don't need another tablet", 'One is enough thank you!');
        return;
    }

    if (stage !== 6) {
        // the Java has no branch: nothing happens and nothing is said
        return;
    }

    await player.say('I found this in a hidden cavern beneath the digsite');
    player.inventory.remove(ITEM.STONE_TABLET);
    await npc.say('Incredible!');
    await player.say('There is an altar down there', 'The place is crawling with skeletons!');
    await npc.say(
        'Yuck!',
        'This is an amazing discovery!',
        'All this while we were convinced...',
        'That no other race had lived here',
        'It seems the followers of Saradomin',
        'Have tried to cover up the evidence of the zaros altar',
        'This whole city must have been built over it!',
        'Thanks for your help',
        'Your sharp eyes have spotted what many have missed...',
        'Here, take this as your reward'
    );
    player.message('The expert gives you 2 gold bars as payment');
    give(player, ITEM.GOLD_BAR, 2);
    completeQuest(player);
}

async function useOnExpert(player, npc, item) {
    if (item.id === ITEM.GOLD_NUGGETS) {
        await expertGoldNuggets(player, npc);
    } else if (item.id === ITEM.TALISMAN_OF_ZAROS) {
        await expertTalisman(player, npc);
    } else if (item.id === ITEM.STONE_TABLET) {
        await expertStoneTablet(player, npc);
    } else if (EXPERT_RESPONSES[item.id]) {
        await EXPERT_RESPONSES[item.id](player, npc, item);
    } else {
        player.message('Nothing interesting happens');
    }
}

// ---------------------------------------------------------------- the digsite scroll on a workman (722)

async function scrollOnWorkman(player, npc) {
    await player.say('Here, have a look at this...');
    await npc.say(
        'I give permission...blah de blah etc....',
        "Okay that's all in order, you may use the mineshafts now",
        "I'll hang onto this scroll shall I ?"
    );
    await player.say('Thanks');
    player.inventory.remove(ITEM.DIGSITE_SCROLL);

    if (!player.cache.digsite_winshaft && stageOf(player) === 5) {
        player.cache.digsite_winshaft = true;
    }
}

async function onUseWithNPC(player, npc, item) {
    const students = npc.id in STUDENT_KEYS;
    const isRock = [
        ITEM.CRACKED_ROCK_SAMPLE,
        ITEM.ROCK_SAMPLE_ORANGE,
        ITEM.ROCK_SAMPLE_PURPLE,
        ITEM.ROCK_SAMPLE_GREEN
    ].includes(item.id);

    if (!(students && isRock) && npc.id !== NPC.EXPERT && !(npc.id === NPC.WORKMAN && item.id === ITEM.DIGSITE_SCROLL)) {
        return false;
    }

    player.engage(npc);

    try {
        if (students) {
            await useOnStudent(player, npc, item);
        } else if (npc.id === NPC.EXPERT) {
            await useOnExpert(player, npc, item);
        } else {
            await scrollOnWorkman(player, npc);
        }
    } finally {
        if (player.interlocutor) {
            player.disengage();
        }
    }

    return true;
}

module.exports = { onTalkToNPC, onUseWithNPC };
