// The Watchtower quest's items and hand-overs (the stage map is in shared.js), from authentic/quests/members/watchtower/
// WatchTowerMechanism.java (the wizard's item uses, the city guard's death rune, the nightshade, the crystals and the robe on
// the ground, Toban's chest key) and WatchTowerShaman.java (the magic ogre potion), and from authentic/itemactions/InvAction.java
// (the spell scroll, nightshade and shaman robe) (AGPL-3.0).

const {
    NPC,
    ITEM,
    CRYSTALS,
    RELIC_PARTS,
    stageOf,
    setStage,
    isDone,
    give,
    mes,
    carries
} = require('./shared');

const TOBAN_CHEST_CLOSED = 978;
const TOBAN_CHEST_OPEN = 979;
const CHEST_TICKS = Math.ceil(2000 / 640);
const SHAMAN_CAVE = { x: 647, y: 3644 };

function hasAllCrystals(player) {
    return CRYSTALS.every((id) => carries(player, id));
}

async function lastCrystalChat(player, n) {
    await player.say('This is the last one');
    await n.say(
        'Magnificent!',
        "At last you've brought all the crystals",
        'Now the shield generator can be activated again',
        'And once again Yanille will be safe',
        'From the threat of the ogres',
        'Throw the lever to activate the system...'
    );

    if (stageOf(player) === 9) {
        setStage(player, 10);
    }
}

async function crystalToWizard(player, n, item) {
    const stage = stageOf(player);

    if (stage === 10 || stage === -1) {
        await n.say('More crystals ?', "I don't need any more now...");
        return;
    }

    if (item === ITEM.POWERING_CRYSTAL1) {
        await player.say('Wizard, look what I have found');
        await n.say("Well done! well done!", "That's a crystal found!", 'You are clever', 'Hold onto it until you have all four...');
    } else if (item === ITEM.POWERING_CRYSTAL2) {
        await player.say('Wizard, I have another crystal');
        await n.say('Superb!', 'Keep up the good work', 'Hold onto it until you have all four...');
    } else if (item === ITEM.POWERING_CRYSTAL3) {
        await player.say('Wizard, here is another crystal');
        await n.say("I must say i'm impressed", 'May Saradomin speed you in finding them all', 'Hold onto it until you have all four...');
    } else {
        await n.say('Well done! Well done!');
    }

    if (hasAllCrystals(player)) {
        await lastCrystalChat(player, n);
        return;
    }

    if (item !== ITEM.POWERING_CRYSTAL4) {
        await n.say('Keep searching for the others', "If you've dropped any...", 'Then you will need to go back to where you got it from');
        return;
    }

    await n.say('Keep searching for the others', "If you've dropped any...", 'Then you will need to go back to where you got it from');

    // authentic: only the first time showing it without the other crystals triggers the new dialogue on talk
    if (!player.cache.crystal_rock) {
        player.cache.crystal_rock = true;
    }
}

async function relicParts(player, n) {
    const { cache } = player;

    if (cache.wizard_relic_part_1 && cache.wizard_relic_part_2 && cache.wizard_relic_part_3) {
        await n.say(
            'Excellent! that seems to be all the pieces',
            'Now I can assemble it...',
            'Hmm, yes it is as I thought...',
            'A statue symbolising an ogre warrior of old',
            'Well, if you ever wanted to make friends with an ogre',
            'Then this is the item to have!'
        );
        player.message('The wizard gives you a complete statue');
        give(player, ITEM.OGRE_RELIC, 1);

        if (stageOf(player) === 2) {
            setStage(player, 3);
        }
    } else {
        await n.say('There may be more parts to find...', "I'll keep this for later");
    }
}

async function relicPartToWizard(player, n, item) {
    const { cache } = player;
    const parts = {
        [ITEM.OGRE_RELIC_PART_BODY]: { key: 'wizard_relic_part_1', say: 'I had this given to me', reply: "It's part of an ogre relic" },
        [ITEM.OGRE_RELIC_PART_BASE]: { key: 'wizard_relic_part_2', say: 'I got given this by an ogre', reply: 'Good good,a part of an ogre relic' },
        [ITEM.OGRE_RELIC_PART_HEAD]: { key: 'wizard_relic_part_3', say: 'An ogre gave me this', reply: "Ah, it's part of an old ogre statue" }
    };
    const part = parts[item];

    await player.say(part.say);

    if (cache[part.key] || stageOf(player) === 10 || stageOf(player) === -1) {
        await n.say('I already have that part...');
        return;
    }

    player.inventory.remove(item);
    await n.say(part.reply);
    cache[part.key] = true;
    await relicParts(player, n);
}

async function useOnWizard(player, n, item) {
    const id = item.id;

    switch (id) {
        case ITEM.POWERING_CRYSTAL1:
        case ITEM.POWERING_CRYSTAL2:
        case ITEM.POWERING_CRYSTAL3:
        case ITEM.POWERING_CRYSTAL4:
            await crystalToWizard(player, n, id);
            break;
        case ITEM.OGRE_RELIC_PART_BODY:
        case ITEM.OGRE_RELIC_PART_BASE:
        case ITEM.OGRE_RELIC_PART_HEAD:
            await relicPartToWizard(player, n, id);
            break;
        case ITEM.OGRE_RELIC:
            await player.say('What is this ?');
            await n.say('It is the ogre statue I finished for you...');
            break;
        case ITEM.VIAL:
            await n.say('Oh lovely, fresh water...thanks!');
            player.inventory.remove(ITEM.VIAL);
            player.inventory.add(ITEM.EMPTY_VIAL);
            break;
        case ITEM.SKAVID_MAP:
            player.message('You give the map to the wizard');
            await n.say(
                'Well well! a map!',
                'Indeed this shows the paths into the skavid caves',
                'I suggest you search these now...'
            );
            break;
        case ITEM.UNFINISHED_OGRE_POTION:
            await n.say('No no, the potion is not complete yet...');
            break;
        case ITEM.OGRE_POTION:
            if (stageOf(player) === -1) {
                await n.say(
                    'Another potion ?',
                    "Ooo no, I don't think so...",
                    "I can't let you use this anymore, it is just too dangerous",
                    "I'd better take it from you before you injure yourself"
                );
                player.inventory.remove(ITEM.OGRE_POTION);
                break;
            }

            await player.say('Yes I have made the potion');
            await n.say("That's great news, let me infuse it with magic...");
            player.message('The wizard mutters strange words over the liquid');
            player.inventory.remove(ITEM.OGRE_POTION);
            give(player, ITEM.MAGIC_OGRE_POTION, 1);
            await n.say(
                'Here it is, a dangerous substance',
                'I must remind you that this potion can only be used',
                'If your magic ability is high enough'
            );

            if (stageOf(player) === 7) {
                setStage(player, 8);
            }
            break;
        case ITEM.MAGIC_OGRE_POTION:
            await n.say('Yes that is the potion I enchanted for you', 'Go and use it now...');
            break;
        case ITEM.ARMOUR:
        case ITEM.WATCH_TOWER_EYE_PATCH:
        case ITEM.ROBE:
        case ITEM.DAGGER:
        case ITEM.GOBLIN_ARMOUR:
        case ITEM.EYE_PATCH:
        case ITEM.IRON_DAGGER:
        case ITEM.WIZARDS_ROBE:
            if (stageOf(player) !== 1) {
                player.message('The wizard has no need for more evidence');
                return;
            }

            if (id === ITEM.EYE_PATCH) {
                await player.say('I found this eye patch');
            } else if (id === ITEM.GOBLIN_ARMOUR) {
                await player.say('Have a look at this goblin armour');
            } else if (id === ITEM.IRON_DAGGER) {
                await player.say('I found a dagger');
            } else if (id === ITEM.WIZARDS_ROBE) {
                await player.say('I have this robe');
            }

            await n.say('Let me see...', 'No, sorry this is not evidence', 'You need to keep searching im afraid');
            break;
        default:
            player.message('Nothing interesting happens');
            break;
    }
}

async function useOnCityGuard(player, n) {
    const { cache } = player;

    if (cache.city_guard_riddle === true || stageOf(player) === -1) {
        player.message('The guard is not listening to you');
        return;
    }

    player.inventory.remove(ITEM.DEATH_RUNE);
    give(player, ITEM.SKAVID_MAP, 1);

    if (stageOf(player) === 3) {
        setStage(player, 4);
    }

    // player solved the riddle
    cache.city_guard_riddle = true;
    await player.say('I worked it out!');
    await n.say('Well well.. the imp has done it!', 'Thanks for the rune', 'This is what you be needing...');
    player.message('The guard gives you a map');
}

async function useNightshadeOnGuard(player, n) {
    const stage = stageOf(player);

    // LOCKED_POST_QUEST_REGIONS_ACCESSIBLE is false in the authentic config
    if ((stage >= 0 && stage < 5) || stage === -1) {
        player.message('The guard is occupied at the moment');
        return;
    }

    player.message('You give the guard some nightshade');
    player.inventory.remove(ITEM.NIGHTSHADE);
    await n.say('What is this!!!', 'Arrrrgh! I cannot stand this plant!', 'Ahhh, it burns! it burns!!!');
    player.message('You run past the guard while he is busy...');
    player.teleport(SHAMAN_CAVE.x, SHAMAN_CAVE.y);
}

// WatchTowerShaman.onUseNpc
async function useOnShaman(player, n, item) {
    const { cache } = player;

    if (item.id === ITEM.OGRE_POTION) {
        player.message('There is a small flash');
        player.message('But the potion was ineffective');
        await player.say('Oh no! I better go back to the wizards about this');
        return;
    }

    if (player.skills.magic.current < 14) {
        player.message('You need a level of 14 magic first');
        return;
    }

    player.message('There is a bright flash');
    player.message('The ogre dissolves into spirit form');
    // delnpc(n, true): gone, and back on its respawn timer
    player.world.removeEntity('npcs', n);

    if (cache.shaman_count === undefined) {
        cache.shaman_count = 1;
        await player.say('Thats one destroyed...');
        return;
    }

    const done = cache.shaman_count;

    if (done < 6) {
        cache.shaman_count = done + 1;
    }

    if (done === 1) {
        await player.say('Thats the second one gone...');
    } else if (done === 2) {
        await player.say('Thats the next one dealt with...');
    } else if (done === 3) {
        await player.say('There goes another one...');
    } else if (done === 4) {
        await player.say('Thats five, only one more left now...');
    } else if (done === 5 || cache.shaman_count === 6) {
        player.message('You hear a scream...');
        player.message('The shaman dissolves before your eyes!');
        player.message('A crystal drops from the hand of the dissappearing ogre!');
        player.message('You snatch it up quickly');
        player.inventory.remove(ITEM.MAGIC_OGRE_POTION);
        give(player, ITEM.EMPTY_VIAL, 1);
        give(player, ITEM.POWERING_CRYSTAL3, 1);

        if (stageOf(player) === 8) {
            setStage(player, 9);
        }
    }
}

async function onUseWithNPC(player, npc, item) {
    if (npc.id === NPC.WATCHTOWER_WIZARD) {
        if (item.id === ITEM.FINGERNAILS) {
            return false;
        }

        player.engage(npc);

        try {
            await useOnWizard(player, npc, item);
        } finally {
            player.disengage();
        }

        return true;
    }

    if (npc.id === NPC.CITY_GUARD && item.id === ITEM.DEATH_RUNE) {
        player.engage(npc);
        await useOnCityGuard(player, npc);
        player.disengage();

        return true;
    }

    if (npc.id === NPC.OGRE_GUARD_CAVE_ENTRANCE && item.id === ITEM.NIGHTSHADE) {
        player.engage(npc);
        await useNightshadeOnGuard(player, npc);
        player.disengage();

        return true;
    }

    if (npc.id === NPC.OGRE_SHAMAN && (item.id === ITEM.MAGIC_OGRE_POTION || item.id === ITEM.OGRE_POTION)) {
        await useOnShaman(player, npc, item);
        return true;
    }

    return false;
}

// Toban's chest 978 (606,804) and the key Og gave (use) or the key in the pack (click, see obstacles.js)
async function openTobanChest(player, gameObject, consumeKey) {
    if (consumeKey) {
        player.message('You use the key Og gave you');
        player.inventory.remove(ITEM.KEY);
    }

    player.world.replaceTimed('gameObjects', gameObject, TOBAN_CHEST_OPEN, CHEST_TICKS);

    if (carries(player, ITEM.STOLEN_GOLD)) {
        await mes(player, 'You have already got the stolen gold');
    } else {
        player.message('You find a stash of gold inside');
        await mes(player, 'You take the gold');
        give(player, ITEM.STOLEN_GOLD, 1);
    }

    player.message('The chest springs shut');
}

async function onUseWithGameObject(player, gameObject, item) {
    if (gameObject.id === TOBAN_CHEST_CLOSED && item.id === ITEM.KEY) {
        await openTobanChest(player, gameObject, false);
        return true;
    }

    return false;
}

async function onUseWithInventory(player, item, target) {
    const parts = (id) => RELIC_PARTS.includes(id);

    if (parts(item.id) && parts(target.id)) {
        player.message("I think these fit together, but I can't seem to make it fit");
        player.message('I am going to need someone with more experience to help me with this');
        return true;
    }

    if (
        (item.id === ITEM.BAT_BONES && target.id === ITEM.VIAL) ||
        (item.id === ITEM.VIAL && target.id === ITEM.BAT_BONES)
    ) {
        player.message('The bat bones are to bulky to fit in the vial');
        return true;
    }

    return false;
}

// ---------------------------------------------------------------- ground items

function inPedestal({ x, y }) {
    return (x === 490 || x === 495) && (y === 3520 || y === 3525);
}

async function onGroundItemTake(player, groundItem) {
    if (groundItem.id === ITEM.SHAMAN_ROBE) {
        player.message('You take the robe');

        if (stageOf(player) === 5) {
            setStage(player, 6);
        }

        // the default pickup adds the robe and removes it from the ground
        return false;
    }

    if (!CRYSTALS.includes(groundItem.id)) {
        return false;
    }

    if (stageOf(player) === -1 || inPedestal(groundItem)) {
        await mes(player, 'You try and take the crystal but its stuck solid!');
        await mes(player, 'You feel magic power coursing through the crystal...');
        await mes(player, 'The force renews your magic level');

        const { magic } = player.skills;

        if (magic.current < magic.base) {
            player.changeStat('magic', magic.base - magic.current);
        }

        return true;
    }

    player.message('You take the crystal');

    return false;
}

// ---------------------------------------------------------------- InvAction (spell scroll, nightshade, shaman robe)

async function onInventoryCommand(player, item) {
    const { cache } = player;

    if (item.id === ITEM.SPELL_SCROLL) {
        if (cache.watchtower_scroll && isDone(player)) {
            await mes(player, 'The scroll crumbles to dust');
        } else {
            await mes(player, 'You memorise what is written on the scroll');
            await mes(player, 'You can now cast the Watchtower teleport spell');
            await mes(player, 'Provided you have the required runes and magic level');
            await mes(player, 'The scroll crumbles to dust');
        }

        player.inventory.remove(ITEM.SPELL_SCROLL);
        cache.watchtower_scroll = true;

        return true;
    }

    if (item.id === ITEM.NIGHTSHADE) {
        if (!player.inventory.has(ITEM.NIGHTSHADE)) {
            return true;
        }

        player.inventory.remove(ITEM.NIGHTSHADE);
        player.message('You eat the nightshade...');
        await player.say('Ahhhh! what have I done !');
        player.damage(Math.floor(player.skills.hits.current * 0.166666666 + 14));
        player.message('The nightshade was highly poisonous');

        return true;
    }

    if (item.id === ITEM.SHAMAN_ROBE) {
        const stage = stageOf(player);

        player.message('You search the robe');

        if (stage === 8 || stage === 9) {
            if (carries(player, ITEM.POWERING_CRYSTAL3)) {
                await mes(player, 'You find nothing');
            } else if (player.bank.has(ITEM.POWERING_CRYSTAL3)) {
                await player.say('I already have this in my bank');
            } else {
                await mes(player, 'You find a crystal wrapped in the folds of the material');
                give(player, ITEM.POWERING_CRYSTAL3, 1);
            }
        } else {
            await mes(player, 'You find nothing');
        }

        return true;
    }

    return false;
}

module.exports = {
    onUseWithNPC,
    onUseWithGameObject,
    onUseWithInventory,
    onGroundItemTake,
    onInventoryCommand,
    openTobanChest
};
