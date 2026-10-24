# rsc-server (hackmods fork, `arsc` branch)

This is the game server for **Autonomous-RSC** (https://github.com/hackmods/Autonomous-RSC). It is a fork of
2003scape/rsc-server; every ARSC change is a commit on the `arsc` branch here. Read this before changing anything.

## Where server changes go
- Server behaviour (plugins, packet handlers, world admin) is written **here**, on `arsc`. Never as a patch script, an
  overlay or a Dockerfile step in Autonomous-RSC: that was the old way and it is gone.
- Autonomous-RSC builds its image from the commit pinned in `source/pins.json` (`rsc-server.commit`). A change does
  nothing in the running game until that pin is bumped to the pushed SHA in an Autonomous-RSC PR.
- Order: commit here, `git push origin arsc`, put `git rev-parse HEAD` in `source/pins.json` there, commit that there.
  Push here first: CI in Autonomous-RSC fetches the pinned SHA from this repo and fails if it is not pushed.

## Plugins
- A plugin is a file under `src/plugins/` exporting `onSomething(player, ...)` hooks. It must also be listed in
  `src/plugins/index.js` (a flat `require` map, one line per file, same style as its neighbours).
- Hooks must be in `PLUGIN_TYPES` in `src/model/world.js`. A hook that returns true claims the action.
- Use `@2003scape/rsc-data` tables (`skills/*.json`, `config/items.json`) rather than copying numbers. rsc-data
  experience is in quarter points; pass it to `player.addExperience` as is.
- Upstream (`2003scape/rsc-server`) merges go into `arsc` with `git fetch upstream` then merge; do not rebase `arsc`.

## Tests
- `npm test` (runs `test/*.test.js`). Add a test file with every plugin: drive it with fake player and world objects.
- A change that needs the real game (World, Player, bots) is checked in Autonomous-RSC: see its `CLAUDE.md`.
