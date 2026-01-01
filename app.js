const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");

const elPhrase = document.getElementById("phrase");
const elHighlight = document.getElementById("highlight");
const elColor = document.getElementById("color");
const elDuration = document.getElementById("duration");
const elFps = document.getElementById("fps");
const elRes = document.getElementById("res");
const elGrain = document.getElementById("grain");
const elBlur = document.getElementById("blur");
const elMeta = document.getElementById("meta");

const btnPreview = document.getElementById("btnPreview");
const btnGenerate = document.getElementById("btnGenerate");
const linkDownload = document.getElementById("download");

// --- Utils ---
function rand(min, max) { return Math.random() * (max - min) + min; }
function randi(min, max) { return Math.floor(rand(min, max + 1)); }
function choice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function parseRes() {
  const [w, h] = elRes.value.split("x").map(n => parseInt(n, 10));
  canvas.width = w;
  canvas.height = h;
}

function splitHighlights(s) {
  return s
    .split(",")
    .map(x => x.trim())
    .filter(Boolean);
}

function normalize(s) {
  return (s || "").toLowerCase();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(/\s+/);
  let line = "";
  const lines = [];
  for (let n = 0; n < words.length; n++) {
    const testLine = line ? (line + " " + words[n]) : words[n];
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      lines.push(line);
      line = words[n];
    } else {
      line = testLine;
    }
  }
  if (line) lines.push(line);
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight));
  return lines;
}

// --- Fake “paper” background ---
function drawPaperBG() {
  const w = canvas.width, h = canvas.height;

  // base paper tone
  ctx.fillStyle = "#f4f2ee";
  ctx.fillRect(0, 0, w, h);

  // subtle vignette
  const g = ctx.createRadialGradient(w*0.5, h*0.45, Math.min(w,h)*0.05, w*0.5, h*0.45, Math.max(w,h)*0.75);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.12)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // “folds / wrinkles”
  ctx.globalAlpha = 0.20;
  ctx.strokeStyle = "rgba(0,0,0,0.12)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    const y = rand(h*0.1, h*0.9);
    ctx.moveTo(0, y);
    for (let x = 0; x <= w; x += w/6) {
      ctx.lineTo(x, y + rand(-18, 18));
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// --- Fake printed text blocks (background noise) ---
const LOREM = [
  "В данном обзоре исследуется происхождение и значение фразы в литературе и искусстве.",
  "От древних мифов до современных картин — этот вопрос появляется снова и снова.",
  "С точки зрения психологии, поиски смысла жизни часто начинаются с простого вопроса.",
  "Наблюдение, внимание к деталям и случайность иногда приводят к открытиям.",
  "Язык — странный инструмент: он одновременно скрывает и раскрывает мысль."
];

function drawPrintedNoise() {
  const w = canvas.width, h = canvas.height;
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.textBaseline = "top";

  const marginX = w * 0.10;
  let y = h * 0.12;

  const fontSize = Math.round(h * rand(0.020, 0.026));
  ctx.font = `${fontSize}px "Times New Roman", Times, serif`;

  // lots of lines
  for (let p = 0; p < 10; p++) {
    const paragraph = choice(LOREM);
    const maxWidth = w - marginX * 2;
    const lineH = Math.round(fontSize * 1.25);

    // slightly different opacity per paragraph
    ctx.globalAlpha = rand(0.18, 0.38);

    // wrap as “print”
    const words = paragraph.split(" ");
    let line = "";
    for (let i = 0; i < words.length; i++) {
      const test = line ? line + " " + words[i] : words[i];
      if (ctx.measureText(test).width > maxWidth) {
        ctx.fillText(line, marginX + rand(-4, 4), y);
        y += lineH;
        line = words[i];
      } else {
        line = test;
      }
    }
    if (line) { ctx.fillText(line, marginX + rand(-4, 4), y); y += lineH; }

    y += lineH * rand(0.7, 1.5);
    if (y > h * 0.85) break;
  }

  ctx.restore();
}

// --- Highlighted phrase placement & draw ---
function drawHighlightedPhrase(phrase, highlights, color) {
  const w = canvas.width, h = canvas.height;

  // Random placement “like screenshot”
  const x = w * rand(0.12, 0.22);
  const y = h * rand(0.18, 0.62);

  const fontSize = Math.round(h * rand(0.040, 0.060)); // big-ish
  const weight = choice([600, 700, 800]);
  ctx.font = `${weight} ${fontSize}px "Times New Roman", Times, serif`;
  ctx.textBaseline = "alphabetic";

  // We’ll render on one line (for simplicity). If you want wrapping — we can extend.
  const text = phrase.trim();
  const textMetrics = ctx.measureText(text);
  const textWidth = textMetrics.width;

  // small jitter + “camera blur / motion”
  const jitterX = rand(-6, 6);
  const jitterY = rand(-6, 6);

  // Determine highlight ranges by searching substrings (case-insensitive).
  const lowerText = normalize(text);

  // If highlights empty → highlight the whole phrase.
  const parts = highlights.length ? highlights : [text];

  // Draw highlights first as rectangles under matching substrings
  // Approach: measure substring widths using ctx.measureText of slices.
  for (const part of parts) {
    const needle = normalize(part);
    if (!needle) continue;

    // find all occurrences
    let startIdx = 0;
    while (true) {
      const idx = lowerText.indexOf(needle, startIdx);
      if (idx === -1) break;

      const before = text.slice(0, idx);
      const match = text.slice(idx, idx + needle.length);

      const beforeW = ctx.measureText(before).width;
      const matchW = ctx.measureText(match).width;

      // highlight “marker” style
      const padX = fontSize * 0.18;
      const padY = fontSize * 0.28;
      const rectX = x + beforeW - padX + jitterX;
      const rectY = y - fontSize + padY + jitterY;
      const rectW = matchW + padX * 2;
      const rectH = fontSize * 0.95;

      ctx.save();
      ctx.globalAlpha = rand(0.85, 0.98);
      ctx.fillStyle = color;

      // slight tilt
      ctx.translate(rectX + rectW/2, rectY + rectH/2);
      ctx.rotate(rand(-0.03, 0.03));
      ctx.translate(-(rectX + rectW/2), -(rectY + rectH/2));

      // rounded-ish rect
      roundRect(ctx, rectX, rectY, rectW, rectH, rectH * 0.18);
      ctx.fill();

      ctx.restore();

      startIdx = idx + needle.length;
    }
  }

  // Draw phrase on top (black-ish ink)
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.88)";
  ctx.globalAlpha = 1;
  // tiny stroke to feel “printed”
  ctx.lineWidth = Math.max(1, fontSize * 0.04);
  ctx.strokeStyle = "rgba(0,0,0,0.25)";

  // soft shadow for realism
  ctx.shadowColor = "rgba(0,0,0,0.18)";
  ctx.shadowBlur = rand(0, 2.2);
  ctx.shadowOffsetX = rand(-0.5, 0.5);
  ctx.shadowOffsetY = rand(0.2, 1.0);

  // “print jitter”
  ctx.strokeText(text, x + jitterX, y + jitterY);
  ctx.fillText(text, x + jitterX, y + jitterY);

  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.arcTo(x+w, y, x+w, y+h, r);
  ctx.arcTo(x+w, y+h, x, y+h, r);
  ctx.arcTo(x, y+h, x, y, r);
  ctx.arcTo(x, y, x+w, y, r);
  ctx.closePath();
}

// --- Post effects: blur background, grain, slight vertical smear ---
function applyBlur(blurPx) {
  // cheap trick: draw canvas onto itself with ctx.filter blur using offscreen
  const w = canvas.width, h = canvas.height;
  const off = document.createElement("canvas");
  off.width = w; off.height = h;
  const octx = off.getContext("2d");
  octx.drawImage(canvas, 0, 0);

  ctx.save();
  ctx.clearRect(0, 0, w, h);
  ctx.filter = `blur(${blurPx}px)`;
  ctx.drawImage(off, 0, 0);
  ctx.restore();
}

function addGrain(amount) {
  if (amount <= 0) return;
  const w = canvas.width, h = canvas.height;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const amp = Math.floor(255 * amount);

  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() * 2 - 1) * amp;
    d[i]     = clamp(d[i]     + n);
    d[i + 1] = clamp(d[i + 1] + n);
    d[i + 2] = clamp(d[i + 2] + n);
  }
  ctx.putImageData(img, 0, 0);
}

function clamp(v) { return Math.max(0, Math.min(255, v)); }

function drawFrame(state) {
  const { phrase, highlights, color, blurPx, grainAmt } = state;

  // 1) paper
  drawPaperBG();

  // 2) printed noise (text blocks)
  drawPrintedNoise();

  // 3) blur the whole thing a bit (like your example)
  applyBlur(blurPx);

  // 4) then redraw phrase + highlight on top sharp-ish
  drawHighlightedPhrase(phrase, highlights, color);

  // 5) add grain last
  addGrain(grainAmt);
}

// --- Preview + Video generation ---
async function preview() {
  parseRes();
  const phrase = elPhrase.value;
  const highlights = splitHighlights(elHighlight.value);
  const color = elColor.value;
  const blurPx = parseFloat(elBlur.value);
  const grainAmt = parseFloat(elGrain.value);

  // show 10 quick frames
  for (let i = 0; i < 10; i++) {
    drawFrame({ phrase, highlights, color, blurPx, grainAmt });
    elMeta.textContent = `Preview frame ${i+1}/10`;
    await sleep(70);
  }
  elMeta.textContent = "Preview done.";
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function generateVideo() {
  parseRes();
  linkDownload.style.display = "none";
  linkDownload.removeAttribute("href");

  const phrase = elPhrase.value;
  const highlights = splitHighlights(elHighlight.value);
  const color = elColor.value;
  const duration = Math.max(0.1, parseFloat(elDuration.value) || 2);
  const fps = Math.max(10, Math.min(60, parseInt(elFps.value || "30", 10)));
  const blurPx = parseFloat(elBlur.value);
  const grainAmt = parseFloat(elGrain.value);

  const totalFrames = Math.round(duration * fps);

  // MediaRecorder setup
  const stream = canvas.captureStream(fps);
  const mime = pickMime();
  if (!mime) {
    alert("Увы: MediaRecorder не поддерживает WebM кодеки в этом браузере.");
    return;
  }

  const chunks = [];
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });

  rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };

  const done = new Promise((resolve) => {
    rec.onstop = () => resolve();
  });

  rec.start();

  // Render frames
  const start = performance.now();
  for (let f = 0; f < totalFrames; f++) {
    drawFrame({ phrase, highlights, color, blurPx, grainAmt });
    elMeta.textContent = `Rendering ${f+1}/${totalFrames} @ ${fps}fps`;
    // keep timing roughly aligned with fps
    await sleep(1000 / fps);
  }

  rec.stop();
  await done;

  const blob = new Blob(chunks, { type: mime });
  const url = URL.createObjectURL(blob);

  linkDownload.href = url;
  linkDownload.download = `highlight_${canvas.width}x${canvas.height}_${Math.round(duration*1000)}ms.webm`;
  linkDownload.style.display = "inline-flex";
  linkDownload.textContent = "Download video (WebM)";

  const elapsed = ((performance.now() - start) / 1000).toFixed(2);
  elMeta.textContent = `Done. Frames: ${totalFrames}, elapsed: ${elapsed}s, mime: ${mime}`;
}

function pickMime() {
  const candidates = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm"
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return "";
}

btnPreview.addEventListener("click", preview);
btnGenerate.addEventListener("click", generateVideo);

// initial sizing
parseRes();
drawFrame({
  phrase: elPhrase.value,
  highlights: splitHighlights(elHighlight.value),
  color: elColor.value,
  blurPx: parseFloat(elBlur.value),
  grainAmt: parseFloat(elGrain.value),
});
elMeta.textContent = "Ready.";
