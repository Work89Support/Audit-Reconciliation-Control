/* =============================================================
   Charts - SVG chart helpers (ไม่มี dependency ภายนอก)
   ทุกกราฟมี hover tooltip, legend/direct label และ table fallback
   ============================================================= */

const Charts = (() => {
  const PALETTE = {
    s1: "#2a78d6",
    s2: "#eb6834",
    s3: "#1baf7a",
    s4: "#4a3aa7",
    grid: "#e4edf7",
    axis: "#c3d5e8",
    muted: "#7c8ea2",
    text: "#0f2238",
    surface: "#ffffff",
  };
  const STATUS = { critical: "#d03b3b", high: "#ec835a", medium: "#fab219", low: "#0ca30c" };

  const registry = new Map();
  let tip;

  function ensureTip() {
    if (!tip) {
      tip = document.createElement("div");
      tip.className = "chart-tip";
      tip.setAttribute("role", "status");
      document.body.appendChild(tip);
    }
    return tip;
  }
  function showTip(html, evt) {
    const t = ensureTip();
    t.innerHTML = html;
    t.classList.add("on");
    const pad = 14;
    let x = evt.clientX + pad;
    let y = evt.clientY + pad;
    const r = t.getBoundingClientRect();
    if (x + r.width > window.innerWidth - 8) x = evt.clientX - r.width - pad;
    if (y + r.height > window.innerHeight - 8) y = evt.clientY - r.height - pad;
    t.style.left = x + "px";
    t.style.top = y + "px";
  }
  function hideTip() {
    if (tip) tip.classList.remove("on");
  }

  const fmtInt = (n) => Math.round(n).toLocaleString("th-TH");
  const fmtMoney = (n) => Number(n).toLocaleString("th-TH", { maximumFractionDigits: 0 });
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function niceMax(v) {
    if (v <= 0) return 10;
    const mag = Math.pow(10, Math.floor(Math.log10(v)));
    const n = v / mag;
    const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
    return step * mag;
  }

  function topRoundedRect(x, y, w, h, r) {
    r = Math.min(r, w / 2, Math.max(h, 0.01));
    return `M${x},${y + h} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${y + h} Z`;
  }
  function rightRoundedRect(x, y, w, h, r) {
    r = Math.min(r, h / 2, Math.max(w, 0.01));
    return `M${x},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${y + h - r} Q${x + w},${y + h} ${x + w - r},${y + h} L${x},${y + h} Z`;
  }

  /* ---------------- line / area chart ---------------- */
  function line(el, opt) {
    const W = Math.max(el.clientWidth || 520, 280);
    const H = opt.height || 240;
    const m = { t: 16, r: 14, b: opt.hideXLabels ? 12 : 30, l: 52 };
    const iw = W - m.l - m.r;
    const ih = H - m.t - m.b;
    const series = opt.series;
    const n = opt.xLabels.length;
    const maxV = niceMax(Math.max(...series.flatMap((s) => s.values)) * 1.08);
    const x = (i) => m.l + (n === 1 ? iw / 2 : (i * iw) / (n - 1));
    const y = (v) => m.t + ih - (v / maxV) * ih;
    const ticks = [4, 5, 3, 2].find((t) => (maxV / t) % 1 === 0) || 4;

    let g = "";
    for (let i = 0; i <= ticks; i++) {
      const v = (maxV / ticks) * i;
      const yy = y(v);
      g += `<line x1="${m.l}" y1="${yy}" x2="${W - m.r}" y2="${yy}" stroke="${PALETTE.grid}" stroke-width="1"/>`;
      g += `<text x="${m.l - 8}" y="${yy + 4}" text-anchor="end" class="c-axis">${opt.short ? shortNum(v) : fmtInt(v)}</text>`;
    }
    if (!opt.hideXLabels) {
      const every = Math.ceil(n / (iw < 420 ? 6 : 12));
      let lastX = -999;
      const minGap = 44;
      opt.xLabels.forEach((lb, i) => {
        if (i % every !== 0 && i !== n - 1) return;
        if (x(i) - lastX < minGap && i !== n - 1) return;
        if (i === n - 1 && x(i) - lastX < minGap) return;
        lastX = x(i);
        g += `<text x="${x(i)}" y="${H - 10}" text-anchor="middle" class="c-axis">${esc(lb)}</text>`;
      });
    }

    let paths = "";
    series.forEach((s) => {
      const pts = s.values.map((v, i) => `${x(i)},${y(v)}`).join(" L");
      if (s.area) {
        paths += `<path d="M${x(0)},${y(0)} L${pts} L${x(n - 1)},${y(0)} Z" fill="${s.color}" opacity="0.10"/>`;
      }
      paths += `<path d="M${pts}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    });

    let hot = `<g class="c-hover"><line class="c-cross" x1="0" y1="${m.t}" x2="0" y2="${m.t + ih}" stroke="${PALETTE.axis}" stroke-width="1" opacity="0"/>`;
    series.forEach((s, si) => {
      hot += `<circle class="c-dot c-dot-${si}" r="5" fill="${s.color}" stroke="#fff" stroke-width="2" opacity="0"/>`;
    });
    hot += `</g>`;
    for (let i = 0; i < n; i++) {
      const bw = iw / (n - 1 || 1);
      hot += `<rect class="c-hit" data-i="${i}" x="${x(i) - bw / 2}" y="${m.t}" width="${bw}" height="${ih}" fill="transparent"/>`;
    }

    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" role="img" aria-label="${esc(opt.label || "กราฟเส้น")}">${g}
      <line x1="${m.l}" y1="${m.t + ih}" x2="${W - m.r}" y2="${m.t + ih}" stroke="${PALETTE.axis}" stroke-width="1"/>
      ${paths}${hot}</svg>`;

    const svg = el.querySelector("svg");
    const cross = svg.querySelector(".c-cross");
    const dots = [...svg.querySelectorAll(".c-dot")];
    svg.querySelectorAll(".c-hit").forEach((r) => {
      r.addEventListener("mousemove", (e) => {
        const i = +r.dataset.i;
        cross.setAttribute("x1", x(i));
        cross.setAttribute("x2", x(i));
        cross.setAttribute("opacity", "1");
        dots.forEach((d, si) => {
          d.setAttribute("cx", x(i));
          d.setAttribute("cy", y(series[si].values[i]));
          d.setAttribute("opacity", "1");
        });
        const rows = series
          .map((s) => `<div class="tip-row"><i style="background:${s.color}"></i><span>${esc(s.name)}</span><b>${fmtInt(s.values[i])}${opt.unit || ""}</b></div>`)
          .join("");
        showTip(`<p class="tip-title">${esc(opt.xLabels[i])}</p>${rows}`, e);
      });
      r.addEventListener("mouseleave", () => {
        cross.setAttribute("opacity", "0");
        dots.forEach((d) => d.setAttribute("opacity", "0"));
        hideTip();
      });
    });
  }

  function shortNum(v) {
    if (v >= 1000000) return (v / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
    if (v >= 1000) return (v / 1000).toFixed(0) + "k";
    return fmtInt(v);
  }

  /* ---------------- vertical bars ---------------- */
  function bars(el, opt) {
    const W = Math.max(el.clientWidth || 520, 260);
    const H = opt.height || 220;
    const m = { t: 16, r: 12, b: 44, l: 50 };
    const iw = W - m.l - m.r;
    const ih = H - m.t - m.b;
    const items = opt.items;
    const maxV = niceMax(Math.max(...items.map((i) => i.value)) * 1.1);
    const slot = iw / items.length;
    const bw = Math.min(slot - 8, 54);
    const y = (v) => m.t + ih - (v / maxV) * ih;

    let g = "";
    for (let i = 0; i <= 4; i++) {
      const v = (maxV / 4) * i;
      g += `<line x1="${m.l}" y1="${y(v)}" x2="${W - m.r}" y2="${y(v)}" stroke="${PALETTE.grid}" stroke-width="1"/>`;
      g += `<text x="${m.l - 8}" y="${y(v) + 4}" text-anchor="end" class="c-axis">${shortNum(v)}</text>`;
    }
    let b = "";
    items.forEach((it, i) => {
      const cx = m.l + slot * i + slot / 2;
      const h = Math.max(ih - (y(it.value) - m.t), 2);
      const color = it.color || opt.color || PALETTE.s1;
      b += `<path class="c-bar" data-i="${i}" d="${topRoundedRect(cx - bw / 2, y(it.value), bw, h, 4)}" fill="${color}"/>`;
      b += `<text x="${cx}" y="${y(it.value) - 7}" text-anchor="middle" class="c-val">${opt.money ? fmtMoney(it.value) : fmtInt(it.value)}</text>`;
      const lines = String(it.label).split("\n");
      lines.forEach((ln, li) => {
        b += `<text x="${cx}" y="${H - 26 + li * 14}" text-anchor="middle" class="c-axis">${esc(ln)}</text>`;
      });
    });

    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" role="img" aria-label="${esc(opt.label || "กราฟแท่ง")}">${g}
      <line x1="${m.l}" y1="${m.t + ih}" x2="${W - m.r}" y2="${m.t + ih}" stroke="${PALETTE.axis}" stroke-width="1"/>${b}</svg>`;

    el.querySelectorAll(".c-bar").forEach((p) => {
      p.addEventListener("mousemove", (e) => {
        const it = items[+p.dataset.i];
        showTip(
          `<p class="tip-title">${esc(String(it.label).replace("\n", " "))}</p><div class="tip-row"><i style="background:${it.color || opt.color || PALETTE.s1}"></i><span>${esc(opt.metric || "จำนวน")}</span><b>${opt.money ? fmtMoney(it.value) : fmtInt(it.value)}${opt.unit || ""}</b></div>${it.hint ? `<p class="tip-note">${esc(it.hint)}</p>` : ""}`,
          e,
        );
      });
      p.addEventListener("mouseleave", hideTip);
    });
  }

  /* ---------------- horizontal bars ---------------- */
  function hbars(el, opt) {
    const items = opt.items;
    const W = Math.max(el.clientWidth || 460, 260);
    const rowH = opt.rowH || 34;
    const H = items.length * rowH + 10;
    const labelW = opt.labelW || Math.min(180, Math.max(96, W * 0.36));
    const valueW = 62;
    const iw = Math.max(W - labelW - valueW - 12, 40);
    const maxV = Math.max(...items.map((i) => i.value), 1);

    let b = "";
    items.forEach((it, i) => {
      const y = i * rowH + 6;
      const w = Math.max((it.value / maxV) * iw, 3);
      const color = it.color || opt.color || PALETTE.s1;
      b += `<text x="0" y="${y + rowH / 2 - 2}" class="c-hlabel" dominant-baseline="middle">${esc(it.label)}</text>`;
      b += `<rect x="${labelW}" y="${y + 4}" width="${iw}" height="${rowH - 16}" rx="4" fill="${PALETTE.grid}" opacity="0.65"/>`;
      b += `<path class="c-hbar" data-i="${i}" d="${rightRoundedRect(labelW, y + 4, w, rowH - 16, 4)}" fill="${color}"/>`;
      b += `<text x="${W}" y="${y + rowH / 2 - 2}" text-anchor="end" class="c-val" dominant-baseline="middle">${opt.money ? fmtMoney(it.value) : fmtInt(it.value)}${opt.unit || ""}</text>`;
    });
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" role="img" aria-label="${esc(opt.label || "กราฟแท่งแนวนอน")}">${b}</svg>`;
    el.querySelectorAll(".c-hbar").forEach((p) => {
      p.addEventListener("mousemove", (e) => {
        const it = items[+p.dataset.i];
        const pct = ((it.value / items.reduce((a, c) => a + c.value, 0)) * 100).toFixed(1);
        showTip(
          `<p class="tip-title">${esc(it.label)}</p><div class="tip-row"><i style="background:${it.color || opt.color || PALETTE.s1}"></i><span>${esc(opt.metric || "จำนวน")}</span><b>${opt.money ? fmtMoney(it.value) : fmtInt(it.value)}${opt.unit || ""}</b></div><p class="tip-note">คิดเป็น ${pct}% ของทั้งหมด</p>`,
          e,
        );
      });
      p.addEventListener("mouseleave", hideTip);
    });
  }

  /* ---------------- single stacked bar ---------------- */
  function stack(el, opt) {
    const items = opt.items.filter((i) => i.value > 0);
    const total = items.reduce((a, c) => a + c.value, 0) || 1;
    const W = Math.max(el.clientWidth || 420, 240);
    const H = 26;
    let x = 0;
    let b = "";
    items.forEach((it, i) => {
      const w = Math.max((it.value / total) * W - 2, 2);
      b += `<rect class="c-seg" data-i="${i}" x="${x}" y="0" width="${w}" height="${H}" rx="4" fill="${it.color}"/>`;
      x += w + 2;
    });
    const legend = items
      .map(
        (it) =>
          `<span class="c-leg"><i style="background:${it.color}"></i>${esc(it.label)} <b>${fmtInt(it.value)}</b></span>`,
      )
      .join("");
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" role="img" aria-label="${esc(opt.label || "สัดส่วน")}">${b}</svg><div class="c-legend">${legend}</div>`;
    el.querySelectorAll(".c-seg").forEach((p) => {
      p.addEventListener("mousemove", (e) => {
        const it = items[+p.dataset.i];
        showTip(
          `<p class="tip-title">${esc(it.label)}</p><div class="tip-row"><i style="background:${it.color}"></i><span>จำนวน</span><b>${fmtInt(it.value)}</b></div><p class="tip-note">${((it.value / total) * 100).toFixed(1)}% ของทั้งหมด</p>`,
          e,
        );
      });
      p.addEventListener("mouseleave", hideTip);
    });
  }

  /* ---------------- sparkline (สำหรับ KPI tile) ---------------- */
  function spark(values, color) {
    const W = 96;
    const H = 28;
    const max = Math.max(...values);
    const min = Math.min(...values);
    const span = max - min || 1;
    const pts = values.map((v, i) => `${(i / (values.length - 1)) * W},${H - 2 - ((v - min) / span) * (H - 6)}`).join(" L");
    return `<svg class="spark" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true"><path d="M${pts}" fill="none" stroke="${color || PALETTE.s1}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  /* ---------------- registry + resize ---------------- */
  function draw(selector, kind, opt) {
    const el = typeof selector === "string" ? document.querySelector(selector) : selector;
    if (!el) return;
    registry.set(el, { kind, opt });
    render(el, kind, opt);
  }
  function render(el, kind, opt) {
    if (kind === "line") line(el, opt);
    else if (kind === "bars") bars(el, opt);
    else if (kind === "hbars") hbars(el, opt);
    else if (kind === "stack") stack(el, opt);
  }
  let rz;
  window.addEventListener("resize", () => {
    clearTimeout(rz);
    rz = setTimeout(() => {
      registry.forEach((cfg, el) => {
        if (document.body.contains(el)) render(el, cfg.kind, cfg.opt);
        else registry.delete(el);
      });
    }, 160);
  });
  function reset() {
    registry.clear();
    hideTip();
  }

  return { draw, spark, reset, PALETTE, STATUS, fmtInt, fmtMoney, shortNum };
})();
