// Ported from Open-RSC Core-Framework authentic/quests/members/shilovillage/ShiloVillageUtils.java (AGPL-3.0): the quest items'
// drop refusals, their inventory commands (read, bury, activate), the chisel and bone crafting, the cursed coins in the cave and
// the bumpy dirt's crawl through the fissure. Shared stage map: shared.js.

const {
    ITEM,
    NPC,
    stageOf,
    setStage,
    cacheHas,
    cacheSet,
    mes,
    delay,
    hurt,
    hitsCurrent,
    level,
    spawnNpc,
    removeNpc,
    sendBox,
    inBounds
} = require('./shared');

const COINS_X = 358;
const COINS_Y = 3626;

// ShiloVillageUtils.BUMPY_DIRT_HOLDER: the crawl through the fissure into the cave
async function bumpyDirtHolder(player) {
    player.message('Do you want to try to crawl through the fissure?');

    if (cacheHas(player, 'SV_DIG_ROPE')) {
        player.message('You see that a rope is attached nearby');
    }

    const menu = await player.ask(["Yes, I'll give it a go!", 'No thanks, it looks a bit dark!']);

    if (menu === 0) {
        player.message('You start to contort your body...');
        await mes(player, 'With some dificulty you manage to push your body');
        await mes(player, 'through the small crack in the rock.');

        if (!cacheHas(player, 'SV_DIG_ROPE')) {
            await mes(player, 'As you squeeze out of the hole...');
            player.message('you realise that there is a huge drop underneath you');
            player.message('You begin falling....');
            player.teleport(380, 3692);
            await delay(player);
            await player.say('Ahhhhh!');
            hurt(player, 1);
            player.message('Your body is battered as you hit the cavern walls.');
            await player.say('Ooooff!');
            hurt(player, 1);
            await delay(player);
            player.teleport(352, 3650);
            hurt(player, Math.floor(hitsCurrent(player) * 0.2 + 10));
            await mes(player, 'You hit the floor and it knocks the wind out of you!');
            await player.say('Ugghhhh!!');
        } else {
            await mes(player, 'You squeeze through the fissure in the granite');
            await mes(player, 'And once through, you cleverly use the rope to slowly lower');
            await mes(player, 'yourself to the floor.');
            await player.say('Yay!');
            player.teleport(352, 3650);
        }

        player.addExperience('agility', 30);

        if (stageOf(player) === 2) {
            setStage(player, 3);
        }
    } else if (menu === 1) {
        player.message('You think better of attempting to squeeze your body into the fissure.');
        await player.say('It looked very dangerous, and dark...', 'scarey!');
    }
}

// Zadimus: 589
async function dropZadimusCorpse(player) {
    await mes(player, 'You feel an uneartly compunction to bury this corpse!');

    if (inBounds(player, 445, 749, 449, 753)) {
        await mes(player, 'You hear an unearthly moaning sound as you see');
        await mes(player, 'an apparition materialises right in front of you.');

        const zadimus = spawnNpc(player, NPC.ZADIMUS, player.x, player.y, 60000);

        await delay(player);
        await zadimus.say('You have released me from my torture, and now I shall aid you');
        await delay(player);
        await zadimus.say('You seek to dispell the one who tortured and killed me');
        await delay(player);
        await zadimus.say('Remember this...');
        await delay(player);
        await zadimus.say("'I am the key, but only kin may approach her.'");
        await mes(player, 'The apparition disapears into the ground where you buried the corpse.');
        removeNpc(player, zadimus);
        await mes(player, 'You see the ground in front of you shake ');
        await mes(player, 'as a shard of bone forces its way to the surface.');
        player.message('You take the bone shard and place it in your inventory.');
        player.inventory.remove(ITEM.ZADIMUS_CORPSE, 1);
        player.inventory.add(ITEM.BONE_SHARD, 1);

        if (stageOf(player) === 3) {
            setStage(player, 4);
        }
    } else {
        await mes(player, 'You hear a ghostly wailing sound coming from the corpse');
        await mes(player, 'and a whispering voice says,');
        player.message("'@yel@Zadimus: Let me rest in a sacred place and assist you I will'");
    }
}

// blockDropObj: every one of these is handled (the drop never goes through)
const DROP_IDS = new Set([
    ITEM.STONE_PLAQUE,
    ITEM.CRUMPLED_SCROLL,
    ITEM.TATTERED_SCROLL,
    ITEM.ZADIMUS_CORPSE,
    ITEM.BONE_KEY,
    ITEM.BONE_BEADS,
    ITEM.BONE_SHARD,
    ITEM.LOCATING_CRYSTAL,
    ITEM.BERVIRIUS_TOMB_NOTES,
    ITEM.SWORD_POMMEL,
    ITEM.RASHILIYA_CORPSE,
    ITEM.BEADS_OF_THE_DEAD
]);

// a "this looks important" confirmation: yes removes the item with these lines
async function confirmDiscard(player, item, lines) {
    player.message('This looks quite important, are you sure you want to drop it?');

    const menu = await player.ask(["Yes, I'm sure.", "No, I think I'll keep it."]);

    if (menu === 0) {
        player.message(...lines);
        player.inventory.remove(item, 1);
    } else if (menu === 1) {
        player.message('You decide against throwing the item away.');
    }
}

async function onDropItem(player, item) {
    if (!item || !DROP_IDS.has(item.id)) {
        return false;
    }

    if (item.id === ITEM.RASHILIYA_CORPSE) {
        await mes(player, 'The remains of Rashiliyia look quite delicate.');
        await mes(player, 'You sense that a spirit needs to be put to rest.');
        player.message('Are you sure that you want to drop the remains ?');

        const menu = await player.ask(['Yes, I am sure.', "No, I'll keep hold of the remains."]);

        if (menu === 0) {
            for (const key of ['dolmen_zombie', 'dolmen_skeleton', 'dolmen_ghost']) {
                delete player.cache[key];
            }

            player.inventory.remove(ITEM.RASHILIYA_CORPSE, 1);
            await mes(player, 'You drop Rashiliyias remains on the ground.');
            await mes(player, 'The bones turn to dust and forms into the shape of a human figure.');

            const rash = spawnNpc(player, NPC.RASHILIYIA, player.x, player.y, 30000);

            await mes(player, 'The figure turns to you and you hear a cackling, croaky voice on the air.');
            await rash.say('Many thanks for releasing me!', 'Please excuse me, I must attend to my plans!');
            removeNpc(player, rash);
            player.message('The figure turns and soars away quickly disapearing into the distance.');
        } else if (menu === 1) {
            player.message('You decide to keep hold of Rashiliyias remains.');
        }
    } else if (item.id === ITEM.BEADS_OF_THE_DEAD) {
        await mes(player, 'Are you sure you want to drop the Beads of the Dead?');
        player.message('It looks very rare and unique.');

        const menu = await player.ask(["Yes, I'm sure.", "Nope, I've had second thoughts."]);

        if (menu === 0) {
            await mes(player, 'As the necklace hits the floor, it disintigrates');
            await mes(player, 'into a puff of white powder.');
            player.message('and you start to wonder if it ever really existed?');
            player.inventory.remove(ITEM.BEADS_OF_THE_DEAD, 1);
        } else if (menu === 1) {
            player.message('You decide not to drop the Beads of the Dead.');
        }
    } else if (item.id === ITEM.BONE_BEADS) {
        await mes(player, 'As the beads hit the floor, they disintegrate into');
        player.message('puffs of white powder.');
        player.inventory.remove(ITEM.BONE_BEADS, 1);
    } else if (item.id === ITEM.BERVIRIUS_TOMB_NOTES) {
        player.message('As you drop the delicate scrolls onto the floor, they');
        player.message('disintegrate immediately.');

        if (!cacheHas(player, 'dropped_writing')) {
            cacheSet(player, 'dropped_writing');
        }

        player.inventory.remove(ITEM.BERVIRIUS_TOMB_NOTES, 1);
    } else if (item.id === ITEM.LOCATING_CRYSTAL) {
        player.message('Are you sure you want to drop this crystal?');
        player.message('It looks very delicate and it may break.');

        const menu = await player.ask(['Yes, I am sure.', "No, I've reconsidered, I'll keep it!"]);

        if (menu === 0) {
            await mes(player, 'As you drop the cystal, it hits a rock and explodes.');
            player.message('You are lascerated by shards of glass.');
            hurt(player, 10);
            player.inventory.remove(ITEM.LOCATING_CRYSTAL, 1);
        } else if (menu === 1) {
            player.message('You decide to keep the Locating Crystal ');
            player.message('tucked into your inventory safe and sound.');
        }
    } else if (item.id === ITEM.SWORD_POMMEL) {
        await mes(player, 'You drop the sword pommel on the floor.');
        player.message('It turns to dust as soon as it hits the ground.');
        player.inventory.remove(ITEM.SWORD_POMMEL, 1);
    } else if (item.id === ITEM.BONE_KEY) {
        player.message('This looks quite valuable.');
        player.message('As you go to throw the item away');
        player.message("Zadimus' words come to you again.");
        player.message("@yel@'I am the key, but only kin may approach her'");
    } else if (item.id === ITEM.BONE_SHARD) {
        player.message('You cannot bring yourself to drop this item.');
        player.message('You remember the words that Zadimus said when he appeared');
        player.message('in front of you.');
        player.message("@yel@'I am the key, but only kin may approach her.");
    } else if (item.id === ITEM.CRUMPLED_SCROLL) {
        await confirmDiscard(player, ITEM.CRUMPLED_SCROLL, [
            'As you drop the item, it gets carried off by the wind.',
            'never to be seen again.'
        ]);
    } else if (item.id === ITEM.TATTERED_SCROLL) {
        await confirmDiscard(player, ITEM.TATTERED_SCROLL, [
            'You decide to throw the item away.',
            'As you drop the item, it falls down a narrow crevice.',
            'never to be seen again.'
        ]);
    } else if (item.id === ITEM.ZADIMUS_CORPSE) {
        await dropZadimusCorpse(player);
    } else if (item.id === ITEM.STONE_PLAQUE) {
        await confirmDiscard(player, ITEM.STONE_PLAQUE, [
            'As you drop the item, it bounces into a stream.',
            'never to be seen again.'
        ]);
    }

    return true;
}

const COMMAND_IDS = new Set([
    ITEM.ZADIMUS_CORPSE,
    ITEM.CRUMPLED_SCROLL,
    ITEM.TATTERED_SCROLL,
    ITEM.STONE_PLAQUE,
    ITEM.BONE_SHARD,
    ITEM.BERVIRIUS_TOMB_NOTES,
    ITEM.LOCATING_CRYSTAL,
    ITEM.BONE_KEY,
    ITEM.RASHILIYA_CORPSE
]);

async function activateCrystal(player) {
    await mes(player, 'You feel the crystal trying to draw upon your spiritual energy.');
    player.message('Do you want to let it.');

    const menu = await player.ask(['Yes, that seems fine.', 'No, it sounds a bit dangerous.']);

    if (menu === 1) {
        player.message('You decide not to allow the crystal to draw spiritual energy from your body.');
        return;
    }

    if (level(player, 'prayer') < 10) {
        player.message('You have no spiritual energy that the crystal can draw from.');
        await delay(player, 2);
        player.message('You need to have at least 10 prayer points for it to work.');
        return;
    }

    // sic: the Java compares only the x coordinate with 351 (its TODO "check ranges")
    const distance = Math.abs(351 - player.x);

    if (distance <= 5) {
        player.message('The crystal blazes brilliantly.');
        player.changeStat('prayer', -1);
    } else if (distance <= 7) {
        player.message('@yel@The crystal is very bright.');
        player.changeStat('prayer', -1);
    } else if (distance <= 10) {
        player.message('@red@The crystal glows brightly');
        player.changeStat('prayer', -1);
    } else if (distance <= 20) {
        player.message('The crystal glows feintly');
        player.changeStat('prayer', -1);
    } else {
        player.message('Nothing seems different about the Crystal.');
        player.changeStat('prayer', -2);
    }
}

async function readNotes(player) {
    player.message('This scroll is a collection of writings..');
    await delay(player, 2);
    player.message('Some of them are just scraps of papyrus with what looks like random scribblings.');
    await delay(player, 2);
    player.message('Which would you like to read?');
    await delay(player, 2);

    const menu = await player.ask(['Tattered Yellow papyrus', 'Decayed White papyrus', 'Crusty Orange papyrus']);

    if (menu >= 0 && !cacheHas(player, 'read_tomb_notes')) {
        cacheSet(player, 'read_tomb_notes');
    }

    if (menu === 0) {
        sendBox(
            player,
            '...and rest like your mother who is silent in the peace of her ' +
                'tomb far to the North of Ah Za Rhoon. Near the sea, and under ' +
                'the hills deep in the underground to watch all of nature from the ' +
                'darkness of her final resting place.',
            false
        );
    } else if (menu === 1) {
        sendBox(
            player,
            '...Rashiliyia did so love objects of beauty. Her tomb was ' +
                'adnorned with crystals that glowed brightly when near to each other.',
            false
        );
    } else if (menu === 2) {
        sendBox(
            player,
            '...the sphere is activated when power of a spiritual nature is ' +
                'expended upon it, this can be very draining on the body...',
            false
        );
    }
}

async function onInventoryCommand(player, item) {
    if (!item || !COMMAND_IDS.has(item.id)) {
        return false;
    }

    if (item.id === ITEM.RASHILIYA_CORPSE) {
        player.message('Nothing interesting happens');
    } else if (item.id === ITEM.BONE_KEY) {
        player.message('The key is intricately carved out of bone.');
    } else if (item.id === ITEM.LOCATING_CRYSTAL) {
        await activateCrystal(player);
    } else if (item.id === ITEM.BERVIRIUS_TOMB_NOTES) {
        await readNotes(player);
    } else if (item.id === ITEM.BONE_SHARD) {
        player.message('The words of Zadimus come back to you.');
        player.message("@yel@'I am the key, but only kin may approach her.'");
    } else if (item.id === ITEM.ZADIMUS_CORPSE) {
        await dropZadimusCorpse(player);
    } else if (item.id === ITEM.CRUMPLED_SCROLL) {
        await mes(player, 'This looks like part of a scroll about Rashiliyia');
        await mes(player, 'Would you like to read it?');

        const menu = await player.ask(['Yes please!', 'No thanks.']);

        if (menu === 0) {
            sendBox(
                player,
                "Rashiliyia's rage went unchecked.% %" +
                    'She killed without mercy for revenge of her sons life.% %' +
                    'Like a spectre through the night she entered houses and one ' +
                    'by one quietly strangled life from the occupants.% %' +
                    'It is said that only a handful survived, protected by necklace wards to keep the Witch Queen at bay.',
                true
            );
        } else if (menu === 1) {
            player.message('You decide to leave the scroll well alone.');
        }
    } else if (item.id === ITEM.TATTERED_SCROLL) {
        await mes(player, 'This looks like part of a scroll about someone called Berverius..');
        player.message('Would you like to read it?');

        const menu = await player.ask(['Yes please.', 'No thanks.']);

        if (menu === 0) {
            sendBox(
                player,
                'Bervirius, song of King Danthalas, was killed in battle.% %' +
                    'His devout Mother Rashiliyia was so heartbroken that she% swore fealty to Zamorak ' +
                    'if he would return her son to her.% %' +
                    'Bervirius returned as an undead creature and terrorized the ' +
                    'King and Queen. Many guards died fighting the Undead ' +
                    'Berverious, eventually the undead Bervirius was set on fire and ' +
                    'soon only the bones remained.% %' +
                    'His remains were taken far to the South, and then towards the ' +
                    'setting sun to a tomb that is surrounded by and level with the ' +
                    'sea. The only remedy for containing the spirits of witches and undead.',
                true
            );
        } else if (menu === 1) {
            player.message('You decide not to open the scroll but instead put it carefully back into your inventory.');
        }
    } else if (item.id === ITEM.STONE_PLAQUE) {
        await mes(player, "The markings are very intricate. It's a very strange language.");
        await mes(player, 'The meaning of it evades you though.');
    }

    return true;
}

const pair = (item, target, a, b) => (item.id === a && target.id === b) || (item.id === b && target.id === a);

// chisel and pommel / bone beads and wire / chisel and bone shard
async function onUseWithInventory(player, item, target) {
    if (pair(item, target, ITEM.BONE_BEADS, ITEM.BRONZE_WIRE)) {
        if (level(player, 'crafting') < 20) {
            player.message('You need a level of 20 Crafting to craft this.');
            return true;
        }

        await mes(player, 'You successfully craft the beads and Bronze Wire ');
        player.message("into a necklace which you name, 'Beads of the dead'");
        player.inventory.remove(ITEM.BRONZE_WIRE, 1);
        player.inventory.remove(ITEM.BONE_BEADS, 1);
        player.inventory.add(ITEM.BEADS_OF_THE_DEAD, 1);

        return true;
    }

    if (pair(item, target, ITEM.CHISEL, ITEM.BONE_SHARD)) {
        if (stageOf(player) === -1) {
            player.message("You're not quite sure what to make with this.");
            return true;
        }

        if (cacheHas(player, 'can_chisel_bone')) {
            if (level(player, 'crafting') < 20) {
                player.message('You need a level of 20 Crafting to craft this.');
                return true;
            }

            await mes(player, "Remembering Zadimus' words and the strange bone lock,");
            await mes(player, 'you start to craft the bone.');
            player.message('You succesfully make a key out of the bone shard.');
            player.inventory.remove(ITEM.BONE_SHARD, 1);
            player.inventory.add(ITEM.BONE_KEY, 1);
            player.addExperience('crafting', 35);
        } else {
            await mes(player, "You're not quite sure what to make with this.");
            player.message('Perhaps it will come to you as you discover more about Rashiliyia?');
        }

        return true;
    }

    if (pair(item, target, ITEM.CHISEL, ITEM.SWORD_POMMEL)) {
        if (level(player, 'crafting') < 20) {
            player.message('You need a level of 20 Crafting to craft this.');
            return true;
        }

        await mes(player, 'You prepare the ivory pommel and the chisel to start crafting...');
        await mes(player, 'You successfully craft some of the ivory into beads.');
        player.message('They may look good as part of a necklace.');
        player.addExperience('crafting', 35);
        player.inventory.remove(ITEM.SWORD_POMMEL, 1);
        player.inventory.add(ITEM.BONE_BEADS, 1);

        return true;
    }

    return false;
}

// the cursed coins in the cave (ShiloVillageUtils.onTakeObj): the first touch raises the dead, the second takes 10 coins
async function onGroundItemTake(player, groundItem) {
    if (groundItem.id !== ITEM.COINS || groundItem.x !== COINS_X || groundItem.y !== COINS_Y) {
        return false;
    }

    const { world } = player;

    if (cacheHas(player, 'coins_shilo_cave')) {
        world.removeEntity('groundItems', groundItem);
        player.inventory.add(ITEM.COINS, 10);
        player.message('The coins turn to dust in your hand...');

        return true;
    }

    await mes(player, 'As soon as you touch the coins...');
    await mes(player, 'You hear the grinding sound of bones');
    player.message('against stone as you see skeletons and ');
    await delay(player, 2);
    player.message('Zombies rising up out of the ground.');
    spawnNpc(player, NPC.SKELETON, player.x - 1, player.y + 1, 60000);
    spawnNpc(player, NPC.SKELETON, player.x - 1, player.y - 1, 60000);
    spawnNpc(player, NPC.UNDEAD_ONE, player.x + 2, player.y + 1, 60000);
    spawnNpc(player, NPC.UNDEAD_ONE, player.x + 1, player.y - 1, 60000);
    player.message('The coins turn to dust in your hands.');
    cacheSet(player, 'coins_shilo_cave');

    return true;
}

module.exports = {
    bumpyDirtHolder,
    dropZadimusCorpse,
    onDropItem,
    onInventoryCommand,
    onUseWithInventory,
    onGroundItemTake
};
