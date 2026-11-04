// Ported from Open-RSC authentic/npcs/catherby/CandleMakerShop.java (AGPL-3.0)
// Candle maker (Catherby): greeting that opens the candle shop, and the Merlin's Crystal black candle: at stage 3 he
// agrees to make one for a bucket of wax (cache candlemaker), then swaps the wax bucket (605) for the black candle (600)
// (quests/members/merlins-crystal/). Skipped: the custom firemaking cape (WANT_CUSTOM_SPRITES).

const CANDLEMAKER_ID = 282;
const WAX_BUCKET_ID = 605;
const UNLIT_BLACK_CANDLE_ID = 600;

const QUEST_OPTION = 'Have you got any black candles?';

async function onTalkToNPC(player, npc) {
    if (npc.id !== CANDLEMAKER_ID) {
        return false;
    }

    player.engage(npc);

    if (player.cache.candlemaker) {
        await npc.say('Have you got any wax yet?');

        if (player.inventory.has(WAX_BUCKET_ID)) {
            await player.say('Yes I have some now');
            player.inventory.remove(WAX_BUCKET_ID);
            player.message('You exchange the wax with the candle maker for a black candle');
            player.inventory.add(UNLIT_BLACK_CANDLE_ID);
            delete player.cache.candlemaker;
        }

        player.disengage();
        return true;
    }

    await npc.say('Hi would you be interested in some of my fine candles');

    const options = [];

    if (player.questStages.merlinsCrystal === 3) {
        options.push(QUEST_OPTION);
    }

    options.push('Yes please', 'No thankyou');

    const choice = await player.ask(options, true);
    const picked = options[choice];

    if (picked === QUEST_OPTION) {
        await npc.say('Black candles hmm?', "It's very bad luck to make black candles");
        await player.say('I can pay well for one');
        await npc.say(
            'I still dunno',
            "Tell you what, I'll supply with you with a black candle",
            'If you can bring me a bucket full of wax'
        );
        player.cache.candlemaker = true;
    } else if (picked === 'Yes please') {
        player.disengage();
        player.openShop('candle');
        return true;
    }

    player.disengage();
    return true;
}

module.exports = { onTalkToNPC };
