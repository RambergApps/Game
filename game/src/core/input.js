// Tastatur + mus. pressed()/released() gjelder ett fast steg (nullstilles av endFrame()).
export function createInput(canvas) {
  const down = new Set(), pressed = new Set(), released = new Set();
  const mouse = { x: 0, y: 0, worldX: 0, worldY: 0, left: false, right: false, leftPressed: false, rightPressed: false, wheel: 0 };
  addEventListener('keydown', (e) => {
    if (['Space', 'Tab', 'F1', 'ArrowUp', 'ArrowDown', 'ShiftLeft', 'ShiftRight'].includes(e.code)) e.preventDefault();
    if (!down.has(e.code)) pressed.add(e.code); down.add(e.code);
  });
  addEventListener('keyup', (e) => { down.delete(e.code); released.add(e.code); });
  const reset = () => { down.clear(); pressed.clear(); released.clear(); mouse.left = mouse.right = false; };
  addEventListener('blur', reset);
  document.addEventListener('visibilitychange', () => { if (document.hidden) reset(); });
  const pos = (e) => { const r = canvas.getBoundingClientRect(); mouse.x = (e.clientX - r.left) * (canvas.width / r.width); mouse.y = (e.clientY - r.top) * (canvas.height / r.height); };
  canvas.addEventListener('mousemove', pos);
  canvas.addEventListener('mousedown', (e) => { pos(e); if (e.button === 0) { mouse.left = true; mouse.leftPressed = true; } if (e.button === 2) { mouse.right = true; mouse.rightPressed = true; } });
  addEventListener('mouseup', (e) => { if (e.button === 0) mouse.left = false; if (e.button === 2) mouse.right = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('wheel', (e) => { mouse.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
  return {
    mouse,
    down: (code) => down.has(code),
    pressed: (code) => pressed.has(code),
    released: (code) => released.has(code),
    /** Oppdater mouse.worldX/Y fra kamera (kalles først i hvert steg). */
    sync(camera) { const w = camera.screenToWorld(mouse.x, mouse.y); mouse.worldX = w.x; mouse.worldY = w.y; },
    /** Slipp alle holdte taster/knapper (kalles ved pause, kortvalg, mellomsekvens- og menylukking). */
    reset,
    endFrame() { pressed.clear(); released.clear(); mouse.leftPressed = mouse.rightPressed = false; mouse.wheel = 0; },
  };
}
