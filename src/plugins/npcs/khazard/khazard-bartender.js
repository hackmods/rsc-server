// Ported from Open-RSC Core-Framework authentic/npcs/khazard/KhazardBartender.java (AGPL-3.0)
// The Khazard bartender (591,718): beer for a coin, a free khali brew (Fight Arena: the bribable guard's drink).
// As in the Java the beer is handed over before the coin is taken, and with no coin it is free.

const KHAZARD_BARTENDER_ID = 382;

const COINS_ID = 10;
const BEER_ID = 193;
const KHALI_BREW_ID = 735;

async function onTalkToNPC(player, npc) {
    if (npc.id !== KHAZARD_BARTENDER_ID) {
        return false;
    }

    player.engage(npc);

    await player.say('Hello');
    await npc.say('Hello, what can i get you? we have all sorts of brew');

    const choice = await player.ask(["I'll have a beer please", "I'd like a khali brew please", 'Got any news?'], true);

    if (choice === 0) {
        await npc.say("There you go, that's one gold coin");
        player.inventory.add(BEER_ID);
        player.inventory.remove(COINS_ID, 1);
    } else if (choice === 1) {
        await npc.say('There you go', 'No charge');
        player.inventory.add(KHALI_BREW_ID);
    } else if (choice === 2) {
        await npc.say(
            'Well have you seen the famous khazard fight arena?',
            "I've seen some grand battles in my time..",
            'Ogres, goblins, even dragons, they all come to fight',
            'The poor slaves of general khazard'
        );
    }

    player.disengage();

    return true;
}

module.exports = { onTalkToNPC };
