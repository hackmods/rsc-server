// ARSC Wilderness clans (docs/WILDERNESS.md and source/knowledge/rsc-clans.md in
// Autonomous-RSC): formal clans with ranks, a clan chat channel, and clan
// battles refereed by the Clan Herald in Edgeville
// (plugins/npcs/edgeville/clan-herald.js).
//
// The registry lives here, in memory, and every change is written through to
// the data server (clans and clan_battles tables, src/pvp/store.js there).
// Kills are counted by src/pvp-stats.js, which calls onKill.
//
// Commands (any player, whatever the command policy):
//   ::c <text>                    clan chat (also a public chat line starting "@c ")
//   ::clan                        your clan, or this help
//   ::clan found <TAG> <name>     found a clan beside the Herald (5000 coins)
//   ::clan invite <name>          leader or general
//   ::clan join <TAG>             after an invite
//   ::clan leave | kick <name> | promote <name> | demote <name> | leader <name>
//   ::clan motto <text>           leader
//   ::clan challenge <TAG> [front]   leader or general
//   ::clan accept | decline       the challenged clan's leader or general
//   ::clan battles | standings | fronts

const log = require('bole')('clans');
const { request } = require('./pvp-stats');

const COINS_ID = 10;
const FOUND_COST = 5000;
const MAX_MEMBERS = 8;
const CHAT_KEEP = 200;
const CHAT_MAX = 80;
const INVITE_MS = 3 * 60 * 1000;
const CHALLENGE_MS = 15 * 60 * 1000;
const LEAD_MS = 10 * 60 * 1000;
const BATTLE_MS = 20 * 60 * 1000;
const TICK_MS = 5000;

const HERALD_ID = 601; // the "Referee" definition: no other plugin uses it
const HERALD_RANGE = 8;

const RANKS = ['member', 'general', 'leader'];

// the battle fronts (the bots' wild-clans.js FRONTS, same tiles)
const FRONTS = {
    edgeville: { x: 192, y: 408, place: 'the Edgeville side (level 4)' },
    middle: { x: 168, y: 360, place: 'the middle ground (level 12)' },
    varrock: { x: 132, y: 408, place: 'the Varrock side (level 4)' },
    east: { x: 288, y: 408, place: 'the eastern side (level 4)' },
    chaos: { x: 116, y: 366, place: 'the chaos temple (level 11)' },
    eastmiddle: { x: 240, y: 360, place: 'the eastern middle (level 12)' }
};

const COLOURS = ['@red@', '@cya@', '@gre@', '@yel@', '@mag@', '@or1@', '@lre@', '@blu@'];

const state = {
    world: null,
    clans: new Map(), // tag -> clan
    battles: new Map(), // id -> battle (open ones: challenged, scheduled, live)
    recent: [], // finished battles, newest first
    invites: new Map(), // username -> { tag, from, at }
    chat: new Map(), // tag -> [{ at, from, text }]
    timer: null,
    nextLocalId: -1,
    now: () => Date.now()
};

function normName(name) {
    return String(name || '')
        .toLowerCase()
        .replace(/_/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function pretty(username) {
    const name = String(username || '');
    return name ? name[0].toUpperCase() + name.slice(1) : name;
}

function persistClan(clan) {
    if (!state.world) {
        return;
    }

    const { kills, deaths, ...row } = clan;

    request(state.world, { handler: 'clanSave', clan: row }).then((reply) => {
        if (!reply || !reply.success) {
            log.warn('clan not saved', clan.tag, reply && (reply.code || reply.timeout || reply.down));
        }
    });
}

function forgetClan(tag) {
    if (state.world) {
        request(state.world, { handler: 'clanDelete', tag });
    }
}

async function persistBattle(battle) {
    if (!state.world) {
        return battle;
    }

    const { announced, ...row } = battle;
    const reply = await request(state.world, {
        handler: 'clanBattleSave',
        battle: battle.id > 0 ? row : { ...row, id: undefined }
    });

    if (reply && reply.success && reply.id && !(battle.id > 0)) {
        state.battles.delete(battle.id);
        battle.id = reply.id;
        state.battles.set(battle.id, battle);
    }

    return battle;
}

// ---------------------------------------------------------------------------
// lookups
// ---------------------------------------------------------------------------

function memberOf(username) {
    const name = normName(username);

    for (const clan of state.clans.values()) {
        const member = clan.members.find((m) => m.username === name);

        if (member) {
            return { clan, member };
        }
    }

    return null;
}

function tagOf(username) {
    const found = memberOf(username);
    return found ? found.clan.tag : null;
}

function getClan(tag) {
    return state.clans.get(String(tag || '').toUpperCase()) || null;
}

function rankAtLeast(member, rank) {
    return RANKS.indexOf(member.rank) >= RANKS.indexOf(rank);
}

function openBattleOf(tag) {
    for (const battle of state.battles.values()) {
        if (battle.challenger === tag || battle.defender === tag) {
            return battle;
        }
    }

    return null;
}

function onlinePlayer(username) {
    return state.world ? state.world.getPlayerByUsername(normName(username)) : null;
}

function onlineMembers(clan) {
    return clan.members.map((m) => onlinePlayer(m.username)).filter(Boolean);
}

function heraldNear(player) {
    if (!player.world || !player.world.npcs) {
        return false;
    }

    for (const npc of player.world.npcs.getAll ? player.world.npcs.getAll() : []) {
        if (
            npc.id === HERALD_ID &&
            Math.abs(npc.x - player.x) <= HERALD_RANGE &&
            Math.abs(npc.y - player.y) <= HERALD_RANGE
        ) {
            return true;
        }
    }

    return false;
}

// ---------------------------------------------------------------------------
// messages
// ---------------------------------------------------------------------------

function announce(text) {
    if (!state.world || !state.world.players) {
        return 0;
    }

    let count = 0;

    for (const player of state.world.players.getAll()) {
        player.message(`@or2@${text}`);
        count += 1;
    }

    return count;
}

function remember(tag, from, text) {
    const lines = state.chat.get(tag) || [];
    lines.push({ at: state.now(), from, text });

    if (lines.length > CHAT_KEEP) {
        lines.splice(0, lines.length - CHAT_KEEP);
    }

    state.chat.set(tag, lines);
}

// a line to every online member, kept in the chat tail; `from` null is the Herald
function clanMessage(clan, text, from = null) {
    remember(clan.tag, from || 'Herald', text);
    const line = from
        ? `@cya@[${clan.tag}] ${pretty(from)}: @whi@${text}`
        : `@cya@[${clan.tag}] @or1@${text}`;

    for (const player of onlineMembers(clan)) {
        player.message(line);
    }
}

function chat(player, text) {
    const found = memberOf(player.username);

    if (!found) {
        player.message('You are not in a clan. Talk to the Clan Herald in Edgeville');
        return false;
    }

    const clean = String(text || '')
        .replace(/@[a-z0-9]{3}@/gi, '')
        .replace(/[\r\n]/g, ' ')
        .trim()
        .slice(0, CHAT_MAX);

    if (!clean) {
        return false;
    }

    if (player.canChat && !player.canChat()) {
        return false;
    }

    clanMessage(found.clan, clean, player.username);
    return true;
}

// ---------------------------------------------------------------------------
// membership
// ---------------------------------------------------------------------------

function validTag(tag) {
    return /^[A-Z]{2,4}$/.test(tag);
}

function validName(name) {
    return /^[A-Za-z][A-Za-z ']{2,23}$/.test(name);
}

function createClan({ tag, name, leader, motto = '', colour = null, members = [] }) {
    const now = state.now();
    const clan = {
        tag,
        name,
        leader: normName(leader),
        motto,
        colour: colour || COLOURS[state.clans.size % COLOURS.length],
        created: now,
        battlesWon: 0,
        battlesLost: 0,
        kills: 0,
        deaths: 0,
        members: [{ username: normName(leader), rank: 'leader', joined: now }]
    };

    for (const username of members) {
        const name = normName(username);

        if (name && !clan.members.some((m) => m.username === name)) {
            clan.members.push({ username: name, rank: 'member', joined: now });
        }
    }

    state.clans.set(tag, clan);
    return clan;
}

function found(player, tag, name) {
    tag = String(tag || '').toUpperCase();
    name = String(name || '').trim();

    if (memberOf(player.username)) {
        return 'You are already in a clan';
    }

    if (!heraldNear(player)) {
        return 'Clans are founded with the Clan Herald, on the Edgeville street';
    }

    if (!validTag(tag)) {
        return 'A clan tag is 2 to 4 letters, like FANG';
    }

    if (!validName(name)) {
        return 'A clan name is 3 to 24 letters and spaces';
    }

    if (state.clans.has(tag)) {
        return `The tag ${tag} is taken`;
    }

    for (const clan of state.clans.values()) {
        if (clan.name.toLowerCase() === name.toLowerCase()) {
            return `There is already a clan called ${clan.name}`;
        }
    }

    if (!player.inventory.has(COINS_ID, FOUND_COST)) {
        return `Founding a clan costs ${FOUND_COST} coins`;
    }

    player.inventory.remove(COINS_ID, FOUND_COST);
    const clan = createClan({ tag, name, leader: player.username });
    persistClan(clan);
    announce(`${pretty(player.username)} has founded the clan ${name} [${tag}]!`);
    return null;
}

function invite(player, targetName) {
    const found = memberOf(player.username);
    const target = onlinePlayer(targetName);

    if (!found || !rankAtLeast(found.member, 'general')) {
        return 'Only a clan leader or general can invite';
    }

    if (!target) {
        return `${pretty(normName(targetName))} is not online`;
    }

    if (memberOf(target.username)) {
        return `${pretty(target.username)} is already in a clan`;
    }

    if (found.clan.members.length >= MAX_MEMBERS) {
        return `A clan has at most ${MAX_MEMBERS} members`;
    }

    state.invites.set(target.username, {
        tag: found.clan.tag,
        from: player.username,
        at: state.now()
    });

    target.message(
        `@cya@${pretty(player.username)} invites you to join ${found.clan.name} [${found.clan.tag}]. ` +
            `Type ::clan join ${found.clan.tag}`
    );
    player.message(`You invite ${pretty(target.username)} to ${found.clan.name}`);
    return null;
}

function join(player, tag) {
    tag = String(tag || '').toUpperCase();
    const pending = state.invites.get(player.username);
    const clan = getClan(tag);

    if (memberOf(player.username)) {
        return 'You are already in a clan';
    }

    if (!clan || !pending || pending.tag !== tag || state.now() - pending.at > INVITE_MS) {
        return 'You need a fresh invite from that clan';
    }

    if (clan.members.length >= MAX_MEMBERS) {
        return 'That clan is full';
    }

    state.invites.delete(player.username);
    clan.members.push({ username: player.username, rank: 'member', joined: state.now() });
    persistClan(clan);
    clanMessage(clan, `${pretty(player.username)} has joined the clan`);
    return null;
}

// the next leader when one leaves: the longest-serving general, else member
function successor(clan) {
    const ranked = clan.members
        .filter((m) => m.rank !== 'leader')
        .sort((a, b) => RANKS.indexOf(b.rank) - RANKS.indexOf(a.rank) || a.joined - b.joined);

    return ranked[0] || null;
}

function removeMember(clan, username) {
    clan.members = clan.members.filter((m) => m.username !== username);

    if (clan.leader === username) {
        const next = successor(clan);

        if (next) {
            next.rank = 'leader';
            clan.leader = next.username;
            clanMessage(clan, `${pretty(next.username)} now leads the clan`);
        }
    }

    if (!clan.members.length) {
        state.clans.delete(clan.tag);
        state.chat.delete(clan.tag);
        forgetClan(clan.tag);
        announce(`The clan ${clan.name} [${clan.tag}] has disbanded`);
        return;
    }

    persistClan(clan);
}

function leave(player) {
    const found = memberOf(player.username);

    if (!found) {
        return 'You are not in a clan';
    }

    clanMessage(found.clan, `${pretty(player.username)} has left the clan`);
    removeMember(found.clan, player.username);
    player.message(`You leave ${found.clan.name}`);
    return null;
}

function kick(player, targetName) {
    const found = memberOf(player.username);
    const name = normName(targetName);
    const target = found && found.clan.members.find((m) => m.username === name);

    if (!found || !rankAtLeast(found.member, 'general')) {
        return 'Only a clan leader or general can remove a member';
    }

    if (!target || target.username === player.username) {
        return `${pretty(name)} is not in your clan`;
    }

    if (RANKS.indexOf(target.rank) >= RANKS.indexOf(found.member.rank)) {
        return 'You can only remove members ranked below you';
    }

    clanMessage(found.clan, `${pretty(name)} was removed from the clan`);
    removeMember(found.clan, name);

    const online = onlinePlayer(name);

    if (online) {
        online.message(`You were removed from ${found.clan.name}`);
    }

    return null;
}

function setRank(player, targetName, rank) {
    const found = memberOf(player.username);
    const name = normName(targetName);
    const target = found && found.clan.members.find((m) => m.username === name);

    if (!found || found.member.rank !== 'leader') {
        return 'Only the clan leader can change ranks';
    }

    if (!target || target.username === player.username) {
        return `${pretty(name)} is not in your clan`;
    }

    if (rank === 'leader') {
        found.member.rank = 'general';
        target.rank = 'leader';
        found.clan.leader = target.username;
        clanMessage(found.clan, `${pretty(name)} now leads the clan`);
    } else {
        target.rank = rank;
        clanMessage(found.clan, `${pretty(name)} is now a ${rank}`);
    }

    persistClan(found.clan);
    return null;
}

function setMotto(player, text) {
    const found = memberOf(player.username);

    if (!found || found.member.rank !== 'leader') {
        return 'Only the clan leader can set the motto';
    }

    found.clan.motto = String(text || '').replace(/@[a-z0-9]{3}@/gi, '').trim().slice(0, 80);
    persistClan(found.clan);
    clanMessage(found.clan, `New motto: ${found.clan.motto}`);
    return null;
}

// admin seeding (POST /clans/seed): create the clan or bring its roster in;
// a member already in another clan is skipped. Idempotent
function seed(specs) {
    const out = [];

    for (const spec of Array.isArray(specs) ? specs : []) {
        const tag = String(spec.tag || '').toUpperCase();
        const leader = normName(spec.leader);

        if (!validTag(tag) || !validName(String(spec.name || '')) || !leader) {
            out.push({ tag, error: 'tag (2-4 letters), name and leader are required' });
            continue;
        }

        const other = memberOf(leader);

        if (other && other.clan.tag !== tag) {
            out.push({ tag, error: `${leader} is in ${other.clan.tag}` });
            continue;
        }

        let clan = getClan(tag);
        const created = !clan;

        if (!clan) {
            clan = createClan({ tag, name: spec.name, leader, colour: spec.colour || null });
        }

        clan.name = spec.name;

        if (spec.motto != null) {
            clan.motto = String(spec.motto).slice(0, 80);
        }

        if (spec.colour) {
            clan.colour = spec.colour;
        }

        const skipped = [];
        const generals = new Set((spec.generals || []).map(normName));

        for (const username of [leader, ...(spec.members || []).map(normName)]) {
            if (!username) {
                continue;
            }

            const elsewhere = memberOf(username);

            if (elsewhere && elsewhere.clan.tag !== tag) {
                skipped.push(username);
                continue;
            }

            let member = clan.members.find((m) => m.username === username);

            if (!member) {
                if (clan.members.length >= MAX_MEMBERS) {
                    skipped.push(username);
                    continue;
                }

                member = { username, rank: 'member', joined: state.now() };
                clan.members.push(member);
            }

            member.rank =
                username === leader ? 'leader' : generals.has(username) ? 'general' : member.rank === 'leader' ? 'member' : member.rank;
        }

        clan.leader = leader;
        persistClan(clan);
        out.push({ tag, created, members: clan.members.length, skipped });
    }

    return out;
}

// ---------------------------------------------------------------------------
// battles
// ---------------------------------------------------------------------------

function frontKey(name) {
    const key = String(name || '').toLowerCase().replace(/[^a-z]/g, '');
    return FRONTS[key] ? key : null;
}

function describeBattle(battle) {
    const a = getClan(battle.challenger);
    const b = getClan(battle.defender);
    const front = FRONTS[battle.front];

    return {
        ...battle,
        announced: undefined,
        challengerName: a ? a.name : battle.challenger,
        defenderName: b ? b.name : battle.defender,
        place: front ? front.place : null,
        tile: front ? { x: front.x, y: front.y } : null
    };
}

async function challenge(player, tag, frontName) {
    const found = memberOf(player.username);
    tag = String(tag || '').toUpperCase();
    const rival = getClan(tag);

    if (!found || !rankAtLeast(found.member, 'general')) {
        return 'Only a clan leader or general can issue a challenge';
    }

    if (!rival || rival.tag === found.clan.tag) {
        return `There is no rival clan ${tag}`;
    }

    if (openBattleOf(found.clan.tag)) {
        return 'Your clan already has a battle open';
    }

    if (openBattleOf(rival.tag)) {
        return `${rival.name} already has a battle open`;
    }

    const front = frontName ? frontKey(frontName) : 'edgeville';

    if (!front) {
        return `Fronts: ${Object.keys(FRONTS).join(', ')}`;
    }

    const battle = {
        id: state.nextLocalId--,
        challenger: found.clan.tag,
        defender: rival.tag,
        front,
        created: state.now(),
        startsAt: null,
        endsAt: null,
        status: 'challenged',
        killsChallenger: 0,
        killsDefender: 0,
        winner: null,
        announced: {}
    };

    state.battles.set(battle.id, battle);
    await persistBattle(battle);

    announce(
        `${found.clan.name} challenge ${rival.name} to a clan battle at ${FRONTS[front].place}! ` +
            `${rival.tag}'s leader can accept at the Clan Herald or with ::clan accept`
    );
    clanMessage(rival, `${found.clan.name} challenge us at ${FRONTS[front].place}. Leader or general: ::clan accept or ::clan decline`);
    clanMessage(found.clan, `Challenge sent to ${rival.name} (${Math.round(CHALLENGE_MS / 60000)} minutes to answer)`);
    return null;
}

function challengeFor(tag) {
    for (const battle of state.battles.values()) {
        if (battle.defender === tag && battle.status === 'challenged') {
            return battle;
        }
    }

    return null;
}

function accept(player) {
    const found = memberOf(player.username);

    if (!found || !rankAtLeast(found.member, 'general')) {
        return 'Only a clan leader or general can accept a challenge';
    }

    const battle = challengeFor(found.clan.tag);

    if (!battle) {
        return 'Your clan has no challenge to answer';
    }

    const now = state.now();
    battle.status = 'scheduled';
    battle.startsAt = now + LEAD_MS;
    battle.endsAt = battle.startsAt + BATTLE_MS;
    battle.announced = { lead: true };
    persistBattle(battle);

    const { challengerName, defenderName, place } = describeBattle(battle);
    announce(
        `Clan battle: ${challengerName} vs ${defenderName} at ${place} in ${Math.round(LEAD_MS / 60000)} minutes, ` +
            `for ${Math.round(BATTLE_MS / 60000)} minutes. Most kills wins!`
    );
    return null;
}

function decline(player) {
    const found = memberOf(player.username);

    if (!found || !rankAtLeast(found.member, 'general')) {
        return 'Only a clan leader or general can decline a challenge';
    }

    const battle = challengeFor(found.clan.tag);

    if (!battle) {
        return 'Your clan has no challenge to answer';
    }

    battle.status = 'cancelled';
    finish(battle);
    const challenger = getClan(battle.challenger);

    if (challenger) {
        clanMessage(challenger, `${found.clan.name} declined our challenge`);
    }

    announce(`${found.clan.name} declined the challenge from ${challenger ? challenger.name : battle.challenger}`);
    return null;
}

function finish(battle) {
    state.battles.delete(battle.id);
    state.recent.unshift(battle);
    state.recent.length = Math.min(state.recent.length, 20);
    persistBattle(battle);
}

function tick(now = state.now()) {
    for (const battle of Array.from(state.battles.values())) {
        const info = describeBattle(battle);
        battle.announced = battle.announced || {};

        if (battle.status === 'challenged' && now - battle.created >= CHALLENGE_MS) {
            battle.status = 'expired';
            finish(battle);
            announce(`${info.defenderName} let the challenge from ${info.challengerName} expire`);
            continue;
        }

        if (battle.status === 'scheduled') {
            const left = battle.startsAt - now;

            if (left <= 5 * 60000 && left > 60000 && !battle.announced.five) {
                battle.announced.five = true;
                announce(`Clan battle in 5 minutes: ${info.challengerName} vs ${info.defenderName} at ${info.place}`);
            }

            if (left <= 60000 && left > 0 && !battle.announced.one) {
                battle.announced.one = true;
                announce(`Clan battle in 1 minute: ${info.challengerName} vs ${info.defenderName} at ${info.place}`);
            }

            if (left <= 0) {
                battle.status = 'live';
                battle.announced.start = true;
                persistBattle(battle);
                announce(`The clan battle has begun! ${info.challengerName} vs ${info.defenderName} at ${info.place}`);
            }

            continue;
        }

        if (battle.status === 'live' && now >= battle.endsAt) {
            const a = getClan(battle.challenger);
            const b = getClan(battle.defender);
            const score = `${battle.killsChallenger} kills to ${battle.killsDefender}`;

            if (battle.killsChallenger === battle.killsDefender) {
                battle.winner = null;
                announce(`The clan battle is a draw: ${info.challengerName} and ${info.defenderName}, ${score}`);
            } else {
                const challengerWon = battle.killsChallenger > battle.killsDefender;
                const winner = challengerWon ? a : b;
                const loser = challengerWon ? b : a;
                battle.winner = challengerWon ? battle.challenger : battle.defender;

                if (winner) {
                    winner.battlesWon += 1;
                    persistClan(winner);
                }

                if (loser) {
                    loser.battlesLost += 1;
                    persistClan(loser);
                }

                announce(
                    `${winner ? winner.name : battle.winner} win the clan battle against ` +
                        `${loser ? loser.name : '?'}, ${challengerWon ? score : `${battle.killsDefender} kills to ${battle.killsChallenger}`}!`
                );
            }

            battle.status = 'done';
            finish(battle);
        }
    }

    for (const [username, pending] of state.invites) {
        if (now - pending.at > INVITE_MS) {
            state.invites.delete(username);
        }
    }
}

// src/pvp-stats.js: a player killed a player. Returns the live battle's id
// when the kill counted in one
function onKill(event, killer, victim) {
    const killerClan = getClan(event.killerClan);
    const victimClan = getClan(event.victimClan);

    if (killerClan) {
        killerClan.kills = (killerClan.kills || 0) + 1;
        clanMessage(
            killerClan,
            `${pretty(event.killer)} killed ${pretty(event.victim)}${victimClan ? ` [${victimClan.tag}]` : ''} at level ${event.wildLevel}`
        );
    }

    if (victimClan) {
        victimClan.deaths = (victimClan.deaths || 0) + 1;

        if (victimClan !== killerClan) {
            clanMessage(
                victimClan,
                `${pretty(event.victim)} fell to ${pretty(event.killer)}${killerClan ? ` [${killerClan.tag}]` : ''} at level ${event.wildLevel}`
            );
        }
    }

    if (!killerClan || !victimClan || killerClan === victimClan) {
        return null;
    }

    for (const battle of state.battles.values()) {
        if (battle.status !== 'live') {
            continue;
        }

        const pair = [battle.challenger, battle.defender];

        if (!pair.includes(killerClan.tag) || !pair.includes(victimClan.tag)) {
            continue;
        }

        if (battle.challenger === killerClan.tag) {
            battle.killsChallenger += 1;
        } else {
            battle.killsDefender += 1;
        }

        persistBattle(battle);
        const line = `Battle: ${battle.challenger} ${battle.killsChallenger} - ${battle.killsDefender} ${battle.defender}`;
        clanMessage(killerClan, line);
        clanMessage(victimClan, line);
        return battle.id > 0 ? battle.id : null;
    }

    return null;
}

// ---------------------------------------------------------------------------
// views
// ---------------------------------------------------------------------------

function viewClan(clan, { chatTail = 0 } = {}) {
    const view = {
        tag: clan.tag,
        name: clan.name,
        leader: clan.leader,
        motto: clan.motto,
        colour: clan.colour,
        created: clan.created,
        battlesWon: clan.battlesWon,
        battlesLost: clan.battlesLost,
        kills: clan.kills || 0,
        deaths: clan.deaths || 0,
        members: clan.members.map((m) => ({
            ...m,
            online: !!onlinePlayer(m.username)
        }))
    };

    if (chatTail) {
        view.chat = (state.chat.get(clan.tag) || []).slice(-chatTail);
    }

    return view;
}

function standings() {
    return Array.from(state.clans.values())
        .map((clan) => viewClan(clan))
        .sort(
            (a, b) =>
                b.battlesWon - a.battlesWon ||
                b.kills - a.kills ||
                a.deaths - b.deaths ||
                a.tag.localeCompare(b.tag)
        );
}

function openBattles() {
    return Array.from(state.battles.values()).map(describeBattle);
}

// ---------------------------------------------------------------------------
// ::clan and ::c
// ---------------------------------------------------------------------------

const HELP = [
    '::c <text> talks to your clan. ::clan found <TAG> <name> (5000 coins, by the Herald)',
    '::clan invite|kick|promote|demote|leader <name>, join <TAG>, leave, motto <text>',
    '::clan challenge <TAG> [front], accept, decline, battles, standings, fronts'
];

function info(player) {
    const found = memberOf(player.username);

    if (!found) {
        player.message('You are not in a clan. The Clan Herald on the Edgeville street can tell you more');
        HELP.forEach((line) => player.message(line));
        return;
    }

    const { clan, member } = found;
    const online = onlineMembers(clan).length;
    player.message(`@cya@${clan.name} [${clan.tag}], you are a ${member.rank}. ${clan.members.length} members, ${online} online`);
    player.message(
        `Kills ${clan.kills || 0}, deaths ${clan.deaths || 0}, battles won ${clan.battlesWon}, lost ${clan.battlesLost}`
    );

    if (clan.motto) {
        player.message(`Motto: ${clan.motto}`);
    }

    const battle = openBattleOf(clan.tag);

    if (battle) {
        player.message(describeLine(battle));
    }
}

function describeLine(battle) {
    const info = describeBattle(battle);
    const now = state.now();

    if (battle.status === 'challenged') {
        return `${info.challengerName} challenged ${info.defenderName} at ${info.place} (waiting for an answer)`;
    }

    if (battle.status === 'scheduled') {
        return `${info.challengerName} vs ${info.defenderName} at ${info.place} starts in ${Math.max(1, Math.ceil((battle.startsAt - now) / 60000))} min`;
    }

    return `LIVE: ${info.challengerName} ${battle.killsChallenger} - ${battle.killsDefender} ${info.defenderName} at ${info.place}, ${Math.max(0, Math.ceil((battle.endsAt - now) / 60000))} min left`;
}

async function command(player, command, args = []) {
    if (command === 'c') {
        chat(player, args.join(' '));
        return true;
    }

    const sub = String(args[0] || '').toLowerCase();
    const rest = args.slice(1);
    let error = null;

    switch (sub) {
        case '':
        case 'info':
            info(player);
            return true;
        case 'help':
            HELP.forEach((line) => player.message(line));
            return true;
        case 'found':
            error = found(player, rest[0], rest.slice(1).join(' '));
            break;
        case 'invite':
            error = invite(player, rest.join(' '));
            break;
        case 'join':
            error = join(player, rest[0]);
            break;
        case 'leave':
            error = leave(player);
            break;
        case 'kick':
            error = kick(player, rest.join(' '));
            break;
        case 'promote':
            error = setRank(player, rest.join(' '), 'general');
            break;
        case 'demote':
            error = setRank(player, rest.join(' '), 'member');
            break;
        case 'leader':
            error = setRank(player, rest.join(' '), 'leader');
            break;
        case 'motto':
            error = setMotto(player, rest.join(' '));
            break;
        case 'challenge':
            error = await challenge(player, rest[0], rest[1]);
            break;
        case 'accept':
            error = accept(player);
            break;
        case 'decline':
            error = decline(player);
            break;
        case 'battles': {
            const open = Array.from(state.battles.values());
            player.message(open.length ? `${open.length} clan battle(s):` : 'No clan battles are open');
            open.forEach((battle) => player.message(describeLine(battle)));
            return true;
        }
        case 'standings':
            player.message('Clan standings (battles won, kills, deaths):');
            standings()
                .slice(0, 5)
                .forEach((clan, i) =>
                    player.message(`${i + 1}. ${clan.name} [${clan.tag}] ${clan.battlesWon}W ${clan.battlesLost}L, ${clan.kills} kills, ${clan.deaths} deaths`)
                );
            return true;
        case 'fronts':
            player.message(`Fronts: ${Object.entries(FRONTS).map(([k, f]) => `${k} (${f.place})`).join(', ')}`);
            return true;
        default:
            HELP.forEach((line) => player.message(line));
            return true;
    }

    if (error) {
        player.message(error);
    }

    return true;
}

// ---------------------------------------------------------------------------
// world-admin HTTP: { status, body } or null when not ours
// ---------------------------------------------------------------------------

function strip(reply) {
    const { token, handler, ...body } = reply || {};
    return body;
}

// the data server ranks saved counters; online players' live counters win
function mergeOnline(rows, board) {
    const key = board === 'streak' ? 'bestStreak' : board;
    const byName = new Map(rows.map((row) => [row.username, row]));

    for (const player of state.world ? state.world.players.getAll() : []) {
        const pvp = player.cache && player.cache.pvp;

        if (!pvp) {
            continue;
        }

        const row = { username: player.username, ...pvp };
        row.kd = row.deaths ? row.kills / row.deaths : row.kills;
        byName.set(player.username, row);
    }

    return Array.from(byName.values())
        .map((row) => ({ ...row, clan: tagOf(row.username) }))
        .filter((row) => (board === 'kd' ? row.kills > 0 : (row[key] || 0) > 0))
        .sort((a, b) => (b[key] || 0) - (a[key] || 0) || (b.kills || 0) - (a.kills || 0) || a.username.localeCompare(b.username))
        .map((row, index) => ({ ...row, rank: index + 1 }));
}

async function handleHttp(method, route, url, readBody) {
    const parts = route.split('/').filter(Boolean);
    const world = state.world;

    if (parts[0] === 'pvp' && method === 'GET') {
        if (parts[1] === 'hiscores' && parts.length === 2) {
            const board = url.searchParams.get('board') || 'kills';
            const limit = Math.min(100, +url.searchParams.get('limit') || 25);
            const reply = await request(world, { handler: 'pvpHiscores', board, limit: 100 });

            if (reply.success === false) {
                return { status: 400, body: { error: `boards: kills, deaths, kd, streak, assists, damage, deepest, loot` } };
            }

            const rows = mergeOnline(reply.rows || [], board).slice(0, limit);
            return { status: 200, body: { board, rows, stale: !!(reply.down || reply.timeout) } };
        }

        if (parts[1] === 'events' && parts.length === 2) {
            const reply = await request(world, {
                handler: 'pvpEvents',
                since: +url.searchParams.get('since') || 0,
                limit: +url.searchParams.get('limit') || 50
            });

            if (reply.down || reply.timeout) {
                return { status: 503, body: { error: 'data server unavailable' } };
            }

            return { status: 200, body: strip(reply) };
        }

        return null;
    }

    if (parts[0] === 'clan-battles' && method === 'GET' && parts.length === 1) {
        const reply = await request(world, { handler: 'clanBattles', limit: 20 });
        const done = reply.battles || state.recent;

        return {
            status: 200,
            body: {
                open: openBattles(),
                recent: done.filter((b) => !state.battles.has(b.id)).map(describeBattle),
                fronts: FRONTS,
                rules: { challengeMs: CHALLENGE_MS, leadMs: LEAD_MS, battleMs: BATTLE_MS, maxMembers: MAX_MEMBERS, foundCost: FOUND_COST }
            }
        };
    }

    if (parts[0] !== 'clans') {
        return null;
    }

    if (method === 'GET' && parts.length === 1) {
        return { status: 200, body: { clans: standings(), battles: openBattles() } };
    }

    if (method === 'GET' && parts.length === 2) {
        const clan = getClan(decodeURIComponent(parts[1]));

        if (!clan) {
            return { status: 404, body: { error: 'unknown clan' } };
        }

        const tail = Math.min(CHAT_KEEP, +url.searchParams.get('chat') || 50);
        return { status: 200, body: { ...viewClan(clan, { chatTail: tail }), battle: openBattleOf(clan.tag) ? describeBattle(openBattleOf(clan.tag)) : null } };
    }

    if (method === 'POST' && parts[1] === 'seed' && parts.length === 2) {
        let body;

        try {
            body = JSON.parse(await readBody());
        } catch (e) {
            return { status: 400, body: { error: 'invalid JSON' } };
        }

        return { status: 200, body: { results: seed(body && body.clans) } };
    }

    // POST /clans/:tag/chat {from?, text}: an operator line into a clan's chat
    if (method === 'POST' && parts.length === 3 && parts[2] === 'chat') {
        const clan = getClan(decodeURIComponent(parts[1]));
        let body;

        try {
            body = JSON.parse(await readBody());
        } catch (e) {
            return { status: 400, body: { error: 'invalid JSON' } };
        }

        if (!clan || !body || typeof body.text !== 'string' || !body.text.trim()) {
            return { status: 400, body: { error: 'clan and text required' } };
        }

        clanMessage(clan, body.text.trim().slice(0, CHAT_MAX));
        return { status: 200, body: { ok: true } };
    }

    return null;
}

// ---------------------------------------------------------------------------
// lifecycle
// ---------------------------------------------------------------------------

async function load() {
    const reply = await request(state.world, { handler: 'clanLoad' });

    if (!reply || !reply.success) {
        log.warn('clans not loaded', reply && (reply.code || (reply.down ? 'down' : 'timeout')));
        return false;
    }

    state.clans.clear();
    state.battles.clear();

    for (const clan of reply.clans || []) {
        state.clans.set(clan.tag, { ...clan, members: clan.members || [] });
    }

    for (const battle of reply.battles || []) {
        state.battles.set(battle.id, { ...battle, announced: { lead: true } });
    }

    log.info(`loaded ${state.clans.size} clans, ${state.battles.size} open battles`);
    return true;
}

function init(world) {
    state.world = world;
    load().catch((e) => log.error(e));

    if (state.timer) {
        clearInterval(state.timer);
    }

    state.timer = setInterval(() => {
        try {
            tick();
        } catch (e) {
            log.error(e);
        }
    }, TICK_MS);

    if (state.timer.unref) {
        state.timer.unref();
    }
}

// tests: a clean registry on a fake world
function reset(world = null) {
    state.world = world;
    state.clans.clear();
    state.battles.clear();
    state.recent.length = 0;
    state.invites.clear();
    state.chat.clear();
    state.nextLocalId = -1;
    state.now = () => Date.now();

    if (state.timer) {
        clearInterval(state.timer);
        state.timer = null;
    }
}

module.exports = {
    COINS_ID,
    FOUND_COST,
    MAX_MEMBERS,
    INVITE_MS,
    CHALLENGE_MS,
    LEAD_MS,
    BATTLE_MS,
    HERALD_ID,
    FRONTS,
    state,
    init,
    load,
    reset,
    tick,
    command,
    chat,
    announce,
    clanMessage,
    memberOf,
    tagOf,
    getClan,
    heraldNear,
    found,
    invite,
    join,
    leave,
    kick,
    setRank,
    setMotto,
    seed,
    challenge,
    accept,
    decline,
    challengeFor,
    openBattleOf,
    onKill,
    standings,
    openBattles,
    describeBattle,
    describeLine,
    viewClan,
    handleHttp
};
