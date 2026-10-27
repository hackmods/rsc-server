// ARSC: shops that rsc-data's shops.json leaves out, merged into the shop table by model/shop.js (upstream shops are
// never overwritten). Same shape as shops.json: items { id, amount }, multipliers, delta, restock (ms), general.

module.exports = {
    // Edgeville, just south of the Wilderness border: supplies for players heading in
    // (plugins/npcs/edgeville/wilderness-outfitter.js)
    'wilderness-outfitter': {
        items: [
            // melee (the client shop holds 40 slots: skirts, bass, bronze scimitar, iron long sword left out)
            { id: 83, amount: 10 }, // Iron Scimitar
            { id: 84, amount: 8 }, // Steel Scimitar
            { id: 427, amount: 5 }, // Black Scimitar
            { id: 72, amount: 8 }, // Steel Long Sword
            { id: 5, amount: 10 }, // Medium Iron Helmet
            { id: 105, amount: 8 }, // Medium Steel Helmet
            { id: 7, amount: 8 }, // Iron Chain Mail Body
            { id: 114, amount: 6 }, // Steel Chain Mail Body
            { id: 2, amount: 8 }, // Iron Kite Shield
            { id: 129, amount: 6 }, // Steel Kite Shield
            // ranged
            { id: 189, amount: 10 }, // Shortbow
            { id: 188, amount: 10 }, // Longbow
            { id: 649, amount: 5 }, // Oak Shortbow
            { id: 648, amount: 5 }, // Oak Longbow
            { id: 11, amount: 1000 }, // Bronze Arrows
            { id: 638, amount: 1000 }, // Iron Arrows
            { id: 640, amount: 1000 }, // Steel Arrows
            { id: 15, amount: 10 }, // Leather Armour
            { id: 16, amount: 10 }, // Leather Gloves (the clan rangers' kit)
            { id: 17, amount: 10 }, // Boots
            // magic
            { id: 101, amount: 5 }, // Staff of Air
            { id: 102, amount: 5 }, // Staff of water
            { id: 103, amount: 5 }, // Staff of earth
            { id: 33, amount: 1000 }, // Air-Rune
            { id: 35, amount: 1000 }, // Mind-Rune
            { id: 32, amount: 1000 }, // Water-Rune
            { id: 34, amount: 1000 }, // Earth-Rune
            { id: 31, amount: 1000 }, // Fire-Rune
            { id: 41, amount: 1000 }, // Chaos-Rune
            { id: 184, amount: 5 }, // Wizards robe
            { id: 185, amount: 5 }, // wizardshat
            // potions (3 dose)
            { id: 474, amount: 10 }, // attack Potion (3 doses)
            { id: 222, amount: 10 }, // Strength Potion (3 doses)
            { id: 480, amount: 10 }, // defense Potion (3 doses)
            { id: 566, amount: 10 }, // Cure poison Potion (3 doses)
            { id: 483, amount: 10 }, // restore prayer Potion (3 doses)
            // food
            { id: 367, amount: 30 }, // Tuna
            { id: 373, amount: 30 }, // Lobster
            { id: 370, amount: 30 }, // Swordfish
            { id: 326, amount: 30 } // Meat Pizza
        ],
        sellMultiplier: 100,
        buyMultiplier: 60,
        delta: 2,
        restock: 30000,
        general: false
    }
};
