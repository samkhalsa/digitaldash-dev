import { useEffect, useRef } from "react";

/**
 * a full-viewport canvas behind the page. the logo is floyd-steinberg
 * dithered at runtime so the halftone dots are the particles: they breathe
 * while idle, and scatter into dust as the reader scrolls into the story.
 *
 * source image: /logo.svg (any image works, dark pixels become dots).
 * respects prefers-reduced-motion: a still dither, no animation.
 */

type Particle = {
  sx: number; // logo-space x, -0.5..0.5
  sy: number; // logo-space y, -0.5..0.5
  dx: number; // scatter direction x
  dy: number; // scatter direction y
  dist: number; // scatter distance, in logo sizes
  delay: number; // 0..1, scatter delay by position
  phase: number; // idle phase
  speed: number; // idle speed
  arrow: boolean; // whether this dot joins the arrow at the end
  ax: number; // arrow-space x, -0.5..0.5 (normalised by arrow width)
  ay: number; // arrow-space y
  gdelay: number; // 0..1, gather delay
};

const LOGO_SRC = "/logo.svg";

function dither(img: HTMLImageElement, targetWidth: number): Particle[] {
  const w = targetWidth;
  const h = Math.max(1, Math.round((w * img.naturalHeight) / img.naturalWidth));
  const off = document.createElement("canvas");
  off.width = w;
  off.height = h;
  const octx = off.getContext("2d", { willReadFrequently: true });
  if (!octx) return [];
  octx.fillStyle = "#fff";
  octx.fillRect(0, 0, w, h);
  octx.drawImage(img, 0, 0, w, h);
  const src = octx.getImageData(0, 0, w, h).data;

  // luminance, with alpha composited over white
  const g = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const j = i * 4;
    const a = src[j + 3] / 255;
    const lum = (src[j] * 0.299 + src[j + 1] * 0.587 + src[j + 2] * 0.114) * a + 255 * (1 - a);
    g[i] = lum;
  }

  // floyd-steinberg error diffusion to 1 bit
  const dark: Array<[number, number]> = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const old = g[i];
      const nv = old < 128 ? 0 : 255;
      const err = old - nv;
      g[i] = nv;
      if (x + 1 < w) g[i + 1] += (err * 7) / 16;
      if (y + 1 < h) {
        if (x > 0) g[i + w - 1] += (err * 3) / 16;
        g[i + w] += (err * 5) / 16;
        if (x + 1 < w) g[i + w + 1] += (err * 1) / 16;
      }
      if (nv === 0) dark.push([x / w - 0.5, y / h - 0.5]);
    }
  }

  // normalise to the mark's own bounding box so image padding doesn't shrink it
  let minX = 1, maxX = -1, minY = 1, maxY = -1;
  for (const [x, y] of dark) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const extent = Math.max(maxX - minX, maxY - minY) || 1;
  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;

  // thin the solid fill into a dotted field
  const stride = 3;
  const out: Particle[] = [];
  for (let i = 0; i < dark.length; i += stride) {
    const sx = (dark[i][0] - midX) / extent;
    const sy = (dark[i][1] - midY) / extent;
    const ang = Math.atan2(sy, sx) + (Math.random() - 0.5) * 1.2;
    out.push({
      sx,
      sy,
      dx: Math.cos(ang),
      dy: Math.sin(ang) - 0.6, // bias upward, like dust lifting off
      dist: 0.5 + Math.random() * 1.1,
      delay: Math.random() * 0.35 + (sy + 0.5) * 0.35,
      phase: Math.random() * Math.PI * 2,
      speed: 0.4 + Math.random() * 0.8,
      arrow: false,
      ax: 0,
      ay: 0,
      gdelay: Math.random() * 0.35,
    });
  }
  return out;
}

/**
 * an arrow, pointing forward, as a cloud of at most n points. drawn to a small
 * canvas and sampled at dither density so the dust can gather into it at the
 * end of the page without packing solid.
 */
function arrowPoints(max: number): Array<[number, number]> {
  const w = 240;
  const h = 130;
  const off = document.createElement("canvas");
  off.width = w;
  off.height = h;
  const c = off.getContext("2d", { willReadFrequently: true });
  if (!c) return [];
  c.fillStyle = "#fff";
  c.fillRect(0, 0, w, h);
  c.strokeStyle = "#000";
  c.lineWidth = 22;
  c.lineCap = "round";
  c.lineJoin = "round";
  c.beginPath();
  c.moveTo(28, 65);
  c.lineTo(206, 65);
  c.moveTo(150, 16);
  c.lineTo(208, 65);
  c.lineTo(150, 114);
  c.stroke();
  const d = c.getImageData(0, 0, w, h).data;
  const all: Array<[number, number]> = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4] < 128) all.push([x / w - 0.5, (y - h / 2) / w]);
    }
  }
  const n = Math.min(max, Math.floor(all.length / 3));
  const out: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) {
    const src = all[Math.floor((i * all.length) / n) % all.length];
    out.push([src[0] + (Math.random() - 0.5) / w, src[1] + (Math.random() - 0.5) / w]);
  }
  return out;
}

function cssColor(name: string): [number, number, number] {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const c = document.createElement("canvas").getContext("2d");
  if (!c) return [0, 0, 0];
  c.fillStyle = raw || "#000";
  const hex = c.fillStyle as string; // normalised to #rrggbb
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function DitherBackground() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvasEl = ref.current;
    if (!canvasEl) return;
    const context = canvasEl.getContext("2d");
    if (!context) return;
    const cv: HTMLCanvasElement = canvasEl;
    const c: CanvasRenderingContext2D = context;

    const reduceMedia = window.matchMedia("(prefers-reduced-motion: reduce)");
    const darkMedia = window.matchMedia("(prefers-color-scheme: dark)");

    let parts: Particle[] = [];
    let img: HTMLImageElement | null = null;
    let W = 0;
    let H = 0;
    let dpr = 1;
    let ink: [number, number, number] = [0, 0, 0];
    let raf = 0;
    let running = true;
    let pointerX = 0; // -0.5..0.5, smoothed
    let pointerY = 0;
    let targetPX = 0;
    let targetPY = 0;

    function rebuild() {
      if (!img) return;
      const small = window.innerWidth < 600;
      parts = dither(img, small ? 150 : 230);
      // spread the arrow's dots evenly across the field; the rest fade out
      const arrow = arrowPoints(parts.length);
      const step = parts.length / Math.max(1, arrow.length);
      for (let i = 0; i < arrow.length; i++) {
        const p = parts[Math.min(parts.length - 1, Math.floor(i * step))];
        p.arrow = true;
        p.ax = arrow[i][0];
        p.ay = arrow[i][1];
      }
    }

    function resize() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = window.innerWidth;
      H = window.innerHeight;
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      cv.style.width = W + "px";
      cv.style.height = H + "px";
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      ink = cssColor("--color-accent");
      rebuild();
      if (reduceMedia.matches) draw(0);
    }

    function draw(now: number) {
      c.clearRect(0, 0, W, H);
      if (!parts.length) return;

      const reduce = reduceMedia.matches;
      const dark = darkMedia.matches;
      const small = W < 600;

      // where the logo sits: large and centred, a touch above the middle
      const S = Math.min(W, H) * (small ? 0.7 : 0.6);
      const cx = W / 2 + pointerX * 14;
      const cy = H * 0.46 + pointerY * 10;

      // scatter as the reader scrolls into the story
      const scroll = reduce ? 0 : Math.min(1, window.scrollY / (H * 1.1));

      // gather the dust into an arrow as the reader reaches the end
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - H);
      const gatherRange = Math.min(H * 0.9, maxScroll * 0.5);
      const gather = reduce ? 0 : Math.min(1, Math.max(0, 1 - (maxScroll - window.scrollY) / gatherRange));
      // the arrow sits low, beside the sign-off, clear of the last photo
      const A = Math.min(W, H) * (small ? 0.5 : 0.34);
      const acx = W / 2;
      const acy = H * (small ? 0.78 : 0.72);
      const t0 = now * 0.001;
      const nudge = Math.sin(t0 * 1.4) * 6;
      const baseAlpha = dark ? 0.6 : 0.5;
      const dot = small ? 1.6 : 1.9;
      const color = `rgb(${ink[0]},${ink[1]},${ink[2]})`;
      c.fillStyle = color;

      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        const t = smooth((scroll - p.delay * 0.6) / 0.6);
        const g = smooth((gather - p.gdelay * 0.5) / 0.65);

        let x = cx + p.sx * S;
        let y = cy + p.sy * S;

        if (!reduce) {
          // idle breathing: a slow, tiny wander so the field feels alive
          const w = t0 * p.speed;
          x += Math.sin(w + p.phase) * 1.4;
          y += Math.cos(w * 0.8 + p.phase) * 1.4;
        }

        if (t > 0) {
          const d = p.dist * S * t;
          x = lerp(x, x + p.dx * d, 1);
          y = lerp(y, y + p.dy * d - scroll * H * 0.25, 1);
        }

        if (g > 0 && p.arrow) {
          x = lerp(x, acx + p.ax * A + nudge * g, g);
          y = lerp(y, acy + p.ay * A, g);
        }

        const shimmer = reduce ? 1 : 0.78 + 0.22 * Math.sin(t0 * 1.6 * p.speed + p.phase * 3);
        const scattered = baseAlpha * shimmer * (1 - t * 0.9);
        const alpha = p.arrow ? lerp(scattered, baseAlpha * shimmer, g) : scattered * (1 - g);
        if (alpha < 0.01) continue;
        c.globalAlpha = alpha;
        const size = lerp(dot * (1 + t * 0.6), dot, g);
        c.fillRect(x, y, size, size);
      }
      c.globalAlpha = 1;
    }

    function frame(now: number) {
      if (!running) return;
      pointerX += (targetPX - pointerX) * 0.05;
      pointerY += (targetPY - pointerY) * 0.05;
      draw(now);
      raf = requestAnimationFrame(frame);
    }

    function onPointer(e: PointerEvent) {
      targetPX = e.clientX / W - 0.5;
      targetPY = e.clientY / H - 0.5;
    }

    function onVisibility() {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!reduceMedia.matches) {
        running = true;
        raf = requestAnimationFrame(frame);
      }
    }

    function onTheme() {
      ink = cssColor("--color-accent");
      if (reduceMedia.matches) draw(0);
    }

    const image = new Image();
    image.src = LOGO_SRC;
    image.decoding = "async";
    image.onload = () => {
      img = image;
      resize();
      if (reduceMedia.matches) {
        draw(0);
      } else {
        raf = requestAnimationFrame(frame);
      }
    };

    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onPointer, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    darkMedia.addEventListener("change", onTheme);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointer);
      document.removeEventListener("visibilitychange", onVisibility);
      darkMedia.removeEventListener("change", onTheme);
    };
  }, []);

  return <canvas ref={ref} className="dither" aria-hidden="true" />;
}
