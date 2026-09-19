import type { Vec2 } from './math';

export type ActionName =
  | 'up' | 'down' | 'left' | 'right'
  | 'attack' | 'heavy' | 'offhand' | 'artifact' | 'potion'
  | 'interact' | 'inventory' | 'map' | 'quests' | 'character' | 'skills'
  | 'pause' | 'dash' | 'slot1' | 'slot2' | 'slot3' | 'slot4' | 'slot5' | 'weaponPower' | 'debug' | 'minimap' | 'travel' | 'brace' | 'target';

export const DEFAULT_BINDINGS: Record<ActionName, string[]> = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  attack: ['Space'],
  heavy: ['KeyG'],
  offhand: ['KeyF'],
  artifact: ['KeyR'],
  potion: ['KeyQ'],
  interact: ['KeyE'],
  inventory: ['KeyI', 'Tab'],
  map: ['KeyM'],
  quests: ['KeyJ'],
  character: ['KeyC'],
  skills: ['KeyK'],
  pause: ['Escape', 'KeyP'],
  dash: ['ShiftLeft', 'ShiftRight'],
  slot1: ['Digit1'],
  slot2: ['Digit2'],
  slot3: ['Digit3'],
  slot4: ['Digit4'],
  slot5: ['Digit5'],
  weaponPower: ['KeyV'],
  debug: ['F3'],
  minimap: ['KeyN'],
  travel: ['KeyT'],
  brace: ['KeyB'],
  target: ['KeyX'],
};

/**
 * Keyboard + mouse state. Edge state ("pressed this frame") is cleared by
 * {@link Input.endFrame} so systems can poll instead of subscribing.
 */
export class Input {
  bindings: Record<ActionName, string[]> = structuredClone(DEFAULT_BINDINGS);

  private down = new Set<string>();
  private pressed = new Set<string>();
  private released = new Set<string>();

  mouse: Vec2 = { x: 0, y: 0 };
  /** Mouse position in world space — updated by the renderer each frame. */
  world: Vec2 = { x: 0, y: 0 };
  mouseDown = [false, false, false];
  mousePressed = [false, false, false];
  wheel = 0;
  /** Set while a modal UI panel owns the keyboard. */
  uiCapture = false;
  /** Seconds since the mouse last moved; keyboard aiming takes over when this grows. */
  mouseIdle = 99;
  hasMouse = false;

  /**
   * Touch input, written by the on-screen controls. It is kept apart from the
   * keyboard sets rather than faking key codes, so a finger on the stick and a
   * finger on a button are simply two independent facts and neither can clear
   * the other.
   */
  private virtualDown = new Set<ActionName>();
  private virtualPressed = new Set<ActionName>();
  /** Analog stick vector, already clamped to length 1. Null when untouched. */
  stick: Vec2 | null = null;
  /**
   * True while the on-screen controls are up. Touches then belong to the
   * controls, so a tap on the world does not also swing the weapon.
   */
  touchMode = false;

  private listeners: Array<[EventTarget, string, EventListenerOrEventListenerObject]> = [];

  /** Called by the on-screen controls when a button goes down or comes up. */
  setVirtual(action: ActionName, down: boolean): void {
    if (down) {
      if (!this.virtualDown.has(action)) this.virtualPressed.add(action);
      this.virtualDown.add(action);
    } else {
      this.virtualDown.delete(action);
    }
  }

  /** Release everything the on-screen controls were holding. */
  clearVirtual(): void {
    this.virtualDown.clear();
    this.stick = null;
  }

  attach(canvas: HTMLCanvasElement): void {
    const add = (t: EventTarget, type: string, fn: EventListenerOrEventListenerObject, opts?: AddEventListenerOptions) => {
      t.addEventListener(type, fn, opts);
      this.listeners.push([t, type, fn]);
    };

    add(window, 'keydown', (e) => {
      const ev = e as KeyboardEvent;
      if (ev.code === 'Tab' || ev.code === 'F3' || ev.code.startsWith('Arrow') || ev.code === 'Space') ev.preventDefault();
      if (ev.repeat) return;
      this.down.add(ev.code);
      this.pressed.add(ev.code);
    });
    add(window, 'keyup', (e) => {
      const ev = e as KeyboardEvent;
      this.down.delete(ev.code);
      this.released.add(ev.code);
    });
    add(window, 'blur', () => {
      this.down.clear();
      this.mouseDown = [false, false, false];
    });
    add(canvas, 'contextmenu', (e) => e.preventDefault());
    add(canvas, 'mousemove', (e) => {
      const ev = e as MouseEvent;
      const r = canvas.getBoundingClientRect();
      const nx = ((ev.clientX - r.left) / r.width) * canvas.width;
      const ny = ((ev.clientY - r.top) / r.height) * canvas.height;
      if (Math.abs(nx - this.mouse.x) + Math.abs(ny - this.mouse.y) > 1) {
        this.mouseIdle = 0;
        this.hasMouse = true;
      }
      this.mouse.x = nx;
      this.mouse.y = ny;
    });
    add(canvas, 'mousedown', (e) => {
      const ev = e as MouseEvent;
      // With the on-screen controls up, the world is a view, not a button:
      // the browser synthesises a click from every tap, and without this every
      // tap on the scenery also swings the weapon.
      if (this.touchMode) return;
      if (ev.button < 3) {
        this.mouseDown[ev.button] = true;
        this.mousePressed[ev.button] = true;
      }
    });
    add(window, 'mouseup', (e) => {
      const ev = e as MouseEvent;
      if (ev.button < 3) this.mouseDown[ev.button] = false;
    });
    add(canvas, 'wheel', (e) => {
      this.wheel += (e as WheelEvent).deltaY;
    }, { passive: true });
  }

  detach(): void {
    for (const [t, type, fn] of this.listeners) t.removeEventListener(type, fn);
    this.listeners = [];
  }

  isDown(action: ActionName): boolean {
    if (this.uiCapture) return false;
    if (this.virtualDown.has(action)) return true;
    for (const code of this.bindings[action]) if (this.down.has(code)) return true;
    return false;
  }

  /** True on the frame the action went down. Works even while UI has capture (for panel toggles). */
  wasPressed(action: ActionName, ignoreCapture = false): boolean {
    if (this.uiCapture && !ignoreCapture) return false;
    if (this.virtualPressed.has(action)) return true;
    for (const code of this.bindings[action]) if (this.pressed.has(code)) return true;
    return false;
  }

  wasReleased(action: ActionName): boolean {
    for (const code of this.bindings[action]) if (this.released.has(code)) return true;
    return false;
  }

  /** Normalised movement vector from the four direction actions, or the stick. */
  moveVector(): Vec2 {
    // The stick is analog: a light push walks, a full push runs. Ignoring the
    // magnitude is the single thing that makes a virtual stick feel wrong.
    if (this.stick && !this.uiCapture) return { x: this.stick.x, y: this.stick.y };
    let x = 0;
    let y = 0;
    if (this.isDown('left')) x -= 1;
    if (this.isDown('right')) x += 1;
    if (this.isDown('up')) y -= 1;
    if (this.isDown('down')) y += 1;
    if (x !== 0 && y !== 0) {
      const inv = Math.SQRT1_2;
      x *= inv;
      y *= inv;
    }
    return { x, y };
  }

  tick(dt: number): void {
    this.mouseIdle += dt;
  }

  endFrame(): void {
    this.pressed.clear();
    this.released.clear();
    this.virtualPressed.clear();
    this.mousePressed = [false, false, false];
    this.wheel = 0;
  }

  /** Human readable label for the first key bound to an action. */
  keyLabel(action: ActionName): string {
    const code = this.bindings[action][0] ?? '';
    return code.replace(/^Key|^Digit/, '').replace('Left', '').replace('Escape', 'ESC') || code;
  }
}
