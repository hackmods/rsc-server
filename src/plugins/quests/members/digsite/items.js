// The Dig Site items (quests/members/digsite/shared.js has the stage map), from Open-RSC Core-Framework
// authentic/itemactions/InvAction.java (reading the book of experimental chemistry, the certificates, the digsite scroll and
// the stone tablet) and authentic/quests/members/digsite/DigsiteMiscs.java (AGPL-3.0): dropping the unstable liquids hurts.
//
// deviation: the nitroglycerin's blast is `hits / 2 - 3` in the Java, which is negative for a player under 6 hits; it is
// floored at 0 here.

const { ITEM } = require('./shared');

// ActionSender.sendBox(player, ..., true): the big box, '%' breaks a line
const CHEMISTRY_BOOK =
    'Volatile chemicals - Notes on experimental chemistry. % %' +
    'In order to ease the mining Process, my colleagues and I ' +
    'decided we needed something stronger than picks to delve ' +
    'under the digsite. As I already had an intermediate knowledge of ' +
    'herblaw, I experimented on certain chemicals, and invented a ' +
    'compound of tremendous power, which, if subjected to a spark ' +
    'would literally explode. We used vials of this compound with great results, ' +
    'as it enabled us to reach further than ever before. ' +
    "Here is what I have left of the compound's recipe: % %" +
    '1 measure of ammonium nitrate powder,% ' +
    '1 measure of nitroglycerin,% ' +
    '1 measure of ground charcoal.% ' +
    '1 measure of ?% ' +
    'Unfortunately the last ingredient was not written down, but we ' +
    'understand that a certain root grows around these parts that was used to very good effect...';

async function onInventoryCommand(player, item) {
    switch (item.id) {
        case ITEM.BOOK_OF_EXPERIMENTAL_CHEMISTRY:
            player.send({ type: 'serverMessageOnTop', message: CHEMISTRY_BOOK });
            return true;
        case ITEM.LEVEL_1_CERTIFICATE:
            await player.say('It says:', 'The holder of this certificate has passed the level 1 exam in earth sciences');
            return true;
        case ITEM.LEVEL_2_CERTIFICATE:
            await player.say('It says:', 'The holder of this certificate has passed the level 2 exam in earth sciences');
            return true;
        case ITEM.LEVEL_3_CERTIFICATE:
            await player.say('It says:', 'The holder of this certificate has passed the level 3 exam in earth sciences');
            return true;
        case ITEM.DIGSITE_SCROLL:
            await player.say(
                "It says 'I give permission for the bearer to use the mineshafts on site",
                'Signed Terrance Balando, Archaeological expert, City of Varrock'
            );
            return true;
        case ITEM.STONE_TABLET:
            await player.say('It says:', 'Tremble mortal, before the altar of our dread lord zaros');
            return true;
        default:
            return false;
    }
}

const hits = (player) => player.skills.hits.current;

async function onDropItem(player, item) {
    if (!item) {
        return false;
    }

    switch (item.id) {
        case ITEM.UNIDENTIFIED_LIQUID:
            player.message('bang!');
            player.inventory.remove(item.id);
            player.damage(Math.floor(hits(player) * 0.3 + 5));
            await player.say('Ow!');
            player.message('The liquid exploded!');
            player.message('You were injured by the burning liquid');
            return true;
        case ITEM.MIXED_CHEMICALS_1:
        case ITEM.MIXED_CHEMICALS_2:
            player.message('bang!');
            player.inventory.remove(item.id);
            player.damage(Math.floor(hits(player) / 2) + 6);
            await player.say('Ow!');
            player.message('The chemicals exploded!');
            player.message('You were injured by the exploding liquid');
            return true;
        case ITEM.NITROGLYCERIN:
            player.message('bang!');
            player.inventory.remove(item.id);
            player.damage(Math.max(0, Math.floor(hits(player) / 2) - 3));
            await player.say('Ow!');
            player.message('The nitroglycerin exploded!');
            player.message('You were injured by the exploding liquid');
            return true;
        case ITEM.EXPLOSIVE_COMPOUND:
            player.message('@que@bang!');
            await player.world.sleepTicks(3);
            player.inventory.remove(item.id);
            player.damage(61);
            await player.say('Ow!');
            player.message('The compound exploded!');
            player.message('You were badly injured by the exploding liquid');
            return true;
        default:
            return false;
    }
}

module.exports = { onInventoryCommand, onDropItem, CHEMISTRY_BOOK };
