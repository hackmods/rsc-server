// Thordur's Black Hole Experience (12 July 2001 - 26 February 2002): pay Thordur 10 coins for a disk of returning,
// climb down his ladder into the black hole (solid void, nowhere to walk) and spin the disk to get back out.
// https://classic.runescape.wiki/w/Transcript:Thordur
// https://classic.runescape.wiki/w/Disk_of_Returning
// Hole bounds and exit tile follow Open-RSC (Point.onBlackHole, DiskOfReturning.java).

const COINS_ID = 10;
const DISK_OF_RETURNING_ID = 387;
const HOLE_LADDER_ID = 199;
const THORDUR_ID = 175;

const BLACK_HOLE = { minX: 303, maxX: 307, minY: 3298, maxY: 3302 };
const HOLE_CENTRE = { x: 305, y: 3300 };
const EXIT = { x: 311, y: 3348 };

function inBlackHole({ x, y }) {
    return (
        x >= BLACK_HOLE.minX &&
        x <= BLACK_HOLE.maxX &&
        y >= BLACK_HOLE.minY &&
        y <= BLACK_HOLE.maxY
    );
}

async function offerExperience(player, npc) {
    const choice = await player.ask(
        ['Yes please', 'No Thankyou', "What's the black hole experience?"],
        true
    );

    switch (choice) {
        case 0: // yes
            await sellDisk(player, npc);
            break;
        case 2: {
            // describe
            await npc.say(
                'Experience the mind numbing boredom',
                "As experienced by runescape's criminals and rulebreakers",
                'But with the comfort of being able to leave at any time'
            );

            const describeChoice = await player.ask(
                [
                    'Yes please',
                    "No thanks, I don't enjoy Mind numbing boredom"
                ],
                false
            );

            if (describeChoice === 0) {
                await player.say('Yes please');
                await sellDisk(player, npc);
            } else {
                await player.say('No thanks', "I don't enjoy mind numbing boredom");
                await npc.say('Me neither', "I'm not well suited for this job");
            }
            break;
        }
    }
}

async function sellDisk(player, npc) {
    await npc.say(
        'Ok it will cost you 10 gold coins',
        'For which you get to enter the hole',
        'And get a magic disk which lets you escape again'
    );

    const choice = await player.ask(
        ['Yes that sounds good', "Oh I'm not paying money for it"],
        true
    );

    if (choice !== 0) {
        return;
    }

    if (!player.inventory.has(COINS_ID, 10)) {
        await player.say("Oh dear. I don't seem to have enough money");
        return;
    }

    player.inventory.remove(COINS_ID, 10);
    player.inventory.add(DISK_OF_RETURNING_ID);
    player.message('You pay the dwarf ten coins and get given a disk');
    await npc.say(
        'Ok you may climb down the ladder to the black hole',
        'Have fun'
    );
}

async function onTalkToNPC(player, npc) {
    if (npc.id !== THORDUR_ID) {
        return false;
    }

    player.engage(npc);
    await npc.say('Would you like to go on the black hole experience');
    await offerExperience(player, npc);
    player.disengage();
    return true;
}

async function onGameObjectCommandOne(player, gameObject) {
    if (gameObject.id !== HOLE_LADDER_ID) {
        return false;
    }

    const { world } = player;

    if (player.inventory.has(DISK_OF_RETURNING_ID)) {
        player.message('You climb down the ladder');
        await world.sleepTicks(1);

        // land somewhere in the hole, as Open-RSC does, so visitors are not all stacked on one tile
        player.teleport(
            HOLE_CENTRE.x + Math.floor(Math.random() * 5) - 2,
            HOLE_CENTRE.y + Math.floor(Math.random() * 5) - 2
        );
        return true;
    }

    const thordur = world.npcs.getByID(THORDUR_ID);

    if (!thordur || thordur.interlocutor) {
        player.message('you seem to be missing a disk to use the ladder');
        return true;
    }

    player.engage(thordur);
    await thordur.say(
        "Hey careful that's the ladder to the black hole experience",
        "You don't want to go down there unprepared",
        'So do you want to experience it?'
    );
    await offerExperience(player, thordur);
    player.disengage();
    return true;
}

async function onInventoryCommand(player, item) {
    if (item.id !== DISK_OF_RETURNING_ID) {
        return false;
    }

    if (!inBlackHole(player)) {
        player.message("The disk will only work from in Thordur's black hole");
        return true;
    }

    player.message('You spin your disk of returning');
    player.inventory.remove(DISK_OF_RETURNING_ID);
    player.teleport(EXIT.x, EXIT.y, true);
    return true;
}

// ARSC: the 2001 scam was "drop your disk and something cool happens", which left the player stuck in the hole
// until a moderator came. The disk is the only way out, so it stays in the bag while the player is in there.
async function onDropItem(player, item) {
    if (!item || item.id !== DISK_OF_RETURNING_ID || !inBlackHole(player)) {
        return false;
    }

    player.message("You'd better not drop that, it's your only way out");
    return true;
}

module.exports = {
    onTalkToNPC,
    onGameObjectCommandOne,
    onInventoryCommand,
    onDropItem,
    inBlackHole
};
