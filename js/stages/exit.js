"use strict";
function exitStage(message) {
    message = message || T("Refresh page...");
    game.ctx.fillStyle = "#fff";
    game.forceDrawStrokedText(
        T(message),
        CELL_SIZE,
        CELL_SIZE
    );
    game.network.disconnect();

    var reload = document.createElement("button");
    reload.textContent = T("Reload");
    reload.onclick = game.reload;

    var help = document.createElement("p");
    help.id = "crash-help";

    var reset = document.createElement("button");
    reset.textContent = T("Reset settings");
    reset.addEventListener('click', game.controller.reset);
    document.body.appendChild(reset);

    help.appendChild(game.button.bugtracker());
    help.appendChild(game.button.vk());
    help.appendChild(reset);
    help.appendChild(game.button.logout());
    help.appendChild(reload);
    game.world.appendChild(help);
};
Stage.add(exitStage);
