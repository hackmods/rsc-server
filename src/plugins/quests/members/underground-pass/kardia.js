// Ported from Open-RSC Core-Framework authentic/quests/members/undergroundpass/npcs/UndergroundPassKardiaTheWitch.java
// (AGPL-3.0): Kardia's house (773,3536): the railing (172) to look through, the door (173) that blasts the player until her cat
// is brought, the chest (885) with the doll of Iban, the journal and two potions (stage 6), and the cat that cannot be taken
// twice. The cat (1003) lies on the platform at 804,3509. Stage map: shared.js.

const {
    ITEM,
    NPC,
    OBJECT,
    stageOf,
    cacheHas,
    cacheSet,
    mes,
    give,
    take,
    holds,
    hurt,
    hitsCurrent,
    nearNpc,
    bubble
} = require('./shared');

async function railing(player) {
    await mes(player, 'inside you see Kardia the witch');
    player.message('her appearence make\'s you feel quite ill');

    return true;
}

// the cat is left at the door and the witch takes it in
async function leaveCat(player) {
    await mes(player, 'you place the cat by the door');
    take(player, ITEM.KARDIA_CAT);
    player.teleport(776, 3535);
    await mes(player, 'you knock on the door and hide around the corner');
    player.message('the witch takes the cat inside');
    cacheSet(player, 'kardia_cat');
}

async function door(player, wallObject, click) {
    if (click === 0) {
        if (cacheHas(player, 'kardia_cat')) {
            player.message('you open the door');
            await player.enterDoor(wallObject);
            await mes(player, 'and walk through');
            player.message('the witch is busy talking to the cat');

            return true;
        }

        const witch = nearNpc(player, NPC.KARDIA, 5);

        player.message('you reach to open the door');

        if (witch) {
            await witch.say('get away...far away from here');
            await player.world.sleepTicks(2);
            player.message('the witch raises her hands above her');
            bubble(player, player.x, player.y, true);
            hurt(player, Math.floor(hitsCurrent(player) / 5) + 5); // 6 lowest, 25 max.
            await witch.say('haa haa.. die mortal');
        } else {
            // not known dialogue - guessed: the Java marks it "find if something happens here authentically"
            player.message('but nothing seems to happen');
        }

        return true;
    }

    if (holds(player, ITEM.KARDIA_CAT) && !cacheHas(player, 'kardia_cat')) {
        await leaveCat(player);
    } else if (cacheHas(player, 'kardia_cat')) {
        await mes(player, 'there is no reply');
        player.message('inside you can hear the witch talking to her cat');
    } else {
        await mes(player, 'you knock on the door');
        player.message('there is no reply');
    }

    return true;
}

async function onWallObjectCommandOne(player, wallObject) {
    if (wallObject.id === OBJECT.WITCH_RAILING) {
        return railing(player);
    }

    return wallObject.id === OBJECT.WITCH_DOOR ? door(player, wallObject, 0) : false;
}

async function onWallObjectCommandTwo(player, wallObject) {
    if (wallObject.id === OBJECT.WITCH_RAILING) {
        return railing(player);
    }

    return wallObject.id === OBJECT.WITCH_DOOR ? door(player, wallObject, 1) : false;
}

async function onUseWithWallObject(player, wallObject, item) {
    if (wallObject.id !== OBJECT.WITCH_DOOR || item.id !== ITEM.KARDIA_CAT) {
        return false;
    }

    if (!cacheHas(player, 'kardia_cat')) {
        await leaveCat(player);
    } else {
        await mes(player, 'the witch is busy playing...');
        player.message('with her other cat');
    }

    return true;
}

// the chest: at stage 6 the doll of Iban, the old journal and two potions, once
async function searchChest(player, gameObject) {
    if (gameObject.id !== OBJECT.WITCH_CHEST) {
        return false;
    }

    await mes(player, 'you search the chest');

    if (stageOf(player) === 6 && !cacheHas(player, 'doll_of_iban')) {
        player.message('..inside you find a book a wooden doll..');
        player.message('...and two potions');
        give(player, ITEM.A_DOLL_OF_IBAN);
        give(player, ITEM.OLD_JOURNAL);
        give(player, ITEM.FULL_SUPER_ATTACK_POTION);
        give(player, ITEM.FULL_STAT_RESTORATION_POTION);
        cacheSet(player, 'doll_of_iban');
    } else {
        player.message('but you find nothing of interest');
    }

    return true;
}

// a second cat does not fit in the satchel
async function onGroundItemTake(player, groundItem) {
    if (groundItem.id !== ITEM.KARDIA_CAT || !holds(player, ITEM.KARDIA_CAT)) {
        return false;
    }

    await mes(player, "it's not very nice to squeeze one cat into a satchel");
    player.message("...two's just plain cruel!");

    return true;
}

async function onGameObjectCommandOne(player, gameObject) {
    return searchChest(player, gameObject);
}

async function onGameObjectCommandTwo(player, gameObject) {
    return searchChest(player, gameObject);
}

module.exports = {
    onWallObjectCommandOne,
    onWallObjectCommandTwo,
    onUseWithWallObject,
    onGameObjectCommandOne,
    onGameObjectCommandTwo,
    onGroundItemTake
};
