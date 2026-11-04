// ARSC custom NPC rows, appended to rsc-data's NPC table at load (same contract as src/arsc-items: ids continue the
// table with no gap, and the clients' config archive carries the same rows, docs/CLIENT_CONFIG.md "Append NPC
// definitions"). First rows: the Iron Man tutors (src/ironman.js, plugins/npcs/lumbridge/iron-men.js).

const npcDefs = require('@2003scape/rsc-data/config/npcs.json');

const newNPCs = require('./npcs.json').npcs;

function appendDefinition(npc) {
    if (npcDefs[npc.id]) {
        return;
    }

    if (npcDefs.length !== npc.id) {
        throw new Error(`arsc-npcs: npc ${npc.id} expected at index ${npcDefs.length}`);
    }

    const { id, ...definition } = npc;
    npcDefs.push(definition);
}

for (const npc of newNPCs) {
    appendDefinition(npc);
}

module.exports = {
    npcs: Object.fromEntries(newNPCs.map((npc) => [npc.id, npc])),
    IRONMAN: 794,
    ULTIMATE_IRONMAN: 795,
    HARDCORE_IRONMAN: 796
};
