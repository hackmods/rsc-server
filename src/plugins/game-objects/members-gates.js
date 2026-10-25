const GATE_IDS = new Set([
    // taverly
    137,

    // falador
    138,

    // brimhaven
    254,

    // edgeville dungeon
    305,

    // wilderness
    347,

    // digsite
    1089,

    // tree gnome stronghold (Open-RSC DoorAction.java GNOME_STRONGHOLD_GATE)
    626
]);

const GNOME_STRONGHOLD_GATE_ID = 626;
const GNOME_GUARD_ID = 562;

// Ported from Open-RSC Core-Framework authentic/defaults/DoorAction.java (GNOME_STRONGHOLD_GATE) (AGPL-3.0):
// during The Grand Tree the guards keep the player in (stage 8) or out (stage 10)
async function strongholdRefuses(player, gameObject) {
    const stage = player.questStages.grandTree;
    const { world } = player;

    if (player.y <= gameObject.y && stage === 8) {
        let [guard] = player.getNearbyEntitiesByID('npcs', GNOME_GUARD_ID, 15);
        let spawned = false;

        if (!guard) {
            guard = world.spawnTimedNPC({
                id: GNOME_GUARD_ID,
                x: 705,
                y: 530,
                ticks: 47
            });
            spawned = true;
        }

        await guard.say('halt human');
        await player.say('what?, why?');
        await guard.say(
            'from order of the head tree guardian...',
            '..you cannot leave'
        );
        await player.say("that's crazy, why?");
        await guard.say(
            'humans are planning to attack our stronghold',
            'you could be a spy'
        );
        await player.say("that's ridiculous");
        await guard.say("maybe, but that's the orders, I'm sorry");
        player.message('the gnome refuses to open the gate');
        await world.sleepTicks(3);

        if (spawned) {
            world.removeEntity('npcs', guard);
        }

        return true;
    }

    if (player.y >= gameObject.y + 1 && stage === 10) {
        const [guard] = player.getNearbyEntitiesByID('npcs', GNOME_GUARD_ID, 15);

        if (guard) {
            await guard.say("i'm afraid that we have orders not to let you in");
            await player.say('orders from who?');
            await guard.say("the head tree guardian, he say's you're a spy");
            await player.say('glough!');
            await guard.say("i'm sorry but you'll have to leave");
        }

        return true;
    }

    return false;
}

async function onGameObjectCommandOne(player, gameObject) {
    if (!GATE_IDS.has(gameObject.id)) {
        return false;
    }

    const { world } = player;

    if (!world.members) {
        player.message(gameObject.definition.description);
        return true;
    }

    if (
        gameObject.id === GNOME_STRONGHOLD_GATE_ID &&
        (await strongholdRefuses(player, gameObject))
    ) {
        return true;
    }

    await player.enterGate(gameObject);
    player.message('you go through the gate');

    return true;
}

module.exports = { onGameObjectCommandOne };
