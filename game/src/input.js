// input.js — keyboard + mouse-drag camera input. One clear job: read the player's
// hands and expose them as a plain state object the game loop consumes.
export function createInput(canvas) {
  const input = {
    keys: new Set(),
    camYaw: 0.6, camPitch: 0.35,
    pressed: new Set(), // keys pressed since last consume
  };
  const KEYMAP = {
    KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
    ShiftLeft: 'sprint', ShiftRight: 'sprint',
    KeyE: 'enter', KeyF: 'punch', KeyP: 'pause', KeyM: 'mute',
  };
  window.addEventListener('keydown', (e) => {
    const action = KEYMAP[e.code];
    if (!action) return;
    if (e.code === 'KeyE' || e.code === 'KeyF' || e.code === 'KeyP' || e.code === 'KeyM') {
      if (!e.repeat) input.pressed.add(action);
    }
    input.keys.add(action);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => {
    const action = KEYMAP[e.code];
    if (action) input.keys.delete(action);
  });
  let dragging = false, lastX = 0, lastY = 0;
  canvas.addEventListener('mousedown', (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; });
  window.addEventListener('mouseup', () => { dragging = false; });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    input.camYaw -= (e.clientX - lastX) * 0.005;
    input.camPitch = Math.max(0.08, Math.min(1.1, input.camPitch + (e.clientY - lastY) * 0.004));
    lastX = e.clientX; lastY = e.clientY;
  });
  // Touch: one finger drags the camera, on-screen buttons are not needed for desktop play.
  canvas.addEventListener('touchstart', (e) => { dragging = true; lastX = e.touches[0].clientX; lastY = e.touches[0].clientY; }, { passive: true });
  canvas.addEventListener('touchmove', (e) => {
    if (!dragging) return;
    input.camYaw -= (e.touches[0].clientX - lastX) * 0.006;
    input.camPitch = Math.max(0.08, Math.min(1.1, input.camPitch + (e.touches[0].clientY - lastY) * 0.005));
    lastX = e.touches[0].clientX; lastY = e.touches[0].clientY;
  }, { passive: true });
  canvas.addEventListener('touchend', () => { dragging = false; });
  return input;
}

// True once for each fresh press; call once per frame.
export function consumePress(input, action) {
  if (input.pressed.has(action)) { input.pressed.delete(action); return true; }
  return false;
}
export function clearPresses(input) { input.pressed.clear(); }
