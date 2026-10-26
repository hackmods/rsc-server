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
        // ARSC sandbox: bots cannot read the captcha image (sandbox flags below; docs/ENGINE.md in Autonomous-RSC).
        const arscAnyWord =
            sleepWord.trim().length > 0 &&
            require('../world-admin').canSkipSleepWord(player);
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
