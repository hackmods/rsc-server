'use strict';

/**
 * ARSC authentic RSC holiday drops (2001-2003): calendar windows, one-per-player
 * uniques on pickup, and helpers shared by world-admin + Thessalia reclaim.
 * @see https://classic.runescape.wiki/w/Holiday_drops
 */

const TIMEZONE = 'Europe/London';

/** Bunny ears / Scythe — Classic one-per-player untradeables. */
const HOLIDAY_UNIQUES = {
    1156: "You don't need another pair of Bunny ears, you only have one head",
    1289: "You already have a scythe you don't need another one"
};

const FREE_BOUNDS = { minX: 48, maxX: 450, minY: 128, maxY: 766 };

/** Default pad on either side of start/end (timezone / late-login cushion). Override with windowPadHours (0 disables). */
const DEFAULT_WINDOW_PAD_HOURS = 12;

/** Anonymous Gregorian algorithm → { month: 3|4, day }. */
function westernEasterSunday(year) {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return { month, day };
}

function partsInLondon(date) {
    const fmt = new Intl.DateTimeFormat('en-GB', {
        timeZone: TIMEZONE,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hourCycle: 'h23'
    });
    const out = { year: 0, month: 0, day: 0, hour: 0, minute: 0 };
    for (const p of fmt.formatToParts(date)) {
        if (p.type !== 'literal' && out[p.type] !== undefined) {
            out[p.type] = Number(p.value);
        }
    }
    if (out.hour === 24) out.hour = 0;
    return out;
}

function addDays(monthDay, year, offset) {
    const utc = Date.UTC(year, monthDay.month - 1, monthDay.day + offset);
    const d = new Date(utc);
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function resolveAnchor(spec, year) {
    if (spec == null) return null;
    if (typeof spec.easterOffsetDays === 'number') {
        const easter = westernEasterSunday(year);
        const shifted = addDays(easter, year, spec.easterOffsetDays);
        return {
            year: shifted.year,
            month: shifted.month,
            day: shifted.day,
            hour: spec.hour === undefined ? 0 : spec.hour,
            minute: spec.minute === undefined ? 0 : spec.minute
        };
    }
    if (spec.month == null || spec.day == null) return null;
    return {
        year,
        month: spec.month,
        day: spec.day,
        hour: spec.hour === undefined ? 0 : spec.hour,
        minute: spec.minute === undefined ? 0 : spec.minute
    };
}

function stamp(p) {
    return ((p.year * 100 + p.month) * 100 + p.day) * 10000 + p.hour * 100 + p.minute;
}

/** Shift wall-clock parts by whole hours (calendar arithmetic in UTC fields). */
function shiftParts(p, hours) {
    const utc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute + hours * 60);
    const d = new Date(utc);
    return {
        year: d.getUTCFullYear(),
        month: d.getUTCMonth() + 1,
        day: d.getUTCDate(),
        hour: d.getUTCHours(),
        minute: d.getUTCMinutes()
    };
}

function windowPadHours(ev) {
    if (ev && Number.isFinite(ev.windowPadHours)) {
        return Math.max(0, Math.min(168, Number(ev.windowPadHours)));
    }
    return DEFAULT_WINDOW_PAD_HOURS;
}

/**
 * True when now falls inside the event window (Europe/London).
 * No start/end and no easterOffsetDays → always in window (legacy events).
 */
function eventInWindow(ev, now = new Date()) {
    if (!ev) return false;
    const hasEaster = typeof ev.easterOffsetDays === 'number';
    const hasBounds = ev.start != null || ev.end != null;
    if (!hasEaster && !hasBounds) return true;

    const local = partsInLondon(now);
    const years = [local.year - 1, local.year, local.year + 1];
    const nowStamp = stamp(local);

    for (const year of years) {
        const startSpec = ev.start
            ? Object.assign({}, ev.start, {
                  easterOffsetDays: hasEaster ? ev.easterOffsetDays : ev.start.easterOffsetDays
              })
            : hasEaster
              ? { easterOffsetDays: ev.easterOffsetDays, hour: 0, minute: 0 }
              : null;
        const endSpec = ev.end
            ? Object.assign({}, ev.end, {
                  easterOffsetDays: hasEaster ? ev.easterOffsetDays : ev.end.easterOffsetDays
              })
            : hasEaster
              ? { easterOffsetDays: ev.easterOffsetDays, hour: 23, minute: 59 }
              : null;

        if (!startSpec && !endSpec) continue;

        const start = resolveAnchor(
            startSpec || { month: 1, day: 1, hour: 0, minute: 0 },
            year
        );
        let end = resolveAnchor(
            endSpec || { month: 12, day: 31, hour: 23, minute: 59 },
            year
        );
        if (!start || !end) continue;

        const pad = windowPadHours(ev);
        const paddedStart = pad ? shiftParts(start, -pad) : start;
        const paddedEnd = pad ? shiftParts(end, pad) : end;

        if (nowStamp >= stamp(paddedStart) && nowStamp <= stamp(paddedEnd)) {
            return true;
        }
    }
    return false;
}

function ownsItem(player, id) {
    if (!player) return false;
    if (player.inventory && player.inventory.has && player.inventory.has(id)) return true;
    if (player.bank && player.bank.has && player.bank.has(id)) return true;
    return false;
}

function uniqueMessage(id) {
    return HOLIDAY_UNIQUES[id] || null;
}

/** Plugin: refuse a second bunny ears / scythe. */
async function onGroundItemTake(player, groundItem) {
    const msg = uniqueMessage(groundItem && groundItem.id);
    if (!msg) return false;
    if (!ownsItem(player, groundItem.id)) {
        if (!player.cache.holidayUniques) player.cache.holidayUniques = {};
        player.cache.holidayUniques[groundItem.id] = Date.now();
        return false;
    }
    player.message(msg);
    return true;
}

function listActiveEvents(events, now = new Date()) {
    return (events || [])
        .filter((e) => e && e.enabled !== false && eventInWindow(e, now))
        .map((e) => ({
            id: e.id,
            type: e.type,
            message: e.message,
            items: e.items,
            region: e.region,
            onePerPlayer: !!e.onePerPlayer
        }));
}

function rollWeighted(entries, random = Math.random) {
    const list = entries || [];
    if (!list.length) return null;
    let total = 0;
    for (const e of list) total += e.weight == null ? 1 : e.weight;
    let r = random() * total;
    for (const e of list) {
        r -= e.weight == null ? 1 : e.weight;
        if (r <= 0) return e;
    }
    return list[list.length - 1];
}

function randInt(min, max, random = Math.random) {
    return min + Math.floor(random() * (max - min + 1));
}

function pickScatterTile(world, region, random = Math.random) {
    if (!region) return null;
    for (let i = 0; i < 24; i += 1) {
        let x;
        let y;
        if (region.radius != null) {
            const r = region.radius;
            x = region.x + randInt(-r, r, random);
            y = region.y + randInt(-r, r, random);
        } else {
            x = randInt(region.minX, region.maxX, random);
            y = randInt(region.minY, region.maxY, random);
        }
        if (
            world &&
            !world.members &&
            (x < FREE_BOUNDS.minX ||
                x > FREE_BOUNDS.maxX ||
                y % 944 < FREE_BOUNDS.minY ||
                y % 944 > FREE_BOUNDS.maxY)
        ) {
            continue;
        }
        return { x, y };
    }
    return null;
}

module.exports = {
    TIMEZONE,
    DEFAULT_WINDOW_PAD_HOURS,
    HOLIDAY_UNIQUES,
    westernEasterSunday,
    partsInLondon,
    shiftParts,
    windowPadHours,
    eventInWindow,
    ownsItem,
    uniqueMessage,
    onGroundItemTake,
    listActiveEvents,
    rollWeighted,
    pickScatterTile
};
