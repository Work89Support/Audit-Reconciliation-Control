/* =============================================================
   Exporter - ออกไฟล์ Excel (.xlsx), CSV และบันทึกหน้าจอเป็นภาพ
   - Excel เขียนเองด้วย XlsxWriter ทำงานได้แม้ไม่มีอินเทอร์เน็ต
   - ภาพใช้ html2canvas ถ้ามี ถ้าไม่มีใช้ตัวจับภาพในตัว (SVG foreignObject)
   ============================================================= */

const Exporter = (() => {
  const hasXLSX = () => typeof XlsxWriter !== "undefined";
  const hasCanvas = () => typeof html2canvas !== "undefined";

  function saveBlob(blob, filename) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 800);
  }

  /* ---------- Excel ---------- */
  /* sheets: [{ name, headers:[], rows:[[]], widths:[], title? }]
     ใช้ตัวเขียน xlsx ที่อยู่ในโปรเจกต์ ทำงานได้แม้ไม่มีอินเทอร์เน็ต */
  function workbook(sheets, filename, meta) {
    if (typeof XlsxWriter === "undefined") return { ok: false, reason: "no-xlsx" };
    try {
      const blob = XlsxWriter.build(sheets, meta);
      saveBlob(blob, filename);
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: e.message };
    }
  }

  function csv(headers, rows, filename) {
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const text = "﻿" + [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\r\n");
    saveBlob(new Blob([text], { type: "text/csv;charset=utf-8;" }), filename);
  }

  /* ---------- ภาพ ---------- */
  function svgToPng(svgEl, filename, scale = 2) {
    return new Promise((resolve, reject) => {
      const clone = svgEl.cloneNode(true);
      const rect = svgEl.getBoundingClientRect();
      const w = Math.max(rect.width, 320);
      const hgt = Math.max(rect.height, 160);
      clone.setAttribute("width", w);
      clone.setAttribute("height", hgt);
      clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      // ใส่สไตล์ข้อความให้ติดไปกับภาพ
      const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
      style.textContent = `text{font-family:'Kanit',system-ui,sans-serif}.c-axis{fill:#7c8ea2;font-size:11px}.c-val{fill:#0f2238;font-size:11.5px}.c-hlabel{fill:#40526a;font-size:12.5px}`;
      clone.insertBefore(style, clone.firstChild);
      const data = new XMLSerializer().serializeToString(clone);
      const img = new Image();
      img.onload = () => {
        const cv = document.createElement("canvas");
        cv.width = w * scale;
        cv.height = hgt * scale;
        const ctx = cv.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, cv.width, cv.height);
        ctx.drawImage(img, 0, 0, cv.width, cv.height);
        cv.toBlob((b) => {
          saveBlob(b, filename);
          resolve(true);
        }, "image/png");
      };
      img.onerror = reject;
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(data);
    });
  }

  /* ---------- ตัวจับภาพในตัว (ใช้ได้แม้ไม่มีอินเทอร์เน็ต) ----------
     คัดลอกโหนดพร้อมสไตล์ที่คำนวณแล้ว ใส่ลงใน SVG foreignObject แล้ว rasterize */
  const STYLE_PROPS = [
    "display","position","box-sizing","min-height","min-width",
    "margin-top","margin-right","margin-bottom","margin-left",
    "padding-top","padding-right","padding-bottom","padding-left",
    "border-top","border-right","border-bottom","border-left","border-radius",
    "background-color","background-image","background-size","background-position","background-repeat",
    "color","font-family","font-size","font-weight","font-style","line-height","letter-spacing",
    "text-align","text-decoration","text-transform","white-space","word-break","overflow-wrap",
    "vertical-align","opacity","flex","flex-direction","flex-wrap","justify-content","align-items",
    "align-content","gap","row-gap","column-gap","grid-template-columns","grid-column","grid-row",
    "list-style","fill","stroke","stroke-width","box-shadow","table-layout","border-collapse",
    "border-spacing","object-fit","transform","top","left","right","bottom","z-index","float","clear",
  ];

  function inlineStyles(src, dst) {
    const cs = getComputedStyle(src);
    let css = "";
    for (const prop of STYLE_PROPS) {
      const v = cs.getPropertyValue(prop);
      if (v && v !== "none" && v !== "normal" && v !== "auto" && v !== "0px" && v !== "rgba(0, 0, 0, 0)") {
        css += `${prop}:${v};`;
      }
    }
    if (css) dst.setAttribute("style", css);
    const sk = src.children;
    const dk = dst.children;
    for (let i = 0; i < sk.length && i < dk.length; i++) inlineStyles(sk[i], dk[i]);
  }

  function domToCanvas(el, opts = {}) {
    return new Promise((resolve, reject) => {
      const rect = el.getBoundingClientRect();
      const w = Math.ceil(rect.width);
      const hgt = Math.ceil(Math.max(el.scrollHeight, rect.height)) + 6;
      const scale = opts.scale || 2;

      const clone = el.cloneNode(true);
      clone.querySelectorAll(".no-capture, .panel-cam").forEach((n) => n.remove());
      inlineStyles(el, clone);
      clone.style.width = w + "px";
      clone.style.margin = "0";
      clone.style.boxShadow = "none";

      const wrapper = document.createElement("div");
      wrapper.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
      wrapper.style.cssText = `width:${w}px;background:${opts.background || "#ffffff"};font-family:'Kanit',Tahoma,system-ui,sans-serif;`;
      wrapper.appendChild(clone);

      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${hgt}" viewBox="0 0 ${w} ${hgt}">
        <foreignObject x="0" y="0" width="${w}" height="${hgt}">${new XMLSerializer().serializeToString(wrapper)}</foreignObject></svg>`;

      const img = new Image();
      img.onload = () => {
        const cv = document.createElement("canvas");
        cv.width = w * scale;
        cv.height = hgt * scale;
        const ctx = cv.getContext("2d");
        ctx.fillStyle = opts.background || "#ffffff";
        ctx.fillRect(0, 0, cv.width, cv.height);
        ctx.drawImage(img, 0, 0, cv.width, cv.height);
        resolve(cv);
      };
      img.onerror = () => reject(new Error("แปลงเป็นภาพไม่สำเร็จ"));
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    });
  }

  function canvasToFile(cv, filename) {
    return new Promise((resolve, reject) =>
      cv.toBlob((b) => {
        if (!b) return reject(new Error("สร้างภาพไม่สำเร็จ"));
        saveBlob(b, filename);
        resolve(true);
      }, "image/png"),
    );
  }

  async function domToPng(el, filename, opts = {}) {
    const cv = await domToCanvas(el, opts);
    return canvasToFile(cv, filename);
  }

  /* ต่อภาพหลายส่วนเป็นภาพเดียวเรียงลงมา — ใช้เป็นทางสำรองของ "ทั้งหน้า"
     เพราะการ render โครง grid ซ้อนหลายชั้นใน foreignObject ไม่เสถียร */
  async function stitch(elements, filename, opts = {}) {
    const scale = opts.scale || 2;
    const gap = 20 * scale;
    const pad = 24 * scale;
    const canvases = [];
    for (const el of elements) canvases.push(await domToCanvas(el, { ...opts, background: "#ffffff", scale }));
    if (!canvases.length) throw new Error("ไม่พบส่วนที่จะบันทึก");

    const headH = opts.heading ? 84 * scale : 0;
    const width = Math.max(...canvases.map((c) => c.width)) + pad * 2;
    const height = headH + pad * 2 + canvases.reduce((a, c) => a + c.height, 0) + gap * (canvases.length - 1);

    const out = document.createElement("canvas");
    out.width = width;
    out.height = height;
    const ctx = out.getContext("2d");
    ctx.fillStyle = opts.background || "#f2f7fd";
    ctx.fillRect(0, 0, width, height);

    let y = pad;
    if (opts.heading) {
      ctx.fillStyle = "#0f2238";
      ctx.font = `600 ${26 * scale}px 'Kanit', Tahoma, sans-serif`;
      ctx.fillText(opts.heading, pad, y + 30 * scale);
      if (opts.subheading) {
        ctx.fillStyle = "#63748a";
        ctx.font = `400 ${15 * scale}px 'Kanit', Tahoma, sans-serif`;
        ctx.fillText(opts.subheading, pad, y + 58 * scale);
      }
      y += headH;
    }
    canvases.forEach((c) => {
      ctx.drawImage(c, pad, y);
      y += c.height + gap;
    });
    await canvasToFile(out, filename);
    return canvases.length;
  }

  async function capture(el, filename, opts = {}) {
    if (hasCanvas()) {
      const hidden = [...el.querySelectorAll(".no-capture")];
      hidden.forEach((n) => (n.style.visibility = "hidden"));
      try {
        const cv = await html2canvas(el, {
          backgroundColor: opts.background || "#ffffff",
          scale: opts.scale || 2,
          useCORS: true,
          logging: false,
          windowWidth: document.documentElement.scrollWidth,
        });
        await new Promise((r) => cv.toBlob((b) => (saveBlob(b, filename), r()), "image/png"));
        return { ok: true, mode: "full" };
      } catch (e) {
        return { ok: false, reason: e.message };
      } finally {
        hidden.forEach((n) => (n.style.visibility = ""));
      }
    }
    // ทางสำรองในตัว: จับภาพทั้งส่วนรวมตารางได้ โดยไม่ต้องมีอินเทอร์เน็ต
    try {
      await domToPng(el, filename, opts);
      return { ok: true, mode: "builtin" };
    } catch (e) {
      const svg = el.querySelector(".chart svg, svg.spark");
      if (svg) {
        await svgToPng(svg, filename);
        return { ok: true, mode: "chart-only" };
      }
      return { ok: false, reason: e.message };
    }
  }

  return { workbook, csv, capture, svgToPng, domToPng, domToCanvas, stitch, saveBlob, hasXLSX, hasCanvas };
})();
