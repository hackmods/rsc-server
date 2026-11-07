// Ported from Open-RSC Core-Framework authentic/npcs/shilo/Yanni.java and CartDriver.java and the two Shilo gates of
// authentic/defaults/DoorAction.java (AGPL-3.0): the village side of the quest. The metal gate 611 (388,851) lets a player who has
// finished the quest in, and drags anyone else in among the zombies; the wooden gate 712 (394,851) is the way out. Yanni (624) buys
// the quest's curios. The cart driver (619, 417,853) takes 500 coins to Brimhaven (468,662).
//
// Not ported: the Brimhaven cart driver (618) and cart (769), which the map data does not have, so the ride to the village does
// not exist. The cart 613 over the village wall is in game-objects/object-tele-points.js.

const { ITEM, NPC, stageOf, mes, delay, holds, swapObject } = require('./shared');

const METAL_GATE = 611;
const WOODEN_GATE = 712;
const TRAVEL_CART_SHILO = 768;

async function metalGate(player, gameObject) {
    if (gameObject.x !== 388 || gameObject.y !== 851) {
        return false;
    }

    if (stageOf(player) === -1) {
        player.teleport(395, 851);
        player.message('You open the gates and make your way through into');
        player.message('the village.');
        return true;
    }

    await mes(player, 'The gate feels very cold to your touch!');
    player.message('Are you sure you want to go through?');

    const menu = await player.ask(['Yes, I am fearless!', 'No, actually, I have a bad feeling about this!']);

    if (menu === 0) {
        swapObject(player, gameObject, 612, 5);

        if (player.x >= 388) {
            await mes(player, 'The gates open very slowly.');
            player.teleport(387, 852);
            player.message('You manage to drag your battered body back through the gates.');
        } else {
            await mes(player, 'The gates open very slowly...');
            player.teleport(389, 852);
            await mes(player, 'As soon as the gates open, the Zombies grab you and start dragging you inside!');
            player.teleport(391, 852);
            await player.say("Oh no, I'm done for!");
        }
    } else if (menu === 1) {
        await mes(player, 'You drag your quivering body  away from the gates.');
    }

    return true;
}

async function woodenGate(player, gameObject) {
    if (gameObject.x !== 394 || gameObject.y !== 851) {
        return false;
    }

    if (player.x >= 394) {
        await mes(player, 'The gate opens smoothly');
        player.teleport(381, 851);
        player.message('You make your way out of Shilo Village.');
    } else {
        player.message("The gate won't open");
        await delay(player, 3);
        player.message("You look around, but you don't think anyone saw you.");
    }

    return true;
}

async function cartRide(player, driver) {
    await driver.say('I am offering a cart ride to Brimhaven if you\'re interested!', 'It will cost 500 Gold');

    const menu = await player.ask(['Yes, that sounds great!', 'No thanks.'], false);

    if (menu === 0) {
        await player.say("Yes please, I'd like to go to Brimhaven!");

        if (holds(player, ITEM.COINS, 500)) {
            await driver.say('Great!', "Just hop into the cart then and we'll go!");
            player.inventory.remove(ITEM.COINS, 500);
            await mes(player, 'You Hop into the cart and the driver urges the horses on.', 2);
            player.teleport(468, 662);
            await mes(player, 'You take a taxing journey through the jungle to Brimhaven.', 2);
            await mes(player, 'You feel fatigued from the journey, but at least', 2);
            await mes(player, "you didn't have to walk all that distance.", 2);
        } else {
            await driver.say(
                "Sorry, but it looks as if you don't have enough money.",
                'Come back and see me when you have enough for the ride.'
            );
        }
    } else if (menu === 1) {
        await player.say('No thanks.');
        await driver.say('Ok Bwana, let me know if you change your mind.');
    }
}

const CURIOS = [
    [ITEM.BONE_KEY, 100, 'Bone Key', 'You sell the Bone Key.'],
    [ITEM.STONE_PLAQUE, 100, 'Stone-Plaque', 'You sell the Stone Plaque.'],
    [ITEM.TATTERED_SCROLL, 100, 'tattered scroll', 'You sell the Tattered Scroll.'],
    [ITEM.CRUMPLED_SCROLL, 100, 'crumpled scroll', 'You sell the crumpled Scroll.'],
    [ITEM.BERVIRIUS_TOMB_NOTES, 100, 'Bervirius Tomb Notes', 'You sell the Bervirius Tomb Notes.'],
    [ITEM.LOCATING_CRYSTAL, 500, 'Locating Crystal', 'You sell the Locating Crystal.'],
    [ITEM.BEADS_OF_THE_DEAD, 1000, 'Beads of the Dead', 'You sell Beads of the Dead.']
];

async function yanniTalk(player, npc) {
    await player.say('Hello there!');
    await npc.say(
        'Greetings Bwana!',
        'My name is Yanni and I buy and sell antiques ',
        'and other interesting items.',
        'If you have any interesting items that you might',
        "want to sell me, please let me see them and I'll",
        'offer you a fair price.',
        'Would you like me to have a look at your items',
        'and give you a quote?'
    );

    const menu = await player.ask(['Yes please!', 'Maybe some other time?'], true);

    if (menu === 0) {
        await npc.say('Great Bwana!');

        let interest = 0;

        for (const [id, price, name] of CURIOS) {
            if (!player.inventory.has(id)) {
                continue;
            }

            interest++;

            if (id === ITEM.LOCATING_CRYSTAL) {
                await npc.say("WOW! I'll give you 500 Gold for your Locating Crystal!");
            } else if (id === ITEM.BEADS_OF_THE_DEAD) {
                await npc.say("Great I'll give you 1000 Gold for your Beads of the Dead.");
            } else if (id === ITEM.BERVIRIUS_TOMB_NOTES) {
                await npc.say("I'll give you 100 Gold for your Bervirius Tomb Notes.");
            } else if (id === ITEM.TATTERED_SCROLL || id === ITEM.CRUMPLED_SCROLL) {
                await npc.say(`I'll give you ${price} Gold for your ${name}`);
            } else {
                await npc.say(`I'll give you ${price} Gold for the ${name}.`);
            }
        }

        if (interest > 0) {
            await npc.say(interest > 1 ? 'Those are the items I am interested in Bwana.' : "And that's the only item I am interested in.");
            await npc.say('If you want to sell me those items, simply show them to me.');
        } else {
            await npc.say('Sorry Bwana, you have nothing I am interested in.');
        }
    } else if (menu === 1) {
        await npc.say('Sure thing.', 'Have a nice day Bwana.');
    }
}

async function onTalkToNPC(player, npc) {
    if (npc.id !== NPC.YANNI && npc.id !== NPC.CART_DRIVER_SHILO) {
        return false;
    }

    player.engage(npc);

    try {
        if (npc.id === NPC.YANNI) {
            await yanniTalk(player, npc);
        } else {
            await player.say('Hello!');
            await npc.say('Hello Bwana!');
            await cartRide(player, npc);
        }
    } finally {
        if (player.interlocutor) {
            player.disengage();
        }
    }

    return true;
}

async function onUseWithNPC(player, npc, item) {
    if (npc.id !== NPC.YANNI) {
        return false;
    }

    const row = CURIOS.find(([id]) => id === item.id);

    if (!row) {
        player.message('Nothing interesting happens');
        return true;
    }

    const [id, price, , message] = row;

    await npc.say(`Great item, here's ${price} Gold for it.`);
    player.inventory.remove(id, 1);
    player.inventory.add(ITEM.COINS, price);
    player.message(message);

    return true;
}

async function onGameObjectCommandOne(player, gameObject) {
    if (gameObject.id === METAL_GATE) {
        return metalGate(player, gameObject);
    }

    if (gameObject.id === WOODEN_GATE) {
        return woodenGate(player, gameObject);
    }

    if (gameObject.id === TRAVEL_CART_SHILO) {
        player.message('This looks like a sturdy travelling cart.');

        const driver = player.getNearbyEntitiesWithinRadius('npcs', NPC.CART_DRIVER_SHILO, 10)[0];

        if (!driver) {
            player.message('The cart driver is currently busy.');
            return true;
        }

        player.message('A nearby man walks over to you.');
        player.engage(driver);

        try {
            await cartRide(player, driver);
        } finally {
            if (player.interlocutor) {
                player.disengage();
            }
        }

        return true;
    }

    return false;
}

async function onGameObjectCommandTwo(player, gameObject) {
    if (gameObject.id === TRAVEL_CART_SHILO) {
        player.message('A sturdy travelling cart built for long trips through jungle areas.');
        return true;
    }

    return false;
}

module.exports = { onTalkToNPC, onUseWithNPC, onGameObjectCommandOne, onGameObjectCommandTwo };
