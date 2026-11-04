// Ported from Open-RSC Core-Framework authentic/npcs/entrana/HighPriestOfEntrana.java (AGPL-3.0)
// The High priest of Entrana (395) welcomes visitors. During The Holy Grail (questStages.theHolyGrail, quests/members/
// holy-grail.js), from stage 2, he knows nothing of the grail, but the Crone (394) standing near him (within 20 tiles)
// butts in and sends the grail knight to "where the six heads face": stage 2 -> 3. From then on the Crone speaks the
// priest's answers (the Java reassigns `n` to her).

const HIGH_PRIEST_ID = 395;
const CRONE_ID = 394;

const FISHER_KING = 0;
const SIX_HEADS = 1;
const WHISTLE = 2;

function grailStage(player) {
    return player.questStages.theHolyGrail || 0;
}

async function dialogue(player, npc, choice) {
    if (choice === -1) {
        await npc.say('Many greetings welcome to our fair island');

        if (grailStage(player) >= 2) {
            await player.say('Hello, I am in search of the holy grail');
            await npc.say(
                'The object of which you speak did once pass through holy entrana',
                'I know not where it is now',
                'Nor do I really care'
            );

            const [crone] = player
                .getNearbyEntitiesByID('npcs', CRONE_ID, 41)
                .sort((a, b) => player.getDistance(a) - player.getDistance(b));

            if (crone) {
                await crone.say(
                    'Wait!',
                    'Did you say the grail?',
                    'You are a grail knight yes?',
                    "Well you'd better hurry, a fisher king is in pain"
                );
                await player.say("Well I would but I don't know where I am going");
                await crone.say('Go to where the six heads face', 'blow the whistle and away you go');

                if (grailStage(player) === 2) {
                    player.questStages.theHolyGrail = 3;
                }

                const menu = await player.ask(
                    ['What are the six heads?', "What's a fisher king?", 'Ok I will go searching', 'What do you mean by the whistle?'],
                    true
                );

                if (menu === 0) {
                    await dialogue(player, crone, SIX_HEADS);
                } else if (menu === 1) {
                    await dialogue(player, crone, FISHER_KING);
                } else if (menu === 3) {
                    await dialogue(player, crone, WHISTLE);
                }
            }

            return;
        }

        await npc.say('enjoy your stay hear', 'May it be spiritually uplifting'); // sic
        return;
    }

    if (choice === FISHER_KING) {
        await npc.say('The fisher king is the owner and slave of the grail');
        await player.say('What are the four heads?'); // authentic from replay: the dialogue ended here
    } else if (choice === SIX_HEADS) {
        await npc.say(
            'The six  stone heads have appeared just recently in the world', // sic
            'They all face the point of realm crossing',
            'Find where two of the heads face',
            'And you should be able to pinpoint where it is'
        );

        const menu = await player.ask(
            ["What's a fisher king?", 'Ok I will go searching', 'What do you mean by the whistle?', 'the point of realm crossing?'],
            false
        );

        if (menu === 0) {
            await player.say("What's a fisher king?");
            await dialogue(player, npc, FISHER_KING);
        } else if (menu === 1) {
            await player.say('Ok I will go searching');
        } else if (menu === 2) {
            await player.say('What do you mean by the whistle?');
            await dialogue(player, npc, WHISTLE);
        } else if (menu === 3) {
            await player.say('The point of realm crossing');
            await npc.say(
                'The realm of the fisher king is not quite of this reality',
                'It is of a reality very close to ours though',
                "Where it's easiest to cross that is a point of realm crossing"
            );
        }
    } else if (choice === WHISTLE) {
        await npc.say(
            "You don't know about the whistles yet?",
            'the whistles are easy',
            "You will need one to get to and from the fisher king's realm",
            'they reside in a haunted manor house in Misthalin',
            'though you may not perceive them unless you carry something',
            'From the realm of the fisher king'
        );

        const menu = await player.ask(
            ['What are the four heads?', "What's a fisher king?", 'Ok I will go searching'],
            false
        );

        if (menu === 0) {
            await player.say('What are the six heads?');
            await dialogue(player, npc, SIX_HEADS);
        } else if (menu === 1) {
            await player.say("What's a fisher king?");
            await dialogue(player, npc, FISHER_KING);
        } else if (menu === 2) {
            await player.say('Ok I will go searching');
        }
    }
}

async function onTalkToNPC(player, npc) {
    if (npc.id !== HIGH_PRIEST_ID) {
        return false;
    }

    player.engage(npc);

    try {
        await dialogue(player, npc, -1);
    } finally {
        if (player.interlocutor) {
            player.disengage();
        }
    }

    return true;
}

module.exports = { onTalkToNPC };
