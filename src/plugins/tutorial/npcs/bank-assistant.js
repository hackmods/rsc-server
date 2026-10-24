// Tutorial Island bank assistant (OpenRSC BankAssistant.java)

const t = require('../core');

async function openBank(player, npc) {
    await npc.say(`Certainly ${player.isMale() ? 'Sir' : 'Miss'}`);
    // disengage first so the bank interface is not blocked (see banker.js)
    player.disengage();
    player.bank.open();
}

async function onTalkToNPC(player, npc) {
    if (npc.id !== t.NPC.BANK) {
        return false;
    }

    player.engage(npc);

    if (!t.onTutorial(player)) {
        await npc.say('Hello welcome to the bank of runescape');
        player.disengage();
        return true;
    }

    await npc.say(
        'Hello welcome to the bank of runescape',
        'You can deposit your items in banks',
        'This allows you to own much more equipment',
        'Than can be fitted in your inventory',
        'It will also keep your items safe',
        "So you won't lose them when you die",
        'You can withdraw deposited items from any bank in the world'
    );

    if (t.stage(player) === 55) {
        await player.say('Can I access my bank account please?');
        t.setStage(player, 60);
        await openBank(player, npc);
        return true;
    }

    await npc.say('Now proceed through the next door');

    const choice = await player.ask(
        ['Can I access my bank account please?', 'Okay thankyou for your help'],
        true
    );

    if (choice === 0) {
        await openBank(player, npc);
        return true;
    }

    if (choice === 1) {
        await npc.say('Not a problem');
    }

    player.disengage();
    return true;
}

module.exports = { onTalkToNPC };
