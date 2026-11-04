// Ported from Open-RSC Core-Framework authentic/itemactions/InvAction.java handleScrumpledPieceOfPaper (AGPL-3.0)
// The scrumpled piece of paper (1120) Shantay sometimes drops (npcs/al-kharid/shantay.js) is the Ugthanki kebab
// recipe, shown in the big message box ("%" is a line break).

const SCRUMPLED_PAPER_ID = 1120;

const RECIPE =
    '@gre@*** Delicious Ugthanki Kebab *** % %' +
    'Ingredients : Cooked Ugthanki meat %' +
    'Flour %Water %Onion %Tomato % %' +
    '@yel@The Ugthanki meat should be nicely grilled. %' +
    '@yel@Next take the flour and water and make some Pitta Bread. %' +
    "@yel@You'll need a range to do this. % %" +
    '@yel@Take an onion and chop it into a bowl. %' +
    '@yel@Take a tomato and chop it into the onion mixture. %' +
    '@yel@Chop the meat into the Onion and Tomato mixture. %' +
    '@yel@Finally fill the pitta bread with the Ugthanki, Onion and %' +
    '@yel@Tomato mixture to make your delicious Ugthanki Kebab.';

async function onInventoryCommand(player, item) {
    if (item.id !== SCRUMPLED_PAPER_ID) {
        return false;
    }

    // ActionSender.sendBox(player, ..., true): the big box
    player.send({ type: 'serverMessageOnTop', message: RECIPE });

    return true;
}

module.exports = { onInventoryCommand, RECIPE };
