// NPC drop definitions: rsc-data rolls/drops.json with the Open-RSC port (src/arsc-drops.json, made by
// scripts/port-npc-drops.js) layered on top. An ARSC table replaces the rsc-data one for the same NPC id; named
// sub-tables (herb, rare, ...) are replaced the same way. rsc-data entries the port does not define are kept.
const rsc = require('@2003scape/rsc-data/rolls/drops');
const arsc = require('./arsc-drops.json');

module.exports = Object.assign({}, rsc, arsc.drops);
