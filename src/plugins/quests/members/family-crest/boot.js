// Ported from Open-RSC Core-Framework authentic/npcs/dwarvenmine/Boot.java (AGPL-3.0).
// Boot the Dwarf (313), the dwarven mine under Ice Mountain: at stage 5 he points to the perfect gold east of
// Ardougne (stage 6).

const { NPCS, stage } = require('./shared');

async function whyBoot(npc) {
    await npc.say('Because when I was a very young dwarf', 'I used to sleep in a large boot');
}

async function onTalkToNPC(player, npc) {
    if (npc.id !== NPCS.boot) {
        return false;
    }

    player.engage(npc);

    await npc.say('Hello tall person');

    const lookingForGold = stage(player) === 5;
    const options = [];

    if (lookingForGold) {
        options.push("Hello I'm in search of very high quality gold");
    }

    options.push('Hello short person', 'Why are you called boot?');

    const choice = await player.ask(options, true);

    if (lookingForGold) {
        if (choice === 0) {
            await npc.say(
                'Hmm well the best gold I know of',
                'is east of the great city of Ardougne',
                'In some certain rocks underground there',
                "Its not the easiest of rocks to get to though I've heard"
            );
            player.questStages.familyCrest = 6;
        } else if (choice === 2) {
            await whyBoot(npc);
        }
    } else if (choice === 1) {
        await whyBoot(npc);
    }

    player.disengage();
    return true;
}

module.exports = { onTalkToNPC };
