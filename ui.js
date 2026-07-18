// Подключаемся напрямую к твоему живому серверу на Render
const socket = io('https://craftwars-io.onrender.com'); 

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const radarCanvas = document.getElementById('radarCanvas');
const radarCtx = radarCanvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

let myId = null;
let mapSize = 3000;
let gameActive = false;
let players = {};
let gameObjects = [];
const keys = { w: false, a: false, s: false, d: false };
let mouseAngle = 0;

// Отслеживаем статус подключения к серверу
socket.on('connect', () => {
    const statusEl = document.getElementById('connection-status');
    if (statusEl) {
        statusEl.innerText = "Подключено! Можно играть.";
        statusEl.style.color = "#5cb85c";
    }
});

socket.on('disconnect', () => {
    const statusEl = document.getElementById('connection-status');
    if (statusEl) {
        statusEl.innerText = "Потеряно соединение (сервер спит или перезагружается)";
        statusEl.style.color = "#ff4444";
    }
});

function startGame() {
    if (!socket.connected) {
        alert("Подожди, пока сервер на Render проснется! (Это занимает 1-2 минуты при первом запуске)");
        return;
    }
    const nick = document.getElementById('nickname-input').value.trim();
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('game-ui').classList.remove('hidden');
    
    gameActive = true;
    socket.emit('player_join', { name: nick });
    requestAnimationFrame(gameLoop);
}

socket.on('init', (data) => {
    myId = data.id;
    mapSize = data.mapSize;
    gameObjects = data.objects;
});

socket.on('game_update', (data) => { 
    players = data.players; 
});

socket.on('update_resources', (res) => {
    if (document.getElementById('res-wood')) document.getElementById('res-wood').innerText = res.wood;
    if (document.getElementById('res-stone')) document.getElementById('res-stone').innerText = res.stone;
});

socket.on('slot_changed', (data) => {
    if (data.success) {
        document.querySelectorAll('#hotbar .slot').forEach(s => s.classList.remove('active'));
        const targetSlot = document.querySelector(`#hotbar .slot[data-slot="${data.activeSlot}"]`);
        if (targetSlot) targetSlot.classList.add('active');
    }
});

socket.on('craft_response', (data) => {
    if (data.success) {
        if (document.getElementById('res-wood')) document.getElementById('res-wood').innerText = data.resources.wood;
        if (document.getElementById('res-stone')) document.getElementById('res-stone').innerText = data.resources.stone;
        updateUIHotbar(data.hotbar);
    } else {
        alert(data.message);
    }
});

window.addEventListener('keydown', (e) => {
    if (!gameActive || document.activeElement.id === 'nickname-input') return;
    if (e.key === 'w' || e.key === 'ц') keys.w = true;
    if (e.key === 'a' || e.key === 'ф') keys.a = true;
    if (e.key === 's' || e.key === 'ы') keys.s = true;
    if (e.key === 'd' || e.key === 'в') keys.d = true;
    if (e.key >= '1' && e.key <= '5') socket.emit('select_slot', e.key);
    if (e.key.toLowerCase() === 'i' || e.key.toLowerCase() === 'ш') toggleWindow('inventory-window');
    if (e.key.toLowerCase() === 'c' || e.key.toLowerCase() === 'с') toggleWindow('craft-window');
});

window.addEventListener('keyup', (e) => {
    if (e.key === 'w' || e.key === 'ц') keys.w = false;
    if (e.key === 'a' || e.key === 'ф') keys.a = false;
    if (e.key === 's' || e.key === 'ы') keys.s = false;
    if (e.key === 'd' || e.key === 'в') keys.d = false;
});

window.addEventListener('mousemove', (e) => {
    if (!gameActive) return;
    mouseAngle = Math.atan2(e.clientY - canvas.height / 2, e.clientX - canvas.width / 2);
});

window.addEventListener('mousedown', () => { 
    if (gameActive) socket.emit('player_strike'); 
});

function gameLoop() {
    if (!gameActive) return;
    socket.emit('player_input', { 
        move: { 
            x: (keys.a ? -1 : 0) + (keys.d ? 1 : 0), 
            y: (keys.w ? -1 : 0) + (keys.s ? 1 : 0) 
        }, 
        angle: mouseAngle 
    });

    const me = players[myId];
    if (me) {
        const camX = me.x - canvas.width / 2;
        const camY = me.y - canvas.height / 2;
        
        ctx.fillStyle = '#578a34'; 
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        drawGrid(ctx, camX, camY);
        for (let obj of gameObjects) drawObject(ctx, obj, camX, camY);
        for (let id in players) drawPlayer(ctx, players[id], camX, camY, id === myId);
        drawRadar(me);
    }
    requestAnimationFrame(gameLoop);
}

function drawGrid(c, cx, cy) {
    c.strokeStyle = '#4d7a2e'; 
    c.lineWidth = 2; 
    const size = 100;
    for (let x = Math.floor(cx / size) * size; x < cx + canvas.width + size; x += size) { 
        c.beginPath(); c.moveTo(x - cx, 0); c.lineTo(x - cx, canvas.height); c.stroke(); 
    }
    for (let y = Math.floor(cy / size) * size; y < cy + canvas.height + size; y += size) { 
        c.beginPath(); c.moveTo(0, y - cy); c.lineTo(canvas.width, y - cy); c.stroke(); 
    }
}

function drawObject(c, obj, cx, cy) {
    const sx = obj.x - cx, sy = obj.y - cy;
    if (sx < -100 || sx > canvas.width + 100 || sy < -100 || sy > canvas.height + 100) return;
    c.beginPath(); c.arc(sx, sy, obj.radius, 0, Math.PI * 2);
    c.fillStyle = obj.type === 'tree' ? '#2e5c1e' : '#7a7a7a'; 
    c.strokeStyle = obj.type === 'tree' ? '#1f3d14' : '#555';
    c.lineWidth = 5; c.fill(); c.stroke();
}

function drawPlayer(c, p, cx, cy, isMe) {
    const sx = p.x - cx, sy = p.y - cy;
    c.save(); c.translate(sx, sy); c.rotate(p.angle);
    c.fillStyle = '#e0ac69'; c.strokeStyle = '#333'; c.lineWidth = 3;
    c.beginPath(); c.arc(20, -20, 10, 0, Math.PI * 2); c.fill(); c.stroke();
    c.beginPath(); c.arc(20, 20, 10, 0, Math.PI * 2); c.fill(); c.stroke();
    c.fillStyle = isMe ? '#4a90e2' : '#e0ac69'; 
    c.beginPath(); c.arc(0, 0, p.radius, 0, Math.PI * 2); c.fill(); c.stroke();
    c.restore();
    c.fillStyle = 'white'; c.font = 'bold 14px Arial'; c.textAlign = 'center'; 
    c.fillText(p.name, sx, sy - p.radius - 10);
}

function drawRadar(me) {
    radarCtx.clearRect(0, 0, 150, 150);
    for (let id in players) {
        if (id !== myId) {
            radarCtx.fillStyle = 'rgba(255, 0, 0, 0.7)';
            radarCtx.beginPath(); 
            radarCtx.arc((players[id].x / mapSize) * 150, (players[id].y / mapSize) * 150, 3, 0, Math.PI * 2); 
            radarCtx.fill();
        }
    }
    radarCtx.fillStyle = '#ffffff'; 
    radarCtx.beginPath(); 
    radarCtx.arc((me.x / mapSize) * 150, (me.y / mapSize) * 150, 4, 0, Math.PI * 2); 
    radarCtx.fill();
}

function toggleWindow(wId) { 
    const el = document.getElementById(wId);
    if (el) el.classList.toggle('hidden'); 
}

function craftItem(name) { 
    socket.emit('craft_request', name); 
}

function updateUIHotbar(hotbar) {
    for (let slotNum in hotbar) {
        const slotText = document.querySelector(`#hotbar .slot[data-slot="${slotNum}"] .slot-icon`);
        if (slotText) {
            let n = hotbar[slotNum];
            if (n === 'wood_wall') n = 'Дер. Стена';
            if (n === 'stone_wall') n = 'Кам. Стена';
            if (n === 'spike') n = 'Шипы';
            if (n === 'empty') n = 'Пусто';
            slotText.innerText = n;
        }
    }
}
