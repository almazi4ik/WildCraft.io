const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

function drawGrid() {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    const gridSize = 50;
    
    // Рисуем бесконечную сетку для ощущения движения
    ctx.beginPath();
    for (let x = -2000; x <= 2000; x += gridSize) {
        ctx.moveTo(x, -2000);
        ctx.lineTo(x, 2000);
    }
    for (let y = -2000; y <= 2000; y += gridSize) {
        ctx.moveTo(-2000, y);
        ctx.lineTo(2000, y);
    }
    ctx.stroke();
}

function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const lerpFactor = 0.2; // Скорость доводки к серверным координатам
    const me = window.players[window.myId];

    ctx.save();

    // Камера строго по центру твоего игрока (исправляет баг со смещением)
    if (me) {
        ctx.translate(canvas.width / 2 - me.x, canvas.height / 2 - me.y);
    }

    drawGrid();

    // Отрисовка всех игроков
    for (let id in window.players) {
        let p = window.players[id];

        // Линейная интерполяция
        p.x += (p.targetX - p.x) * lerpFactor;
        p.y += (p.targetY - p.y) * lerpFactor;

        // Рисуем кружок игрока
        ctx.beginPath();
        ctx.arc(p.x, p.y, 20, 0, Math.PI * 2);
        ctx.fillStyle = (id === window.myId) ? '#3498db' : '#e74c3c'; // Ты синий, враги красные
        ctx.fill();
        ctx.strokeStyle = '#2980b9';
        ctx.lineWidth = 3;
        ctx.stroke();
    }

    ctx.restore();
    requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
