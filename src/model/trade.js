// ARSC trade patch (installed by services/rsc-server/patches/trade-accept.js)
// Real RSC flow: offer screen (tradeItemUpdate / tradeAccept) then a confirm
// screen (tradeConfirmAccept); items swap only when both confirm.

const items = require('@2003scape/rsc-data/config/items');

const {
    Container,
    StackPolicy,
    IDComparator,
    definitionStackable
} = require('./container');

const TRADE_CAPACITY = 12;
const INVENTORY_CAPACITY = 30;
const MAX_AMOUNT = 2147483647;

function isStackable(id) {
    return !!(items[id] && items[id].stackable);
}

// rsc-socket's tradeRecipientStatus encoder writes its whole message argument
// as the status byte (packet.writeByte(accepted) receives the message object),
// so the message also coerces to 0/1 to make that byte correct. Encoders that
// read message.accepted are unaffected.
function recipientStatus(accepted) {
    const message = { type: 'tradeRecipientStatus', accepted };

    Object.defineProperty(message, 'valueOf', {
        value: () => (accepted ? 1 : 0),
        enumerable: false
    });

    return message;
}

function sendStatus(player, accepted, recipientAccepted) {
    player.send({ type: 'tradeStatus', accepted });
    player.send(recipientStatus(recipientAccepted));
}

function copyItems(list) {
    return list.map(({ id, amount }) => ({ id, amount }));
}

function processTradeRequest(playerA, playerB) {
    playerA.trade.requests.delete(playerB);
    playerA.trade.clear();
    playerA.trade.tradingWith = playerB;
    playerA.interfaceOpen.trade = true;
    playerA.send({ type: 'tradeOpen', index: playerB.index });
}

function processTradeClose(player) {
    player.interfaceOpen.trade = false;
    player.trade.tradingWith = null;
    player.trade.clear();
    player.send({ type: 'tradeClose' });
}

// unequipped copies of an item the player carries (stackables: total amount)
function countHeld(player, id) {
    let total = 0;

    for (const item of player.inventory.items) {
        if (item.id === id && !item.equipped) {
            total += isStackable(id) ? item.amount : 1;
        }
    }

    return total;
}

// every copy of an item, equipped or not
function countAll(player, id) {
    let total = 0;

    for (const item of player.inventory.items) {
        if (item.id === id) {
            total += isStackable(id) ? item.amount : 1;
        }
    }

    return total;
}

function totalsOf(offer) {
    const totals = new Map();

    for (const { id, amount } of offer) {
        totals.set(id, (totals.get(id) || 0) + amount);
    }

    return totals;
}

// does the player still carry everything in the offer?
function holds(player, offer) {
    for (const [id, amount] of totalsOf(offer)) {
        if (countHeld(player, id) < amount) {
            return false;
        }
    }

    return true;
}

// would the player's inventory fit receive[] once give[] has left it?
function canHold(player, give, receive) {
    const inventoryItems = player.inventory.items;
    let slots = inventoryItems.length;

    // stackable id -> { slots, amount }
    const stacks = new Map();

    for (const item of inventoryItems) {
        if (isStackable(item.id)) {
            const stack = stacks.get(item.id) || { slots: 0, amount: 0 };

            stack.slots += 1;
            stack.amount += item.amount;
            stacks.set(item.id, stack);
        }
    }

    for (const { id, amount } of give) {
        if (isStackable(id)) {
            const stack = stacks.get(id);

            if (stack) {
                stack.amount -= amount;

                if (stack.amount <= 0) {
                    slots -= stack.slots;
                    stack.slots = 0;
                    stack.amount = 0;
                }
            }
        } else {
            slots -= 1;
        }
    }

    for (const { id, amount } of receive) {
        if (!player.world.members && items[id].members) {
            return false;
        }

        if (isStackable(id)) {
            const stack = stacks.get(id);

            if (stack && stack.slots > 0) {
                if (stack.amount + amount > MAX_AMOUNT) {
                    return false;
                }

                stack.amount += amount;
            } else {
                slots += 1;
                stacks.set(id, { slots: 1, amount });
            }
        } else {
            slots += 1;
        }
    }

    return slots <= INVENTORY_CAPACITY;
}

// take an offer out of the inventory, throwing if anything did not leave
function removeFromInventory(player, offer) {
    for (const [id, total] of totalsOf(offer)) {
        const before = countAll(player, id);

        if (isStackable(id)) {
            let remaining = total;

            while (remaining > 0) {
                let found = null;

                for (const item of player.inventory.items) {
                    if (item.id === id) {
                        found = item;
                    }
                }

                if (!found) {
                    break;
                }

                const take = Math.min(remaining, found.amount);

                player.inventory.remove(id, take);
                remaining -= take;
            }
        } else {
            for (let i = 0; i < total; i += 1) {
                player.inventory.remove(id, 1);
            }
        }

        if (before - countAll(player, id) !== total) {
            throw new Error('could not remove item ' + id + ' from inventory');
        }
    }
}

// put an offer into the inventory, throwing if anything did not arrive
function addToInventory(player, offer) {
    for (const { id, amount } of offer) {
        const before = countAll(player, id);

        player.inventory.add(id, amount);

        if (countAll(player, id) - before !== amount) {
            throw new Error('could not add item ' + id + ' to inventory');
        }
    }
}

// close both windows without trading
function failTrade(culprit, other, culpritMessage, otherMessage) {
    processTradeClose(culprit);
    processTradeClose(other);

    // the trailing "declined trade" lines keep bot clients (which treat a
    // close after confirming as success unless they see this) honest
    culprit.message(culpritMessage, 'You have declined trade');
    other.message(otherMessage, 'Other player has declined trade');
}

function completeTrade(playerA, playerB) {
    const offerA = copyItems(playerA.trade.offer);
    const offerB = copyItems(playerB.trade.offer);

    if (!holds(playerA, offerA)) {
        failTrade(
            playerA,
            playerB,
            'You no longer have the items you offered',
            'Other player no longer has the items they offered'
        );
        return;
    }

    if (!holds(playerB, offerB)) {
        failTrade(
            playerB,
            playerA,
            'You no longer have the items you offered',
            'Other player no longer has the items they offered'
        );
        return;
    }

    if (!canHold(playerA, offerA, offerB)) {
        failTrade(
            playerA,
            playerB,
            "You don't have enough inventory space",
            "Other player doesn't have enough inventory space"
        );
        return;
    }

    if (!canHold(playerB, offerB, offerA)) {
        failTrade(
            playerB,
            playerA,
            "You don't have enough inventory space",
            "Other player doesn't have enough inventory space"
        );
        return;
    }

    // [player, offer, 'remove' | 'add'] steps done so far, for rollback
    const done = [];

    try {
        removeFromInventory(playerA, offerA);
        done.push([playerA, offerA, 'remove']);

        removeFromInventory(playerB, offerB);
        done.push([playerB, offerB, 'remove']);

        addToInventory(playerA, offerB);
        done.push([playerA, offerB, 'add']);

        addToInventory(playerB, offerA);
        done.push([playerB, offerA, 'add']);
    } catch (e) {
        for (const [player, offer, kind] of done.reverse()) {
            try {
                if (kind === 'remove') {
                    addToInventory(player, offer);
                } else {
                    removeFromInventory(player, offer);
                }
            } catch (rollbackError) {
                // nothing more can be done
            }
        }

        failTrade(playerA, playerB, 'Trade failed', 'Trade failed');
        return;
    }

    processTradeClose(playerA);
    processTradeClose(playerB);

    playerA.message('Trade completed.');
    playerB.message('Trade completed.');

    // ARSC Grand Exchange: log minted goods passing to a clean account
    require('../exchange').onTrade(playerA, playerB, offerA, offerB);
}

class Trade extends Container {
    constructor(player) {
        super(
            TRADE_CAPACITY,
            StackPolicy.USE_FUNCTION,
            IDComparator,
            definitionStackable
        );

        // the owner of this object
        this.player = player;

        // set of trade requests the player has received
        this.requests = new Set();

        // the player the owner is trading with
        this.tradingWith = null;

        // what the owner is offering: [{ id, amount }], one slot per
        // non-stackable item (the Container methods are not used for this)
        this.offer = [];

        // accepted the offer screen
        this.accepted = false;

        // the confirm screen is showing
        this.confirming = false;

        // accepted the confirm screen
        this.confirmAccepted = false;
    }

    clear() {
        super.clear();

        this.offer = [];
        this.accepted = false;
        this.confirming = false;
        this.confirmAccepted = false;
    }

    // the partner, or null (closing our window) if they are no longer trading
    // with us
    partner() {
        const other = this.tradingWith;

        if (
            other &&
            other.interfaceOpen.trade &&
            other.trade.tradingWith === this.player
        ) {
            return other;
        }

        if (this.player.interfaceOpen.trade) {
            processTradeClose(this.player);
        }

        return null;
    }

    request(otherPlayer) {
        // TODO: take privacy settings into account

        if (otherPlayer.hasInterfaceOpen()) {
            this.player.message('That player is busy at the moment');
            return;
        }

        // if we have a request from this player, open the trade screen
        // otherwise, send them a trade request
        if (this.requests.has(otherPlayer)) {
            processTradeRequest(this.player, otherPlayer);
            processTradeRequest(otherPlayer, this.player);
        } else {
            this.player.message('Sending trade request');
            otherPlayer.message(
                this.player.username + ' wishes to trade with you'
            );
            otherPlayer.trade.requests.add(this.player);
            this.tradingWith = otherPlayer;
        }
    }

    // un-accept both sides and tell both clients
    resetAccepted(other) {
        this.accepted = false;
        other.trade.accepted = false;

        sendStatus(this.player, false, false);
        sendStatus(other, false, false);
    }

    // first screen: accept the current pair of offers
    accept() {
        const other = this.partner();

        if (!other || this.confirming || this.accepted) {
            return;
        }

        this.accepted = true;
        this.player.send({ type: 'tradeStatus', accepted: true });
        other.send(recipientStatus(true));

        if (!other.trade.accepted) {
            return;
        }

        // both accepted: check both can hold what they would receive
        const selfFits = canHold(this.player, this.offer, other.trade.offer);
        const otherFits = canHold(other, other.trade.offer, this.offer);

        if (!selfFits || !otherFits) {
            if (!selfFits) {
                this.player.message("You don't have enough inventory space");
                other.message(
                    "Other player doesn't have enough inventory space"
                );
            }

            if (!otherFits) {
                other.message("You don't have enough inventory space");
                this.player.message(
                    "Other player doesn't have enough inventory space"
                );
            }

            this.resetAccepted(other);
            return;
        }

        this.confirming = true;
        this.confirmAccepted = false;
        other.trade.confirming = true;
        other.trade.confirmAccepted = false;

        this.player.send({
            type: 'tradeConfirmOpen',
            recipient: other.username,
            recipientItems: copyItems(other.trade.offer),
            items: copyItems(this.offer)
        });

        other.send({
            type: 'tradeConfirmOpen',
            recipient: this.player.username,
            recipientItems: copyItems(this.offer),
            items: copyItems(other.trade.offer)
        });
    }

    decline() {
        // capture reference since processTradeClose mods this variable
        const other = this.tradingWith;

        processTradeClose(this.player);

        if (
            other &&
            other.interfaceOpen.trade &&
            other.trade.tradingWith === this.player
        ) {
            processTradeClose(other);
            other.message('Other player has declined trade');
        }
    }

    // second screen: both confirming swaps the items
    confirmAccept() {
        const other = this.partner();

        if (!other || !this.confirming || !other.trade.confirming) {
            return;
        }

        this.confirmAccepted = true;

        if (!other.trade.confirmAccepted) {
            return;
        }

        completeTrade(this.player, other);
    }

    updateItems(offered) {
        const other = this.partner();

        // offers are frozen once the confirm screen is showing
        if (!other || this.confirming || other.trade.confirming) {
            return;
        }

        const hadAccepted = this.accepted || other.trade.accepted;
        const offer = [];
        const totals = new Map();

        for (const entry of offered || []) {
            const id = entry && entry.id;
            const amount = entry && entry.amount;

            if (
                !Number.isInteger(id) ||
                !items[id] ||
                !Number.isInteger(amount) ||
                amount < 1 ||
                amount > MAX_AMOUNT ||
                items[id].untradeable
            ) {
                this.player.message('Failed to add item to trade');
                break;
            }

            const wanted = (totals.get(id) || 0) + amount;

            if (countHeld(this.player, id) < wanted) {
                // they don't have this item
                this.player.message('You dont have that item');
                break;
            }

            const stackable = isStackable(id);
            const existing = stackable
                ? offer.find((slot) => slot.id === id)
                : null;
            const slotsNeeded = stackable ? (existing ? 0 : 1) : amount;

            if (offer.length + slotsNeeded > TRADE_CAPACITY) {
                // unable to add item to trade, it is full
                this.player.message('Failed to add item to trade');
                break;
            }

            totals.set(id, wanted);

            if (existing) {
                existing.amount += amount;
            } else if (stackable) {
                offer.push({ id, amount });
            } else {
                for (let i = 0; i < amount; i += 1) {
                    offer.push({ id, amount: 1 });
                }
            }
        }

        this.offer = offer;

        other.send({
            type: 'tradeItems',
            items: copyItems(offer)
        });

        // any change to either offer withdraws both acceptances
        if (hadAccepted) {
            this.resetAccepted(other);
        }
    }

    toJSON() {
        return copyItems(this.offer);
    }
}

module.exports = Trade;
