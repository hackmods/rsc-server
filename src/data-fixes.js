// Applies data-fixes.json to the @2003scape/rsc-data module objects. They are cached singletons, so once this has been
// required every other require of the same table sees the corrected rows. Safe to require many times: each op is
// idempotent. Require it before reading a table (server.js does, and each plugin that relies on a fix does too).

const { fixes } = require('./data-fixes.json');

// static requires so the browser bundle includes them
const tables = {
    'config/npcs': require('@2003scape/rsc-data/config/npcs'),
    'skills/cooking': require('@2003scape/rsc-data/skills/cooking'),
    'skills/fishing': require('@2003scape/rsc-data/skills/fishing'),
    'skills/herblaw': require('@2003scape/rsc-data/skills/herblaw'),
    'skills/mining': require('@2003scape/rsc-data/skills/mining'),
    'skills/smithing': require('@2003scape/rsc-data/skills/smithing')
};

function same(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
}

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function apply(fix, table) {
    const keys = fix.path.split('.');
    const last = keys.pop();
    let parent = table;

    for (const key of keys) {
        parent = parent[key];

        if (parent === undefined || parent === null) {
            throw new Error(`data-fixes: ${fix.id}: no ${fix.path} in ${fix.file}`);
        }
    }

    if (fix.op === 'set') {
        parent[last] = clone(fix.value);
    } else if (fix.op === 'delete') {
        delete parent[last];
    } else if (fix.op === 'push') {
        const list = parent[last];

        for (const value of fix.values) {
            if (!list.some((existing) => same(existing, value))) {
                list.push(clone(value));
            }
        }
    } else {
        throw new Error(`data-fixes: ${fix.id}: unknown op ${fix.op}`);
    }
}

for (const fix of fixes) {
    if (!tables[fix.file]) {
        throw new Error(`data-fixes: ${fix.id}: unknown file ${fix.file}`);
    }

    apply(fix, tables[fix.file]);
}

module.exports = { fixes, tables };
