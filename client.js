const socket = io();

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Настройка размера Canvas на весь экран
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

// Хранилище игроков на клиенте
let players = {};
let myId = null;

// Управление
const keys = {
    w: false, a: false, s: false, d: false
};

const speed = 5;

// Обработка сети
socket.on('connect', () => {
    myId = socket.id;
});

socket.on('currentPlayers', (serverPlayers) => {
    players = serverPlayers;
});

socket.on('newPlayer', (data) => {
    players[data.id] = data.player;
});

socket.on('playerMoved', (data) => {
    if (players[data.id]) {
        players[data.id].x = data.x;
        players[data.id].y = data.y;
    }
});

socket.on('playerDisconnected', (id) => {
    delete players[id];
});

// Слушатели клавиатуры
window.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.key.toLowerCase())) {
        keys[e.key.toLowerCase()] = true;
    }
});

window.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.key.toLowerCase())) {
        keys[e.key.toLowerCase()] = false;
    }
});

// Игровой цикл
function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Очистка экрана (трава видна из-за CSS)

    // Рисуем сетку для эффекта пространства (как в MooMoo)
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.lineWidth = 1;
    for(let i = 0; i < canvas.width; i += 50) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
    }
    for(let i = 0; i < canvas.height; i += 50) {
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke();
    }

    // Движение нашего игрока
    if (myId && players[myId]) {
        let moved = false;
        const p = players[myId];

        if (keys.w && p.y > p.radius) { p.y -= speed; moved = true; }
        if (keys.s && p.y < canvas.height - p.radius) { p.y += speed; moved = true; }
        if (keys.a && p.x > p.radius) { p.x -= speed; moved = true; }
        if (keys.d && p.x < canvas.width - p.radius) { p.x += speed; moved = true; }

        if (moved) {
            socket.emit('movement', { x: p.x, y: p.y });
        }
    }

    // Отрисовка всех игроков
    for (const id in players) {
        const p = players[id];
        
        // Рисуем тело
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#333';
        ctx.stroke();

        // Обозначаем своего игрока
        if (id === myId) {
            ctx.fillStyle = 'black';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('ВЫ', p.x, p.y + 4);
        }
    }

    requestAnimationFrame(gameLoop);
}

// Запуск игры
gameLoop();
