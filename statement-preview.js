/* Read-only original PDF rendering. No reconciliation or approval mutations. */
const StatementPreview = (() => {
  let libraryLoading;
  function loadLib(){
    if(typeof pdfjsLib!=='undefined'){pdfjsLib.GlobalWorkerOptions.workerSrc='vendor/pdf.worker.min.js';return Promise.resolve(pdfjsLib);}
    if(!libraryLoading)libraryLoading=new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src='vendor/pdf.min.js';
      script.onload=()=>{if(typeof pdfjsLib==='undefined')return reject(Error('โหลดตัวแสดง PDF ไม่สำเร็จ'));pdfjsLib.GlobalWorkerOptions.workerSrc='vendor/pdf.worker.min.js';resolve(pdfjsLib);};
      script.onerror=()=>reject(Error('โหลดตัวแสดง PDF ไม่สำเร็จ'));document.head.appendChild(script);
    }).catch(error=>{libraryLoading=null;throw error;});
    return libraryLoading;
  }
  async function mount(host, file) {
    const actor=Sb.authUser()?.id;
    host.dataset.file=file.id;
    host.dataset.ready='false';delete host.dataset.page;delete host.dataset.pageCount;
    host.innerHTML='<p role="status">กำลังโหลดภาพสเตทเมนต์ต้นฉบับ…</p>';
    let task,doc,renderTask,observer,disposed=false,page=1,zoom=1,busy=false;
    const valid=()=>!disposed&&host.isConnected&&Sb.authUser()?.id===actor;
    const dispose=()=>{if(disposed)return;disposed=true;observer?.disconnect();renderTask?.cancel();task?.destroy()?.catch(()=>{});};
    observer=new MutationObserver(()=>{if(!host.isConnected)dispose();});
    observer.observe(document.body,{childList:true,subtree:true});
    try {
      const [lib,bytes]=await Promise.all([loadLib(),Sb.download(file.storage_path)]);
      if(!valid()){dispose();return;}
      // PDF.js may transfer/detach its buffer. Preserve the authenticated snapshot.
      task=lib.getDocument({data:new Uint8Array(bytes.slice(0)),isEvalSupported:false});
      task.onPassword=(update,reason)=>{
        if(!valid())return dispose();
        host.innerHTML='<p role="status">'+(reason===2?'รหัสผ่านไม่ถูกต้อง':'PDF นี้มีรหัสผ่าน')+'</p><label>รหัสผ่าน PDF <input type="password" autocomplete="off" data-pdf-password></label><button type="button" data-pdf-unlock>เปิดเอกสาร</button>';
        host.querySelector('[data-pdf-unlock]').onclick=()=>{const input=host.querySelector('[data-pdf-password]');const password=input.value;input.value='';update(password);host.innerHTML='<p role="status">กำลังเปิดเอกสาร…</p>';};
      };
      doc=await task.promise;
      if(!valid()){dispose();return;}
      if(file.preview_page){page=Number(file.preview_page);if(!Number.isInteger(page)||page<1||page>doc.numPages)throw Error('เลขหน้าที่อ้างอิงอยู่นอกเอกสาร');}
      host.innerHTML='<div class="statement-preview-tools"><button type="button" data-pdf-prev>หน้าก่อน</button><span data-pdf-status role="status"></span><button type="button" data-pdf-next>หน้าถัดไป</button><button type="button" data-pdf-zoom>ขยายภาพ</button></div><div class="statement-preview-image"><canvas aria-label="ภาพสเตทเมนต์ต้นฉบับ"></canvas></div><p data-pdf-error role="alert"></p>';
      const canvas=host.querySelector('canvas'),status=host.querySelector('[data-pdf-status]');
      async function draw(){
        if(busy||!valid())return;busy=true;
        host.dataset.ready='false';
        host.querySelectorAll('button').forEach(b=>b.disabled=true);
        status.textContent=`กำลังวาดหน้า ${page} / ${doc.numPages}…`;
        try {
          const pdfPage=await doc.getPage(page);if(!valid())return;
          host.dataset.page=String(page);host.dataset.pageCount=String(doc.numPages);
          const base=pdfPage.getViewport({scale:1});
          const scale=Math.min(2,Math.max(.5,(host.clientWidth||600)/base.width))*zoom;
          const viewport=pdfPage.getViewport({scale});
          canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
          renderTask=pdfPage.render({canvasContext:canvas.getContext('2d'),viewport});await renderTask.promise;
          if(valid()){host.dataset.ready='true';status.textContent=`หน้า ${page} / ${doc.numPages} · ภาพจาก PDF ต้นฉบับ`;host.querySelector('[data-pdf-error]').textContent='';}
        }catch(error){if(valid())host.querySelector('[data-pdf-error]').textContent='แสดงภาพไม่ได้: '+error.message;}
        finally{busy=false;if(valid()){host.querySelectorAll('button').forEach(b=>b.disabled=false);host.querySelector('[data-pdf-prev]').disabled=page===1;host.querySelector('[data-pdf-next]').disabled=page===doc.numPages;}}
      }
      host.querySelector('[data-pdf-prev]').onclick=()=>{if(page>1){page--;draw();}};
      host.querySelector('[data-pdf-next]').onclick=()=>{if(page<doc.numPages){page++;draw();}};
      host.querySelector('[data-pdf-zoom]').onclick=()=>{zoom=zoom===1?2:1;host.querySelector('[data-pdf-zoom]').textContent=zoom===1?'ขยายภาพ':'ย่อภาพ';draw();};
      await draw();
    }catch(error){if(valid())host.textContent='เปิดภาพสเตทเมนต์ไม่ได้: '+error.message+' — คู่ที่เตรียมไว้ยังอยู่';dispose();}
    return dispose;
  }
  return {mount};
})();
