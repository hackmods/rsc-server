// An NPC shooting a player, ported from Open-RSC
// server/src/com/openrsc/server/event/rsc/impl/projectile/RangeEventNpc.java.
// No authentic NPC ranges (Open-RSC starts this event only from the admin
// commands ::npcrangeevent2 and ::shootme), but it is the path Protect from
// Missiles guards against: a victim praying it is not shot ("<npc> is trying
// to shoot you!") and the event stops (RangeEventNpc.java:80-87).
//
// The shot is a longbow with bronze arrows (RangeEventNpc.java:88) rolled with
// the NPC's ranged level of 1 (combat.rollNPCRangedDamage); 6 in 7 arrows land
// under the victim (Formulae.loseArrow).

const { protectedFromMissiles, rollNPCRangedDamage } = require('./combat');

const BRONZE_ARROWS_ID = 11;

// RangeEventNpc: setDelayTicks(3)
const SHOT_TICKS = 3;

// isUnreachable: the victim must stay within 5 tiles (Entity.withinRange)
const SHOT_RADIUS = 5;

// the victim must stay inside the NPC's wander box grown by 9 tiles
const BOX_PAD = 9;

// how long the dropped arrows stay (a player drop's lifetime)
const ARROW_TICKS = 200;

function npcName(npc) {
    return (npc.definition && npc.definition.name) || 'npc';
}

function stop(npc) {
    if (typeof npc.rangedTimeout === 'number') {
        npc.world.clearTickTimeout(npc.rangedTimeout);
    }

    delete npc.rangedTimeout;
    delete npc.rangedVictim;
}

function victimGone(npc, victim) {
    return (
        !victim.loggedIn ||
        victim.skills.hits.current <= 0 ||
        npc.skills.hits.current <= 0 ||
        npc.world.npcs.getByIndex(npc.index) !== npc
    );
}

function outOfBox(npc, victim) {
    return (
        victim.x < npc.minX - BOX_PAD ||
        victim.x > npc.maxX + BOX_PAD ||
        victim.y < npc.minY - BOX_PAD ||
        victim.y > npc.maxY + BOX_PAD
    );
}

// one RangeEventNpc.run(); returns true when the event goes on
function shoot(npc, victim) {
    if (victimGone(npc, victim) || npc.opponent || outOfBox(npc, victim)) {
        return false;
    }

    if (
        Math.abs(npc.x - victim.x) > SHOT_RADIUS ||
        Math.abs(npc.y - victim.y) > SHOT_RADIUS
    ) {
        victim.message('You got away');
        return false;
    }

    if (!npc.withinLineOfSight(victim, true)) {
        return false;
    }

    npc.faceEntity(victim);

    if (protectedFromMissiles(victim)) {
        victim.message(`${npcName(npc)} is trying to shoot you!`);
        return false;
    }

    const damage = rollNPCRangedDamage(npc, victim);

    if (Math.floor(Math.random() * 7) !== 0) {
        npc.world.addTimedGroundItem({
            id: BRONZE_ARROWS_ID,
            x: victim.x,
            y: victim.y,
            ticks: ARROW_TICKS
        });
    }

    victim.message(`${npcName(npc)} is shooting at you!`);
    victim.damage(damage, npc, 'ranged');

    return true;
}

// start (or retarget) the event; the first shot comes on the next tick
function startNpcRanged(npc, victim) {
    stop(npc);
    npc.rangedVictim = victim;

    const run = (ticks) => {
        npc.rangedTimeout = npc.world.setTickTimeout(() => {
            delete npc.rangedTimeout;

            if (npc.rangedVictim !== victim) {
                return;
            }

            if (shoot(npc, victim)) {
                run(SHOT_TICKS);
            } else {
                stop(npc);
            }
        }, ticks);
    };

    run(1);
}

module.exports = { startNpcRanged, stopNpcRanged: stop, shoot };
