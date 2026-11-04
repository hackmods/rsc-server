// Ported from Open-RSC Core-Framework authentic/quests/members/MerlinsCrystal.java and authentic/itemactions/
// InvUseOnItem.java (AGPL-3.0): the magic words, lighting candles and summoning Thrantax. Stages: camelot.js.
//   The chaos altar (296) at (116,366) Search: "Snarthon Candtrick Termanto" (cache magicWords)
//   Tinderbox (166) on a black candle (600) lights it (602); on a candle (599) lights it (601)
//   Dropping bat bones (604) on the pentagram tile (448,435) with the magic words read and the lit black candle carried
//   summons Thrantax (288, 63 s): the right words move the quest to stage 4. Wrong words: the candle goes out (it is
//   lost) and Thrantax attacks. The bones are not dropped either way (Java's DropObj trigger keeps them).
// The black candle itself is the candle maker's (npcs/catherby/candle-maker-shop.js), for the wax bucket (camelot.js).

const THRANTAX_ID = 288;
const ALTAR_ID = 296;
const ALTAR_Y = 366;
const PENTAGRAM = { x: 448, y: 435 };

const TINDERBOX_ID = 166;
const UNLIT_CANDLE_ID = 599;
const UNLIT_BLACK_CANDLE_ID = 600;
const LIT_CANDLE_ID = 601;
const LIT_BLACK_CANDLE_ID = 602;
const BAT_BONES_ID = 604;

const LIGHTS = {
    [UNLIT_BLACK_CANDLE_ID]: LIT_BLACK_CANDLE_ID,
    [UNLIT_CANDLE_ID]: LIT_CANDLE_ID
};

// addnpc(..., 63 seconds), in 640 ms ticks
const THRANTAX_TICKS = Math.ceil(63000 / 640);

const MAGIC_WORDS = ['Snarthtrick Candanto Termon', 'Snarthon Candtrick Termanto', 'Snarthanto Candon Termtrick'];
// what the player then says (Java: the first one comes out a little different)
const SPOKEN = ['Snarthtrick Candato Termon', 'Snarthon Candtrick Termanto', 'Snarthanto Candon Termtrick'];
const RIGHT_WORDS = 1;

async function onGameObjectCommandTwo(player, gameObject) {
    if (gameObject.id !== ALTAR_ID || gameObject.y !== ALTAR_Y) {
        return false;
    }

    const { world } = player;

    player.message('You find a small inscription at the bottom of the altar');
    await world.sleepTicks(3);
    player.message('It reads Snarthon Candtrick Termanto');
    await world.sleepTicks(3);
    player.cache.magicWords = true;

    return true;
}

async function onUseWithInventory(player, item, target) {
    let candle;

    if (item.id === TINDERBOX_ID && LIGHTS[target.id]) {
        candle = target.id;
    } else if (target.id === TINDERBOX_ID && LIGHTS[item.id]) {
        candle = item.id;
    } else {
        return false;
    }

    player.inventory.remove(candle);
    player.message('You light the candle');

    if (candle === UNLIT_BLACK_CANDLE_ID) {
        player.inventory.add(LIT_BLACK_CANDLE_ID);
    } else {
        player.inventory.add(LIT_CANDLE_ID);
    }

    return true;
}

async function onDropItem(player, item) {
    if (
        !item ||
        item.id !== BAT_BONES_ID ||
        player.x !== PENTAGRAM.x ||
        player.y !== PENTAGRAM.y ||
        !player.cache.magicWords ||
        !player.inventory.has(LIT_BLACK_CANDLE_ID)
    ) {
        return false;
    }

    const { world } = player;
    const thrantax = world.spawnTimedNPC({ id: THRANTAX_ID, x: PENTAGRAM.x, y: PENTAGRAM.y, ticks: THRANTAX_TICKS });

    player.sendTeleportBubble(PENTAGRAM.x, PENTAGRAM.y);
    player.message('Suddenly a demon appears');
    await player.say('Now what were those magic words?');

    const opt = await player.ask(MAGIC_WORDS, false);

    if (opt === RIGHT_WORDS) {
        await player.say(SPOKEN[opt]);
        await thrantax.say(
            'rarrrrgh',
            'You have me in your control',
            'What do you wish of me?',
            'So that I may return to the nether regions'
        );
        await player.say('I wish to free Merlin from his giant crystal');
        await thrantax.say('rarrrrgh', 'It is done, you can now shatter Merlins crystal with Excalibur');
        world.removeEntity('npcs', thrantax);

        // Java sets 4 whatever the stage; a finished quest is not reopened here
        if (player.questStages.merlinsCrystal !== -1) {
            player.questStages.merlinsCrystal = 4;
        }

        return true;
    }

    if (SPOKEN[opt]) {
        await player.say(SPOKEN[opt]);
    }

    await thrantax.say('rarrrrgh');
    player.inventory.remove(LIT_BLACK_CANDLE_ID);
    thrantax.attack(player);

    return true;
}

module.exports = { onGameObjectCommandTwo, onUseWithInventory, onDropItem };
