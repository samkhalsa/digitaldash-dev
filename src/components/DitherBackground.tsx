import { useEffect, useRef } from "react";

/**
 * a full-viewport canvas behind the page.
 *
 * the logo is floyd-steinberg dithered at runtime so the halftone dots are
 * the particles. as the reader scrolls, the mark scatters: most dots fade out,
 * but a few dozen fly to slots in a layered neural network laid out across
 * the screen. from there, connections draw in layer by layer, left to right,
 * until the network is complete at the end of the page.
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
};

/** a dot that lands in the network. */
type Node = { i: number; x: number; y: number; layer: number; edges: number[] };
/** a connection between two nodes; `order` is when it grows in, `w` its weight. */
type Edge = { a: number; b: number; order: number; w: number };

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
    g[i] = (src[j] * 0.299 + src[j + 1] * 0.587 + src[j + 2] * 0.114) * a + 255 * (1 - a);
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
    });
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
    let nodes: Node[] = [];
    let edges: Edge[] = [];
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
    let colL = 0; // the text column, so lines behind it can be dimmed
    let colR = 0;
    let maxScroll = 1; // cached: reading scrollHeight every frame forces layout
    let lastScroll = -1;
    let needsDraw = true;

    /** where the logo sits: large and centred in the first screen. */
    function logoFrame() {
      const small = W < 600;
      return { S: Math.min(W, H) * (small ? 0.58 : 0.48), cx: W / 2, cy: H * 0.42 };
    }

    function rebuild() {
      if (!img) return;
      const small = window.innerWidth < 600;
      parts = dither(img, small ? 150 : 230);
    }

    /**
     * lay the network out in layers across the screen, like a diagram of a
     * neural net but loosened up. each slot is claimed by the scattered dot
     * whose logo position is nearest, and that dot's scatter path is bent so
     * it lands exactly in the slot. connections run between adjacent layers.
     */
    function buildNetwork() {
      const small = W < 600;
      const { S, cx, cy } = logoFrame();
      const counts = small ? [3, 5, 6, 5, 3] : [4, 6, 8, 9, 8, 6, 4];
      const L = counts.length;
      const marginX = small ? W * 0.08 : W * 0.05;
      const top = H * 0.1;
      const bottom = H * 0.9;

      // slots
      const slots: Array<{ x: number; y: number; layer: number }> = [];
      const gapX = (W - marginX * 2) / (L - 1);
      counts.forEach((n, layer) => {
        const x0 = marginX + gapX * layer;
        const gapY = (bottom - top) / n;
        for (let k = 0; k < n; k++) {
          slots.push({
            x: x0 + (Math.random() - 0.5) * gapX * 0.35,
            y: top + gapY * (k + 0.5) + (Math.random() - 0.5) * gapY * 0.5,
            layer,
          });
        }
      });

      // claim a dot for each slot, nearest by logo position, and aim it there
      const used = new Set<number>();
      nodes = [];
      for (const slot of slots) {
        let best = -1;
        let bestD = Infinity;
        for (let i = 0; i < parts.length; i++) {
          if (used.has(i)) continue;
          const p = parts[i];
          const d = Math.hypot(cx + p.sx * S - slot.x, cy + p.sy * S - slot.y);
          if (d < bestD) {
            bestD = d;
            best = i;
          }
        }
        if (best < 0) break;
        used.add(best);
        const p = parts[best];
        const vx = slot.x - (cx + p.sx * S);
        const vy = slot.y + H * 0.25 - (cy + p.sy * S); // scatter lifts by H/4 at full scroll
        const len = Math.hypot(vx, vy) || 1;
        p.dx = vx / len;
        p.dy = vy / len;
        p.dist = len / S;
        nodes.push({ i: best, x: slot.x, y: slot.y, layer: slot.layer, edges: [] });
      }

      // connections: each node reaches 2 or 3 nodes in the next layer,
      // nearest first with one further reach for variety
      edges = [];
      const seen = new Set<string>();
      const byLayer: number[][] = counts.map(() => []);
      nodes.forEach((n, idx) => byLayer[n.layer].push(idx));
      for (let layer = 0; layer < L - 1; layer++) {
        for (const a of byLayer[layer]) {
          const next = byLayer[layer + 1]
            .map((b) => ({ b, d: Math.abs(nodes[b].y - nodes[a].y) }))
            .sort((p, q) => p.d - q.d);
          const picks = next.slice(0, 2);
          if (next.length > 3 && Math.random() < 0.7) picks.push(next[2 + Math.floor(Math.random() * (next.length - 2))]);
          for (const o of picks) {
            const key = `${a}:${o.b}`;
            if (seen.has(key)) continue;
            seen.add(key);
            edges.push({ a, b: o.b, order: 0, w: 0.5 + Math.random() * 0.9 });
          }
        }
        // make sure every node in the next layer has at least one input
        for (const b of byLayer[layer + 1]) {
          if (edges.some((e) => e.b === b)) continue;
          const a = byLayer[layer].reduce((best, cand) =>
            Math.abs(nodes[cand].y - nodes[b].y) < Math.abs(nodes[best].y - nodes[b].y) ? cand : best,
          );
          edges.push({ a, b, order: 0, w: 0.5 + Math.random() * 0.9 });
        }
      }

      // growth order: left to right, layer by layer, top to bottom within a layer
      edges
        .slice()
        .sort((e, f) => nodes[e.a].layer - nodes[f.a].layer || nodes[e.a].y - nodes[f.a].y || nodes[e.b].y - nodes[f.b].y)
        .forEach((e, order) => {
          e.order = order;
        });
      edges.forEach((e, idx) => {
        nodes[e.a].edges.push(idx);
        nodes[e.b].edges.push(idx);
      });
    }

    function measureDoc() {
      maxScroll = Math.max(1, document.documentElement.scrollHeight - H);
      needsDraw = true;
    }

    function measureColumn() {
      const page = document.querySelector(".page");
      if (!page) return;
      const r = page.getBoundingClientRect();
      const pad = parseFloat(getComputedStyle(page).paddingLeft) || 0;
      colL = r.left + pad;
      colR = r.right - pad;
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
      buildNetwork();
      measureColumn();
      measureDoc();
      if (reduceMedia.matches) draw(0);
    }

    function draw(now: number) {
      c.clearRect(0, 0, W, H);
      if (!parts.length) return;

      const reduce = reduceMedia.matches;
      const dark = darkMedia.matches;
      const small = W < 600;
      const t0 = now * 0.001;
      const { S, cx: cx0, cy: cy0 } = logoFrame();
      const cx = cx0 + pointerX * 14;
      const cy = cy0 + pointerY * 10;

      // scatter as the reader scrolls into the story
      const scroll = reduce ? 0 : Math.min(1, window.scrollY / (H * 1.1));
      const baseAlpha = dark ? 0.6 : 0.5;
      const dot = small ? 1.6 : 1.9;
      c.fillStyle = `rgb(${ink[0]},${ink[1]},${ink[2]})`;

      // the logo, and its scatter
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        const t = smooth((scroll - p.delay * 0.6) / 0.6);
        if (t >= 1) continue; // gone, or landed in the network

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
          x += p.dx * d;
          y += p.dy * d - scroll * H * 0.25;
        }

        const shimmer = reduce ? 1 : 0.78 + 0.22 * Math.sin(t0 * 1.6 * p.speed + p.phase * 3);
        const alpha = baseAlpha * shimmer * (1 - t);
        if (alpha < 0.01) continue;
        c.globalAlpha = alpha;
        const size = dot * (1 + t * 0.6);
        c.fillRect(x, y, size, size);
      }

      // the network: grows from the end of the scatter, complete near the end
      if (!edges.length || scroll <= 0) {
        c.globalAlpha = 1;
        return;
      }
      const netSpan = Math.max(1, (maxScroll - H * 1.1) * 0.92);
      const net = Math.min(1, Math.max(0, (window.scrollY - H * 1.1) / netSpan));
      const head = net * edges.length;

      const settle = reduce ? 0 : 1 - scroll; // wander fades as the logo scatters
      const pos = nodes.map((n) => {
        const p = parts[n.i];
        const w = t0 * p.speed;
        return {
          x: n.x + pointerX * 14 + Math.sin(w + p.phase) * 1.4 * settle,
          y: n.y + pointerY * 10 + Math.cos(w * 0.8 + p.phase) * 1.4 * settle,
        };
      });
      const local = edges.map((e) => smooth((head - e.order) / 5));
      const lineAlpha = dark ? 0.2 : 0.14;
      const nodeAlpha = dark ? 0.5 : 0.4;
      const underText = 0.5; // extra dimming behind the column

      c.strokeStyle = `rgb(${ink[0]},${ink[1]},${ink[2]})`;
      c.lineCap = "round";
      for (let k = 0; k < edges.length; k++) {
        const l = local[k];
        if (l <= 0) continue;
        const e = edges[k];
        const a = pos[e.a];
        const b = pos[e.b];
        const mx = (a.x + b.x) / 2;
        const dim = mx > colL && mx < colR ? underText : 1;
        c.globalAlpha = lineAlpha * l * dim * (0.6 + e.w * 0.4);
        c.lineWidth = e.w;
        c.beginPath();
        c.moveTo(a.x, a.y);
        c.lineTo(a.x + (b.x - a.x) * l, a.y + (b.y - a.y) * l);
        c.stroke();
      }

      for (let k = 0; k < nodes.length; k++) {
        const n = nodes[k];
        const arrival = smooth((scroll - parts[n.i].delay * 0.6) / 0.6);
        if (arrival <= 0) continue;
        let lit = 0;
        for (const ei of n.edges) if (local[ei] > lit) lit = local[ei];
        const { x, y } = pos[k];
        const dim = x > colL && x < colR ? underText : 1;
        const size = dot * 1.5 + lit * 1.5;
        c.globalAlpha = nodeAlpha * (0.5 + 0.5 * lit) * arrival * dim;
        c.fillRect(x - size / 2, y - size / 2, size, size);
        if (lit > 0) {
          // a faint ring once the node is wired in
          c.globalAlpha = nodeAlpha * 0.35 * lit * dim;
          c.lineWidth = 1;
          c.beginPath();
          c.arc(x, y, size * 1.6, 0, Math.PI * 2);
          c.stroke();
        }
      }
      c.globalAlpha = 1;
    }

    function frame(now: number) {
      if (!running) return;
      pointerX += (targetPX - pointerX) * 0.05;
      pointerY += (targetPY - pointerY) * 0.05;
      // only repaint when something can have changed: the logo is still on
      // screen and breathing, the pointer is settling, or the page scrolled
      const sy = window.scrollY;
      const logoOnScreen = sy < H * 1.2;
      const pointerMoving = Math.abs(targetPX - pointerX) > 0.0005 || Math.abs(targetPY - pointerY) > 0.0005;
      if (needsDraw || logoOnScreen || pointerMoving || sy !== lastScroll) {
        draw(now);
        lastScroll = sy;
        needsDraw = false;
      }
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
      needsDraw = true;
      if (reduceMedia.matches) draw(0);
    }

    // the page grows as photos load in; keep the cached height current
    const docObserver = new ResizeObserver(() => measureDoc());
    docObserver.observe(document.body);

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
      docObserver.disconnect();
    };
  }, []);

  return <canvas ref={ref} className="dither" aria-hidden="true" />;
}
