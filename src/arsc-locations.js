// ARSC: spawns that rsc-data's locations files leave out, added to them at world load (World.loadEntities).

module.exports = {
    npcs: [
        // Thordur, Black Hole Experience (plugins/miniquests/black-hole.js), by Boot in the western Dwarven Mine
        { id: 175, x: 313, y: 3346, minX: 310, maxX: 314, minY: 3344, maxY: 3349 }
    ],
    gameObjects: [
        // ladder down to the black hole, by the torch alcove north of Thordur (311,3343 holds the torch)
        { id: 199, direction: 0, x: 312, y: 3344 },
        // wishing fountains (plugins/game-objects/wishing-fountains.js) for towns rsc-data gives no fountain or well;
        // each 2x2 spot and the ring round it was clear and walkable on the landscape
        { id: 26, direction: 0, x: 121, y: 508 }, // Varrock square
        { id: 26, direction: 0, x: 211, y: 628 }, // Draynor
        { id: 26, direction: 0, x: 269, y: 656 }, // Port Sarim
        { id: 26, direction: 0, x: 225, y: 511 }, // Barbarian Village
        { id: 26, direction: 0, x: 371, y: 705 }, // Karamja, Musa Point
        { id: 26, direction: 0, x: 372, y: 500 }, // Taverley
        { id: 26, direction: 0, x: 445, y: 500 }, // Catherby
        { id: 26, direction: 0, x: 495, y: 455 }, // Seers' Village
        { id: 26, direction: 0, x: 470, y: 658 }, // Brimhaven
        { id: 26, direction: 0, x: 579, y: 743 }, // Yanille
        { id: 26, direction: 0, x: 702, y: 479 } // Gnome Stronghold
    ],
    wallObjects: [],
    groundItems: [
        // 10 coins on the floor of Thordur's chamber (the price of a disk of returning), back a minute after pickup
        { id: 10, amount: 10, respawn: 60000, x: 308, y: 3348 }
    ]
};
