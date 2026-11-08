async function chat({ player }, { message }) {
    // ARSC clan chat (src/clans.js): a line starting "@c " goes to the clan only ("/c " too, though the classic chat
    // encoding has no slash; ::c <text> always works)
    if (/^[@/]c /i.test(message || '')) {
        require('../clans').chat(player, message.slice(3));
        return;
    }

    if (player.canChat()) {
        player.lastChat = Date.now();
        player.broadcastChat(message);
    }
}

module.exports = { chat };
