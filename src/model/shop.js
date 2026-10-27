const Item = require('./item');
const shops = require('@2003scape/rsc-data/shops');

// ARSC: shops rsc-data lacks (src/arsc-shops.js); upstream entries are never overwritten
const arscShops = require('../arsc-shops');

for (const [name, definition] of Object.entries(arscShops)) {
    if (!shops[name]) {
        shops[name] = definition;
    }
}

// default to coins as shop currency
const DEFAULT_CURRENCY = 10;

// maximum amount a stack of items can hold
// (per https://classic.runescape.wiki/w/Shop)
const ITEM_STACK_CAPACITY = Math.pow(2, 16) - 1;

// maximum number of items a shop can hold
const ITEM_CAPACITY = 40;

class Shop {
    constructor(world, name) {
        this.world = world;
        this.name = name;

        this.definition = shops[name];

        if (!this.definition) {
            throw new Error(`invalid shop name: "${this.name}"`);
        }

        // players viewing the shop
        this.occupants = new Set();

        // the items being sold and current prices
        this.items = this.definition.items.map((item) => new Item(item));

        if (!world.members) {
            this.items = this.items.filter((item) => {
                return !item.definition.members;
            });
        }

        this.currency = this.definition.currency || DEFAULT_CURRENCY;

        this.updateTimeout = null;

        this.boundRestock = this.restock.bind(this);
        this.boundUpdate = this.update.bind(this);
    }

    // determines whether or not an item is part of a shop's "regular" inventory
    // returns the object {id, amount} if true, otherwise undefined
    getShopInventory({ id }) {
        return this.definition.items.find((item) => item.id === id);
    }

    getItemDeltaPrice(item) {
        const shopItem = this.getShopInventory(item);
        let stockAmount = 0;

        if (shopItem) {
            stockAmount = shopItem.amount;
        }

        return (stockAmount - item.amount) * this.definition.delta;
    }

    getItemPrice(item, isSelling) {
        const multiplier = this.definition[
            `${isSelling ? 'buy' : 'sell'}Multiplier`
        ];

        let priceMod = multiplier + this.getItemDeltaPrice(item);

        if (priceMod < 10) {
            priceMod = 10;
        }

        return Math.floor((priceMod * item.definition.price) / 100);
    }

    // ARSC world-admin: one restock pass. The cadence is driven by
    // world-admin (upstream never scheduled it) and the old splice bug that
    // replaced this.items with the removed item is gone.
    restock() {
        let updated = false;
        const keep = [];

        for (const item of this.items) {
            const shopInventory = this.getShopInventory(item);

            if (shopInventory) {
                if (item.amount > shopInventory.amount) {
                    item.amount -= 1;
                    updated = true;
                } else if (item.amount < shopInventory.amount) {
                    item.amount += 1;
                    updated = true;
                }

                keep.push(item);
            } else {
                updated = true;

                if (item.amount > 1) {
                    item.amount -= 1;
                    keep.push(item);
                }
            }
        }

        this.items = keep;

        if (updated) {
            this.updateOccupants();
        }
    }

    updateOccupants() {
        for (const occupant of this.occupants) {
            occupant.openShop(this.name);
        }
    }

    buy(player, id, price) {
        if (!this.occupants.has(player)) {
            return;
        }

        const shopItem = this.items.find((i) => i.id === id);

        // trying to buy non-existent item
        if (!shopItem) {
            return;
        }

        if (shopItem.amount <= 0) {
            player.message('The shop has ran out of stock');
            return;
        }

        const itemPrice = this.getItemPrice(shopItem, false);

        if (price !== itemPrice) {
            return;
        }

        if (!player.inventory.has(10, itemPrice)) {
            player.message("You don't have enough coins");
            return;
        }

        shopItem.amount -= 1;

        const inInventory = !!this.getShopInventory(shopItem);

        if (shopItem.amount <= 0 && !inInventory) {
            this.items.splice(this.items.indexOf(shopItem), 1);
        }

        player.inventory.remove(this.currency, price);
        player.inventory.add(shopItem.id);
        player.sendSound('coins');

        // start a timer to update the shops occupants on the next game tick
        if (this.updateTimeout) {
            this.world.clearTickTimeout(this.updateTimeout);
        }

        this.updateTimeout = this.world.nextTick(this.boundUpdate);
    }

    sell(player, id, price) {
        if (!this.occupants.has(player)) {
            return;
        }

        if (!player.inventory.has(id)) {
            // the player doesn't actually have this item.. shame on them
            return;
        }

        const { world } = this;
        const item = new Item({ id });

        if (!world.members && item.definition.members) {
            return;
        }

        const shopInventoryItem = this.getShopInventory(item);

        if (!this.definition.general && !shopInventoryItem) {
            player.message('You cannot sell this item to this shop');
            return;
        }

        const shopItem = this.items.find((i) => i.id === id);

        item.amount = 0;

        // get the price of the shop item with amount, otherwise
        const itemPrice = shopItem
            ? this.getItemPrice(shopItem, true)
            : this.getItemPrice(item, true);

        if (price !== itemPrice) {
            return;
        }

        item.amount = 1;

        if (shopItem) {
            // the shop has this item, now check if the shop's capcity has
            // been met
            if (shopItem.amount < ITEM_STACK_CAPACITY) {
                shopItem.amount += 1;
            } else {
                // NOT KOSHER
                player.message('This shop has enough of that item');
                return;
            }
        } else {
            // shop doesn't already contain the item, check if the shop can
            // hold new items
            if (this.items.length < ITEM_CAPACITY) {
                this.items.push(item);
            } else {
                player.message('This shop is full');
                return;
            }
        }

        player.inventory.remove(id);
        player.inventory.add(this.currency, price);
        player.sendSound('coins');

        // start a timer to update the shops occupants on the next game tick
        if (this.updateTimeout) {
            this.world.clearTickTimeout(this.updateTimeout);
        }

        this.updateTimeout = this.world.nextTick(this.boundUpdate);
    }

    update() {
        this.updateOccupants();
        this.updateTimeout = null;
    }
}

Shop.names = Object.keys(shops);

module.exports = Shop;
