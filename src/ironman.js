// ARSC Iron Man mode, ported from Open-RSC: constants/IronmanMode.java, Player.java (isIronMan, updateHCIronman),
// handlers PlayerTradeHandler / GroundItemTake / InterfaceShopHandler / BankHandler / PrayerHandler,
// model/container/Inventory.java dropOnDeath and Equipment.java (who may wear the armour).
// The mode is saved per account (players.iron_man in the data server). Chosen by talking to the Iron Man NPCs
// (plugins/npcs/lumbridge/iron-men.js) or set with the admin command ::ironman <user> <mode>.

const MODES = { none: 0, ironman: 1, ultimate: 2, hardcore: 3 };

const LABELS = ['normal player', 'Ironman', 'Ultimate Ironman', 'Hardcore Ironman'];

// Iron Man armour: OpenRSC's ids for the Ultimate and Hardcore helm/body/legs (1293-1298); the standard Ironman set and
// the plate tops and plated skirts take ARSC ids after the agility pouches (OpenRSC's 1290-1292 are our caskets).
const ARMOUR = {
    [MODES.ironman]: { helm: 1306, body: 1307, legs: 1308, top: 1309, skirt: 1312 },
    [MODES.ultimate]: { helm: 1293, body: 1294, legs: 1295, top: 1310, skirt: 1313 },
    [MODES.hardcore]: { helm: 1296, body: 1297, legs: 1298, top: 1311, skirt: 1314 }
};

// armour id -> the mode that may wear it
const ARMOUR_MODE = new Map();

for (const [mode, set] of Object.entries(ARMOUR)) {
    for (const id of Object.values(set)) {
        ARMOUR_MODE.set(id, +mode);
    }
}

const MESSAGES = {
    tradeSelf: 'You are an Ironman. You stand alone.',
    tradeOther: (name) => `${name} is an Ironman. They stand alone.`,
    takeDrop: "You're an Ironman, so you can't take items that other players have dropped.",
    lootPlayer: "You're an Ironman, so you can't loot items from players.",
    overstock: 'Iron Men may not buy items that are over-stocked in a shop.',
    bank: 'As an Ultimate Ironman, you cannot use the bank.',
    protectItem: 'Ultimate Ironmen cannot protect items.',
    exchange: 'As an Ironman, you cannot use the Exchange.'
};

// 'ironman', 'Ultimate', '2', 2 ... -> 0-3, or undefined
function parseMode(value) {
    if (typeof value === 'number') {
        return Number.isInteger(value) && value >= 0 && value <= 3 ? value : undefined;
    }

    const text = String(value || '').trim().toLowerCase();

    if (/^[0-3]$/.test(text)) {
        return +text;
    }

    const aliases = {
        none: 0, normal: 0, off: 0,
        ironman: 1, iron: 1, im: 1, standard: 1, regular: 1,
        ultimate: 2, uim: 2, 'ultimate ironman': 2,
        hardcore: 3, hcim: 3, hc: 3, 'hardcore ironman': 3
    };

    return Object.prototype.hasOwnProperty.call(aliases, text) ? aliases[text] : undefined;
}

function modeOf(player) {
    return (player && Number(player.ironMan)) || 0;
}

// any kind of Iron Man (Player.isIronMan())
function isIronMan(player) {
    return modeOf(player) > 0;
}

function isUltimate(player) {
    return modeOf(player) === MODES.ultimate;
}

function isHardcore(player) {
    return modeOf(player) === MODES.hardcore;
}

function label(mode) {
    return LABELS[mode] || LABELS[0];
}

// 'a normal player', 'an Ironman', 'an Ultimate Ironman', 'a Hardcore Ironman'
function describe(mode) {
    const text = label(mode);
    return `${/^[AEIOU]/.test(text) ? 'an' : 'a'} ${text}`;
}

function setMode(player, mode) {
    player.ironMan = mode;

    // the HC death mark belongs to a Hardcore run; a new choice clears it
    if (mode === MODES.hardcore) {
        player.hcIronmanDeath = 0;
    }
}

// PlayerTradeHandler: null when the two may trade, else the message for the requester
function tradeRefusal(player, other) {
    if (isIronMan(player)) {
        return MESSAGES.tradeSelf;
    }

    if (isIronMan(other)) {
        return MESSAGES.tradeOther(other.getFormattedUsername ? other.getFormattedUsername() : other.username);
    }

    return null;
}

// GroundItem.belongsTo for an Iron Man: world spawns (no dropper) and its own drops only. droppedBy is set by
// World.addPlayerDrop / addTimedGroundItem and, unlike owner, never times out.
function belongsTo(player, groundItem) {
    return groundItem.droppedBy === undefined || groundItem.droppedBy === null || groundItem.droppedBy === player.id;
}

// GroundItemTake / SpellHandler telekinetic grab: null when the player may take it, else the message
function takeRefusal(player, groundItem) {
    if (!isIronMan(player) || belongsTo(player, groundItem)) {
        return null;
    }

    return groundItem.playerKill ? MESSAGES.lootPlayer : MESSAGES.takeDrop;
}

// InterfaceShopHandler.checkPurchaseValidity: an Iron Man may not buy what other players sold past the normal stock
function shopRefusal(player, shopItem, baseAmount) {
    if (isIronMan(player) && shopItem.amount > (baseAmount || 0)) {
        return MESSAGES.overstock;
    }

    return null;
}

function bankRefusal(player) {
    return isUltimate(player) ? MESSAGES.bank : null;
}

// Player.killedBy: a Hardcore Ironman who dies is downgraded to a standard Ironman (OpenRSC freezes the HC hiscores and
// posts to its live feed; here the player is told).
function onDeath(player) {
    if (!isHardcore(player)) {
        return false;
    }

    player.ironMan = MODES.ironman;
    player.hcIronmanDeath = MODES.ironman;
    player.message('You have died as a Hardcore Ironman: you are now a standard Ironman.');

    return true;
}

// Equipment.java: the armour is for its own kind of Iron Man
function wearRefusal(player, id) {
    if (!ARMOUR_MODE.has(id)) {
        return null;
    }

    const mode = ARMOUR_MODE.get(id);

    if (modeOf(player) === mode) {
        return null;
    }

    return mode === MODES.ironman
        ? 'You need to be an Ironman to wear this'
        : mode === MODES.ultimate
          ? 'You need to be an Ultimate Ironman to wear this'
          : 'You need to be a Hardcore Ironman to wear this';
}

module.exports = {
    MODES,
    LABELS,
    ARMOUR,
    ARMOUR_MODE,
    MESSAGES,
    parseMode,
    modeOf,
    isIronMan,
    isUltimate,
    isHardcore,
    label,
    describe,
    setMode,
    tradeRefusal,
    belongsTo,
    takeRefusal,
    shopRefusal,
    bankRefusal,
    onDeath,
    wearRefusal
};
