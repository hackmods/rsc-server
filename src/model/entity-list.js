// entities contained within the entire world. this assigns indexes to new
// entities and provides optimized accessor methods using a quadtree

const { QuadTree, Box } = require('js-quadtree');

// ARSC: the tile each entity was filed under in the quadtree. js-quadtree keeps a reference and finds a point by its
// coordinates, so an entity that moved without being re-filed (a walking NPC, a player) could no longer be removed or
// found where it stood: a dead wandering NPC stayed in the tree as a ghost that blocked walking (Character#canWalk asks
// getAtPoint) and showed up in lookups (live: plague sheep in Sheep Herder walking back after a prod).
const FILED_X = Symbol('filedX');
const FILED_Y = Symbol('filedY');

// take one reference out of every leaf (a point filed under coordinates nobody recorded)
function removeEverywhere(node, entity) {
    if (node.isDivided) {
        for (const child of [node.ne, node.nw, node.se, node.sw]) {
            removeEverywhere(child, entity);
        }

        return;
    }

    for (let i = node.points.length - 1; i >= 0; i -= 1) {
        if (node.points[i] === entity) {
            node.points.splice(i, 1);
        }
    }
}

class EntityList {
    constructor(width, height) {
        this.entities = [];
        this.length = 0;

        this.quadTree = new QuadTree(new Box(0, 0, width, height), {
            capacity: 64,
            arePointsEqual: (point1, point2) => {
                return (
                    point1.index === point2.index &&
                    point1.x === point2.x &&
                    point1.y === point2.y
                );
            }
        });
    }

    // file an entity in the quadtree under its current tile
    file(entity) {
        this.quadTree.insert(entity);
        entity[FILED_X] = entity.x;
        entity[FILED_Y] = entity.y;
    }

    // take an entity out of the quadtree, wherever it was filed
    unfile(entity) {
        const { x, y } = entity;

        if (entity[FILED_X] === x && entity[FILED_Y] === y) {
            this.quadTree.remove(entity);
            return;
        }

        // moved since it was filed: look where it was filed, then everywhere (a quadtree divide re-files by the
        // coordinates of the moment)
        if (entity[FILED_X] !== undefined) {
            entity.x = entity[FILED_X];
            entity.y = entity[FILED_Y];
            this.quadTree.remove(entity);
            entity.x = x;
            entity.y = y;
        }

        removeEverywhere(this.quadTree, entity);
    }

    // re-file an entity of this list after it moved (Character#walkTo, Player#teleport)
    relocate(entity) {
        if (this.entities[entity.index] !== entity) {
            return;
        }

        if (entity[FILED_X] === entity.x && entity[FILED_Y] === entity.y) {
            return;
        }

        this.unfile(entity);
        this.file(entity);
    }

    add(entity) {
        this.file(entity);
        this.length += 1;

        for (let i = 0; i < this.entities.length; i += 1) {
            if (!this.entities[i]) {
                entity.index = i;
                this.entities[i] = entity;
                return i;
            }
        }

        const index = this.entities.push(entity) - 1;
        entity.index = index;
        return index;
    }

    remove(entity) {
        // make sure this is the same entity that was here before, in case
        // we try to remove the same instance twice.
        if (this.entities[entity.index] !== entity) {
            return false;
        }

        this.entities[entity.index] = null;
        this.unfile(entity);
        this.length -= 1;

        return true;
    }

    *getAll() {
        for (const entity of this.entities) {
            if (entity) {
                yield entity;
            }
        }
    }

    getByIndex(index) {
        return this.entities[index];
    }

    getInArea(x, y, range) {
        x -= Math.floor(range / 2);
        y -= Math.floor(range / 2);

        return this.quadTree.query(new Box(x, y, range, range));
    }

    getAtPoint(x, y) {
        return this.quadTree.query(new Box(x, y, 0, 0));
    }

    *getAllByID(id) {
        for (const entity of this.getAll()) {
            if (entity.id === id) {
                yield entity;
            }
        }
    }

    getByID(id) {
        const [entity] = this.getAllByID(id);
        return entity;
    }
}

module.exports = EntityList;
