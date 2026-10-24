async function sleepWord({ player }, { sleepWord }) {
    if (!player.interfaceOpen.sleep) {
        return;
    }

    const { world } = player;

    // request a new one
    if (sleepWord === '-null-') {
        if (Date.now() - player.lastSleepWord < 1000) {
            return;
        }

        player.openSleep(false);
    } else {
        // ARSC sandbox: bots cannot read the captcha image (see services/rsc-server/patches/sandbox-sleep.js).
        const arscPrefix = (process.env.ARSC_SLEEP_PREFIX || 'bot').toLowerCase();
        const arscName = String(player.username || '').toLowerCase();
        const arscAnyWord =
            process.env.ARSC_SLEEP_ANYWORD === '1' &&
            sleepWord.trim().length > 0 &&
            (arscPrefix === '*' || arscName.startsWith(arscPrefix));
        if (arscAnyWord || player.sleepWord === sleepWord) {
            player.exitSleep(true);
        } else {
            player.sendSleepIncorrect();
            await world.sleepTicks(1);
            player.openSleep(false);
        }
    }
}

module.exports = { sleepWord };
