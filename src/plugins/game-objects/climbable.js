// 199: the black hole ladder (miniquests/black-hole.js)
// 244: the Entrana dungeon ladder (the monk warns first, quests/members/lost-city.js)
// 359: the White Wolf Mountain stairs (the dwarf guards them, quests/members/fishing-contest.js)
// 981, 985: the Dwarf Cannon watch tower ladders (quests/members/dwarf-cannon/objects.js; the trap door is shut at stage 0)
const EXCLUDE_IDS = new Set([130, 198, 199, 223, 227, 244, 359, 981, 985]);
// ladders, stairs and levers that move the player to a fixed tile (object-tele-points.js) are not plane shifts
const { findTelePoint } = require('./object-tele-points');

async function onGameObjectCommandOne(player, gameObject) {
    if (EXCLUDE_IDS.has(gameObject.id) || findTelePoint(gameObject)) {
        return false;
    }
    if (/go up|climb(-| )up/i.test(gameObject.definition.commands[0])) {
        const { world } = player;

        if (/ladder/i.test(gameObject.definition.name)) {
            player.message('You climb up the ladder');
        }

        player.climb(gameObject, true);
        await world.sleepTicks(1);
        return true;
    } else if (
        /go down|climb(-| )down/i.test(gameObject.definition.commands[0])
    ) {
        const { world } = player;

        if (/ladder/i.test(gameObject.definition.name)) {
            player.message('You climb down the ladder');
        }

        player.climb(gameObject, false);
        await world.sleepTicks(1);
        return true;
    }

    return false;
}

module.exports = { onGameObjectCommandOne };
