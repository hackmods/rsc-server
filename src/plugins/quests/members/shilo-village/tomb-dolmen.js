// Ported from Open-RSC Core-Framework authentic/quests/members/shilovillage/ShiloVillageTombDolmen.java (AGPL-3.0): Bervirius's
// tomb dolmen (689) with the pommel, the crystal and the notes, and the end of the quest (Rashiliyia's remains laid on it at
// stage 8). Reward: 2 quest points and crafting 500 + 500 per crafting level (QuestRewardRegistrar 40, quarter points). Stage map:
// shared.js.

const { ITEM, NPC, OBJECT, REWARD_CACHE_KEYS, stageOf, cacheHas, cacheDel, mes, delay, spawnNpc, removeNpc, moveNpc } = require('./shared');

function handleReward(player) {
    for (const key of REWARD_CACHE_KEYS) {
        cacheDel(player, key);
    }

    player.completeQuest('shiloVillage', {
        questPoints: 2,
        experience: { crafting: 500 + 500 * player.skills.crafting.base },
        message: ['Well Done!', 'You have completed the Shilo Village Quest.', 'You gain some experience in crafting.']
    });
}

async function look(player) {
    await mes(player, 'The Dolmen is intricately decorated with the family');
    await mes(player, 'symbol of two crossed palm trees .');

    if (stageOf(player) === 8) {
        player.message('There is nothing on the Dolmen.');
        return;
    }

    const pommel = player.inventory.has(ITEM.SWORD_POMMEL);
    const crystal = player.inventory.has(ITEM.LOCATING_CRYSTAL);

    if (pommel && crystal) {
        player.message('There is nothing on the Dolmen.');
    } else if (pommel || crystal) {
        player.message('You can see an item on the Dolmen');
    } else {
        player.message('You can see that there are some items on the Dolmen.');
    }
}

async function search(player) {
    await mes(player, 'The Dolmen is intricately decorated with the symbol of');
    await mes(player, 'two crossed palm trees. It might be the family crest?');

    const pommel = player.inventory.has(ITEM.SWORD_POMMEL);
    const crystal = player.inventory.has(ITEM.LOCATING_CRYSTAL);

    if (pommel && crystal) {
        await mes(player, 'There is nothing on the Dolmen.');
    } else if (pommel || crystal) {
        await mes(player, 'You can see an item on the Dolmen');
    } else {
        await mes(player, 'You can see that there are some items on the Dolmen.');
    }

    if (!pommel && !player.inventory.has(ITEM.BONE_BEADS)) {
        await mes(player, 'You find a rusty sword with an ivory pommel.');
        player.message('You take the pommel and place it into your inventory.');
        player.inventory.add(ITEM.SWORD_POMMEL, 1);
        await delay(player);
    }

    if (!crystal) {
        await mes(player, 'You find a Crystal Sphere ');
        player.inventory.add(ITEM.LOCATING_CRYSTAL, 1);
    }

    await mes(player, 'You find some writing on the dolmen,');

    if (!player.inventory.has(ITEM.BERVIRIUS_TOMB_NOTES) && cacheHas(player, 'dropped_writing')) {
        await mes(player, 'You would need some Papyrus and Charcoal');
        player.message('to take more notes from this Dolmen!');
    } else if (!player.inventory.has(ITEM.BERVIRIUS_TOMB_NOTES) && !cacheHas(player, 'dropped_writing')) {
        await mes(player, 'you grab some nearby scraps of delicate paper together ');
        await mes(player, 'and copy the text as best you can and collect');
        player.message('them together as a scroll');
        player.inventory.add(ITEM.BERVIRIUS_TOMB_NOTES, 1);
    }
}

async function onGameObjectCommandOne(player, gameObject) {
    if (gameObject.id !== OBJECT.TOMB_DOLMEN) {
        return false;
    }

    if (stageOf(player) === -1) {
        player.message('You find nothing on the Dolmen.');
        return true;
    }

    await look(player);

    return true;
}

async function onGameObjectCommandTwo(player, gameObject) {
    if (gameObject.id !== OBJECT.TOMB_DOLMEN) {
        return false;
    }

    if (stageOf(player) === -1) {
        player.message('You find nothing on the Dolmen.');
        return true;
    }

    await search(player);

    return true;
}

async function onUseWithGameObject(player, gameObject, item) {
    if (gameObject.id !== OBJECT.TOMB_DOLMEN) {
        return false;
    }

    if (item.id === ITEM.PAPYRUS) {
        if (player.inventory.has(ITEM.BERVIRIUS_TOMB_NOTES)) {
            player.message('You already have Bervirius Tomb Notes in your inventory.');
        } else {
            await mes(player, 'You try to take some new notes on the delicate papyrus.');

            if (!player.inventory.has(ITEM.A_LUMP_OF_CHARCOAL)) {
                player.message('You need some charcoal to make notes.');
                return true;
            }

            await mes(player, 'You use the charcoal and the Papyrus to make some new notes.');
            player.message('You collect the notes together as a scroll.');
            player.inventory.remove(ITEM.PAPYRUS, 1);
            player.inventory.remove(ITEM.A_LUMP_OF_CHARCOAL, 1);
            player.inventory.add(ITEM.BERVIRIUS_TOMB_NOTES, 1);
        }
    } else if (item.id === ITEM.RASHILIYA_CORPSE) {
        if (stageOf(player) === 8) {
            player.message("You carefully place Rashiliyia's remains on the Dolmen.");
            await delay(player, 2);
            player.message('You feel a strange vibration in the air.');

            const rash = spawnNpc(player, NPC.RASHILIYIA, player.x, player.y, 60000);

            moveNpc(rash, rash.x + 1, rash.y);
            await rash.say(
                'You have my gratitude for releasing my spirit.',
                'I have suffered a vengeful and evil existence.',
                'I was tricked by Zamorak. He returned my son to me as an undead Creature.',
                'My hatred and bitterness corrupted me.',
                'I tried too destroy all life...now I am released.',
                'And am grateful to contemplate eternal rest...'
            );
            await mes(player, 'Without warning the spirit of Rashiliyia disapears.');
            removeNpc(player, rash);
            player.inventory.remove(ITEM.RASHILIYA_CORPSE, 1);
            handleReward(player);
        }
    } else {
        player.message('Nothing interesting happens');
    }

    return true;
}

module.exports = { onGameObjectCommandOne, onGameObjectCommandTwo, onUseWithGameObject, handleReward };
