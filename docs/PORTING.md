# Porting Open-RSC quests, minigames and skills

Open-RSC (https://github.com/Open-RSC/Core-Framework, AGPL-3.0) is the reference for authentic behaviour. A Java plugin
under `server/plugins/.../authentic/` ports line for line into one file under `src/plugins/`, listed in
`src/plugins/index.js`. Quest content lives in `src/plugins/quests/`; the helpers below exist so a port needs no framework.

## Java to JS

| Open-RSC | Here |
|---|---|
| `npcsay(p, npc, ...)` | `await npc.say(...)` |
| `say(p, npc, ...)` | `await player.say(...)` |
| `multi(p, npc, ...opts)` | `const i = await player.ask([...opts], repeat)` (returns the index) |
| `delay(n)` | `await world.sleepTicks(n)` |
| `mes(...)`, `message(...)` | `player.message(...)` |
| `p.getCache().getInt/setInt/has/remove` | `player.cache.key` (read, assign, `delete`) |
| `getQuestStage(p, Quests.X)` | `player.questStages.camelKey` (`-1` is complete) |
| `updateQuestStage` | assign `player.questStages.camelKey = n` |
| `give(p, id, n)` | `player.inventory.add(id, n)` |
| `remove(p, id, n)` | `player.inventory.remove(id, n)` |
| `ifheld(p, id, n)`, `hasCatalogID` | `player.inventory.has(id, n)` |
| `countId(id)` | `player.inventory.count(id)` |
| `teleport(p, x, y)` | `player.teleport(x, y)` |
| `ifnearvisnpc(p, id, r)` | `player.getNearbyEntitiesByID('npcs', id, r)[0]`, and skip `npc.locked` ones |
| `addnpc(id, x, y, ticks)` | `world.spawnTimedNPC({ id, x, y, ticks })` |
| `changenpc(npc, id)` | `world.replaceEntity('npcs', npc, id)` (keeps range and spawn, no respawn of the old one) |
| `delnpc(npc)` | `world.removeEntity('npcs', npc)` |
| `changeloc(obj, id)` | `world.replaceEntity('gameObjects', obj, id)` |
| `changeloc(obj, delay, id)` | `world.replaceTimed('gameObjects', obj, id, ticks)` (`'wallObjects'` works too) |
| `addloc` / `delloc` | `world.addEntity('gameObjects', new GameObject(world, {...}))` / `world.removeEntity` |
| `addobject(id, n, x, y, ticks)` | `world.addTimedGroundItem({ id, amount, x, y, ticks, owner })` |
| `incStat(p, skill, base, var)` (quest XP) | `player.addExperience(skill, base + level * var, false)`, quarter points |
| `setCurrentLevel`, `getSkills().setLevel` | `player.changeStat(skill, delta, { cap })` |
| `incQP`, `sendQuestComplete` | `player.completeQuest(key, { questPoints, experience: { skill: xp }, message })` |
| `damage(p, n)` | `player.damage(n)` |
| `npcattack(npc, p)` | `await npc.attack(player)` |
| `thinkbubble(item)` | `player.sendBubble(itemID)` |

`changeStat(skill, delta, { cap })` changes the current level, never below 0. A positive delta stops at `cap` (for a
boost to base + 3 pass `{ cap: base + 3 }`) and never lowers a level already above it; a drain ignores `cap`. It sends the
stats and returns the new level. In Open-RSC `incStat` is quest experience, not a level change; do not confuse the two.

`completeQuest` shows `message` (a string or an array of lines) first, pays the experience without fatigue, sets the stage
to `-1`, then adds the quest points with `@gre@You haved gained N quest point(s)!`. Pass finished XP numbers.

All `ticks` are server ticks (640 ms) and must be at least 1.

## Triggers become hooks

Java has a `blockX` check and an `onX` action per trigger. Here one `onX` hook in `PLUGIN_TYPES` does both: do the work
and return `true` to claim the action and block the default; return `false` before touching anything to pass.

| Open-RSC trigger | Hook |
|---|---|
| `TalkNpcTrigger`, `OpNpcTrigger`, `AttackNpcTrigger`, `KillNpcTrigger` | `onTalkToNPC`, `onNPCCommand`, `onNPCAttack`, `onNPCDeath` |
| `OpLocTrigger`, `OpBoundTrigger` | `onGameObjectCommandOne/Two`, `onWallObjectCommandOne/Two` |
| `UseLocTrigger`, `UseBoundTrigger`, `UseInvTrigger`, `UseNpcTrigger`, `UsePlayerTrigger` | `onUseWithGameObject`, `onUseWithWallObject`, `onUseWithInventory`, `onUseWithNPC`, `onUseWithPlayer` |
| `OpInvTrigger`, `DropObjTrigger`, `TakeObjTrigger`, `UseObjTrigger` | `onInventoryCommand`, `onDropItem`, `onGroundItemTake`, `onUseWithGroundItem` |
| `SpellNpcTrigger` | `onCastOnNPC(player, npc, spell, spellID)` |
| `SpellLocTrigger` | `onCastOnGameObject(player, gameObject, spell, spellID)` |
| spell on a ground item | `onCastOnGroundItem(player, groundItem, spell, spellID)` |
| `PlayerDeathTrigger` | `onPlayerDeath(player)`: true skips the default death (items, respawn) |
| `WearObjTrigger`, `RemoveObjTrigger` | `onWearItem(player, item)`, `onRemoveItem(player, item)`: true blocks it |
| `PlayerRangeNpcTrigger` | `onNPCRangedAttack(player, npc)`: runs before every shot, true stops it |

Not ported yet: `EscapeNpcTrigger` (the player walking out of an NPC fight), `SpellInvTrigger`, `SpellPlayerTrigger`,
`PlayerKilledPlayerTrigger`, `TimedEventTrigger`, login/logout and startup triggers.

## Conventions

- Header comment naming the Open-RSC source file and the licence, for example
  `// Ported from Open-RSC Core-Framework authentic/quests/free/CooksAssistant.java (AGPL-3.0)`.
- Skip every `WANT_CUSTOM_*` and other custom-config branch; port the authentic path only.
- Every handler is `async (player, ...)`. After the guard that decides the handler owns the action, return `true` on every
  path. `test/hook-returns.test.js` fails a hook that acts and then returns falsy.
- Quest key is the camelCase name in `@2003scape/rsc-data/quests.json`. Keep the Java stage numbers, and `-1` for done.
- Use `@2003scape/rsc-data` tables for numbers; its experience is in quarter points and goes to `addExperience` as is.
- Keep each file's line endings (many are CRLF) and the 4-space, single-quote style.
- No Java-style `Functions` clone: call the model methods above.

## Testing

`npm test`. Add `test/<name>.test.js` with each port. Drive the plugin with fake player and world objects, or with a
`Player` made by `Object.create(Player.prototype)` as `test/poison.test.js` does, and a `World` made by
`Object.create(World.prototype)` with the entity lists filled in as `test/porting-foundation.test.js` does (stub
`@2003scape/rsc-captcha` and `@2003scape/rsc-landscape` in `Module._load`, they need the native canvas module). Step
timers with the `runTicks` helper in that file. A test for a hook checks both that a handler is called and that returning
`true` blocks the default. Anything that needs the real game is checked from Autonomous-RSC (see its `CLAUDE.md`).
