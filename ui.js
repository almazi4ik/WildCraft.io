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

// Анимация удара (дерганье рук)
let punchProgress = 0; 
let isPunching = false;

// Размер сетки для строительства (строительство по клеткам)
const GRID_SIZE = 50; 

// Словарь предметов для рендеринга и английских названий
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
    const statusEl = document.getElementById('connection-status');
    if (statusEl) {
        statusEl.innerText = "Connected! Ready to Play.";
        statusEl.style.color = "#5cb85c";
    }
});

socket.on('disconnect', () => {
    const statusEl = document.getElementById('connection-status');
    if (statusEl) {
        statusEl.innerText = "Connection lost (server sleeping or restarting)";
        statusEl.style.color = "#ff4444";
    }
});

function startGame() {
    if (!socket.connected) {
        alert("Wait for Render server to wake up! (Takes 1-2 mins initially)");
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
    
    // Движение (ENG + RUS раскладки)
    if (e.key === 'w' || e.key === 'ц') keys.w = true;
    if (e.key === 'a' || e.key === 'ф') keys.a = true;
    if (e.key === 's' || e.key === 'ы') keys.s = true;
    if (e.key === 'd' || e.key === 'в') keys.d = true;
    
    // Хотбар
    if (e.key >= '1' && e.key <= '5') socket.emit('select_slot', e.key);
    
    // Окна интерфейса
    if (e.key.toLowerCase() === 'i' || e.key.toLowerCase() === 'ш') toggleWindow('inventory-window');
    if (e.key.toLowerCase() === 'c' || e.key.toLowerCase() === 'с') toggleWindow('craft-window');
    
    // Взаимодействие с Дверью (Клавиша E / русская У)
    if (e.key.toLowerCase() === 'e' || e.key.toLowerCase() === 'у') {
        socket.emit('interact_door');
    }
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
    if (gameActive && !isPunching) {
        isPunching = true;
        punchProgress = 0;
        socket.emit('player_strike'); 
    }
});

function gameLoop() {
    if (!gameActive) return;
    
    // Рассчитываем быстрый рывок руки при ударе
    if (isPunching) {
        punchProgress += 0.2; // Скорость рывка рук
        if (punchProgress >= Math.PI) {
            isPunching = false;
            punchProgress = 0;
        }
    }

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
    let sx = obj.x - cx;
    let sy = obj.y - cy;
    
    // Если это постройка игрока (стена, шипы, дверь), выравниваем строго по клеткам
    if (obj.type.includes('wall') || obj.type === 'spike' || obj.type === 'door') {
        sx = Math.floor(obj.x / GRID_SIZE) * GRID_SIZE - cx + GRID_SIZE/2;
        sy = Math.floor(obj.y / GRID_SIZE) * GRID_SIZE - cy + GRID_SIZE/2;
    }

    if (sx < -100 || sx > canvas.width + 100 || sy < -100 || sy > canvas.height + 100) return;

    if (obj.type === 'door') {
        // Отрисовка двери (меняет вид, если открыта/закрыта)
        c.fillStyle = obj.isOpen ? '#e67e22' : '#d35400';
        c.strokeStyle = '#5e2700';
        c.lineWidth = 4;
        c.fillRect(sx - 20, sy - 20, 40, 40);
        c.strokeRect(sx - 20, sy - 20, 40, 40);
        
        // Значок замка/ручки
        c.fillStyle = '#fff';
        c.font = '10px Arial';
        c.fillText(obj.isOpen ? "🔑 OPEN" : "🔒 LOCK", sx, sy + 4);
    } else if (obj.type.includes('wall')) {
        // Квадратные блоки стен строго по сетке
        c.fillStyle = obj.type === 'wood_wall' ? '#a0522d' : '#708090';
        c.strokeStyle = '#333';
        c.lineWidth = 4;
        c.fillRect(sx - 22, sy - 22, 44, 44);
        c.strokeRect(sx - 22, sy - 22, 44, 44);
    } else {
        // Обычные круглые ресурсы (деревья, камни)
        c.beginPath(); c.arc(sx, sy, obj.radius, 0, Math.PI * 2);
        c.fillStyle = obj.type === 'tree' ? '#2e5c1e' : '#7a7a7a'; 
        c.strokeStyle = obj.type === 'tree' ? '#1f3d14' : '#555';
        c.lineWidth = 5; c.fill(); c.stroke();
    }
}

function drawPlayer(c, p, cx, cy, isMe) {
    const sx = p.x - cx, sy = p.y - cy;
    c.save(); c.translate(sx, sy); c.rotate(p.angle);
    
    // Вычисляем смещение рук с учётом синуса анимации удара
    const punchOffset = isMe && isPunching ? Math.sin(punchProgress) * 15 : 0;

    c.fillStyle = '#e0ac69'; c.strokeStyle = '#333'; c.lineWidth = 3;
    
    // Левая рука
    c.beginPath(); c.arc(20, -20, 10, 0, Math.PI * 2); c.fill(); c.stroke();
    // Правая рука (бьет вперед с эффектом подергивания)
    c.beginPath(); c.arc(20 + punchOffset, 20, 10, 0, Math.PI * 2); c.fill(); c.stroke();

    // Отрисовка УДЕРЖИВАЕМОГО ПРЕДМЕТА в правой руке
    if (p.activeItem && p.activeItem !== 'empty') {
        c.fillStyle = ITEM_TYPES[p.activeItem]?.color || '#fff';
        c.strokeStyle = '#222';
        c.lineWidth = 2;
        
        if (p.activeItem === 'sword') {
            c.fillRect(25 + punchOffset, 17, 30, 6); // Меч
        } else if (p.activeItem === 'axe' || p.activeItem === 'pickaxe') {
            c.fillRect(25 + punchOffset, 18, 20, 4); // Древко
            c.fillRect(40 + punchOffset, 10, 6, 20); // Обух топора/кирки
        } else if (p.activeItem.includes('wall') || p.activeItem === 'spike' || p.activeItem === 'door') {
            c.fillRect(22 + punchOffset, 10, 15, 15); // Превью блока здания в руке
        }
    }

    // Тело игрока
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
        const slotEl = document.querySelector(`#hotbar .slot[data-slot="${slotNum}"]`);
        const slotText = slotEl?.querySelector('.slot-icon');
        if (slotText) {
            const itemKey = hotbar[slotNum] || 'empty';
            const itemData = ITEM_TYPES[itemKey];
            
            // Ставим английское название текстом четко
            slotText.innerText = itemData ? itemData.label : 'Empty';
            
            // Подкрашиваем рамку слота под цвет предмета, чтобы было ВИДНО, а не просто текст
            if (itemKey !== 'empty') {
                slotEl.style.border = `3px solid ${itemData.color}`;
                slotEl.style.backgroundColor = 'rgba(255,255,255,0.1)';
            } else {
                slotEl.style.border = '2px solid #555';
                slotEl.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
            }
        }
    }
}
