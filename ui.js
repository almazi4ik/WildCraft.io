document.getElementById('btn-play').addEventListener('click', () => {
    document.getElementById('main-menu').style.display = 'none';
});

window.keys = { w: false, a: false, s: false, d: false };

window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (window.keys.hasOwnProperty(key)) window.keys[key] = true;
});

window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (window.keys.hasOwnProperty(key)) window.keys[key] = false;
});

setInterval(() => {
    let dx = 0; let dy = 0;
    if (window.keys.w) dy -= 1;
    if (window.keys.s) dy += 1;
    if (window.keys.a) dx -= 1;
    if (window.keys.d) dx += 1;

    if (dx !== 0 || dy !== 0) {
        const length = Math.sqrt(dx * dx + dy * dy);
        dx /= length; dy /= length;
        window.socket.emit('move', { dx, dy });
    }
}, 1000 / 60);
