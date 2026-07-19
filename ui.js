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
let mapSize = 9000;
let gameActive = false;
let players = {};
let gameObjects = [];
const keys = { w: false, a: false, s: false, d: false };
let mouseAngle = 0;

let punchProgress = 0; 
let isPunching = false;
const GRID_SIZE = 50; 

// Переключатель режима карты: false = локальный радар, true = глобальная карта мира
let isWorldMapOpen = false; 

const ITEM_TYPES = {
    'empty': { label: 'Empty', color: 'transparent' },
    'axe': { label: 'Axe', color: '#95a5a6' },
    'pickaxe': { label: 'Pickaxe', color: '#7f8c8d' },
    'sword': { label: 'Sword', color: '#3498db' },
    'wood_wall': { label: 'Wood Wall', color: '#a0522d' },
    'stone_wall': { label: 'Stone Wall', color: '#708090' },
    'spike': { label: 'Spike', color: '#e74c3c' },
    'door': { label: 'Door', color: '#d35400' }
};

socket.on('connect', () => {
    document.getElementById('connection-status').innerText = "Connected! Ready to Play.";
    document.getElementById('connection-status').style.color = "#5cb85c";
});

function startGame() {
    if (!socket.connected) return;
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

socket.on('game_update', (data) => { players = data.players; });
socket.on('update_resources', (res) => {
    document.getElementById('res-wood').innerText = res.wood;
    document.getElementById('res-stone').innerText = res.stone;
});

socket.on('slot_changed', (data) => {
    if (data.success) {
        document.querySelectorAll('#hotbar .slot').forEach(s => s.classList.remove('active'));
        document.querySelector(`#hotbar .slot[data-slot="${data.activeSlot}"]`)?.classList.add('active');
        if(players[myId]) players[myId].activeItem = data.activeItem;
    }
});

socket.on('craft_response', (data) => {
    if (data.success) {
        document.getElementById('res-wood').innerText = data.resources.wood;
        document.getElementById('res-stone').innerText = data.resources.stone;
        updateUIHotbar(data.hotbar);
        if(players[myId]) players[myId].activeItem = data.activeItem;
    } else {
        alert(data.message);
    }
});

// Клик по радару переключает карту Мира / Локальный радар
radarCanvas.addEventListener('click', () => {
    isWorldMapOpen = !isWorldMapOpen;
    const container = document.getElementById('radar-container');
    if (isWorldMapOpen) {
        // Делаем карту большой по центру экрана
        container.style.width = "500px";
        container.style.height = "500px";
        container.style.bottom = "50%";
        container.style.right = "50%";
        container.style.transform = "translate(50%, 50%)";
        container.style.borderRadius = "12px";
        radarCanvas.width = 500;
        radarCanvas.height = 500;
    } else {
        // Возвращаем в угол как маленький локальный радар
        container.style.width = "180px";
        container.style.height = "120px";
        container.style.bottom = "20px";
        container.style.right = "20px";
        container.style.transform = "none";
        container.style.borderRadius = "8px";
        radarCanvas.width = 180;
        radarCanvas.height = 120;
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

window.addEventListener('mousedown', (e) => { 
    if (!gameActive) return;
    // Блокируем удар, если кликнули по радару
    if (e.target.id === 'radarCanvas') return;
    if (!isPunching) {
        isPunching = true;
        punchProgress = 0;
        socket.emit('player_strike'); 
    }
});

function gameLoop() {
    if (!gameActive) return;
    if (isPunching) {
        punchProgress += 0.25;
        if (punchProgress >= Math.PI) { isPunching = false; punchProgress = 0; }
    }

    socket.emit('player_input', { 
        move: { x: (keys.a ? -1 : 0) + (keys.d ? 1 : 0), y: (keys.w ? -1 : 0) + (keys.s ? 1 : 0) }, 
        angle: mouseAngle 
    });

    const me = players[myId];
    if (me) {
        const camX = me.x - canvas.width / 2;
        const camY = me.y - canvas.height / 2;
        
        // РЕНДЕР ТРЕХ БИОМОВ НА ЗЕМЛЕ
        ctx.fillStyle = '#578a34'; // Базовый биом (Трава)
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Зимний биом (Сверху карты)
        const winterHeight = mapSize * 0.3 - camY;
        if (winterHeight > 0) {
            ctx.fillStyle = '#eef2f7';
            ctx.fillRect(0, 0, canvas.width, winterHeight);
        }

        // Песчаный биом (Справа снизу)
        const sandX = mapSize * 0.7 - camX;
        const sandY = mapSize * 0.7 - camY;
        if (sandX < canvas.width && sandY < canvas.height) {
            ctx.fillStyle = '#f4d06f';
            ctx.fillRect(Math.max(0, sandX), Math.max(0, sandY), canvas.width, canvas.height);
        }
        
        drawGrid(ctx, camX, camY);
        for (let obj of gameObjects) drawObject(ctx, obj, camX, camY);
        for (let id in players) drawPlayer(ctx, players[id], camX, camY, id === myId);
        drawRadar(me);
    }
    requestAnimationFrame(gameLoop);
}

function drawGrid(c, cx, cy) {
    c.strokeStyle = 'rgba(0,0,0,0.06)'; c.lineWidth = 1; const size = 100;
    for (let x = Math.floor(cx / size) * size; x < cx + canvas.width + size; x += size) { 
        c.beginPath(); c.moveTo(x - cx, 0); c.lineTo(x - cx, canvas.height); c.stroke(); 
    }
    for (let y = Math.floor(cy / size) * size; y < cy + canvas.height + size; y += size) { 
        c.beginPath(); c.moveTo(0, y - cy); c.lineTo(canvas.width, y - cy); c.stroke(); 
    }
}

function drawObject(c, obj, cx, cy) {
    let sx = obj.x - cx, sy = obj.y - cy;
    if (obj.type.includes('wall') || obj.type === 'spike' || obj.type === 'door') {
        sx = Math.floor(obj.x / GRID_SIZE) * GRID_SIZE - cx + GRID_SIZE/2;
        sy = Math.floor(obj.y / GRID_SIZE) * GRID_SIZE - cy + GRID_SIZE/2;
    }
    if (sx < -100 || sx > canvas.width + 100 || sy < -100 || sy > canvas.height + 100) return;

    if (obj.type === 'door') {
        c.fillStyle = obj.isOpen ? '#e67e22' : '#d35400'; c.strokeStyle = '#5e2700'; c.lineWidth = 4;
        c.fillRect(sx - 20, sy - 20, 40, 40); c.strokeRect(sx - 20, sy - 20, 40, 40);
    } else if (obj.type.includes('wall')) {
        c.fillStyle = obj.type === 'wood_wall' ? '#a0522d' : '#708090'; c.strokeStyle = '#333'; c.lineWidth = 4;
        c.fillRect(sx - 22, sy - 22, 44, 44); c.strokeRect(sx - 22, sy - 22, 44, 44);
    } else {
        c.beginPath(); c.arc(sx, sy, obj.radius, 0, Math.PI * 2);
        c.fillStyle = obj.type === 'tree' ? '#2e5c1e' : '#7a7a7a'; 
        c.strokeStyle = obj.type === 'tree' ? '#1f3d14' : '#555';
        c.lineWidth = 4; c.fill(); c.stroke();
    }
}

function drawPlayer(c, p, cx, cy, isMe) {
    const sx = p.x - cx, sy = p.y - cy;
    c.save(); c.translate(sx, sy); c.rotate(p.angle);
    const punchOffset = isMe && isPunching ? Math.sin(punchProgress) * 16 : 0;
    c.fillStyle = '#e0ac69'; c.strokeStyle = '#333'; c.lineWidth = 3;
    c.beginPath(); c.arc(20, -20, 10, 0, Math.PI * 2); c.fill(); c.stroke();
    c.beginPath(); c.arc(20 + punchOffset, 20, 10, 0, Math.PI * 2); c.fill(); c.stroke();

    if (p.activeItem && p.activeItem !== 'empty') {
        c.fillStyle = ITEM_TYPES[p.activeItem]?.color || '#fff'; c.strokeStyle = '#222'; c.lineWidth = 2;
        if (p.activeItem === 'sword') c.fillRect(25 + punchOffset, 17, 32, 6);
        else if (p.activeItem === 'axe' || p.activeItem === 'pickaxe') {
            c.fillRect(25 + punchOffset, 18, 22, 4); c.fillRect(42 + punchOffset, 9, 6, 22);
        } else { c.fillRect(22 + punchOffset, 10, 15, 15); }
    }
    c.fillStyle = isMe ? '#4a90e2' : '#e0ac69'; c.beginPath(); c.arc(0, 0, p.radius, 0, Math.PI * 2); c.fill(); c.stroke();
    c.restore();
    c.fillStyle = 'white'; c.font = 'bold 14px Arial'; c.textAlign = 'center'; c.fillText(p.name, sx, sy - p.radius - 10);
}

// УЛУЧШЕННЫЙ РАДАР (ЛОКАЛЬНЫЙ ВОКРУГ ЧЕЛОВЕЧКА ИЛИ КАРТА ВСЕГО МИРА)
function drawRadar(me) {
    const w = radarCanvas.width;
    const h = radarCanvas.height;
    radarCtx.clearRect(0, 0, w, h);

    // Заливаем фон радара цветом биома
    radarCtx.fillStyle = 'rgba(30, 50, 20, 0.6)';
    radarCtx.fillRect(0, 0, w, h);

    if (isWorldMapOpen) {
        // РЕЖИМ 1: КАРТА ВСЕГО МИРА (Отображаем глобальные точки)
        // Зима на карте мира (сверху)
        radarCtx.fillStyle = 'rgba(255,255,255,0.3)';
        radarCtx.fillRect(0, 0, w, h * 0.3);
        // Песок на карте мира (справа снизу)
        radarCtx.fillStyle = 'rgba(244,208,111,0.4)';
        radarCtx.fillRect(w * 0.7, h * 0.7, w * 0.3, h * 0.3);

        // Игроки на карте мира
        for (let id in players) {
            radarCtx.fillStyle = id === myId ? '#ffffff' : '#ff4444';
            const rx = (players[id].x / mapSize) * w;
            const ry = (players[id].y / mapSize) * h;
            radarCtx.beginPath(); radarCtx.arc(rx, ry, id === myId ? 5 : 4, 0, Math.PI * 2); radarCtx.fill();
        }
    } else {
        // РЕЖИМ 2: ЛОКАЛЬНЫЙ РАДАР ВОКРУГ ЧЕЛОВЕЧКА
        // Центр радара — это сам игрок
        const cx = w / 2;
        const cy = h / 2;
        const zoom = 0.15; // Масштаб локального обзора вокруг игрока

        // Отрисовка врагов в зоне видимости локального радара
        for (let id in players) {
            const dx = (players[id].x - me.x) * zoom;
            const dy = (players[id].y - me.y) * zoom;
            const rx = cx + dx;
            const ry = cy + dy;

            // Если враг попадает в границы прямоугольника радара
            if (rx > 0 && rx < w && ry > 0 && ry < h) {
                radarCtx.fillStyle = id === myId ? '#ffffff' : '#ff4444';
                radarCtx.beginPath(); radarCtx.arc(rx, ry, id === myId ? 4 : 3, 0, Math.PI * 2); radarCtx.fill();
            }
        }
    }
}

function toggleWindow(wId) { document.getElementById(wId)?.classList.toggle('hidden'); }
function craftItem(name) { socket.emit('craft_request', name); }
function updateUIHotbar(hotbar) {
    for (let slotNum in hotbar) {
        const slotEl = document.querySelector(`#hotbar .slot[data-slot="${slotNum}"]`);
        const slotText = slotEl?.querySelector('.slot-icon');
        if (slotText) {
            const itemKey = hotbar[slotNum] || 'empty';
            const itemData = ITEM_TYPES[itemKey];
            slotText.innerText = itemData ? itemData.label : 'Empty';
            if (itemKey !== 'empty') {
                slotEl.style.border = `3px solid ${itemData.color}`;
                slotEl.style.backgroundColor = 'rgba(255,255,255,0.15)';
            } else {
                slotEl.style.border = '2px solid #555';
                slotEl.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
            }
        }
    }
}
