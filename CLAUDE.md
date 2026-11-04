# rsc-server (in Autonomous-RSC, `source/rsc-server`)

This is the game server for **Autonomous-RSC**. It started as a fork of 2003scape/rsc-server (`hackmods/rsc-server`,
branch `arsc`) and was absorbed into Autonomous-RSC on 2026-11-03 with its full history (`git subtree`). Read this
before changing anything.

## Where server changes go
- Server behaviour (plugins, packet handlers, world admin) is an ordinary commit to `source/rsc-server` in an
  Autonomous-RSC branch and PR, together with the bot code and knowledge that depend on it. No pins, no second repo.
- Never a patch script, an overlay or a Dockerfile step: `scripts/check-source-pins.js` fails if
  `services/rsc-server/patches` or `overlay` come back.
- `hackmods/rsc-server` `arsc` is now a read-only public mirror (the AGPL source of what we run). After a PR that
  touches this folder merges, `node scripts/mirror-forks.js` pushes it there. Never commit to the fork directly.
- Upstream (2003scape) has been dormant since 2021. To take something from it, or to offer a fix back, see
  `docs/STATE_OF_THE_WORLD.md` Part A ("Contributing back").

## Plugins
- A plugin is a file under `src/plugins/` exporting `onSomething(player, ...)` hooks. It must also be listed in
  `src/plugins/index.js` (a flat `require` map, one line per file, same style as its neighbours).
- Hooks must be in `PLUGIN_TYPES` in `src/model/world.js`. A hook that returns true claims the action.
- Use `@2003scape/rsc-data` tables (`skills/*.json`, `config/items.json`) rather than copying numbers. rsc-data
  experience is in quarter points; pass it to `player.addExperience` as is.
- Authentic content is ported from OpenRSC (`source/OpenRSC-Core-Framework`, pinned in `source/pins.json`); name the
  Java source in the commit.

## Tests
- `npm test` here (runs `test/*.test.js`). Add a test file with every plugin: drive it with fake player and world
  objects. A test that loads `src/model/player.js` stubs `@2003scape/rsc-captcha` (it needs the native canvas module).
- A change that needs the real game (World, Player, bots) is proven with `node scripts/test-stack.js` from the repo root
  (it builds this folder): see the root `CLAUDE.md`.
