// Ported from Open-RSC Core-Framework authentic/defaults/DoorAction.java (AGPL-3.0), handleGates: every GATE_MEMBERS_*
// case, GNOME_STRONGHOLD_GATE and GATE_VARROCK_BIOHAZARD_CLOSED
const GATE_IDS = new Set([
    // red dragons (140, 180)
    93,

    // taverly
    137,

    // falador
    138,

    // brimhaven
    254,

    // edgeville dungeon
    305,

    // wilderness: frozen waste plateau (331, 142), NW of the greater demons (111, 142), Lava Maze dungeon ladder (243, 178),
    // King Black Dragon ladder (285, 185)
    346,
    347,
    319,
    508,

    // digsite
    1089,

    // tree gnome stronghold (Open-RSC DoorAction.java GNOME_STRONGHOLD_GATE)
    626
]);

const GNOME_STRONGHOLD_GATE_ID = 626;
const GNOME_GUARD_ID = 562;

// GATE_VARROCK_BIOHAZARD_CLOSED / _OPEN: the east Varrock gate at (93, 521)
const VARROCK_GATE_ID = 513;
const VARROCK_GATE_OPEN_ID = 514;
const VARROCK_GATE_X = 93;
const VARROCK_GATE_Y = 521;
const VARROCK_GUARD_ID = 503;
const ETHENEA_ID = 810;
const SULPHURIC_BROLINE_ID = 811;
const LIQUID_HONEY_ID = 809;

const NOT_A_MEMBER = 'You need to be a member to use this gate';

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

// during Biohazard (stages 6 and 7) the guard searches anyone coming in from the east side
async function varrockGate(player, gameObject) {
    if (
        gameObject.x !== VARROCK_GATE_X ||
        gameObject.y !== VARROCK_GATE_Y
    ) {
        return true;
    }

    if (!player.world.members) {
        player.message(NOT_A_MEMBER);
        return true;
    }

    const stage = player.questStages.biohazard;

    if (player.x >= VARROCK_GATE_X + 1 && stage >= 6 && stage < 8) {
        const guard = player
            .getNearbyEntitiesByID('npcs', VARROCK_GUARD_ID, 10)
            .find((npc) => !npc.locked);

        if (guard) {
            await guard.say(
                'Halt. I need to conduct a search on you',
                'There have been reports of a someone bringing a virus into Varrock'
            );
        }

        const confiscated = [
            [ETHENEA_ID, 'He takes the vial of ethenea from you'],
            [SULPHURIC_BROLINE_ID, 'He takes the vial of sulphuric broline from you'],
            [LIQUID_HONEY_ID, 'He takes the vial of liquid honey from you']
        ];

        for (const [id, message] of confiscated) {
            if (player.inventory.has(id)) {
                player.inventory.remove(id);
                player.message(message);
            }
        }
    }

    player.message('you open the gate and pass through');
    await player.enterGate(gameObject, VARROCK_GATE_OPEN_ID);

    return true;
}

async function onGameObjectCommandOne(player, gameObject) {
    if (gameObject.id === VARROCK_GATE_ID) {
        return varrockGate(player, gameObject);
    }

    if (!GATE_IDS.has(gameObject.id)) {
        return false;
    }

    const { world } = player;

    if (!world.members) {
        player.message(NOT_A_MEMBER);
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
