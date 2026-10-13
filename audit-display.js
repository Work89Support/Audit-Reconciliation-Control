/* Display only. Never use formatted labels for matching, sorting or persistence. */
(function(root){
 'use strict';
 function dateTime(value){
  if(value===null||value===undefined||value==='')return 'ยังไม่มีข้อมูลเวลา';
  let input=value;
  if(typeof value==='string'){
   const text=value.trim();
   if(/^\d{4}-\d{2}-\d{2}$/.test(text))return dateOnly(text);
   if(!/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/.test(text))return 'ไม่พบเวลาที่ถูกต้อง';
   if(dateOnly(text.slice(0,10))==='ไม่พบวันที่ที่ถูกต้อง')return 'ไม่พบเวลาที่ถูกต้อง';
   input=text.replace(' ','T');
   // Older UI notes contain wall-clock Thai timestamps without an offset.
   if(!/(Z|[+-]\d{2}:?\d{2})$/.test(input))input+='+07:00';
  }
  const date=new Date(input);if(!Number.isFinite(date.getTime()))return 'ไม่พบเวลาที่ถูกต้อง';
  const parts=new Intl.DateTimeFormat('th-TH-u-ca-gregory',{timeZone:'Asia/Bangkok',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date),get=type=>parts.find(p=>p.type===type)?.value;
  return `${get('day')} ${get('month')} ${get('year')} เวลา ${get('hour')}:${get('minute')} น. (เวลาไทย)`;
 }
 function dateOnly(value){const text=String(value||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(text))return 'ไม่พบวันที่ที่ถูกต้อง';const date=new Date(text+'T00:00:00+07:00');if(!Number.isFinite(date.getTime())||new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(date)!==text)return 'ไม่พบวันที่ที่ถูกต้อง';return new Intl.DateTimeFormat('th-TH-u-ca-gregory',{timeZone:'Asia/Bangkok',day:'numeric',month:'short',year:'numeric'}).format(date);}
 root.AuditDisplay={dateTime,dateOnly};if(typeof module!=='undefined')module.exports=root.AuditDisplay;
})(typeof window==='undefined'?globalThis:window);
