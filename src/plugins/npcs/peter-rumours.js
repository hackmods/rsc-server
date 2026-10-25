// Folk tale: talk to a barman, a tramp or a gypsy and now and then they mention Peter Panelist. Never claims the talk,
// the NPC's own dialogue still runs. Sightings are of the last places he hid, so the news is always a little stale.

const peter = require('../../peter-panelist');

const RUMOUR_CHANCE = 0.12;
const RUMOUR_DELAY_TICKS = 4;

const TELLERS = new Set([
    'bartender',
    'barmaid',
    'tramp',
    'hans',
    'gypsy',
    'jonny the beard',
    'kebab seller',
    'tea seller',
    'beggar',
    'fisherman'
]);

const TALES = [
    'You overhear: "They say a little man hides in the far corners of the world, handing out party hats"',
    'You overhear: "My cousin found Peter Panelist once. Made him rich. Or was it a cracker?"',
    'You overhear: "He never stays put. A minute, two at most, then pop, gone"',
    'You overhear: "Peter Panelist? Never trust a man who moves that fast and gives away gold"',
    'You overhear: "The old adventurers swear by the Panelist. Nobody has ever seen him sit down"',
    'You overhear: "If you hear someone shouting Order, order! in the middle of nowhere, run towards it"',
    'You overhear: "Party hats come from crackers, crackers come from Peter. That is how it works"',
    'You overhear: "A hundred thousand coins in one go, they say. I only ever got eleven"',
    'You overhear: "He whispers Psst to the lost. Only the lost ever find him"',
    'You overhear: "The Panelist adores an audience, but not a crowd"',
    'You overhear: "My grandmother said he hides where the maps run out"',
    'You overhear: "Pull his cracker with a friend. Friendship is the only prize that stays"'
];

function rumour(random = Math.random) {
    const recent = peter.recentSpots();

    // stale news: where he was a hop or two ago
    if (recent.length > 1 && random() < 0.35) {
        const spot = recent[1 + Math.floor(random() * (recent.length - 1))];

        return `You overhear: "Someone swears they saw Peter Panelist at ${spot.name}. Hours ago, mind"`;
    }

    return TALES[Math.floor(random() * TALES.length)];
}

async function onTalkToNPC(player, npc) {
    const name = npc && npc.definition && npc.definition.name;

    if (name && TELLERS.has(name.toLowerCase()) && Math.random() < RUMOUR_CHANCE) {
        // a moment later, as if overheard while the talk starts (also keeps this hook from acting and returning false)
        const line = rumour();

        player.world.setTickTimeout(() => player.message(line), RUMOUR_DELAY_TICKS);
    }

    return false;
}

module.exports = { onTalkToNPC, rumour, TALES, TELLERS };
