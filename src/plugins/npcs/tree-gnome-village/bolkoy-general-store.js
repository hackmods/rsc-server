// Ported from Open-RSC authentic/npcs/gnomevillage/BolkoyGeneralStore.java (AGPL-3.0)
// Bolkoy (Tree Gnome Village general store): greeting varies with the Tree Gnome Village quest stage, then opens the village shop.
// Java quest stages 0-4 (and any unlisted stage) use the first greeting; stage 6 checks the looted-orbs cache flag.

const BOLKOY_ID = 398;

async function greet(player, npc) {
    const stage = player.questStages.treeGnomeVillage;

    if (stage === -1) {
        await player.say('welcome, welcome');
        await npc.say(
            "it's good to see you again",
            'the village is much safer now',
            "by the way i'm the village shop keeper",
            'would you like to buy something?'
        );
        return;
    }

    if (stage === 5) {
        await player.say('hello');
        await npc.say(
            'hello traveller',
            'amazing, you recovered the orb',
            'well i am impressed',
            'would you like to buy something?'
        );
        return;
    }

    if (stage === 6) {
        if (!player.cache.hasOwnProperty('looted_orbs_protect')) {
            await player.say('hi');
            await npc.say(
                'oh, hello there',
                'have you heard? they took',
                'the other orbs, it\'s terrible',
                'i suppose the show must go on',
                'would you like to buy something?'
            );
        } else {
            await player.say('hello');
            await npc.say(
                'hello there',
                "you're that hero who saved the orbs",
                'soon we will perform the ritual',
                'and the village will be safe again',
                'anyway, would you like anything from my shop?'
            );
        }
        return;
    }

    await player.say('hello there');
    await npc.say(
        'hello stranger, are you',
        'new to these parts?',
        "i'm bolkoy by the way",
        "i'm the village shop keeper",
        'would you like to buy something?'
    );
}

async function onTalkToNPC(player, npc) {
    if (npc.id !== BOLKOY_ID) {
        return false;
    }

    player.engage(npc);

    await greet(player, npc);

    const choice = await player.ask(['What have you got?', 'No thankyou'], false);

    if (choice === 0) {
        await player.say('what have you got?');
        await npc.say('take a look');
        player.disengage();
        player.openShop('tree-gnome-village-general');
        return true;
    }

    await player.say('no thankyou');
    await npc.say('ok maybe later');
    player.disengage();
    return true;
}

module.exports = { onTalkToNPC };
