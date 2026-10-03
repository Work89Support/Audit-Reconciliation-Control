/* Categories are explicit Audit decisions, never inferred from a mismatch or employee name.
   Stored in cause as a versioned prefix for compatibility with the existing damages schema. */
const DamageSummary = (() => {
  const categories = Object.freeze({ employee: 'พนักงาน', backoffice: 'ระบบหลังบ้าน', external: 'ธนาคาร / ปัจจัยควบคุมไม่ได้', pm: 'ระบบ PM', game: 'ระบบเกม', system: 'ระบบ', unclassified: 'ยังไม่แยกประเภท' });
  function classify(cause) {
    const current = String(cause || '').match(/^\[damage:v2:(employee|backoffice|external|pm|game)\]\s*/);
    if (current) return { category: current[1], subcategory: '', detail: String(cause).slice(current[0].length) };
    const match = String(cause || '').match(/^\[damage:v1:(employee|system|external)(?::(X1|X3|X5))?\]\s*/);
    if (!match || (match[2] && match[1] !== 'employee')) return { category: 'unclassified', subcategory: '', detail: String(cause || '') };
    return { category: match[1], subcategory: match[2] || '', detail: String(cause).slice(match[0].length) };
  }
  function encodeDetails(category, detail) {
    if (!['employee','backoffice','external','pm','game'].includes(category)) throw new Error('เลือกประเภทความเสียหายก่อน');
    if (!String(detail || '').trim()) throw new Error('ระบุสาเหตุและหลักฐานที่ใช้ยืนยัน');
    return `[damage:v2:${category}] ${String(detail).trim()}`;
  }
  // Old X codes were stored as a category, not a confirmed shift. Never infer a shift from them.
  function shiftLabel(row) { const value=String(row.shift || '').trim(); return !value || value==='-' ? 'รอยืนยันกะ' : value; }
  function employeeLabel(row) { const value=String(row.employee || '').trim(); return !value || value==='-' || value==='ไม่ระบุ' ? 'รอยืนยันผู้เกี่ยวข้อง' : value; }
  function monthRange(month, minimum = '2026-09-15') {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('เลือกเดือนให้ถูกต้อง');
    const [year, m] = month.split('-').map(Number);
    const end = `${month}-${String(new Date(Date.UTC(year,m,0)).getUTCDate()).padStart(2,'0')}`;
    if (end < minimum) throw new Error('เดือนนี้อยู่นอกช่วงข้อมูลที่เปิดใช้งาน');
    return { from: `${month}-01` < minimum ? minimum : `${month}-01`, to: end };
  }
  function groupBy(rows, field) {
    const grouped = new Map();
    for (const row of rows) {
      const label = field === 'shift' ? shiftLabel(row) : employeeLabel(row);
      if (!grouped.has(label)) grouped.set(label, []);
      grouped.get(label).push(row);
    }
    return [...grouped].map(([label, records]) => ({ label, ...summarize(records) }));
  }
  function encode(category, subcategory, detail) {
    if (!['employee', 'system', 'external'].includes(category)) throw new Error('เลือกประเภทความเสียหายก่อน');
    if (subcategory && (category !== 'employee' || !['X1','X3','X5'].includes(subcategory))) throw new Error('ประเภทย่อยไม่ตรงกับประเภทหลัก');
    if (!String(detail || '').trim()) throw new Error('ระบุสาเหตุและหลักฐานที่ใช้ยืนยัน');
    return `[damage:v1:${category}${subcategory ? ':' + subcategory : ''}] ${String(detail).trim()}`;
  }
  function cents(value) {
    if (value === null || value === undefined || value === '') return null;
    const text = String(value).trim();
    if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return null;
    const amount = Math.round(Number(text) * 100);
    return Number.isSafeInteger(amount) ? amount : null;
  }
  function summarize(rows) {
    const groups = Object.keys(categories).map(category => ({ category, label: categories[category], count: 0, cents: 0 }));
    const seen = new Set();
    const issues = [];
    for (const row of rows) {
      const key = row.dbId || row.id;
      if (!key || seen.has(key)) { issues.push({ id: key || '', reason: 'รหัสขาดหรือซ้ำ' }); continue; }
      seen.add(key);
      const amount = cents(row.amount);
      if (amount === null) { issues.push({ id: key, reason: 'ยอดเงินไม่ถูกต้อง' }); continue; }
      const group = groups.find(g => g.category === classify(row.cause).category);
      group.count++; group.cents += amount;
    }
    return { groups: groups.map(g=>({...g, amount:g.cents/100})), total:groups.reduce((s,g)=>s+g.cents,0)/100, issues };
  }
  function financeComplete(status) {
    return ['completed','closed','ปิดแล้ว','ปิดรอบแล้ว','เสร็จแล้ว','เสร็จสิ้น'].includes(String(status || '').trim().toLowerCase());
  }
  return { categories, classify, encode, encodeDetails, shiftLabel, employeeLabel, monthRange, groupBy, cents, summarize, financeComplete };
})();
