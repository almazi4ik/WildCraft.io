const socket = io('https://craftwars-io.onrender.com'); 

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const radarCanvas = document.getElementById('radarCanvas');
const radarCtx = radarCanvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
window.addEventListener('resize', () => {
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
});

let myId = null; let mapSize = 9000; let gameActive = false;
let players = {}; let gameObjects = []; let mobs = []; let droppedItems = [];
const keys = { w: false, a: false, s: false, d: false };
let mouseAngle = 0; let isWorldMapOpen = false;
const GRID_SIZE = 50;

const ITEM_TYPES = {
    'empty': { label: 'Hands', color: 'transparent' },
    'axe': { label: 'Axe', color: '#95a5a6' },
    'pickaxe': { label: 'Pickaxe', color: '#7f8c8d' },
    'sword': { label: 'Sword', color: '#3498db' },
    'wood_wall': { label: 'Wood Wall', color: '#a0522d' },
    'stone_wall': { label: 'Stone Wall', color: '#708090' },
    'spike': { label: 'Spike', color: '#e74c3c' },
    'door': { label: 'Door', color: '#d35400' }
};

const LOOT_ICONS = { wood: '🪵', stone: '🪨', gold: '🪙', meat: '🥩' };

socket.on('init', (data) => { myId = data.id; });
socket.on('game_update', (data) => {
    players = data.players;
    gameObjects = data.gameObjects || [];
    mobs = data.mobs || [];
    droppedItems = data.droppedItems || [];
});

socket.on('loot_received', (data) => {
    const log = document.getElementById('loot-log');
    const entry = document.createElement('div');
    entry.className = 'loot-entry';
    entry.innerHTML = `<span class="loot-icon">${LOOT_ICONS[data.type] || ''}</span> +${data.count}`;
    log.appendChild(entry);
    setTimeout(() => entry.remove(), 2500);
});

socket.on('update_resources', (res) => {
    document.getElementById('res-wood').innerText = res.wood;
    document.getElementById('res-stone').innerText = res.stone;
    document.getElementById('res-gold').innerText = res.gold || 0;
    document.getElementById('res-meat').innerText = res.meat || 0;
});

socket.on('slot_changed', (data) => {
    if (data.success) {
        document.querySelectorAll('#hotbar .slot').forEach(s => s.classList.remove('active'));
        document.querySelector(`#hotbar .slot[data-slot="${data.activeSlot}"]`)?.classList.add('active');
    }
});

socket.on('craft_response', (data) => {
    if (data.success) {
        updateUIHotbar(data.hotbar);
    }
});

radarCanvas.addEventListener('click', () => {
    isWorldMapOpen = !isWorldMapOpen;
    const container = document.getElementById('radar-container');
    if (isWorldMapOpen) {
        Object.assign(container.style, { width: "500px", height: "500px", bottom: "50%", right: "50%", transform: "translate(50%, 50%)" });
        radarCanvas.width = 500; radarCanvas.height = 500;
    } else {
        Object.assign(container.style, { width: "180px", height: "120px", bottom: "20px", right: "20px", transform: "none" });
        radarCanvas.width = 180; radarCanvas.height = 120;
    }
});

window.addEventListener('keydown', (e) => {
    if (!gameActive) return;
    if (e.key === 'w' || e.key === 'ц') keys.w = true;
    if (e.key === 'a' || e.key === 'ф') keys.a = true;
    if (e.key === 's' || e.key === 'ы') keys.s = true;
    if (e.key === 'd' || e.key === 'в') keys.d = true;
    if (e.key === 'q' || e.key === 'й') socket.emit('pickup_item'); // Клавиша Q / Й для лута
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
    mouseAngle = Math.atan2(e.clientY - canvas.height / 2, e.clientX - canvas.width / 2);
});
window.addEventListener('mousedown', () => { if (gameActive) socket.emit('player_strike'); });

function startGame() {
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('game-ui').classList.remove('hidden');
    gameActive = true;
    socket.emit('player_join', { name: document.getElementById('nickname-input').value });
    requestAnimationFrame(gameLoop);
}

function gameLoop() {
    if (!gameActive) return;
    socket.emit('player_input', { 
        move: { x: (keys.a ? -1 : 0) + (keys.d ? 1 : 0), y: (keys.w ? -1 : 0) + (keys.s ? 1 : 0) }, angle: mouseAngle 
    });

    const me = players[myId];
    if (me) {
        const camX = me.x - canvas.width / 2; const camY = me.y - canvas.height / 2;

        // Биомы земли
        ctx.fillStyle = '#578a34'; ctx.fillRect(0, 0, canvas.width, canvas.height); // Трава
        if (mapSize * 0.3 - camY > 0) { ctx.fillStyle = '#eef2f7'; ctx.fillRect(0, 0, canvas.width, mapSize * 0.3 - camY); } // Зима
        if (mapSize * 0.7 - camX < canvas.width && mapSize * 0.7 - camY < canvas.height) {
            ctx.fillStyle = '#f4d06f'; ctx.fillRect(Math.max(0, mapSize * 0.7 - camX), Math.max(0, mapSize * 0.7 - camY), canvas.width, canvas.height); // Песок
        }

        // Отрисовка сущностей
        gameObjects.forEach(obj => drawObject(ctx, obj, camX, camY));
        droppedItems.forEach(item => {
            ctx.fillStyle = '#e74c3c'; ctx.beginPath(); ctx.arc(item.x - camX, item.y - camY, 12, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = 'white'; ctx.font = '10px Arial'; ctx.fillText("🍖", item.x - camX - 6, item.y - camY + 4);
        });
        mobs.forEach(mob => drawMob(ctx, mob, camX, camY));
        for (let id in players) drawPlayer(ctx, players[id], camX, camY, id === myId);
        
        drawRadar(me);
    }
    requestAnimationFrame(gameLoop);
}

function drawObject(c, obj, cx, cy) {
    let sx = obj.x - cx, sy = obj.y - cy;
    if (sx < -100 || sx > canvas.width + 100 || sy < -100 || sy > canvas.height + 100) return;

    if (obj.type === 'door' || obj.type.includes('wood_wall') || obj.type === 'stone_wall' || obj.type === 'spike') {
        c.fillStyle = obj.type === 'wood_wall' ? '#a0522d' : (obj.type === 'stone_wall' ? '#708090' : (obj.type === 'spike' ? '#7f8c8d' : '#d35400'));
        c.fillRect(sx - GRID_SIZE/2, sy - GRID_SIZE/2, GRID_SIZE, GRID_SIZE);
        c.strokeStyle = '#333'; c.strokeRect(sx - GRID_SIZE/2, sy - GRID_SIZE/2, GRID_SIZE, GRID_SIZE);
    } else {
        c.beginPath(); c.arc(sx, sy, obj.radius, 0, Math.PI * 2);
        c.fillStyle = obj.type === 'tree' ? '#2e5c1e' : (obj.type === 'fir' ? '#1b4d3e' : (obj.type === 'cactus' ? '#27ae60' : '#f1c40f'));
        c.fill();
    }
}

function drawPlayer(c, p, cx, cy, isMe) {
    const sx = p.x - cx, sy = p.y - cy;
    c.save(); c.translate(sx, sy); c.rotate(p.angle);

    const isBuilding = p.activeItem.includes('wall') || p.activeItem === 'spike' || p.activeItem === 'door';

    // РЕНДЕР РУК
    c.fillStyle = '#e0ac69'; c.strokeStyle = '#333'; c.lineWidth = 3;
    if (isBuilding) {
        // Две руки держат перед собой один большой блок
        c.beginPath(); c.arc(20, -12, 8, 0, Math.PI * 2); c.fill(); c.stroke();
        c.beginPath(); c.arc(20, 12, 8, 0, Math.PI * 2); c.fill(); c.stroke();
        
        c.fillStyle = p.activeItem === 'wood_wall' ? 'rgba(160,82,45,0.8)' : 'rgba(112,128,144,0.8)';
        c.fillRect(25, -GRID_SIZE/2, GRID_SIZE, GRID_SIZE);
    } else {
        // Обычные руки под оружие
        c.beginPath(); c.arc(20, -18, 9, 0, Math.PI * 2); c.fill(); c.stroke();
        c.beginPath(); c.arc(20, 18, 9, 0, Math.PI * 2); c.fill(); c.stroke();

        if (p.activeItem && p.activeItem !== 'empty') {
            c.fillStyle = ITEM_TYPES[p.activeItem]?.color || '#fff';
            if (p.activeItem === 'sword') c.fillRect(22, 14, 35, 7);
            else { c.fillRect(22, 14, 20, 5); }
        }
    }

    // Тело
    c.fillStyle = isMe ? '#4a90e2' : '#9b59b6'; c.beginPath(); c.arc(0, 0, p.radius, 0, Math.PI * 2); c.fill(); c.stroke();
    c.restore();
}

function drawMob(c, mob, cx, cy) {
    const sx = mob.x - cx, sy = mob.y - cy;
    if (sx < -50 || sx > canvas.width + 50 || sy < -50 || sy > canvas.height + 50) return;

    c.fillStyle = mob.type === 'wolf' ? '#7f8c8d' : (mob.type === 'pig' ? '#ff9ff3' : '#ffffff');
    c.beginPath(); c.arc(sx, sy, mob.type === 'rabbit' ? 14 : 22, 0, Math.PI*2); c.fill();
    
    // Отрисовка ХП БАРА над волками и свиньями
    if (mob.type === 'wolf' || mob.type === 'pig') {
        c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(sx - 20, sy - 35, 40, 5);
        c.fillStyle = mob.type === 'wolf' ? '#e74c3c' : '#2ecc71';
        c.fillRect(sx - 20, sy - 35, (mob.health / mob.maxHealth) * 40, 5);
    }
}

function drawRadar(me) {
    const w = radarCanvas.width; const h = radarCanvas.height;
    radarCtx.clearRect(0, 0, w, h);
    radarCtx.fillStyle = '#578a34'; radarCtx.fillRect(0, 0, w, h);

    if (isWorldMapOpen) {
        // Карта мира (Показывает биомы на весь экран)
        radarCtx.fillStyle = '#eef2f7'; radarCtx.fillRect(0, 0, w, h * 0.3); // Зима
        radarCtx.fillStyle = '#f4d06f'; radarCtx.fillRect(w * 0.7, h * 0.7, w * 0.3, h * 0.3); // Пустыня
        
        for (let id in players) {
            radarCtx.fillStyle = id === myId ? '#ffffff' : '#e74c3c';
            radarCtx.beginPath(); radarCtx.arc((players[id].x/mapSize)*w, (players[id].y/mapSize)*h, 4, 0, Math.PI*2); radarCtx.fill();
        }
    } else {
        // Локальный радар
        const zoom = 0.12;
        // Отрисовка зимнего края на радаре
        const winterY = (mapSize * 0.3 - me.y) * zoom + h/2;
        if (winterY > 0) { radarCtx.fillStyle = '#eef2f7'; radarCtx.fillRect(0, 0, w, winterY); }
        
        radarCtx.fillStyle = '#ffffff'; radarCtx.beginPath(); radarCtx.arc(w/2, h/2, 4, 0, Math.PI*2); radarCtx.fill();
    }
}

function toggleWindow(wId) { document.getElementById(wId)?.classList.toggle('hidden'); }
function craftItem(name) { socket.emit('craft_request', name); }
function updateUIHotbar(hotbar) {
    for (let slotNum in hotbar) {
        const slotEl = document.querySelector(`#hotbar .slot[data-slot="${slotNum}"]`);
        const slotText = slotEl?.querySelector('.slot-icon');
        if (slotText) slotText.innerText = ITEM_TYPES[hotbar[slotNum]]?.label || 'Empty';
    }
}
