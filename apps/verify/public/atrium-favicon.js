// Atrium live favicon — black tile + italic "A" + breathing status bar
//
// Lifted verbatim from `desing/Atrium.html` (asset uuid
// fe2d3138-93f8-493d-83aa-9a56015475fb) via the Wave-N audit. The design
// canon embeds this as the live favicon; matching the design 1:1 means the
// browser tab pulses amber by default and exposes a status-API so demo
// surfaces can flip it green/red mid-run.
//
// API:  window.setAtriumFavicon("green"|"amber"|"red", breathe=true)
// On load it defaults to amber + breathing (testnet heartbeat).

(function () {
  const SIZE = 64;
  const COLORS = {
    amber: "#CC8E2D",
    green: "#43864F",
    red:   "#A1352A",
    paper: "#FBFAF7",
    ink:   "#1A1714"
  };

  const canvas = document.createElement("canvas");
  canvas.width = SIZE; canvas.height = SIZE;
  const ctx = canvas.getContext("2d");

  let statusColor = "amber";
  let breathing = true;
  let frame = 0;
  let raf = null;

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function draw() {
    ctx.clearRect(0, 0, SIZE, SIZE);

    // Tile
    ctx.fillStyle = COLORS.ink;
    roundRect(ctx, 0, 0, SIZE, SIZE, 14);
    ctx.fill();

    // Italic A
    ctx.fillStyle = COLORS.paper;
    ctx.font = "italic 600 44px 'Instrument Serif', 'Times New Roman', serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("A", SIZE / 2 - 1, SIZE / 2 - 4);

    // Status bar — breathes via sin wave when enabled
    const t = frame / 28; // 28 frames ≈ one half cycle
    const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI);
    const alpha = breathing ? 0.45 + 0.55 * pulse : 1;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = COLORS[statusColor] || COLORS.amber;
    const barH = 6, pad = 10;
    roundRect(ctx, pad, SIZE - barH - pad, SIZE - pad * 2, barH, 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    apply();
  }

  function apply() {
    const url = canvas.toDataURL("image/png");
    let link = document.querySelector("link[rel='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.type = "image/png";
    link.href = url;
  }

  function loop() {
    frame++;
    draw();
    // ~12fps is enough for breathing — keeps CPU minimal
    raf = setTimeout(() => requestAnimationFrame(loop), 85);
  }

  function start() {
    draw();
    if (raf) return;
    loop();
  }

  // Pause while the tab is hidden — saves battery, avoids unnecessary work
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (raf) { clearTimeout(raf); raf = null; }
    } else {
      start();
    }
  });

  window.setAtriumFavicon = function (status, breathe) {
    if (status && COLORS[status]) statusColor = status;
    if (typeof breathe === "boolean") breathing = breathe;
  };

  // Wait for Instrument Serif to be ready so the A draws right
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(start);
  } else {
    start();
  }
})();
