window.socket = io();
window.players = {};
window.myId = null;

// Запоминаем свой ID, чтобы правильно центрировать камеру
window.socket.on('init', (id) => {
    window.myId = id;
});

// Слушаем сервер (10 раз в секунду)
window.socket.on('gameState', (serverPlayers) => {
    for (let id in serverPlayers) {
        let serverData = serverPlayers[id];
        
        if (!window.players[id]) {
            // Новый игрок - создаем сразу на месте
            window.players[id] = {
                x: serverData.x,
                y: serverData.y,
                targetX: serverData.x,
                targetY: serverData.y,
                id: serverData.id
            };
        } else {
            // Существующий игрок - обновляем только цель для интерполяции
            window.players[id].targetX = serverData.x;
            window.players[id].targetY = serverData.y;
        }
    }

    // Удаляем тех, кто вышел
    for (let id in window.players) {
        if (!serverPlayers[id]) {
            delete window.players[id];
        }
    }
});
