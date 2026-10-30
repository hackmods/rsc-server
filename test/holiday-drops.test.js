'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const holiday = require('../src/holiday-drops');
const worldAdmin = require('../src/world-admin');

test('western Easter Sundays match known years', () => {
    assert.deepEqual(holiday.westernEasterSunday(2002), { month: 3, day: 31 });
    assert.deepEqual(holiday.westernEasterSunday(2003), { month: 4, day: 20 });
    assert.deepEqual(holiday.westernEasterSunday(2026), { month: 4, day: 5 });
});

test('eventInWindow: fixed Halloween day in London', () => {
    const ev = {
        start: { month: 10, day: 31, hour: 0, minute: 0 },
        end: { month: 10, day: 31, hour: 23, minute: 59 }
    };
    assert.equal(
        holiday.eventInWindow(ev, new Date('2026-10-31T12:00:00+00:00')),
        true
    );
    // default ±12h pad: Oct 30 12:00 London is inside; Oct 30 11:00 is not
    assert.equal(
        holiday.eventInWindow(ev, new Date('2026-10-30T12:00:00+00:00')),
        true
    );
    assert.equal(
        holiday.eventInWindow(ev, new Date('2026-10-30T11:00:00+00:00')),
        false
    );
});

test('eventInWindow: windowPadHours 0 keeps exact day', () => {
    const ev = {
        start: { month: 10, day: 31, hour: 0, minute: 0 },
        end: { month: 10, day: 31, hour: 23, minute: 59 },
        windowPadHours: 0
    };
    assert.equal(
        holiday.eventInWindow(ev, new Date('2026-10-30T12:00:00+00:00')),
        false
    );
    assert.equal(
        holiday.eventInWindow(ev, new Date('2026-10-31T12:00:00+00:00')),
        true
    );
});

test('eventInWindow: Easter offset stacks eggs and bunny same day', () => {
    const eggs = { easterOffsetDays: 0 };
    const bunny = { easterOffsetDays: 0 };
    // 2026-04-05 is Easter Sunday
    const noon = new Date('2026-04-05T12:00:00+01:00');
    assert.equal(holiday.eventInWindow(eggs, noon), true);
    assert.equal(holiday.eventInWindow(bunny, noon), true);
    assert.equal(
        holiday.eventInWindow(eggs, new Date('2026-04-06T12:00:00+01:00')),
        false
    );
});

test('eventInWindow: legacy events without windows always active', () => {
    assert.equal(holiday.eventInWindow({ id: 'crier', type: 'broadcast' }), true);
});

test('listActiveEvents stacks Oct 31 eras', () => {
    const events = [
        {
            id: 'halloween-2001',
            type: 'groundScatter',
            enabled: true,
            start: { month: 10, day: 31 },
            end: { month: 10, day: 31, hour: 23, minute: 59 },
            items: [{ id: 422, weight: 1 }]
        },
        {
            id: 'halloween-2002',
            type: 'groundScatter',
            enabled: true,
            start: { month: 10, day: 31 },
            end: { month: 10, day: 31, hour: 23, minute: 59 },
            items: [{ id: 831, weight: 1 }]
        },
        {
            id: 'christmas-2001',
            type: 'groundScatter',
            enabled: true,
            start: { month: 12, day: 24 },
            end: { month: 12, day: 24, hour: 23, minute: 59 },
            items: [{ id: 575, weight: 1 }]
        }
    ];
    const active = holiday.listActiveEvents(
        events,
        new Date('2026-10-31T15:00:00+00:00')
    );
    assert.deepEqual(
        active.map((e) => e.id).sort(),
        ['halloween-2001', 'halloween-2002']
    );
});

test('onGroundItemTake refuses a second scythe', async () => {
    const messages = [];
    const player = {
        cache: {},
        inventory: { has: (id) => id === 1289 },
        bank: { has: () => false },
        message: (m) => messages.push(m)
    };
    const blocked = await holiday.onGroundItemTake(player, { id: 1289 });
    assert.equal(blocked, true);
    assert.match(messages[0], /scythe/i);
});

test('onGroundItemTake allows first bunny ears', async () => {
    const player = {
        cache: {},
        inventory: { has: () => false },
        bank: { has: () => false },
        message: () => {}
    };
    const blocked = await holiday.onGroundItemTake(player, { id: 1156 });
    assert.equal(blocked, false);
    assert.ok(player.cache.holidayUniques[1156]);
});

test('normalize accepts groundScatter with date window', () => {
    const world = { members: true, shops: new Map() };
    worldAdmin._state.builtin = worldAdmin._state.builtin || {};
    const { doc, errors } = worldAdmin.normalize(world, {
        version: 1,
        shops: {},
        vendors: [],
        events: [
            {
                id: 'halloween-2001',
                type: 'groundScatter',
                everyMinutes: 5,
                start: { month: 10, day: 31 },
                end: { month: 10, day: 31, hour: 23, minute: 59 },
                region: { x: 298, y: 544, radius: 12 },
                items: [{ id: 422, weight: 1 }],
                count: 3,
                ticks: 100,
                message: 'Happy Halloween!'
            }
        ],
        starterKit: { enabled: false, grantTo: 'new', items: [], message: '', skipPrefixes: [] }
    });
    assert.deepEqual(errors, []);
    assert.equal(doc.events[0].type, 'groundScatter');
    assert.equal(doc.events[0].items[0].id, 422);
});

test('runEvent groundScatter places timed items', () => {
    const placed = [];
    const world = {
        members: true,
        addTimedGroundItem(spec) {
            placed.push(spec);
            return spec;
        },
        players: { getAll: () => [] },
        shops: new Map()
    };
    worldAdmin._state.world = world;
    worldAdmin.runEvent(
        {
            id: 'test-scatter',
            type: 'groundScatter',
            everyMinutes: 5,
            enabled: true,
            region: { x: 100, y: 500, radius: 2 },
            items: [{ id: 422, weight: 1, amount: 1 }],
            count: 4,
            ticks: 50
        },
        { force: true }
    );
    assert.equal(placed.length, 4);
    assert.equal(placed[0].id, 422);
    assert.equal(placed[0].ticks, 50);
});

test('runEvent skips when outside window unless forced', () => {
    const placed = [];
    worldAdmin._state.world = {
        members: true,
        addTimedGroundItem(spec) {
            placed.push(spec);
        },
        players: { getAll: () => [] }
    };
    const ev = {
        id: 'future',
        type: 'groundScatter',
        start: { month: 1, day: 1 },
        end: { month: 1, day: 1, hour: 1, minute: 0 },
        region: { x: 100, y: 500, radius: 1 },
        items: [{ id: 422, weight: 1 }],
        count: 2,
        ticks: 10
    };
    // mid-year: outside Jan 1
    const real = Date;
    // eventInWindow uses Date.now via new Date() default — call without force on a Jan-only window in October
    worldAdmin.runEvent(ev);
    assert.equal(placed.length, 0);
});
