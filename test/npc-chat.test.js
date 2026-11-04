// NPC.broadcastChat: an NPC that speaks while engaged addresses its interlocutor; one that speaks unengaged (the bridge
// ogre, a gnome guard, the agility trainer, Kaleb at the dormitory ladder) addresses each player who sees it. Reading
// this.interlocutor.index on an unengaged NPC threw live and cut the plugin short (Wave 4 live proof).

const test = require('node:test');
const assert = require('node:assert/strict');

const NPC = require('../src/model/npc');

const viewer = (index) => ({ index, localEntities: { characterUpdates: { npcChat: [] } } });

test('an unengaged NPC addresses each viewer; an engaged one its interlocutor', () => {
    const a = viewer(2);
    const b = viewer(3);
    const npc = { index: 7, interlocutor: null, knownPlayers: new Set([a, b]) };

    NPC.prototype.broadcastChat.call(npc, 'Oi! Little thing');
    assert.deepEqual(a.localEntities.characterUpdates.npcChat, [{ npcIndex: 7, playerIndex: 2, message: 'Oi! Little thing' }]);
    assert.deepEqual(b.localEntities.characterUpdates.npcChat, [{ npcIndex: 7, playerIndex: 3, message: 'Oi! Little thing' }]);

    npc.interlocutor = a;
    NPC.prototype.broadcastChat.call(npc, 'hello');
    assert.equal(b.localEntities.characterUpdates.npcChat[1].playerIndex, 2);
});
