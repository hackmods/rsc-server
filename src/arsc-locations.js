// ARSC: spawns that rsc-data's locations files leave out, added to them at world load (World.loadEntities).

module.exports = {
    npcs: [
        // Thordur, Black Hole Experience (plugins/miniquests/black-hole.js), by Boot in the western Dwarven Mine
        { id: 175, x: 313, y: 3346, minX: 310, maxX: 314, minY: 3344, maxY: 3349 }
    ],
    gameObjects: [
        // ladder down to the black hole, by the torch alcove north of Thordur (311,3343 holds the torch)
        { id: 199, direction: 0, x: 312, y: 3344 }
    ],
    wallObjects: [],
    groundItems: [
        // 10 coins on the floor of Thordur's chamber (the price of a disk of returning), back a minute after pickup
        { id: 10, amount: 10, respawn: 60000, x: 308, y: 3348 }
    ]
};
