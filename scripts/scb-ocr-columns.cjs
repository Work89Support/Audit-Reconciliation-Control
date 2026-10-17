'use strict';
// Recover column-order OCR only when every printed movement is independently
// accounted for by the same-page opening/running balances and bank direction.
// No digit substitution, missing amount, or partial-page recovery is permitted.
function reconstructScbOcrColumns(input) {
 const text=String(input||'').replace(/\r/g,'');
 if(!/SIAM COMMERCIAL BANK PUBLIC COMPANY LIMITED/i.test(text))return null;
 const headings=[...text.matchAll(/ธนาคารไทยพาณิชย์[^\n]*\nTHE SIAM COMMERCIAL BANK PUBLIC COMPANY LIMITED/gi)];
 if(!headings.length)return null;
 const money=/\d{1,3}(?:,\d{3})*(?:\.\d{2}|,\d{2})(?![\d.,])/g;
 const cents=s=>{const m=s.match(/^(\d{1,3}(?:,\d{3})*)([.,])(\d{2})$/);return m?Number(m[1].replace(/,/g,''))*100+Number(m[3]):NaN;};
 const fmt=n=>(n/100).toFixed(2);
 const pages=[],proof=[];let lastDateTime='',previousClosing=null,sourceAccount=null;
 for(let page=0;page<headings.length;page++){
  let raw=text.slice(headings[page].index,headings[page+1]?.index??text.length);
  raw=raw.replace(/(?:เอกสารฉบับนี้ออกโดยระบบอัตโนมัติ|This document is auto-generated)[^\n]*/g,s=>' '.repeat(s.length)).split(/TOTAL AMOUNTS/)[0];
  if(!/BALANCE BROUGHT FORWARD/.test(raw))return null;
  const dates=[...raw.matchAll(/\b(\d{2}\/\d{2}\/\d{2})\s+(\d{2}:\d{2})(?:\s+(X[12]))?/g)];
  const balances=[...raw.matchAll(/(\d{1,3}(?:,\d{3})*(?:\.\d{2}|,\d{2}))\s+(รับโอนจาก|โอนไป)/g)];
  const opening=raw.match(/รายละเอียด\s+(\d{1,3}(?:,\d{3})*\.\d{2})/);
  if(!dates.length||dates.length!==balances.length||!opening||(raw.match(/\bENET\b/g)||[]).length!==dates.length)return null;
  let prior=cents(opening[1]);
  if(previousClosing!==null&&prior!==previousClosing)return null;
  // Remove only the proven opening and balance number spans. Everything else
  // that looks monetary must match the complete movement multiset exactly.
  const openingIndex=opening.index+opening[0].lastIndexOf(opening[1]);
  const spans=[{index:openingIndex,length:opening[1].length},...balances.map(b=>({index:b.index,length:b[1].length}))];
  let remaining=raw;for(const s of spans.sort((a,b)=>b.index-a.index))remaining=remaining.slice(0,s.index)+' '.repeat(s.length)+remaining.slice(s.index+s.length);
  const amounts=[...remaining.matchAll(money)].map(m=>({cents:cents(m[0]),index:m.index,raw:m[0],used:false}));
  if(amounts.length!==dates.length)return null;
  const rows=[];
  for(let i=0;i<dates.length;i++){
   const d=dates[i],b=balances[i],balance=cents(b[1]),change=balance-prior,amount=Math.abs(change),direction=change>0?'X1':change<0?'X2':null;
   const stamp='20'+d[1].slice(6,8)+'-'+d[1].slice(3,5)+'-'+d[1].slice(0,2)+' '+d[2];
   const validDate=new Date(stamp.replace(' ','T')+':00Z');
   if(!Number.isFinite(validDate.getTime())||validDate.toISOString().slice(0,16)!==stamp.replace(' ','T')||!direction||stamp<lastDateTime||(d[3]&&d[3]!==direction)||(direction==='X1')!==(b[2]==='รับโอนจาก'))return null;
   const token=amounts.find(a=>!a.used&&a.cents===amount);if(!token)return null;token.used=true;
   const newline=raw.indexOf('\n',b.index),end=Math.min(balances[i+1]?.index??raw.length,newline<0?raw.length:newline);
   const description=raw.slice(b.index+b[0].length,end).trim();
   const row=d[1]+' '+d[2]+' '+direction+' ENET '+fmt(amount)+' '+fmt(balance)+' '+b[2]+(description?' '+description:'');
   rows.push(row);proof.push({page:page+1,sourceLine:i+1,ocrPageOffset:headings[page].index,dateRaw:d[0],balanceRaw:raw.slice(b.index,end),movementRaw:token.raw,dateOffset:d.index,balanceOffset:b.index,movementOffset:token.index,canonical:row,method:'scb_ocr_balanced_columns_v1'});
   prior=balance;lastDateTime=stamp;
  }
  if(amounts.some(a=>!a.used))return null;
  previousClosing=prior;
  const account=raw.match(/\b\d{3}-\d{6}-\d\b/);if(!account||(sourceAccount&&account[0]!==sourceAccount))return null;sourceAccount=account[0];
  pages.push('THE SIAM COMMERCIAL BANK PUBLIC COMPANY LIMITED\nAccount No. '+account[0]+'\n'+rows.join('\n'));
 }
 return {text:pages.join('\f'),proof};
}
module.exports={reconstructScbOcrColumns};
