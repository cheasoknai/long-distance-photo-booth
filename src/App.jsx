import React, { useState, useRef, useEffect, useCallback, useId } from 'react';
import {
  Camera, Copy, Check, Download, RefreshCw, Users, Link2, Upload, Play, Palette,
  Type, ArrowRight, ArrowLeft, Undo2, Trash2, LogIn, Plus, Smile, X,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const FILTERS = [
  { id: 'normal', label: 'Normal', css: 'none', dot: 'linear-gradient(135deg,#f5eefc,#aa9fbc)' },
  { id: 'bw', label: 'Black & White', css: 'grayscale(1) contrast(1.1)', dot: 'linear-gradient(135deg,#fff,#222)' },
  { id: 'sepia', label: 'Sepia', css: 'sepia(0.85) contrast(1.05) brightness(1.05)', dot: 'linear-gradient(135deg,#e8c99a,#6b4a28)' },
  { id: 'cyber', label: 'Cyberpunk', css: 'saturate(1.9) contrast(1.25) hue-rotate(-25deg) brightness(0.92)', dot: 'linear-gradient(135deg,#00f0ff,#ff2bd6)' },
  { id: 'vintage', label: 'Warm Vintage', css: 'sepia(0.35) saturate(1.3) contrast(0.95) brightness(1.08)', dot: 'linear-gradient(135deg,#ffd9a0,#d98a4e)' },
];

const FRAMES = [
  { id: 'classic', label: 'Classic White', bg: '#ffffff', ink: '#1a1a1a', sub: '#707070', accent: '#1a1a1a', edge: '#e6e6e6' },
  { id: 'cyber', label: 'Cyberpunk Dark', bg: '#0b0a17', ink: '#e9fbff', sub: '#7fe9f5', accent: '#00f0ff', edge: '#ff2bd6' },
  { id: 'pink', label: 'Pastel Pink', bg: '#ffd9e6', ink: '#6e1d43', sub: '#a4577f', accent: '#ff7fae', edge: '#ffffff' },
  { id: 'vintage', label: 'Vintage Cream', bg: '#f2e8d0', ink: '#4f3a22', sub: '#8a7050', accent: '#b38650', edge: '#fff8e6' },
  { id: 'retro', label: 'Retro Yellow', bg: '#ffd23f', ink: '#2a1d14', sub: '#6a4a1e', accent: '#e4572e', edge: '#2a1d14' },
];

const STICKERS = ['💖', '✌️', '✨', '🧸', '🐱', '🌸'];
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const YEAR = new Date().getFullYear();
const DATE_TEXT = new Date()
  .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  .toUpperCase();

// Strip geometry in logical pixels. The preview draws at 1x, the PNG export at 2x.
const SW = 1200;
const PAD = 64;
const GAP = 32;
const PH = (SW - PAD * 2 - GAP) / 2;
const RY = 170;
const ROWS_H = PH * 3 + GAP * 2;
const SH = RY + ROWS_H + 246;

const DISPLAY = "'Bricolage Grotesque', system-ui, sans-serif";
const MONO = "'DM Mono', ui-monospace, monospace";
const EMOJI = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function makeCode() {
  const arr = new Uint32Array(6);
  try {
    crypto.getRandomValues(arr);
  } catch {
    for (let i = 0; i < 6; i++) arr[i] = Math.floor(Math.random() * 4e9);
  }
  return Array.from(arr, (n) => CODE_CHARS[n % CODE_CHARS.length]).join('');
}

function shareLink(code) {
  try {
    const u = new URL(window.location.href);
    u.hash = code;
    return u.toString();
  } catch {
    return '#' + code;
  }
}

async function copyText(text, inputEl) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    /* fall through to the selection fallback */
  }
  try {
    if (inputEl) {
      inputEl.focus();
      inputEl.select();
      return document.execCommand('copy');
    }
  } catch {
    /* ignore */
  }
  return false;
}

function srcSize(el) {
  if (!el) return [0, 0];
  if (el.videoWidth) return [el.videoWidth, el.videoHeight];
  if (el.naturalWidth) return [el.naturalWidth, el.naturalHeight];
  return [el.width || 0, el.height || 0];
}

// Fallback for browsers whose canvas has no ctx.filter.
function pixelFilter(ctx, size, id) {
  const im = ctx.getImageData(0, 0, size, size);
  const d = im.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    if (id === 'bw') {
      d[i] = d[i + 1] = d[i + 2] = y;
    } else if (id === 'sepia') {
      d[i] = 0.393 * r + 0.769 * g + 0.189 * b;
      d[i + 1] = 0.349 * r + 0.686 * g + 0.168 * b;
      d[i + 2] = 0.272 * r + 0.534 * g + 0.131 * b;
    } else if (id === 'cyber') {
      d[i] = (r - 128) * 1.2 + 142;
      d[i + 1] = (g - 128) * 1.2 + 120;
      d[i + 2] = (b - 128) * 1.2 + 158;
    } else if (id === 'vintage') {
      d[i] = r * 1.08 + 10;
      d[i + 1] = g * 1.02 + 4;
      d[i + 2] = b * 0.84;
    }
  }
  ctx.putImageData(im, 0, 0);
}

// Center-crops a feed to a square, mirrors it if asked, applies the filter, returns a JPEG data URL.
function captureSquare(el, { css, id, mirror }) {
  const [sw, sh] = srcSize(el);
  if (!sw || !sh) return null;
  const size = 1080;
  const side = Math.min(sw, sh);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const native = 'filter' in ctx;
  ctx.save();
  if (native && css !== 'none') ctx.filter = css;
  if (mirror) {
    ctx.translate(size, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(el, (sw - side) / 2, (sh - side) / 2, side, side, 0, 0, size, size);
  ctx.restore();
  if (!native && id !== 'normal') pixelFilter(ctx, size, id);
  return c.toDataURL('image/jpeg', 0.92);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fitText(ctx, text, weight, family, max, start, min) {
  let size = start;
  ctx.font = `${weight} ${size}px ${family}`;
  while (size > min && ctx.measureText(text).width > max) {
    size -= 2;
    ctx.font = `${weight} ${size}px ${family}`;
  }
  return size;
}

// Renders the whole photo strip onto a canvas. k is the pixel scale (1 preview, 2 export).
function drawStrip(canvas, { imgs, frame: f, stickers, footer, names }, k) {
  canvas.width = SW * k;
  canvas.height = SH * k;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(k, 0, 0, k, 0, 0);
  const spaced = 'letterSpacing' in ctx;

  ctx.fillStyle = f.bg;
  ctx.fillRect(0, 0, SW, SH);

  // Theme texture
  if (f.id === 'cyber') {
    let g = ctx.createRadialGradient(SW * 0.15, 0, 10, SW * 0.15, 0, 900);
    g.addColorStop(0, 'rgba(255,43,214,0.28)');
    g.addColorStop(1, 'rgba(255,43,214,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, SW, SH);
    g = ctx.createRadialGradient(SW * 0.9, SH, 10, SW * 0.9, SH, 1000);
    g.addColorStop(0, 'rgba(0,240,255,0.25)');
    g.addColorStop(1, 'rgba(0,240,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, SW, SH);
  } else if (f.id === 'pink') {
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (let y = 40; y < SH; y += 56) {
      for (let x = (y / 56) % 2 ? 20 : 48; x < SW; x += 56) {
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, 7);
        ctx.fill();
      }
    }
  } else if (f.id === 'vintage') {
    const g = ctx.createRadialGradient(SW / 2, SH / 2, SW * 0.4, SW / 2, SH / 2, SH * 0.75);
    g.addColorStop(0, 'rgba(120,80,30,0)');
    g.addColorStop(1, 'rgba(120,80,30,0.22)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, SW, SH);
  } else if (f.id === 'retro') {
    ['#e4572e', '#ff8a3d', '#2a1d14'].forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.fillRect(0, SH - 70 + i * 16, SW, 16);
    });
  }

  // Inner frame line
  ctx.save();
  ctx.strokeStyle = f.accent;
  ctx.lineWidth = 4;
  if (f.id === 'cyber') {
    ctx.shadowColor = f.accent;
    ctx.shadowBlur = 18;
  }
  roundRect(ctx, 24, 24, SW - 48, SH - 48, 18);
  ctx.stroke();
  ctx.restore();

  // Header: title, then one name per column
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = f.sub;
  ctx.font = `500 22px ${MONO}`;
  if (spaced) ctx.letterSpacing = '7px';
  ctx.fillText('LONG DISTANCE PHOTO BOOTH', SW / 2, 82);
  if (spaced) ctx.letterSpacing = '0px';
  ctx.fillStyle = f.ink;
  names.forEach((nm, j) => {
    const cx = PAD + j * (PH + GAP) + PH / 2;
    fitText(ctx, nm, 700, DISPLAY, PH - 30, 36, 20);
    ctx.fillText(nm, cx, 140);
  });

  // Three rows, each a pair of photos
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 2; j++) {
      const x = PAD + j * (PH + GAP);
      const y = RY + i * (PH + GAP);
      const img = imgs[i * 2 + j];
      ctx.save();
      roundRect(ctx, x, y, PH, PH, 12);
      ctx.clip();
      if (img) {
        ctx.drawImage(img, x, y, PH, PH);
      } else {
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.fillRect(x, y, PH, PH);
      }
      ctx.restore();
      ctx.save();
      ctx.strokeStyle = f.id === 'cyber' ? (j ? f.accent : f.edge) : f.edge;
      ctx.lineWidth = 8;
      if (f.id === 'cyber') {
        ctx.shadowColor = ctx.strokeStyle;
        ctx.shadowBlur = 22;
      }
      roundRect(ctx, x, y, PH, PH, 12);
      ctx.stroke();
      ctx.restore();
    }
  }

  // Footer text and date
  const fy = RY + ROWS_H + 98;
  const text = footer || ' ';
  ctx.fillStyle = f.ink;
  fitText(ctx, text, 700, DISPLAY, SW - PAD * 2 - 40, 68, 26);
  ctx.fillText(text, SW / 2, fy);
  ctx.fillStyle = f.sub;
  ctx.font = `500 24px ${MONO}`;
  if (spaced) ctx.letterSpacing = '5px';
  ctx.fillText(DATE_TEXT, SW / 2, fy + 64);
  if (spaced) ctx.letterSpacing = '0px';

  // Stickers sit on top of everything
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  stickers.forEach((s) => {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.28)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 5;
    ctx.font = `${Math.round(s.s * SW)}px ${EMOJI}`;
    ctx.fillText(s.emoji, s.x * SW, s.y * SH);
    ctx.restore();
  });
}

/* ------------------------------------------------------------------ */
/* Small components                                                    */
/* ------------------------------------------------------------------ */

function Toast({ text }) {
  if (!text) return null;
  return (
    <div className="toast" role="status">
      {text}
    </div>
  );
}

function CopyField({ label, value, Icon, onFail }) {
  const id = useId();
  const [copied, setCopied] = useState(false);
  const ref = useRef(null);

  const doCopy = async () => {
    const ok = await copyText(value, ref.current);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } else {
      onFail('Copy was blocked. The text is selected, so copy it by hand.');
    }
  };

  return (
    <div>
      <label className="label flex items-center gap-1.5 mb-1.5" htmlFor={id}>
        {Icon && <Icon size={13} />}
        {label}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          ref={ref}
          readOnly
          value={value}
          className="field mono text-sm min-w-0"
          onFocus={(e) => e.target.select()}
        />
        <button type="button" className="btn btn-ghost shrink-0" onClick={doCopy} aria-label={`Copy ${label}`}>
          {copied ? <Check size={16} /> : <Copy size={16} />}
          <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
    </div>
  );
}

function FilterChips({ value, onChange, disabled }) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Live filter">
      {FILTERS.map((f) => (
        <button
          key={f.id}
          type="button"
          className="chip"
          aria-pressed={value === f.id}
          disabled={disabled}
          onClick={() => onChange(f.id)}
        >
          <span className="dot" style={{ background: f.dot }} />
          {f.label}
        </button>
      ))}
    </div>
  );
}

// Animated stand-in for a camera: the simulated partner, or you when no camera is reachable.
function SyntheticFeed({ variant, onEl }) {
  const ref = useRef(null);

  useEffect(() => {
    onEl(ref.current);
    return () => onEl(null);
  }, [onEl]);

  useEffect(() => {
    const cv = ref.current;
    const ctx = cv.getContext('2d');
    const partner = variant === 'partner';
    const pal = partner
      ? { a: '#23406b', b: '#59d6c6', skin: '#f3c9a5', hair: '#2b1d2f', top: '#2e8f86' }
      : { a: '#5a2147', b: '#ff9a76', skin: '#e8b894', hair: '#1d1530', top: '#c2456f' };
    const still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t0 = performance.now();
    let raf;

    const draw = (now) => {
      const t = still ? 1 : (now - t0) / 1000;
      const W = cv.width, H = cv.height;
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, pal.a);
      g.addColorStop(1, pal.b);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      for (let i = 0; i < 9; i++) {
        const x = (Math.sin(t * 0.3 + i * 1.7) * 0.5 + 0.5) * W;
        const y = (Math.cos(t * 0.25 + i * 2.3) * 0.5 + 0.5) * H;
        ctx.fillStyle = `rgba(255,255,255,${0.05 + (i % 3) * 0.03})`;
        ctx.beginPath();
        ctx.arc(x, y, 30 + ((i * 37) % 50), 0, 7);
        ctx.fill();
      }

      const bob = Math.sin(t * 1.6) * 8;
      const sway = Math.sin(t * 0.9) * 16;
      const cx = W / 2 + sway;
      ctx.fillStyle = pal.top;
      ctx.beginPath();
      ctx.ellipse(W / 2 + sway * 0.5, H * 1.02 + bob * 0.5, W * 0.34, H * 0.26, 0, 0, 7);
      ctx.fill();
      ctx.fillStyle = pal.skin;
      ctx.fillRect(cx - 26, H * 0.62 + bob, 52, 70);
      ctx.beginPath();
      ctx.ellipse(cx, H * 0.46 + bob, 92, 108, 0, 0, 7);
      ctx.fill();
      ctx.fillStyle = pal.hair;
      ctx.beginPath();
      ctx.ellipse(cx, H * 0.4 + bob, 98, 86, 0, Math.PI, 0);
      ctx.fill();

      const blink = t % 4 > 3.85 ? 0.1 : 1;
      ctx.fillStyle = '#1b1220';
      [-34, 34].forEach((dx) => {
        ctx.beginPath();
        ctx.ellipse(cx + dx, H * 0.47 + bob, 9, 12 * blink, 0, 0, 7);
        ctx.fill();
      });
      ctx.fillStyle = 'rgba(255,93,143,0.35)';
      [-58, 58].forEach((dx) => {
        ctx.beginPath();
        ctx.ellipse(cx + dx, H * 0.525 + bob, 16, 10, 0, 0, 7);
        ctx.fill();
      });
      ctx.strokeStyle = '#1b1220';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(cx, H * 0.5 + bob, 36, 0.2 * Math.PI, 0.8 * Math.PI);
      ctx.stroke();

      if (!still) raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [variant]);

  return <canvas ref={ref} width={640} height={640} className="absolute inset-0 w-full h-full" />;
}

function SelfFeed({ source, stream, onEl }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (source.type === 'camera' && stream) {
      el.srcObject = stream;
      const p = el.play();
      if (p && p.catch) p.catch(() => {});
    }
    onEl(el);
    return () => onEl(null);
  }, [source, stream, onEl]);

  if (source.type === 'sample') return <SyntheticFeed variant="me" onEl={onEl} />;

  if (source.type === 'file' && source.kind === 'image') {
    return (
      <img ref={ref} src={source.url} alt="Your uploaded photo" className="absolute inset-0 w-full h-full object-cover" />
    );
  }

  return (
    <video
      ref={ref}
      src={source.type === 'file' ? source.url : undefined}
      autoPlay
      muted
      playsInline
      loop={source.type === 'file'}
      className="absolute inset-0 w-full h-full object-cover"
      style={{ transform: source.type === 'camera' ? 'scaleX(-1)' : 'none' }}
    />
  );
}

function Tile({ label, tag, filterCss, children }) {
  return (
    <div
      className="relative aspect-square w-full overflow-hidden rounded-3xl"
      style={{ border: '1px solid var(--line)', background: 'var(--ink2)' }}
    >
      <div className="absolute inset-0" style={{ filter: filterCss }}>
        {children}
      </div>
      <div className="absolute left-3 bottom-3 right-3 flex items-center justify-between gap-2">
        <span
          className="rounded-full px-3 py-1 text-sm font-semibold"
          style={{ background: 'var(--scrim)', WebkitBackdropFilter: 'blur(8px)', backdropFilter: 'blur(8px)' }}
        >
          {label}
        </span>
        {tag && (
          <span className="eyebrow rounded-full px-2.5 py-1" style={{ background: 'var(--scrim)', color: 'var(--text)' }}>
            {tag}
          </span>
        )}
      </div>
    </div>
  );
}

function Steps({ phase, canBooth, canStrip, go }) {
  const items = [
    { id: 'setup', n: 'Room', ok: true },
    { id: 'booth', n: 'Booth', ok: canBooth },
    { id: 'result', n: 'Strip', ok: canStrip },
  ];
  return (
    <nav className="flex items-center gap-1.5" aria-label="Steps">
      {items.map((s, i) => (
        <React.Fragment key={s.id}>
          <button type="button" className="chip" aria-pressed={phase === s.id} disabled={!s.ok} onClick={() => go(s.id)}>
            {s.n}
          </button>
          {i < items.length - 1 && (
            <span aria-hidden="true" style={{ color: 'var(--muted)' }}>/</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/* App                                                                 */
/* ------------------------------------------------------------------ */

export default function App() {
  const hashCode = (() => {
    try {
      const h = (window.location.hash || '').replace('#', '').toUpperCase();
      return /^[A-Z0-9]{6}$/.test(h) ? h : '';
    } catch {
      return '';
    }
  })();

  const [phase, setPhase] = useState('setup'); // setup | booth | result
  const [entered, setEntered] = useState(false);
  const [name, setName] = useState('');
  const [partnerName, setPartnerName] = useState('');
  const [mode, setMode] = useState(hashCode ? 'join' : 'create');
  const [createdCode, setCreatedCode] = useState(makeCode);
  const [joinCode, setJoinCode] = useState(hashCode);
  const [filterId, setFilterId] = useState('normal');
  const [simulate, setSimulate] = useState(true);
  const [cam, setCam] = useState('idle');
  const [stream, setStream] = useState(null);
  const [source, setSource] = useState({ type: 'sample' });
  const [running, setRunning] = useState(false);
  const [shot, setShot] = useState(0);
  const [count, setCount] = useState(0);
  const [flashKey, setFlashKey] = useState(0);
  const [photos, setPhotos] = useState([]);
  const [imgs, setImgs] = useState([]);
  const [frameId, setFrameId] = useState('classic');
  const [stickers, setStickers] = useState([]);
  const [footer, setFooter] = useState('');
  const [footerTouched, setFooterTouched] = useState(false);
  const [fontsOk, setFontsOk] = useState(false);
  const [toast, setToast] = useState('');

  const streamRef = useRef(null);
  const selfElRef = useRef(null);
  const partnerElRef = useRef(null);
  const runRef = useRef(0);
  const stripRef = useRef(null);
  const dragRef = useRef(null);
  const toastTimer = useRef(null);

  const filter = FILTERS.find((f) => f.id === filterId);
  const frame = FRAMES.find((f) => f.id === frameId);
  const activeCode = mode === 'create' ? createdCode : joinCode;
  const names = [name.trim() || 'Me', partnerName.trim() || 'Partner'];
  const valid = name.trim().length > 0 && (mode === 'create' || joinCode.length === 6);

  // The capture loop runs across many renders, so it reads these through refs.
  const filterRef = useRef(filter);
  filterRef.current = filter;
  const sourceRef = useRef(source);
  sourceRef.current = source;

  const say = useCallback((t) => {
    setToast(t);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3200);
  }, []);
  const setSelfEl = useCallback((el) => { selfElRef.current = el; }, []);
  const setPartnerEl = useCallback((el) => { partnerElRef.current = el; }, []);

  // The footer follows the names until the person edits it.
  useEffect(() => {
    if (!footerTouched) setFooter(`${names[0]} & ${names[1]} • ${YEAR}`);
  }, [name, partnerName, footerTouched]); // eslint-disable-line react-hooks/exhaustive-deps

  // Wait for the web fonts so the canvas strip does not draw with fallbacks.
  useEffect(() => {
    if (!document.fonts || !document.fonts.load) {
      setFontsOk(true);
      return;
    }
    Promise.all([
      document.fonts.load("700 40px 'Bricolage Grotesque'"),
      document.fonts.load("500 20px 'DM Mono'"),
    ])
      .catch(() => {})
      .then(() => setFontsOk(true));
  }, []);

  // Camera
  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCam('unsupported');
      setSource({ type: 'sample' });
      return;
    }
    setCam('requesting');
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = s;
      setStream(s);
      setSource({ type: 'camera' });
      setCam('live');
    } catch (e) {
      setCam(e && e.name === 'NotAllowedError' ? 'denied' : 'error');
      if (sourceRef.current.type !== 'camera') setSource({ type: 'sample' });
    }
  }, []);

  useEffect(() => {
    startCamera();
    return () => {
      runRef.current += 1;
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, [startCamera]);

  const onFile = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const kind = file.type.startsWith('image') ? 'image' : file.type.startsWith('video') ? 'video' : '';
    if (!kind) {
      say('Pick a video or photo file.');
      return;
    }
    if (sourceRef.current.type === 'file') URL.revokeObjectURL(sourceRef.current.url);
    setSource({ type: 'file', url: URL.createObjectURL(file), kind });
    e.target.value = '';
  };

  // Capture sequence: 3 shots, a 3-2-1 countdown before each, flash on every snapshot.
  const startSession = async () => {
    if (running) return;
    runRef.current += 1;
    const id = runRef.current;
    setPhotos([]);
    setStickers([]);
    setRunning(true);
    const taken = [];

    for (let i = 0; i < 3; i++) {
      setShot(i);
      for (let c = 3; c >= 1; c--) {
        setCount(c);
        await sleep(1000);
        if (runRef.current !== id) return;
      }
      setCount(0);

      const f = filterRef.current;
      const me = captureSquare(selfElRef.current, { css: f.css, id: f.id, mirror: sourceRef.current.type === 'camera' });
      const partner = captureSquare(partnerElRef.current, { css: f.css, id: f.id, mirror: false });
      if (!me || !partner) {
        setRunning(false);
        setPhotos([]);
        say('A feed was not ready. Check both previews and start again.');
        return;
      }
      setFlashKey((k) => k + 1);
      taken.push({ me, partner });
      setPhotos(taken.slice());
      await sleep(1100);
      if (runRef.current !== id) return;
    }

    setRunning(false);
    setPhase('result');
  };

  const cancelSession = () => {
    runRef.current += 1;
    setRunning(false);
    setCount(0);
    setPhotos([]);
  };

  const retake = () => {
    runRef.current += 1;
    setRunning(false);
    setCount(0);
    setPhotos([]);
    setStickers([]);
    setPhase('booth');
  };

  // Decode the captured photos into images the strip canvas can draw.
  useEffect(() => {
    if (photos.length < 3) {
      setImgs([]);
      return undefined;
    }
    let live = true;
    Promise.all(
      photos
        .flatMap((p) => [p.me, p.partner])
        .map(
          (src) =>
            new Promise((res) => {
              const im = new Image();
              im.onload = () => res(im);
              im.onerror = () => res(null);
              im.src = src;
            })
        )
    ).then((list) => {
      if (live) setImgs(list);
    });
    return () => { live = false; };
  }, [photos]);

  // Redraw the strip preview whenever anything on it changes.
  useEffect(() => {
    if (phase !== 'result' || !stripRef.current) return;
    drawStrip(stripRef.current, { imgs, frame, stickers, footer, names }, 1);
  }, [phase, imgs, frameId, stickers, footer, name, partnerName, fontsOk]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stickers
  const addSticker = (emoji) => {
    setStickers((list) => [
      ...list,
      { id: Date.now() + Math.random(), emoji, x: 0.15 + Math.random() * 0.7, y: 0.12 + Math.random() * 0.76, s: 0.13 },
    ]);
  };

  const toStrip = (e) => {
    const r = stripRef.current.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };

  const onDown = (e) => {
    const p = toStrip(e);
    for (let i = stickers.length - 1; i >= 0; i--) {
      const s = stickers[i];
      const rx = s.s * 0.55;
      const ry = ((s.s * SW) / SH) * 0.55;
      if (Math.abs(p.x - s.x) < rx && Math.abs(p.y - s.y) < ry) {
        dragRef.current = { idx: i, dx: s.x - p.x, dy: s.y - p.y };
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
        return;
      }
    }
  };

  const onMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const p = toStrip(e);
    setStickers((list) =>
      list.map((s, i) =>
        i === d.idx ? { ...s, x: clamp(p.x + d.dx, 0.02, 0.98), y: clamp(p.y + d.dy, 0.02, 0.98) } : s
      )
    );
  };

  const onUp = () => { dragRef.current = null; };

  // Export a 2400px-wide PNG
  const exportPng = async () => {
    if (imgs.length < 6) return;
    const off = document.createElement('canvas');
    drawStrip(off, { imgs, frame, stickers, footer, names }, 2);
    const blob = await new Promise((r) => off.toBlob(r, 'image/png'));
    if (!blob) {
      say('Could not render the image. Try again.');
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `photo-strip-${activeCode || 'booth'}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    say('Photo strip downloaded.');
  };

  const go = (id) => {
    if (running) return;
    if (id === 'booth' && !entered) return;
    if (id === 'result' && photos.length < 3) return;
    setPhase(id);
  };

  const enter = () => {
    if (!valid) return;
    setEntered(true);
    setPhase('booth');
    try { window.history.replaceState(null, '', `#${activeCode}`); } catch { /* ignore */ }
  };

  const camMsg = {
    requesting: 'Asking for camera access…',
    live: 'Camera is live.',
    denied: 'Camera access was blocked. Allow it in your browser, retry, load a video or photo, or keep the animated sample.',
    unsupported: 'This browser has no camera support. Load a video or photo, or keep the animated sample.',
    error: 'The camera could not start. Retry, load a video or photo, or keep the animated sample.',
    idle: '',
  }[cam];

  const selfTag = source.type === 'camera' ? 'Live' : source.type === 'file' ? 'From file' : 'Sample';

  const selfTile = (
    <Tile label={names[0]} tag={selfTag} filterCss={filter.css}>
      <SelfFeed source={source} stream={stream} onEl={setSelfEl} />
    </Tile>
  );

  const fileInput = (
    <label className="btn btn-ghost cursor-pointer" htmlFor="feed-file">
      <Upload size={16} /> Use a video or photo
      <input id="feed-file" type="file" accept="video/*,image/*" className="sr-only" onChange={onFile} />
    </label>
  );

  /* ----- header ----- */
  const header = (
    <header className="flex flex-wrap items-center justify-between gap-3 mb-6">
      <div className="flex items-center gap-3">
        <span className="grid place-items-center w-10 h-10 rounded-2xl" style={{ background: 'var(--rose)', color: 'var(--onbright)' }}>
          <Camera size={20} />
        </span>
        <div>
          <div className="font-display font-bold text-lg leading-none">Long Distance Photo Booth</div>
          <div className="eyebrow mt-1">Two cameras, one strip</div>
        </div>
      </div>
      <Steps phase={phase} canBooth={entered && !running} canStrip={photos.length >= 3 && !running} go={go} />
    </header>
  );

  /* ----- step 1: room setup ----- */
  const setupView = (
    <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] items-start">
      <section className="glass p-6 sm:p-8 min-w-0">
        <div className="eyebrow">Step 1 · Room</div>
        <h1 className="font-display font-bold text-4xl sm:text-5xl leading-[1.02] tracking-tight mt-2 balance">
          Pose together, from anywhere.
        </h1>
        <p className="mt-3 max-w-md" style={{ color: 'var(--muted)' }}>
          Make a room, share the code, and take a three-shot strip with your person. Both of you end up on the same frame.
        </p>

        <div className="mt-6 grid gap-4">
          <div>
            <label className="label block mb-1.5" htmlFor="my-name">Your name</label>
            <input
              id="my-name"
              className="field"
              placeholder="Sokha"
              maxLength={24}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="given-name"
            />
          </div>

          <div className="flex gap-2" role="group" aria-label="Room action">
            <button type="button" className="chip flex-1 justify-center" aria-pressed={mode === 'create'} onClick={() => setMode('create')}>
              <Plus size={15} /> Create room
            </button>
            <button type="button" className="chip flex-1 justify-center" aria-pressed={mode === 'join'} onClick={() => setMode('join')}>
              <LogIn size={15} /> Join room
            </button>
          </div>

          {mode === 'create' ? (
            <div className="grid gap-4 rounded-2xl p-4" style={{ background: 'rgba(0,0,0,0.22)', border: '1px solid var(--line)' }}>
              <CopyField label="Room code" value={createdCode} Icon={Users} onFail={say} />
              <CopyField label="Room link" value={shareLink(createdCode)} Icon={Link2} onFail={say} />
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm" style={{ color: 'var(--muted)' }}>Send either one to your partner.</span>
                <button type="button" className="btn btn-ghost" onClick={() => setCreatedCode(makeCode())}>
                  <RefreshCw size={15} /> New code
                </button>
              </div>
            </div>
          ) : (
            <div>
              <label className="label block mb-1.5" htmlFor="join-code">Room code</label>
              <input
                id="join-code"
                className="field mono text-xl tracking-[0.3em] uppercase"
                placeholder="ABC123"
                maxLength={6}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                autoComplete="off"
              />
            </div>
          )}

          <div>
            <label className="label block mb-1.5" htmlFor="partner-name">
              Partner's name <span style={{ fontWeight: 400 }}>(printed on the strip)</span>
            </label>
            <input
              id="partner-name"
              className="field"
              placeholder="Bopha"
              maxLength={24}
              value={partnerName}
              onChange={(e) => setPartnerName(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="btn btn-primary btn-lg" disabled={!valid} onClick={enter}>
              {mode === 'create' ? 'Open the booth' : 'Join the booth'} <ArrowRight size={18} />
            </button>
            {!valid && (
              <span className="text-sm" style={{ color: 'var(--muted)' }}>
                {!name.trim() ? 'Add your name to continue.' : 'Enter the 6-character room code.'}
              </span>
            )}
          </div>

          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            This app does not open a live video link between two devices. Your partner appears as a simulated camera, so you can run the whole booth from start to finish.
          </p>
        </div>
      </section>

      <section className="grid gap-4 min-w-0">
        <div className="glass p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="eyebrow">Camera check</div>
            <span
              className={`eyebrow ${cam === 'requesting' ? 'pulse' : ''}`}
              style={{ color: cam === 'live' ? 'var(--teal)' : 'var(--muted)' }}
            >
              {cam === 'live' ? '● Live' : cam === 'requesting' ? 'Connecting' : 'Not connected'}
            </span>
          </div>
          {selfTile}
          <p className="mt-3 text-sm" style={{ color: 'var(--muted)' }} role="status">{camMsg}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="btn btn-ghost" onClick={startCamera} disabled={cam === 'requesting'}>
              <Camera size={16} /> {cam === 'live' ? 'Restart camera' : 'Retry camera'}
            </button>
            {fileInput}
            {source.type !== 'sample' && cam !== 'live' && (
              <button type="button" className="btn btn-ghost" onClick={() => setSource({ type: 'sample' })}>
                Use sample
              </button>
            )}
          </div>
        </div>
        <div className="glass p-4 sm:p-5">
          <div className="eyebrow mb-3">Live filter</div>
          <FilterChips value={filterId} onChange={setFilterId} />
        </div>
      </section>
    </div>
  );

  /* ----- step 2: booth ----- */
  const boothView = (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="chip" style={{ cursor: 'default' }}>
            <Users size={14} /> Room <span className="mono">{activeCode}</span>
          </span>
          <button type="button" className="chip" disabled={running} onClick={() => setPhase('setup')}>
            <ArrowLeft size={14} /> Room settings
          </button>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={simulate}
          className="chip"
          disabled={running}
          onClick={() => setSimulate(!simulate)}
        >
          <span className="dot" style={{ background: simulate ? 'var(--teal)' : 'transparent' }} />
          Simulate partner camera
        </button>
      </div>

      <div className="glass p-3 sm:p-5">
        <div className={`bulbs mb-4 ${running ? 'live' : ''}`} aria-hidden="true">
          {Array.from({ length: 16 }, (_, i) => (
            <span key={i} style={{ '--i': i }} />
          ))}
        </div>

        <div className="relative">
          <div className="grid gap-3 sm:grid-cols-2">
            {selfTile}
            {simulate ? (
              <Tile label={names[1]} tag="Simulated" filterCss={filter.css}>
                <SyntheticFeed variant="partner" onEl={setPartnerEl} />
              </Tile>
            ) : (
              <div
                className="relative aspect-square w-full rounded-3xl grid place-items-center text-center p-6"
                style={{ border: '1px dashed var(--line)', background: 'var(--ink2)' }}
              >
                <div>
                  <div className="mx-auto mb-3 grid place-items-center w-12 h-12 rounded-full pulse" style={{ background: 'var(--panel2)' }}>
                    <Users size={22} />
                  </div>
                  <div className="font-display font-bold text-xl">Waiting for {names[1]}</div>
                  <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
                    Turn on Simulate partner camera to try the full session.
                  </p>
                </div>
              </div>
            )}
          </div>

          {running && count > 0 && (
            <div
              className="absolute inset-0 grid place-items-center rounded-3xl"
              style={{ background: 'var(--scrim)' }}
              role="status"
              aria-live="assertive"
            >
              <div
                key={`${shot}-${count}`}
                className="count font-display font-extrabold"
                style={{ fontSize: 'clamp(6rem, 24vw, 12rem)', lineHeight: 1 }}
              >
                {count}
              </div>
            </div>
          )}
        </div>

        <div className="mt-5 grid gap-4">
          <FilterChips value={filterId} onChange={setFilterId} disabled={running} />

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5" aria-hidden="true">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-3 h-3 rounded-full"
                    style={{
                      background: i < photos.length ? 'var(--rose)' : 'var(--panel2)',
                      border: '1px solid var(--line)',
                      boxShadow: running && i === shot && i >= photos.length ? '0 0 0 3px rgba(255,93,143,0.35)' : 'none',
                    }}
                  />
                ))}
              </div>
              <span className="text-sm" style={{ color: 'var(--muted)' }}>
                {running ? `Shot ${shot + 1} of 3. Strike a pose together.` : 'Three shots, 3-2-1 before each one.'}
              </span>
            </div>
            <div className="flex gap-2">
              {running && (
                <button type="button" className="btn btn-ghost" onClick={cancelSession}>
                  <X size={16} /> Cancel
                </button>
              )}
              <button type="button" className="btn btn-primary btn-lg" disabled={running || !simulate} onClick={startSession}>
                <Play size={18} /> Start Photo Session
              </button>
            </div>
          </div>

          {photos.length > 0 && running && (
            <div className="flex gap-2 overflow-x-auto" aria-label="Shots so far">
              {photos.map((p, i) => (
                <div key={i} className="flex gap-1 shrink-0 rounded-xl p-1" style={{ background: 'var(--panel2)' }}>
                  <img src={p.me} alt={`Shot ${i + 1}, you`} className="w-14 h-14 rounded-lg object-cover" />
                  <img src={p.partner} alt={`Shot ${i + 1}, partner`} className="w-14 h-14 rounded-lg object-cover" />
                </div>
              ))}
            </div>
          )}

          {!simulate && (
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              A session needs two feeds. Turn on Simulate partner camera to start.
            </p>
          )}
        </div>
      </div>
    </div>
  );

  /* ----- step 3: strip ----- */
  const resultView = (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,430px)_1fr] items-start">
      <div className="min-w-0">
        <div className="mx-auto w-full max-w-[430px] rounded-md overflow-hidden" style={{ boxShadow: '0 30px 60px -20px rgba(0,0,0,0.6)' }}>
          <canvas
            ref={stripRef}
            className="block w-full h-auto select-none"
            style={{ touchAction: stickers.length ? 'none' : 'auto', cursor: stickers.length ? 'grab' : 'default' }}
            role="img"
            aria-label="Your photo strip preview"
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
          />
        </div>
        <p className="text-center text-sm mt-3" style={{ color: 'var(--muted)' }}>
          {stickers.length ? 'Drag a sticker to move it.' : 'Add stickers from the panel, then drag them into place.'}
        </p>
      </div>

      <div className="grid gap-4 min-w-0">
        <section className="glass p-5">
          <div className="flex items-center gap-2 mb-3">
            <Palette size={16} />
            <h2 className="font-display font-bold text-lg">Frame</h2>
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Frame theme">
            {FRAMES.map((f) => (
              <button key={f.id} type="button" className="chip" aria-pressed={frameId === f.id} onClick={() => setFrameId(f.id)}>
                <span className="dot" style={{ background: `linear-gradient(135deg,${f.bg} 50%,${f.accent} 50%)` }} />
                {f.label}
              </button>
            ))}
          </div>
        </section>

        <section className="glass p-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <Smile size={16} />
              <h2 className="font-display font-bold text-lg">Stickers</h2>
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn btn-ghost" disabled={!stickers.length} onClick={() => setStickers((l) => l.slice(0, -1))}>
                <Undo2 size={15} /> Undo
              </button>
              <button type="button" className="btn btn-ghost" disabled={!stickers.length} onClick={() => setStickers([])}>
                <Trash2 size={15} /> Clear
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {STICKERS.map((s) => (
              <button
                key={s}
                type="button"
                className="btn btn-ghost"
                style={{ width: 56, height: 56, padding: 0, fontSize: 26 }}
                aria-label={`Add sticker ${s}`}
                onClick={() => addSticker(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </section>

        <section className="glass p-5">
          <div className="flex items-center gap-2 mb-3">
            <Type size={16} />
            <h2 className="font-display font-bold text-lg">Footer text</h2>
          </div>
          <label className="sr-only" htmlFor="footer-text">Footer text</label>
          <input
            id="footer-text"
            className="field"
            maxLength={48}
            value={footer}
            placeholder="Sokha & Bopha • 2026"
            onChange={(e) => {
              setFooter(e.target.value);
              setFooterTouched(true);
            }}
          />
        </section>

        <div className="flex flex-wrap gap-3">
          <button type="button" className="btn btn-primary btn-lg" onClick={exportPng} disabled={imgs.length < 6}>
            <Download size={18} /> Download Photo Strip
          </button>
          <button type="button" className="btn btn-ghost btn-lg" onClick={retake}>
            <RefreshCw size={18} /> Retake Photos
          </button>
        </div>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>The download is a PNG at 2400 pixels wide.</p>
      </div>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-6xl">
      {header}
      {phase === 'setup' ? setupView : phase === 'booth' ? boothView : resultView}
      {flashKey > 0 && <div key={flashKey} className="flash" aria-hidden="true" />}
      <Toast text={toast} />
    </div>
  );
}
