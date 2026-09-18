(function(root) {
  'use strict';
  const text = v => String(v ?? '').trim();
  function cents(value) {
    const s = text(value).replace(/,/g, '');
    if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
    const n = Math.round(Number(s) * 100);
    return Number.isSafeInteger(n) ? n : null;
  }
  function letter(i) { let s=''; for(let n=i+1;n;n=Math.floor((n-1)/26)) s=String.fromCharCode(65+(n-1)%26)+s; return s; }
  function analyze(workbook, schema) {
    const results = schema.sheets.map(template => {
      const source = workbook.find(s=>s.name===template.name);
      if (!source) return {...template, missing:true, rows:[], pm:[], bo:[], issues:[], errors:['ไม่พบชีตในไฟล์']};
      const headers = source.rows[0].map(text);
      const boStart = headers.indexOf('รหัส');
      const deposit = template.name.endsWith('ฝ');
      const amount = deposit ? 'realAmount' : /^(AT|M) /.test(template.name) ? 'transferredAmount' : 'amount';
      const errors=[];
      const required=['id','status',amount,'รหัส','จำนวน','เวลา','ยูสเซอร์','ประเภท'];
      for(const h of required) if(headers.filter(x=>x===h).length!==1) errors.push(`หัวคอลัมน์ขาดหรือซ้ำ: ${h}`);
      if(boStart<0 || headers.indexOf(amount)>boStart) errors.push('แยกฝั่ง PM / BO ไม่ได้');
      const result={name:template.name,headers,rows:[],pm:[],bo:[],issues:[],errors,amount,missing:false,pmTotal:0,boTotal:0,manualPm:0,manualBo:0};
      if(errors.length) return result;
      const ai=headers.indexOf(amount), bi=headers.indexOf('จำนวน'), si=headers.indexOf('status');
      const totals = Object.entries(source.formulas || {}).filter(([addr,f])=>addr.match(/^[A-Z]+/)[0]===letter(ai) && /^=?SUM\(/i.test(f));
      // Identify the explicit manual subtotal boundary; all transactions are still counted below it.
      result.totalRow = totals.length===1 ? Number(totals[0][0].match(/\d+/)[0]) : null;
      const sumRows = new Set(Object.entries(source.formulas||{}).filter(([addr,f])=>[letter(ai),letter(bi)].includes(addr.match(/^[A-Z]+/)[0]) && /^=?SUM\(/i.test(f)).map(([addr])=>Number(addr.match(/\d+/)[0])));
      source.rows.slice(1).forEach((values,index)=>{
        const row=source.rowNumbers?.[index+1] || index+2;
        const pmId=text(values[headers.indexOf('id')]);
        const boId=text(values[boStart]);
        const status=text(values[si]).toUpperCase();
        // A subtotal may contain a summed numeric BO ID; distinguish it from a transaction.
        if(sumRows.has(row) && !pmId && !['SUCCESS','SUCCESSED','PARTIAL'].includes(status) && !['ฝาก','ถอน'].includes(text(values[headers.indexOf('ประเภท')]))) return;
        const accepted=['SUCCESS','SUCCESSED',...(deposit?[]:['PARTIAL'])].includes(status);
        const isPm=!!pmId && !!status;
        const isBo=/^\d+$/.test(boId) && text(values[headers.indexOf('ประเภท')])===(deposit?'ฝาก':'ถอน');
        if((pmId || status) && !isPm) errors.push(`แถว ${row}: ข้อมูล PM ไม่ครบ (id / status)`);
        if(boId && !isBo) errors.push(`แถว ${row}: รหัสหรือประเภท BO ไม่ตรงชีต`);
        const record={row,values,pm:isPm,bo:isBo,accepted,flags:[]};
        if(isPm) {
          const value=cents(values[ai]);
          result.pm.push({row,value,accepted,status});
          if(!accepted) record.flags.push('PM ไม่อยู่ในสถานะที่ตรวจ');
          else if(value===null) {errors.push(`แถว ${row}: ไม่มียอด ${amount} ที่อ่านได้`);record.flags.push('ยอด PM อ่านไม่ได้');}
          else {result.pmTotal+=value;if(result.totalRow && row<result.totalRow) result.manualPm+=value;}
        }
        if(isBo) {
          const value=cents(values[bi]);
          const note=text(values[headers.indexOf('หมายเหตุ')]);
          const crossday=values.slice(0,boStart).some(v=>text(v)==='ข้ามวัน');
          if(value===null) {errors.push(`แถว ${row}: ยอด BO อ่านไม่ได้`);record.flags.push('ยอด BO อ่านไม่ได้');}
          else {result.boTotal+=value;if(result.totalRow && row<result.totalRow) result.manualBo+=value;}
          if(crossday) record.flags.push('ข้ามวัน');
          if(/ชี้แจง/.test(note)) record.flags.push('มีหมายเหตุชี้แจง');
          if(result.totalRow && row>result.totalRow) record.flags.push('อยู่นอกยอดรวมออดิท');
          result.bo.push({row,value,id:boId});
          if(record.flags.length) result.issues.push({row,value,id:boId,user:text(values[headers.indexOf('ยูสเซอร์')]),note,flags:[...record.flags]});
        }
        if(isPm || isBo) result.rows.push(record);
        else if(values.some(v=>text(v)) && !/^รวม|total/i.test(pmId)) {
          errors.push(`แถว ${row}: มีข้อมูลที่ยังจัดเป็นธุรกรรมไม่ได้`);
          result.rows.push({...record,flags:['ข้อมูลที่ยังจัดประเภทไม่ได้']});
        }
      });
      return result;
    });
    return results;
  }
  root.MC8SheetData={analyze,cents};
  if(typeof module!=='undefined') module.exports=root.MC8SheetData;
})(typeof window==='undefined'?globalThis:window);
