// Tutorial Island's training objects: the shrimp spot, the tin rock and the
// range. Messages and stage changes follow OpenRSC's Fishing, Mining and
// ObjectCooking tutorial branches.

const t = require('./core');

const FISH_SPOT_ID = 493;
const ROCK_ID = 496;
const RANGE_ID = 491;

// experience is in rsc-server units (4x the displayed value)
const SHRIMP_EXPERIENCE = 40;
const TIN_EXPERIENCE = 70;
const MEAT_EXPERIENCE = 120;

async function fish(player) {
    const { world } = player;

    if (player.skills.fishing.experience >= 200 * 4) {
        player.message('@que@that\'s enough fishing for now');
        await world.sleepTicks(2);
        player.message('@que@go through the next door to continue the tutorial');
        return;
    }

    if (!player.inventory.has(t.ITEM.NET)) {
        player.message('@que@You need a net to catch these fish');
        return;
    }

    player.sendSound('fish');
    player.sendBubble(t.ITEM.NET);
    player.message('@que@You attempt to catch some fish');
    await world.sleepTicks(3);

    // the first catch always comes on the second try at the latest
    const caught =
        Math.random() < 0.5 || player.cache.tutorialFishMiss >= 1;

    if (!caught) {
        player.cache.tutorialFishMiss = (player.cache.tutorialFishMiss || 0) + 1;

        player.message(
            t.stage(player) === 41
                ? "@que@keep trying, you'll catch something soon"
                : '@que@You fail to catch anything'
        );
        return;
    }

    delete player.cache.tutorialFishMiss;
    player.inventory.add(t.ITEM.RAW_SHRIMP);
    player.addExperience('fishing', SHRIMP_EXPERIENCE);
    player.message('@que@You catch some shrimps');

    if (t.stage(player) === 41) {
        t.setStage(player, 42);
    }
}

async function prospect(player) {
    const { world } = player;

    player.message('@que@You examine the rock for ores...');
    await world.sleepTicks(3);
    player.message('@que@This rock contains tin');
    await world.sleepTicks(2);
    player.message(
        "@que@Sometimes you won't find the ore but trying again may find it"
    );
    await world.sleepTicks(2);
    player.message('@que@If a rock contains a high level ore');
    await world.sleepTicks(2);
    player.message('@que@You will not find it until you increase your mining level');

    if (t.stage(player) === 49) {
        t.setStage(player, 50);
    }
}

async function mine(player) {
    const { world } = player;

    if (!player.inventory.has(t.ITEM.BRONZE_PICKAXE)) {
        player.message('@que@You need a pickaxe to mine this rock');
        return;
    }

    if (t.onTutorial(player) && t.stage(player) < 51) {
        player.message('@que@You should speak to the mining instructor first');
        return;
    }

    player.sendSound('mine');
    player.sendBubble(t.ITEM.BRONZE_PICKAXE);
    player.message('@que@You swing your pick at the rock...');
    await world.sleepTicks(3);

    player.inventory.add(t.ITEM.TIN_ORE);
    player.addExperience('mining', TIN_EXPERIENCE);
    player.message('@que@You manage to obtain some tin ore');

    if (t.stage(player) === 51) {
        t.setStage(player, 52);
    }
}

async function onGameObjectCommandOne(player, gameObject) {
    if (gameObject.id === FISH_SPOT_ID) {
        await fish(player);
        return true;
    }

    if (gameObject.id === ROCK_ID) {
        await mine(player);
        return true;
    }

    return false;
}

async function onGameObjectCommandTwo(player, gameObject) {
    if (gameObject.id === ROCK_ID) {
        await prospect(player);
        return true;
    }

    return false;
}

async function onUseWithGameObject(player, gameObject, item) {
    if (gameObject.id !== RANGE_ID || item.id !== t.ITEM.RAW_RAT_MEAT) {
        return false;
    }

    const { world } = player;
    const stage = t.stage(player);

    player.sendBubble(item.id);
    player.sendSound('cooking');
    player.message('@que@You cook the meat on the stove...');
    await world.sleepTicks(3);

    player.inventory.remove(t.ITEM.RAW_RAT_MEAT);

    if (stage === 30) {
        player.inventory.add(t.ITEM.COOKED_MEAT);
        player.addExperience('cooking', MEAT_EXPERIENCE);
        player.message('@que@The meat is now nicely cooked');
        await world.sleepTicks(2);
        player.message('@que@Now speak to the cooking instructor again');
        t.setStage(player, 31);
        return true;
    }

    player.inventory.add(t.ITEM.BURNT_MEAT);
    player.message('@que@You accidentally burn the meat');

    if (stage === 25) {
        await world.sleepTicks(2);
        player.message('@que@sometimes you will burn food');
        await world.sleepTicks(2);
        player.message('@que@As your cooking level increases this will happen less');
        await world.sleepTicks(2);
        player.message('@que@Now speak to the cooking instructor again');
        t.setStage(player, 30);
    }

    return true;
}

module.exports = {
    onGameObjectCommandOne,
    onGameObjectCommandTwo,
    onUseWithGameObject
};
