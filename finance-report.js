(function(root){
 'use strict';
 const roles=['lead','exec','admin'];
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const cents=v=>{if(v===null||v===undefined||v===''||!/^\d+(\.\d{1,2})?$/.test(String(v)))return null;const n=Math.round(Number(v)*100);return Number.isSafeInteger(n)?n:null;};
 const money=v=>v===null||v===undefined?'รอยืนยัน':Number(v).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2});
 const count=v=>Number(v).toLocaleString('th-TH');
 const day=d=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(d))throw Error('วันที่ไม่ถูกต้อง');const t=Date.parse(d+'T00:00:00Z');if(!Number.isFinite(t)||new Date(t).toISOString().slice(0,10)!==d)throw Error('วันที่ไม่ถูกต้อง');return t;};
 const iso=t=>new Date(t).toISOString().slice(0,10),shift=(d,n)=>iso(day(d)+n*86400000);
 function dates(from,to){const length=(day(to)-day(from))/86400000+1;if(length<1||length>31)throw Error('เลือกช่วง 1–31 วัน');return Array.from({length},(_,i)=>shift(from,i));}
 function period(mode,value,from,to,today){
  if(mode==='month'){if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(value))throw Error('เลือกเดือน');from=value+'-01';const [y,m]=value.split('-').map(Number);to=iso(Date.UTC(y,m,0));if(to>=today)to=shift(today,-1);}
  else if(mode==='day'){to=from;}
  else if(mode==='week'){to=shift(today,-1);from=shift(to,-6);}
  const ds=dates(from,to);if(to>=today)throw Error('รายงานใช้วันเต็มถึงเมื่อวาน เพื่อไม่เทียบวันไม่ครบ');
  let previous;
  if(mode==='month'){const [y,m]=from.slice(0,7).split('-').map(Number),start=iso(Date.UTC(y,m-2,1));const last=iso(Date.UTC(y,m-1,0));previous={from:start,to:iso(Math.min(day(last),day(start)+(ds.length-1)*86400000))};}
  else previous={from:shift(from,-ds.length),to:shift(from,-1)};
  return {from,to,previous,equalDays:dates(previous.from,previous.to).length===ds.length};
 }
 function unique(rows,key='id'){const out=new Map();for(const r of rows){if(!r[key])throw Error('ข้อมูลขาดรหัสอ้างอิง');if(out.has(r[key])&&JSON.stringify(out.get(r[key]))!==JSON.stringify(r))throw Error('พบรหัสซ้ำที่ข้อมูลไม่ตรงกัน');out.set(r[key],r);}return [...out.values()];}
 function boSummary(rows,companies,from,to){
  const all=unique(rows,'scopeKey'),wanted=dates(from,to),inScope=all.filter(r=>companies.includes(r.company)&&wanted.includes(r.date));
  const expected=companies.length*wanted.length,complete=inScope.filter(r=>r.complete===true).length===expected&&expected>0;
  let deposit=0,withdraw=0,n=0,deposits=0;for(const r of inScope){const a=cents(r.deposit),b=cents(r.withdraw);if(a===null||b===null)continue;deposit+=a;withdraw+=b;n+=Number(r.count)||0;deposits+=Number(r.deposits)||0;}
  if(!Number.isSafeInteger(deposit)||!Number.isSafeInteger(withdraw))throw Error('ยอดเกินขอบเขตที่คำนวณได้');
  return {from,to,rows:inScope,deposit:deposit/100,withdraw:withdraw/100,count:n,deposits,net:(deposit-withdraw)/100,complete,
   covered:inScope.filter(r=>r.complete===true).length,expected,hasValues:inScope.some(r=>cents(r.deposit)!==null),
   average:deposits?deposit/100/deposits:null};
 }
 function caseData(reports,companies){
  const select=k=>reports.flatMap(r=>r[k]||[]);
  for(const r of reports)if(!companies.includes(r.company)||['damages','risks','collections','receipts'].some(k=>(r[k]||[]).some(x=>x.company!==r.company)))throw Error('ข้อมูลบริษัทไม่ตรงสิทธิ์ หยุดแสดงผล');
  const damages=unique(select('damages')),collections=unique(select('collections'),'damage_id'),receipts=unique(select('receipts'));
  const losses=damages.map(d=>{const c=collections.find(c=>c.damage_id===d.id),amount=cents(d.amount),approved=cents(c?.approved_amount);
   const rs=receipts.filter(r=>r.damage_id===d.id&&!r.voided_at);let paid=0,valid=!!c&&!!c.approved_by&&!!c.approved_at&&amount!==null&&approved!==null&&approved<=amount;
   for(const r of rs){const n=cents(r.amount);if(n===null||n<=0||!r.source_file_id||!r.confirmed_by||!r.confirmed_at){valid=false;continue;}paid+=n;}
   if(paid>approved||!Number.isSafeInteger(paid))valid=false;
   const category=(d.cause||'').match(/^\[damage:v[12]:(employee|backoffice|pm|game|external|system)(?::[^\]]+)?\]/)?.[1]||'unclassified';
   valid=valid&&c.category===category;
   const verified=valid&&category==='employee'&&c.category==='employee'&&!!String(c.party_code||'').trim()&&!!String(c.party_name||'').trim()&&c.party_name===d.employee&&!!c.shift&&c.shift===d.shift;
   return {...d,amount:amount===null?null:amount/100,category,collection:c||null,receipts:rs,paid:valid?paid/100:null,
    net:valid?(amount-paid)/100:null,approved:valid?approved/100:null,personVerified:verified,
    personCode:verified?c.party_code:null,personName:verified?c.party_name:null,
    collectionLabel:!valid?'รอยืนยันสมุดรับคืน':paid===approved?'รับคืนครบตามยอดอนุมัติ':paid?'รับคืนบางส่วน':'ยังไม่มีรับคืนยืนยัน'};
  });
  const identity=new Map();for(const d of losses.filter(r=>r.personVerified)){const key=d.company+'|'+d.personCode;if(identity.has(key)&&identity.get(key)!==d.personName)identity.set(key,null);else if(!identity.has(key))identity.set(key,d.personName);}
  for(const d of losses)if(d.personVerified&&identity.get(d.company+'|'+d.personCode)===null){d.personVerified=false;d.personCode=null;d.personName=null;}
  const linked=new Set(damages.map(d=>d.exception_id));
  const risks=unique(select('risks')).filter(r=>!linked.has(r.id)).map(r=>{const n=cents(r.amount),fx=Number(r.fx_rate);return {...r,amount:n!==null&&r.currency==='THB'?n/100:n!==null&&Number.isFinite(fx)&&fx>0?n/100*fx:null};});
  return {losses,risks};
 }
 function lossTotals(rows){const known=rows.filter(r=>r.amount!==null),ledger=rows.filter(r=>r.net!==null);return {amount:known.reduce((s,r)=>s+Math.round(r.amount*100),0)/100,
  paid:ledger.reduce((s,r)=>s+Math.round(r.paid*100),0)/100,net:ledger.reduce((s,r)=>s+Math.round(r.net*100),0)/100,
  pending:rows.length-ledger.length,invalid:rows.length-known.length,count:rows.length};}
 function staffGroups(rows,group='person'){
  const map=new Map(),add=(key,label,r,amount,paid,pending)=>{if(!map.has(key))map.set(key,{key,label,rows:[],amount:0,paid:0,pending:false,caseIds:new Set()});const g=map.get(key);g.rows.push(r);g.amount+=Math.round(amount*100);if(paid!==null)g.paid+=Math.round(paid*100);g.pending=g.pending||pending||paid===null;g.caseIds.add(r.id);};
  for(const r of rows.filter(r=>r.category==='employee'&&r.amount!==null)){
   const verified=r.personVerified&&r.approved!==null,key=group==='company'?r.company:group==='shift'?r.shift||'รอยืนยันกะ':verified?r.company+'|'+r.personCode:'unverified';
   const label=group==='company'?r.company:group==='shift'?r.shift||'รอยืนยันกะ':verified?r.personCode+' · '+r.personName+' · '+r.company:'รอยืนยันผู้เกี่ยวข้อง';
   if(verified){add(key,label,r,r.approved,r.paid,false);if(r.amount>r.approved)add(group==='person'?'unverified':key,group==='person'?'รอยืนยันส่วนที่ยังไม่จัดสรร':label,r,r.amount-r.approved,null,true);}
   else add(key,label,r,r.amount,null,true);
  }
  return [...map.values()].map(g=>({...g,amount:g.amount/100,paid:g.pending?null:g.paid/100,net:g.pending?null:(g.amount-g.paid)/100,count:g.caseIds.size}));
 }
 function chartsFor(s,previous,companies,losses,risks){
  const sum=(rows,key)=>rows.reduce((n,r)=>n+Number(r[key]||0),0),group=(rows,key,value)=>{const m=new Map();for(const r of rows)m.set(r[key],(m.get(r[key])||0)+Number(r[value]||0));return [...m].map(([label,value])=>({label,value}));};
  const wanted=dates(s.from,s.to),days=wanted.map(date=>{const r=s.bo.rows.filter(r=>r.date===date);return {label:date.slice(5),value:sum(r,'deposit'),count:sum(r,'count'),average:sum(r,'deposits')?sum(r,'deposit')/sum(r,'deposits'):0,complete:r.length===companies.length&&r.every(r=>r.complete)};});
  const hours=Array.from({length:24},(_,hour)=>({label:String(hour).padStart(2,'0'),value:s.bo.rows.flatMap(r=>r.hours||[]).filter(r=>r.hour===hour).reduce((n,r)=>n+r.count,0)}));
  const channels=group(s.bo.rows.flatMap(r=>r.channels||[]),'account','amount');
  return [
   {title:'แนวโน้มยอดฝาก BO รายวัน',unit:'บาท · วันข้อมูลไม่ครบแสดงช่องว่าง',items:days.map(r=>({...r,value:r.complete?r.value:null})),kind:'line'},
   {title:'จำนวนรายการ BO รายวัน',unit:'รายการฝาก + ถอน · วันไม่ครบแสดงช่องว่าง',items:days.map(r=>({label:r.label,value:r.complete?r.count:null})),kind:'line'},
   {title:'ยอดฝาก BO แยกบริษัท',unit:'บาท · ยอดที่อ่านได้ อาจยังไม่ครบ',items:companies.map(c=>({label:c,value:sum(s.bo.rows.filter(r=>r.company===c),'deposit')}))},
   {title:'เปรียบเทียบยอดฝากช่วงก่อน',unit:s.bo.complete&&previous.complete&&s.equalDays?'บาท · ช่วงวันที่จำนวนวันเท่ากัน':'รอข้อมูลทั้งสองช่วงครบก่อนเปรียบเทียบ',items:s.bo.complete&&previous.complete&&s.equalDays?[{label:'ช่วงก่อน',value:previous.deposit},{label:'ช่วงเลือก',value:s.bo.deposit}]:[]},
   {title:'รายการ BO ตามชั่วโมงต้นทาง',unit:'รายการ · เฉพาะแถวที่ทราบเวลาทำรายการ',items:hours,kind:'line'},
   {title:'ยอดฝากตามบัญชี / ช่องทาง BO',unit:'บาท · ไม่ใช่ช่องทางโฆษณา',items:channels},
   {title:'ยอดฝากเฉลี่ยต่อรายการ',unit:'บาท / รายการฝาก · วันไม่ครบแสดงช่องว่าง',items:days.map(r=>({label:r.label,value:r.complete?r.average:null})),kind:'line'},
   {title:'ความเสี่ยงที่ยังไม่ยืนยันเสียหาย',unit:'บาท · สถานะปัจจุบัน เคสเกิดถึงวันสิ้นช่วง',items:group(risks.filter(r=>r.amount!==null),'company','amount')},
   {title:'เสียหายจริงที่ยืนยันแล้ว',unit:'บาท · ตามวันที่เกิดเหตุในช่วงเลือก',items:group(losses.filter(r=>r.amount!==null),'company','amount')},
   {title:'รับคืนและคงค้างตามหลักฐาน',unit:'บาท · เฉพาะเคสที่มีสมุดรับคืนตรวจสอบได้',items:[{label:'รับคืนยืนยัน',value:lossTotals(losses).paid},{label:'คงค้างยืนยัน',value:lossTotals(losses).net}]}
  ];
 }
 function chartSvg(c,W=520,H=230){
  const number=v=>Math.abs(v)>=1e6?(v/1e6).toFixed(1)+'ล.':Math.abs(v)>=1000?(v/1000).toFixed(1)+'พ.':Number(v).toFixed(v%1?1:0);
  const text=(x,y,t,anchor='start')=>`<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="sans-serif" font-size="12" fill="#263e59">${esc(t)}</text>`;
  const values=c.items.filter(r=>r.value!==null&&Number.isFinite(r.value)),max=Math.max(1,...values.map(r=>r.value))*1.15;let body='';
  if(!values.length)return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(c.title)}">${text(W/2,H/2,'ยังไม่มีข้อมูลที่ครบพอแสดงกราฟ','middle')}</svg>`;
  if(c.kind==='line'){
   const L=58,R=24,T=18,B=43,w=W-L-R,h=H-T-B;[0,.5,1].forEach(f=>{body+=`<line x1="${L}" x2="${W-R}" y1="${T+h*(1-f)}" y2="${T+h*(1-f)}" stroke="#dae6f1"/>`+text(L-6,T+h*(1-f)+4,number(max*f),'end');});
   let path='',on=false;const step=Math.max(1,Math.ceil(c.items.length/6));c.items.forEach((r,i)=>{const x=L+(i+.5)*w/c.items.length;if(r.value===null){on=false;return;}const y=T+h-r.value/max*h;path+=(on?'L':'M')+x+','+y+' ';on=true;body+=`<circle cx="${x}" cy="${y}" r="3" fill="#0873d8"><title>${esc(r.label)}: ${esc(money(r.value))}</title></circle>`;if(i%step===0&&i<c.items.length-1||i===c.items.length-1)body+=text(x,H-22,r.label,'middle');});body+=`<path d="${path}" fill="none" stroke="#0873d8" stroke-width="2"/>`;
  }else {const L=Math.min(130,W*.32),R=60,row=(H-22)/values.length;values.forEach((r,i)=>{const y=8+i*row,width=(W-L-R)*r.value/max;body+=text(L-8,y+row*.6,String(r.label).slice(0,20),'end')+`<rect x="${L}" y="${y+3}" width="${width}" height="${Math.max(4,row-10)}" fill="#0873d8"/>`+text(L+width+5,y+row*.6,number(r.value));});}
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(c.title+' '+c.unit)}"><title>${esc(c.title)}</title>${body}</svg>`;
 }
 function pagination(rows,page){const size=20,pages=Math.max(1,Math.ceil(rows.length/size));page=Math.min(Math.max(1,page),pages);return {rows:rows.slice((page-1)*size,page*size),page,pages,total:rows.length};}
 root.FinanceReport={roles,esc,cents,money,day,dates,shift,period,unique,boSummary,caseData,lossTotals,staffGroups,chartsFor,chartSvg,pagination};
 if(typeof module!=='undefined')module.exports=root.FinanceReport;
})(typeof window==='undefined'?globalThis:window);
