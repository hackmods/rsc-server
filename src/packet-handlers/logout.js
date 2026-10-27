const wilderness = require('../wilderness');

// sent after pressing logout button
// Player.canLogout: not while fighting, nor within 10 seconds of combat
async function logout(socket) {
    const { player } = socket;

    if (player && player.loggedIn && wilderness.inCombatCooldown(player)) {
        player.send({ type: 'logoutDeny' });
        return;
    }

    await socket.player.logout();
    delete socket.player;
}

// sent after we send logout success packet or if closing client unexpectedly
async function closeConnection() {}

module.exports = { logout, closeConnection };
