// Gu'Tanoth's gates and battlement (the stage map is in shared.js), from authentic/quests/members/watchtower/
// WatchTowerGateObstacles.java (the east/south gate 988 wants a gold bar, the north-west gate 989 the ogre relic, the enclave
// gate 1068 is shut) and the south-west battlement (wall 195, rock cakes) and the battlement 201 of WatchTowerObstacles.java
// (AGPL-3.0). The caves, the rock jump and the enclave entrance are in game-objects/watchtower-obstacles.js.

const { NPC, ITEM, stageOf, findNpc, carries } = require('./shared');

const NORTH_WEST_GATE = 989;
const EAST_SOUTH_GATE = 988;
const OGRE_ENCLAVE_GATE = 1068;
const BATTLEMENT = 201;
const SOUTH_WEST_BATTLEMENT = 195;

const OUTSIDE = { x: 635, y: 774 };

// ---------------------------------------------------------------- the relic guard (north-west gate)

async function relicCheckGuard(player, guard) {
    await guard.say('Well, what proof of friendship did you bring ?');

    if (carries(player, ITEM.OGRE_RELIC)) {
        await player.say('I have a relic from a chieftan');
        await guard.say("It's got the statue of Dalgroth", "Welcome to Gu'Tanoth", 'Friend of the ogres');
        player.message('The ogre guard lets you pass');
        player.teleport(667, 773);
        delete player.cache.get_ogre_companionship;
        player.cache.has_ogre_companionship = true;
    } else {
        await player.say("I don't have anything");
        await guard.say('Why have you returned with no proof of companionship ?', 'Back to whence you came!');
        player.message('The guard pushes you back down the hill');
        player.teleport(OUTSIDE.x, OUTSIDE.y);
    }
}

// ---------------------------------------------------------------- the gold guard (east/south gate)

async function goldCheckGuard(player, guard) {
    await guard.say('Creature, did you bring me the gold ?');

    if (carries(player, ITEM.GOLD_BAR)) {
        await player.say('Here it is');
        player.inventory.remove(ITEM.GOLD_BAR);
        await guard.say("It's brought it!", 'On your way');
        delete player.cache.get_gold_ogre;
        player.cache.has_gold_ogre = true;
        player.teleport(630, 795);
        player.message('The ogre guard lets you pass');
    } else {
        await player.say("No I don't have it");
        await guard.say('No gold, no passage', 'get out of this city!');
        player.message('The guard pushes you outside the city');
        player.teleport(OUTSIDE.x, OUTSIDE.y);
    }
}

// ---------------------------------------------------------------- the rock cake guard (south-west battlement)

async function cakeCheckGuard(player, guard) {
    await guard.say('Stop creature!... Oh its you', 'Well what have you got for us then ?');

    if (carries(player, ITEM.ROCK_CAKE)) {
        await player.say('How about this ?');
        player.message('You give the guard a rock cake');
        player.inventory.remove(ITEM.ROCK_CAKE);
        await guard.say('Well well, looks at this', 'My favourite, rock cake!', 'Okay we will let it through');
        player.teleport(663, 812);
        player.message('You climb over the battlement');
        delete player.cache.get_ogre_gift;
        player.cache.has_ogre_gift = true;
    } else {
        await player.say("I didn't bring anything");
        await guard.say("Didn't bring anything!", 'In that case shove off!');
        player.message('The guard pushes you out of the city');
        player.teleport(OUTSIDE.x, OUTSIDE.y);
    }
}

async function southWestBattlement(player) {
    const { cache } = player;
    const guard = findNpc(player, NPC.OGRE_GUARD_BATTLEMENT, 5);

    if (player.x <= 664) {
        player.teleport(player.x + 1, player.y);
        return;
    }

    if (cache.has_ogre_gift || stageOf(player) === -1) {
        if (guard) {
            await guard.say("It's that creature again", 'This time we will let it go...');
        }

        player.teleport(player.x - 1, player.y);
        player.message('You climb over the battlement');
    } else if (cache.get_ogre_gift) {
        if (guard) {
            await cakeCheckGuard(player, guard);
        }
    } else if (guard) {
        await guard.say('Oi! where do you think you are going ?', 'You are for the cooking pot!');

        const menu = await player.ask(['But I am a friend to ogres...', 'Not if I can help it'], true);

        if (menu === 0) {
            await guard.say('Prove it to us with a gift', 'Get us something from the market');
            await player.say('Like what ?');
            await guard.say('Surprise us...');
            cache.get_ogre_gift = true;
        } else if (menu === 1) {
            await guard.say('You can help by being tonight\'s dinner...', 'Or you can go away, now what shall it be ?');

            const subMenu = await player.ask(['Okay, okay i\'m going', 'I tire of ogres, prepare to die!'], true);

            if (subMenu === 0) {
                await guard.say('back to whence you came');
                player.teleport(OUTSIDE.x, OUTSIDE.y);
            } else if (subMenu === 1) {
                await guard.say('Grrrrr!');
                if (typeof guard.attack === 'function') {
                    Promise.resolve(guard.attack(player)).catch(() => {});
                }
            }
        }
    }
}

// ---------------------------------------------------------------- hooks

async function onGameObjectCommandOne(player, gameObject) {
    const { cache } = player;

    if (gameObject.id === OGRE_ENCLAVE_GATE) {
        player.message('The gate is locked tight');
        player.message("I'll have to find another way out...");
        return true;
    }

    if (gameObject.id === EAST_SOUTH_GATE) {
        const guard = findNpc(player, NPC.OGRE_GUARD_EASTGATE, 5);

        if (player.y >= 794) {
            player.teleport(630, 792);
        } else if (!guard) {
            player.message('The Ogre guard is currently busy');
        } else if (cache.has_gold_ogre || stageOf(player) === -1) {
            await guard.say('I know you creature, you may pass');
            player.teleport(630, 795);
        } else if (cache.get_gold_ogre) {
            await goldCheckGuard(player, guard);
        } else {
            await guard.say('Halt!', 'You cannot pass here');
            await player.say('I am a friend to ogres');
            await guard.say('You will be my friend only with gold', 'Bring me a bar of pure gold and i will let you pass', 'For now - begone!');
            cache.get_gold_ogre = true;
            player.message('The guard pushes you outside the city');
            player.teleport(OUTSIDE.x, OUTSIDE.y);
        }

        return true;
    }

    if (gameObject.id === NORTH_WEST_GATE) {
        const guard = findNpc(player, NPC.OGRE_GUARD_WESTGATE, 5);

        if (player.x >= 666) {
            player.teleport(665, 773);
        } else if (!guard) {
            player.message('The ogre guard is currently busy');
        } else if (cache.has_ogre_companionship || stageOf(player) === -1) {
            await guard.say("It's the small creature", 'You may pass');
            player.teleport(667, 773);
        } else if (cache.get_ogre_companionship) {
            await relicCheckGuard(player, guard);
        } else {
            await guard.say(
                'Stop creature!',
                'Only ogres and their friends allowed in this city',
                'Show me a sign of companionship',
                'And you may pass...',
                'Until then, back to whence you came!'
            );
            cache.get_ogre_companionship = true;
            player.message('The guard pushes you back down the hill');
            player.teleport(OUTSIDE.x, OUTSIDE.y);
        }

        return true;
    }

    return false;
}

async function onWallObjectCommandOne(player, wallObject) {
    if (wallObject.id === BATTLEMENT) {
        await player.say(
            "What's this ?",
            'The bridge is out - i\'ll need to find another way in',
            'I can see a ladder up there coming out of a hole',
            'Maybe I should check out some of these tunnels around here...'
        );
        return true;
    }

    if (wallObject.id === SOUTH_WEST_BATTLEMENT) {
        await southWestBattlement(player);
        return true;
    }

    return false;
}

async function onUseWithNPC(player, npc, item) {
    const { cache } = player;

    if (npc.id === NPC.OGRE_GUARD_EASTGATE && item.id === ITEM.GOLD_BAR) {
        const guard = findNpc(player, NPC.OGRE_GUARD_WESTGATE, 5);

        // the Java looks for the WEST gate guard here (a sic): no guard in range, nothing happens
        if (guard) {
            if (cache.has_gold_ogre || stageOf(player) === -1) {
                // not known dialogue - guessed
                await guard.say("Yes, yes I've seen it!");
                return true;
            }

            await goldCheckGuard(player, guard);
        }

        return true;
    }

    if (npc.id === NPC.OGRE_GUARD_WESTGATE && [ITEM.OGRE_RELIC, ITEM.OGRE_RELIC_PART_BASE, ITEM.OGRE_RELIC_PART_BODY, ITEM.OGRE_RELIC_PART_HEAD].includes(item.id)) {
        const guard = findNpc(player, NPC.OGRE_GUARD_WESTGATE, 5);

        if (guard && item.id === ITEM.OGRE_RELIC) {
            if (cache.has_ogre_companionship || stageOf(player) === -1) {
                await guard.say("Yes, yes I've seen it!");
                return true;
            }

            await relicCheckGuard(player, guard);
        } else {
            await npc.say("What's this thing ?", 'It looks a bit like our Dalgroth...', "But it's in bits... go away!");
            player.message('The guard pushes you back down the hill');
            player.teleport(OUTSIDE.x, OUTSIDE.y);
            // OG RSC with this reset the ogre companionship
            delete cache.has_ogre_companionship;
            cache.get_ogre_companionship = true;
        }

        return true;
    }

    if (npc.id === NPC.OGRE_GUARD_BATTLEMENT) {
        const guard = findNpc(player, NPC.OGRE_GUARD_BATTLEMENT, 5);

        if (item.id === ITEM.OGRE_RELIC) {
            await npc.say("It's a relic, what of it ?");
            await player.say('Ow!');
            player.message('The guard gives you a smack around the head');
            await npc.say('Bring me something good next time!');
        } else if (item.id === ITEM.ROCK_CAKE) {
            if (cache.get_ogre_gift && guard) {
                await cakeCheckGuard(player, guard);
            } else {
                await player.say('Why am I giving this cake to this ogre ???');
            }
        } else {
            player.message('Nothing interesting happens');
        }

        return true;
    }

    return false;
}

module.exports = { onGameObjectCommandOne, onWallObjectCommandOne, onUseWithNPC };
