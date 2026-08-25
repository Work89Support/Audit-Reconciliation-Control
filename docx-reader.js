/* =============================================================
   DocxReader - แสดงตัวอย่าง .docx ภายในเบราว์เซอร์
   - ใช้ตัวแตก ZIP ใน XlsxReader ที่มีอยู่แล้ว
   - สร้าง DOM ด้วย textContent เท่านั้น เพื่อไม่รัน HTML/สคริปต์จากเอกสาร
   - รองรับข้อความ ย่อหน้า ตาราง ลิงก์ (แสดงเป็นข้อความ) และรูปภาพทั่วไป
   ============================================================= */
const DocxReader = (() => {
  const dec = new TextDecoder("utf-8");
  const MIME = {
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
    webp: "image/webp", bmp: "image/bmp", svg: "image/svg+xml",
  };

  function xml(buffer, label) {
    const doc = new DOMParser().parseFromString(dec.decode(buffer), "application/xml");
    if (doc.querySelector("parsererror")) throw new Error(`อ่านโครงสร้าง ${label} ในไฟล์ Word ไม่สำเร็จ`);
    return doc;
  }

  const children = (node, name) => Array.from(node?.children || []).filter((child) => child.localName === name);
  const descendants = (node, name) => Array.from(node?.getElementsByTagNameNS("*", name) || []);
  const attr = (node, name) => Array.from(node?.attributes || []).find((item) => item.localName === name)?.value || "";

  function relationships(doc) {
    const out = new Map();
    descendants(doc, "Relationship").forEach((rel) => out.set(attr(rel, "Id"), attr(rel, "Target")));
    return out;
  }

  function normalizedPart(target) {
    const parts = (`word/${String(target || "").replace(/^\//, "")}`).split("/");
    const clean = [];
    parts.forEach((part) => {
      if (!part || part === ".") return;
      if (part === "..") clean.pop(); else clean.push(part);
    });
    return clean.join("/");
  }

  function paragraph(node, context) {
    const p = document.createElement("p");
    p.className = "docx-paragraph";
    const pStyle = descendants(node, "pStyle")[0];
    const style = attr(pStyle, "val").toLowerCase();
    if (/title|heading1|heading2|heading3/.test(style)) p.classList.add("docx-heading", `docx-${style.replace(/[^a-z0-9]/g, "")}`);
    const alignment = attr(descendants(node, "jc")[0], "val");
    if (["center", "right", "both", "justify"].includes(alignment)) p.style.textAlign = alignment === "both" ? "justify" : alignment;

    const appendRun = (run) => {
      Array.from(run.childNodes || []).forEach((part) => {
        if (part.nodeType !== 1) return;
        if (part.localName === "t" || part.localName === "delText" || part.localName === "instrText") p.append(document.createTextNode(part.textContent || ""));
        else if (part.localName === "tab") p.append(document.createTextNode("\t"));
        else if (part.localName === "br" || part.localName === "cr") p.append(document.createElement("br"));
        else if (part.localName === "drawing" || part.localName === "pict") appendImages(part);
        else if (part.localName === "r") appendRun(part);
      });
    };
    const appendImages = (part) => {
      descendants(part, "blip").forEach((blip) => {
        const target = context.rels.get(attr(blip, "embed"));
        if (!target) return;
        const path = normalizedPart(target);
        const source = context.parts.get(path);
        if (!source) return;
        const ext = path.split(".").pop().toLowerCase();
        if (!MIME[ext]) { context.warnings.add(`รูปภาพ .${ext} ยังแสดงไม่ได้`); return; }
        const url = URL.createObjectURL(new Blob([source], { type: MIME[ext] }));
        context.urls.push(url);
        const image = document.createElement("img");
        image.src = url;
        image.alt = "รูปภาพจากเอกสาร";
        image.loading = "lazy";
        p.append(image);
      });
    };

    Array.from(node.childNodes || []).forEach((part) => {
      if (part.nodeType !== 1) return;
      if (part.localName === "r") appendRun(part);
      else if (part.localName === "hyperlink" || part.localName === "smartTag" || part.localName === "sdt") descendants(part, "r").forEach(appendRun);
      else if (part.localName === "bookmarkStart" || part.localName === "bookmarkEnd" || part.localName === "pPr") return;
    });
    return p;
  }

  function table(node, context) {
    const wrap = document.createElement("div");
    wrap.className = "docx-table-wrap";
    const table = document.createElement("table");
    children(node, "tr").forEach((rowNode, rowIndex) => {
      const row = document.createElement("tr");
      children(rowNode, "tc").forEach((cellNode) => {
        const cell = document.createElement(rowIndex === 0 ? "th" : "td");
        children(cellNode, "p").forEach((p) => cell.append(paragraph(p, context)));
        children(cellNode, "tbl").forEach((nested) => cell.append(table(nested, context)));
        row.append(cell);
      });
      table.append(row);
    });
    wrap.append(table);
    return wrap;
  }

  async function render(arrayBuffer) {
    if (typeof XlsxReader === "undefined") throw new Error("ไม่พบตัวอ่านเอกสารในระบบ");
    const zip = XlsxReader.zipEntries(arrayBuffer);
    const parts = new Map();
    for (const entry of zip.entries) {
      if (entry.name === "word/document.xml" || entry.name === "word/_rels/document.xml.rels" || entry.name.startsWith("word/media/")) {
        parts.set(entry.name, await XlsxReader.zipRead(zip, entry));
      }
    }
    if (!parts.has("word/document.xml")) throw new Error("ไฟล์นี้ไม่มีเนื้อหา Word ที่ระบบอ่านได้ อาจไม่ใช่ .docx หรือไฟล์เสีย");
    const relDoc = parts.has("word/_rels/document.xml.rels") ? xml(parts.get("word/_rels/document.xml.rels"), "ความสัมพันธ์") : null;
    const context = { parts, rels: relDoc ? relationships(relDoc) : new Map(), urls: [], warnings: new Set() };
    const root = document.createElement("div");
    root.className = "docx-preview";
    const note = document.createElement("div");
    note.className = "file-preview-note";
    note.textContent = "ตัวอย่างจากเอกสาร Word · รูปแบบอาจต่างจากต้นฉบับเล็กน้อย";
    root.append(note);
    const page = document.createElement("article");
    page.className = "docx-page";
    const doc = xml(parts.get("word/document.xml"), "เนื้อหา");
    const body = descendants(doc, "body")[0];
    Array.from(body?.children || []).forEach((part) => {
      if (part.localName === "p") page.append(paragraph(part, context));
      else if (part.localName === "tbl") page.append(table(part, context));
    });
    if (!page.textContent.trim() && !page.querySelector("img, table")) {
      const empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = "เอกสารนี้ไม่มีข้อความหรือตารางที่แสดงตัวอย่างได้";
      page.append(empty);
    }
    if (context.warnings.size) {
      const warning = document.createElement("div");
      warning.className = "docx-warning";
      warning.textContent = Array.from(context.warnings).join(" · ");
      page.prepend(warning);
    }
    root.append(page);
    return { element: root, cleanup: () => context.urls.forEach((url) => URL.revokeObjectURL(url)) };
  }

  return { render };
})();

if (typeof window !== "undefined") window.DocxReader = DocxReader;
