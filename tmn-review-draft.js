/* ร่างสำหรับ Audit เท่านั้น ห้ามใช้แทนผลอ่านที่ผ่าน Quality Gate */
const TmnReviewDraft=(()=>{
 const months=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
 const dateOf=text=>{const m=String(text).match(new RegExp('(\\d{1,2})\\s+('+months.join('|')+')\\s+(\\d{4})'));if(!m)return '';const y=+m[3]>2400?+m[3]-543:+m[3],v=`${y}-${String(months.indexOf(m[2])+1).padStart(2,'0')}-${m[1].padStart(2,'0')}`;const parsed=new Date(v+'T00:00:00Z');return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===v?v:'';};
 function build(envelope,file,job){
  if(envelope.sourceFileId!==file.id||!/^[a-f0-9]{64}$/.test(envelope.sourceSha256||'')||(file.checksum&&envelope.sourceSha256!==file.checksum))throw Error('TMN review source checksum mismatch');
  const pages=[...envelope.pages].sort((a,b)=>a.page-b.page),rows=[],excludedRows=[],issues=[];let date='';
  for(const p of pages){
   const raw=String(p.originalOcr??p.text??''),markers=[...raw.matchAll(/\bROW\s*(\d{1,4})\b/gi)],head=raw.slice(0,markers[0]?.index??raw.length);date=dateOf(head)||date;
   const complete=markers.length===p.geometry?.rows?.length&&markers.every((m,i)=>+m[1]===i+1);
   if(!complete||p.error)issues.push({page:p.page,row:null,message:p.error?.message||'จำนวน marker ไม่ตรงแถวภาพ ต้องตรวจทุกแถวของหน้านี้'});
   for(const region of p.geometry?.rows||[]){
    const id=`P${p.page}-R${region.row}`,m=complete?markers[region.row-1]:null,block=m?raw.slice(m.index+m[0].length,markers[region.row]?.index??raw.length):'';
    const amounts=[...block.matchAll(/(?:^|\s)([+\-−])\s*(?:฿|B|บาท)?\s*(\d[\d,]*\.\d{2})(?=\s|$)/gi)];
    const clocks=[...block.matchAll(/(?:^|\s)((?:[01]?\d|2[0-3]):[0-5]\d(?::[0-5]\d)?)(?=\s|$)/g)];
    const fee=/ค่าธรรมเนียม/.test(block),incoming=/รับเงินจาก|รับโอนเงิน|เงินโอนเข้า|เติมเงินเข้า/.test(block),outgoing=/โอนเงินออก|โอนเงินให้|ส่งเงินให้|ถอนเงิน|จ่ายเงิน|ชำระเงิน/.test(block);
    const direction=incoming&&!outgoing?'deposit':outgoing&&!incoming?'withdraw':'',amount=amounts.length===1?Number(amounts[0][2].replace(/,/g,'')):null;
    const evidence=p.rowEvidence?.find(r=>r.sourceRowId===id),fragment=evidence?.sourceFragments?.find(f=>f.field==='time');
    const continuation=fragment?.raw?.match(/(?:^|\s)((?:[01]?\d|2[0-3]):[0-5]\d)(?=\s|$)/)?.[1];
    const time=clocks.length===1?clocks[0][1].slice(0,5):clocks.length===0&&continuation?continuation:'';
    const problems=[];if(!date)problems.push('ตรวจวันที่จากหัวภาพ');if(!time)problems.push('เวลาไม่ครบ/มีหลายค่า');if(amount===null)problems.push('ยอดไม่ครบ/มีหลายค่า');if(!direction&&!fee)problems.push('ตรวจประเภทฝาก/ถอน');
    if(direction&&amounts.length===1&&((direction==='deposit')!==(amounts[0][1]==='+')))problems.push('เครื่องหมายยอดขัดกับประเภท');
    const description=block.replace(/\b(?:TAIL|HEAD)\b[\s\S]*$/,'').split(/\r?\n/).filter(s=>/รับเงิน|โอนเงิน|ถอนเงิน|เติมเงิน|จ่ายเงิน|ชำระเงิน|ค่าธรรมเนียม/.test(s)).join(' ').trim();
    const row={id,page:p.page,date,time,direction,amount,description,rawOcr:block,sourceRegions:region,sourceImageSha256:p.sourceImageSha256,sourceFragments:evidence?.sourceFragments||[],issues:problems};
    if(fee)excludedRows.push({...row,excludedReason:'ค่าธรรมเนียม'});else rows.push(row);
    if(problems.length&&!fee)issues.push({page:p.page,row:region.row,sourceRowId:id,message:problems.join(' · ')});
   }
   date=dateOf(raw.slice(raw.lastIndexOf('TAIL')))||date;
  }
  return {version:1,sourceType:'tmn-ocr-review-draft-v1',sourceId:file.id,sourceChecksum:envelope.sourceSha256,company:job.company,businessDate:job.business_date,pageCount:envelope.pageCount,rows,excludedRows,issues,physicalRowCount:rows.length+excludedRows.length,reviewed:false};
 }
 return {build};
})();
if(typeof module!=='undefined')module.exports=TmnReviewDraft;
