// ARSC Grand Exchange: who is playing, for the house's floor
// (docs/PLAN_GE_SCALING.md in Autonomous-RSC). Every 5 minutes the players
// online are sampled; a player is active when they moved or used the Exchange
// in the last 15 minutes. Fleet bots (ARSC_FLEET_ACCOUNTS, else the sleep
// policy ARSC_SLEEP_PREFIX, which already names every fleet account) count
// ARSC_EXCHANGE_BOT_WEIGHT each (0.05: a 60-bot fleet is 3 people), humans 1.
// The house reads the average of the last hour, so one player logging in and
// out does not swing the book.

const SAMPLE_MS = 5 * 60 * 1000;
const ACTIVE_MS = 15 * 60 * 1000;
const WINDOW = 12; // samples: one hour
const FORGET_MS = 60 * 60 * 1000;

const env = (name, fallback) =>
    process.env[name] === undefined ? fallback : process.env[name];

function botWeight() {
    const w = Number(env('ARSC_EXCHANGE_BOT_WEIGHT', 0.05));
    return Number.isFinite(w) && w >= 0 ? w : 0.05;
}

function fleetPolicy() {
    return String(
        env('ARSC_FLEET_ACCOUNTS', '') || env('ARSC_SLEEP_PREFIX', '') || 'prefix:bot'
    ).trim();
}

// is this username a fleet bot? Policy syntax as world-admin.js policyAllows
// (prefix:a,b;list:x,y; '*' everyone; a bare prefix), without its
// administrator pass: an admin playing is a person
function isFleetAccount(username, policy = fleetPolicy()) {
    const name = String(username || '').toLowerCase();

    if (!name) {
        return false;
    }

    if (policy === '*') {
        return true;
    }

    if (!/[:;]/.test(policy)) {
        return !!policy && name.startsWith(policy.toLowerCase());
    }

    return policy
        .split(';')
        .map((c) => c.trim())
        .filter(Boolean)
        .some((clause) => {
            const words = (s) =>
                s
                    .split(',')
                    .map((w) => w.trim().toLowerCase())
                    .filter(Boolean);

            if (clause.startsWith('prefix:')) {
                return words(clause.slice(7)).some((p) => name.startsWith(p));
            }

            if (clause.startsWith('list:')) {
                return words(clause.slice(5)).includes(name);
            }

            return false;
        });
}

class Activity {
    constructor({ now = Date.now } = {}) {
        this.now = now;
        // username -> { x, y, activeAt, seenAt }
        this.seen = new Map();
        // [{ at, humans, bots }]
        this.samples = [];
    }

    // players: [{ username, x, y, exchangeLast? }] (Player objects work)
    sample(players, at = this.now()) {
        let humans = 0;
        let bots = 0;
        const policy = fleetPolicy();

        for (const p of players) {
            const key = String(p.username || '').toLowerCase();

            if (!key) {
                continue;
            }

            const prev = this.seen.get(key);
            const moved = !prev || prev.x !== p.x || prev.y !== p.y;
            let activeAt = moved ? at : prev.activeAt;

            if (p.exchangeLast && p.exchangeLast > activeAt) {
                activeAt = p.exchangeLast;
            }

            this.seen.set(key, { x: p.x, y: p.y, activeAt, seenAt: at });

            if (at - activeAt <= ACTIVE_MS) {
                if (isFleetAccount(key, policy)) {
                    bots += 1;
                } else {
                    humans += 1;
                }
            }
        }

        for (const [key, s] of this.seen) {
            if (at - s.seenAt > FORGET_MS) {
                this.seen.delete(key);
            }
        }

        this.samples.push({ at, humans, bots });

        if (this.samples.length > WINDOW) {
            this.samples.splice(0, this.samples.length - WINDOW);
        }

        return { humans, bots };
    }

    // the hour's average of humans + weight * bots (0 before the first sample)
    effective(weight = botWeight()) {
        if (!this.samples.length) {
            return 0;
        }

        const sum = this.samples.reduce((n, s) => n + s.humans + weight * s.bots, 0);
        return Math.round((sum / this.samples.length) * 100) / 100;
    }

    view() {
        const last = this.samples[this.samples.length - 1] || null;

        return {
            effective: this.effective(),
            botWeight: botWeight(),
            humans: last ? last.humans : 0,
            bots: last ? last.bots : 0,
            samples: this.samples.length,
            sampledAt: last ? last.at : null
        };
    }
}

function playersOf(world) {
    try {
        return world.players.getAll().map((p) => ({
            username: p.username,
            x: p.x,
            y: p.y,
            exchangeLast: p.exchangeLast || 0
        }));
    } catch (e) {
        return [];
    }
}

function start(world) {
    const activity = new Activity();
    world.exchangeActivity = activity;
    activity.sample(playersOf(world));

    const every = setInterval(() => activity.sample(playersOf(world)), SAMPLE_MS);
    every.unref();

    return activity;
}

module.exports = {
    ACTIVE_MS,
    Activity,
    SAMPLE_MS,
    WINDOW,
    botWeight,
    fleetPolicy,
    isFleetAccount,
    start
};
