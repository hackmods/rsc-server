// Run every test/*.test.js with node's test runner. Lists the files itself:
// node 18 does not expand globs, and node 22+ no longer accepts a directory.
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const files = fs
    .readdirSync(__dirname)
    .filter((name) => name.endsWith('.test.js'))
    .map((name) => path.join(__dirname, name));

const { status } = spawnSync(process.execPath, ['--test', ...files], {
    stdio: 'inherit'
});

process.exit(status === null ? 1 : status);
