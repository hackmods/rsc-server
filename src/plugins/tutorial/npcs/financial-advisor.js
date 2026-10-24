// Tutorial Island financial advisor. Port of OpenRSC FinancialAdvisor.java.
const t = require('../core');

async function onTalkToNPC(player, npc) {
    if (npc.id !== t.NPC.FINANCE) {
        return false;
    }

    player.engage(npc);

    if (!t.onTutorial(player)) {
        await npc.say('Spend wisely out there, adventurer');
        player.disengage();
        return true;
    }

    await npc.say('Hello there', "I'm your designated financial advisor");
    await player.say(
        "That's good because I don't have any money at the moment",
        'How do I get rich?'
    );
    await npc.say(
        'There are many different ways to make money in runescape',
        'for example certain monsters will drop a bit of loot',
        'To start with killing men and goblins might be a good idea',
        'Some higher level monsters will drop quite a lot of treasure',
        'several of runescapes skills are good money making skills',
        'two of these skills are mining and fishing',
        'there are instructors on the island who will help you with this',
        'using skills and combat to make money is a good plan',
        'because using a skill also slowly increases your level in that skill',
        'A high level in a skill opens up many more oppurtunites',
        'Some other ways of making money include taking quests and tasks',
        'You can find these by talking to certain game controlled characters',
        'Our quest advisors will tell you about this',
        'Sometimes you will find items lying around',
        'Selling these to the shops makes some money too',
        'Now continue through the next door'
    );

    t.setStage(player, 40);

    player.disengage();
    return true;
}

module.exports = { onTalkToNPC };
