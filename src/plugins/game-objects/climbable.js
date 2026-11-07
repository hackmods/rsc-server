// 732, 750-753, 816, 817, 836, 838, 862-866, 872, 920: the Underground Pass ledges, grills and ladder (quests/members/underground-pass/)
// 199: the black hole ladder (miniquests/black-hole.js)
// 331: the trapped Handelmort mansion stairs (quests/members/tribal-totem.js)
// 458: the Sea Slug fishing platform ladder (quests/members/sea-slug.js)
// 244: the Entrana dungeon ladder (the monk warns first, quests/members/lost-city.js)
// 359: the White Wolf Mountain stairs (the dwarf guards them, quests/members/fishing-contest.js)
// 981, 985: the Dwarf Cannon watch tower ladders (quests/members/dwarf-cannon/objects.js; the trap door is shut at stage 0)
// 369, 370: the Temple of Ikov dungeon stairs (quests/members/temple-of-ikov.js; down needs a lit light)
// 928: the Observatory reception ladder (quests/members/observatory-quest.js; the assistant warns first)
// 199: the black hole ladder (miniquests/black-hole.js); 635: the Grand Tree watch tower (agility 25,
// quests/members/grand-tree/roots.js); 295: the Port Sarim jeweller's ladder (quests/members/merlins-crystal/excalibur.js)
const EXCLUDE_IDS = new Set([130, 198, 199, 223, 227, 244, 295, 331, 359, 369, 370, 458, 635, 928, 981, 985, 732, 750, 751, 752, 753, 816, 817, 836, 838, 862, 863, 864, 865, 866, 872, 920]);
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
