// ARSC: the Clan Herald, beside the Wilderness outfitter on the Edgeville street (spawn in arsc-locations.js). He
// founds clans, shows the standings and referees clan battles (src/clans.js). 601 is the "Referee" definition: its
// only other spawn is the gnome ball field and no other plugin uses it, so the talk is gated to Edgeville.
// Everything he does is also a command (::clan ...), so bots and players can do it from anywhere but founding.

const clans = require('../../../clans');

const HERALD_IDS = new Set([clans.HERALD_ID]);

const EDGEVILLE = { minX: 200, maxX: 230, minY: 430, maxY: 460 };

function inEdgeville({ x, y }) {
    return x >= EDGEVILLE.minX && x <= EDGEVILLE.maxX && y >= EDGEVILLE.minY && y <= EDGEVILLE.maxY;
}

async function explain(player, npc) {
    await npc.say(
        `A clan is founded here for ${clans.FOUND_COST} coins: ::clan found TAG Name`,
        `Up to ${clans.MAX_MEMBERS} members. The leader and generals invite with ::clan invite`,
        'Talk to your clan with ::c and your words, wherever you are'
    );
    await npc.say(
        'A leader or general may challenge a rival clan to battle at a front',
        `Once accepted, the battle starts ${Math.round(clans.LEAD_MS / 60000)} minutes later and lasts ${Math.round(
            clans.BATTLE_MS / 60000
        )}`,
        'Every kill of a rival counts. Most kills wins, and I announce it to the world'
    );
}

async function showStandings(player, npc) {
    const table = clans.standings().slice(0, 5);

    if (!table.length) {
        await npc.say('No clan has been founded yet. Be the first!');
        return;
    }

    await npc.say('These are the standings, by battles won');

    table.forEach((clan, i) =>
        player.message(
            `${i + 1}. ${clan.name} [${clan.tag}]: ${clan.battlesWon} won, ${clan.battlesLost} lost, ` +
                `${clan.kills} kills, ${clan.deaths} deaths`
        )
    );

    for (const battle of clans.openBattles()) {
        player.message(clans.describeLine(battle));
    }
}

async function pickRival(player, npc, own) {
    const rivals = clans
        .standings()
        .filter((clan) => clan.tag !== own.tag)
        .slice(0, 4);

    if (!rivals.length) {
        await npc.say('There is no other clan to challenge yet');
        return null;
    }

    await npc.say('Which clan do you challenge?');
    const choice = await player.ask(rivals.map((clan) => `${clan.name} [${clan.tag}]`), false);
    return rivals[choice] || null;
}

async function pickFront(player, npc) {
    const keys = Object.keys(clans.FRONTS);
    // the five-option menu: the commonest fronts; every front works with ::clan challenge TAG front
    const shown = keys.slice(0, 5);
    await npc.say('Where shall it be fought?');
    const choice = await player.ask(shown.map((key) => clans.FRONTS[key].place), false);
    return shown[choice] || null;
}

async function report(player, npc, error, success) {
    if (error) {
        await npc.say(error);
    } else if (success) {
        await npc.say(success);
    }
}

async function onTalkToNPC(player, npc) {
    if (!HERALD_IDS.has(npc.id) || !inEdgeville(npc)) {
        return false;
    }

    player.engage(npc);

    const mine = clans.memberOf(player.username);
    const pending = mine && clans.challengeFor(mine.clan.tag);
    const leads = mine && mine.member.rank !== 'member';

    await npc.say('Hear ye! I am the Clan Herald', 'I keep the clan rolls and referee clan battles');

    const options = [];

    if (!mine) {
        options.push(['How do clans work?', explain]);
    } else {
        options.push([`How is ${mine.clan.name} doing?`, async () => clans.command(player, 'clan', ['info'])]);
    }

    options.push(['Show me the clan standings', showStandings]);

    if (leads && pending) {
        options.push([
            'We accept the challenge!',
            async () => report(player, npc, clans.accept(player), 'So be it. I shall tell the world')
        ]);
    } else if (leads && !clans.openBattleOf(mine.clan.tag)) {
        options.push([
            'I want to challenge a clan',
            async () => {
                const rival = await pickRival(player, npc, mine.clan);

                if (!rival) {
                    return;
                }

                const front = await pickFront(player, npc);

                if (!front) {
                    return;
                }

                await report(player, npc, await clans.challenge(player, rival.tag, front), 'Your challenge is sent');
            }
        ]);
    }

    options.push(['Nothing, thanks', async () => npc.say('Fight with honour')]);

    const choice = await player.ask(
        options.map(([text]) => text),
        true
    );

    const picked = options[choice];

    if (picked) {
        await picked[1](player, npc);
    }

    player.disengage();
    return true;
}

module.exports = { onTalkToNPC };
