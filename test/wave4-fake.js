// A fake player (and world) for the Wave 4 mechanics tests (wave4-*.test.js): an inventory of ids, every skill, the
// messages said and sent, experience, and scripted menu answers. Not a test file itself (no .test.js).

const items = require('@2003scape/rsc-data/config/items.json');

const SKILLS = [
    'attack', 'defense', 'strength', 'hits', 'ranged', 'prayer', 'magic', 'cooking', 'woodcutting', 'fletching',
    'fishing', 'firemaking', 'crafting', 'smithing', 'mining', 'herblaw', 'agility', 'thieving'
];

function fakePlayer({ level = 1, levels = {}, inventory = [], quests = {}, answers = [], cache = {} } = {}) {
    const bag = [];
    const player = {
        world: {
            members: true,
            async sleepTicks() {},
            drops: [],
            addPlayerDrop(p, id, x, y) {
                this.drops.push({ id, x, y });
            },
            replaced: [],
            replaceTimed(type, entity, id, ticks) {
                this.replaced.push({ type, id, ticks });
            }
        },
        x: 100,
        y: 100,
        questStages: { druidicRitual: -1, ...quests },
        cache: { ...cache },
        skills: Object.fromEntries(SKILLS.map((name) => [name, { current: levels[name] || level, base: levels[name] || level }])),
        messages: [],
        said: [],
        sent: [],
        bubbles: [],
        xp: [],
        damaged: [],
        answers: answers.slice(),
        asked: [],
        message(...m) {
            player.messages.push(...m.map((s) => String(s).replace('@que@', '')));
        },
        async say(...lines) {
            player.said.push(...lines);
        },
        async ask(options, repeat) {
            player.asked.push(options);
            const choice = player.answers.length ? player.answers.shift() : -1;
            if (repeat && options[choice]) player.said.push(options[choice]);
            return choice;
        },
        engage() {},
        disengage() {},
        send(packet) {
            player.sent.push(packet);
        },
        sendSound() {},
        sendStats() {},
        sendBubble(id) {
            player.bubbles.push(id);
        },
        isTired: () => false,
        addExperience(skill, experience) {
            player.xp.push({ skill, experience });
        },
        changeStat(skill, delta, { cap } = {}) {
            const stat = player.skills[skill];
            let next = stat.current + delta;
            if (delta > 0 && typeof cap === 'number') next = Math.min(next, Math.max(cap, stat.current));
            stat.current = Math.max(0, next);
            return stat.current;
        },
        damage(amount) {
            player.damaged.push(amount);
            player.skills.hits.current = Math.max(0, player.skills.hits.current - amount);
        },
        bag,
        inventory: {
            items: bag,
            has(id, amount = 1) {
                return player.inventory.count(id) >= amount;
            },
            count(id) {
                return bag.filter((e) => e.id === id).reduce((n, e) => n + e.amount, 0);
            },
            add(id, amount = 1) {
                const def = items[id];
                if (def && def.stackable) {
                    const entry = bag.find((e) => e.id === id);
                    if (entry) entry.amount += amount;
                    else bag.push({ id, amount });
                } else {
                    for (let i = 0; i < amount; i += 1) bag.push({ id, amount: 1 });
                }
            },
            remove(id, amount = 1) {
                for (let left = amount; left > 0; ) {
                    const i = bag.map((e) => e.id).lastIndexOf(id);
                    if (i < 0) return;
                    const entry = bag[i];
                    const take = Math.min(entry.amount, left);
                    entry.amount -= take;
                    left -= take;
                    if (!entry.amount) bag.splice(i, 1);
                }
            }
        }
    };

    for (const entry of inventory) {
        if (Array.isArray(entry)) player.inventory.add(entry[0], entry[1]);
        else player.inventory.add(entry);
    }

    return player;
}

// the ids in the bag, one per unstackable item, [id, amount] for stacks
const ids = (player) => player.bag.map((e) => (items[e.id].stackable ? [e.id, e.amount] : e.id));
const item = (id) => ({ id, definition: items[id] });
const npc = (id) => ({ id, x: 50, y: 60, async say(...lines) { (this.said = this.said || []).push(...lines); } });

// run fn with Math.random returning the values given, in order (then the last one again)
async function withRandom(values, fn) {
    const real = Math.random;
    let i = 0;
    Math.random = () => values[Math.min(i++, values.length - 1)];
    try {
        return await fn();
    } finally {
        Math.random = real;
    }
}

module.exports = { fakePlayer, ids, item, npc, withRandom };
