/* ตรวจการจัดวางภาพต้นฉบับก่อน OCR ไม่ตัดข้อความหรือบริเวณที่ PDF บังไว้ */
const TmnPdfImageProof = (() => {
  const fail = message => { throw Error('TMN screenshot graphics: ' + message); };
  const multiply = (a,b) => [a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],
    a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
  const rectangle = (matrix,[x,y,w,h]) => {
    if(matrix[1]!==0||matrix[2]!==0||!w||!h)fail('non-rectangular clipping or transform');
    const x1=matrix[0]*x+matrix[4],x2=matrix[0]*(x+w)+matrix[4];
    const y1=matrix[3]*y+matrix[5],y2=matrix[3]*(y+h)+matrix[5];
    return [Math.min(x1,x2),Math.min(y1,y2),Math.max(x1,x2),Math.max(y1,y2)];
  };
  const contains = (box,image) => image[0]>=box[0]-.01&&image[1]>=box[1]-.01&&image[2]<=box[2]+.01&&image[3]<=box[3]+.01;
  function inspect(content,box,{rotation=0,safeGraphicsState=()=>false}={}) {
    if(rotation!==0)fail('rotated page requires rendered review');
    let text=String(content||'');
    text=text.replace(/\bBT\b([\s\S]*?)\bET\b/g,(block,inside)=>{
      // เก็บเฉพาะกรณีข้อความว่างที่พิสูจน์ได้เท่านั้น โดยไม่เปลี่ยน clipping
      const remaining=inside.replace(/\(\s*\)/g,' ').replace(/<\s*>/g,' ');
      if(/[()<>\\]/.test(remaining)||[...inside.matchAll(/([+\d.-]+)\s+Tr\b/g)].some(m=>!Number.isInteger(+m[1])||+m[1]<0||+m[1]>3)
        ||remaining.replace(/\/[A-Za-z0-9_.-]+/g,' ').replace(/[+-]?(?:\d+(?:\.\d*)?|\.\d+)/g,' ')
          .replace(/\b(?:Tf|Tm|Td|TD|TL|Tc|Tw|Tz|Ts|Tr|Tj|TJ)\b|T\*|['"]/g,' ').replace(/[\s\[\]]/g,''))fail('native text must be preserved');
      return ' ';
    }).replace(/%[^\r\n]*/g,' ');
    const token=/\s+|\/[A-Za-z0-9_.-]+|[+-]?(?:\d+(?:\.\d*)?|\.\d+)|[A-Za-z][A-Za-z0-9]*\*?/y;
    let state={matrix:[1,0,0,1,0,0],clips:[]},path=null,pendingClip=false,index=0,operatorCount=0;
    const stack=[],args=[],draws=[];
    const arity=(n,type='number')=>{if(args.length!==n||args.some(x=>typeof x!==type||(type==='number'&&!Number.isFinite(x))))fail('invalid operator arguments');};
    while(index<text.length){
      token.lastIndex=index;const match=token.exec(text);if(!match)fail('unsupported PDF token');index=token.lastIndex;
      const value=match[0];if(/^\s+$/.test(value))continue;
      if(value[0]==='/'){args.push(value.slice(1));continue;}
      if(/^[+-.\d]/.test(value)){args.push(Number(value));continue;}
      operatorCount++;
      if(value==='q'){arity(0);stack.push({matrix:[...state.matrix],clips:state.clips.map(x=>[...x])});}
      else if(value==='Q'){arity(0);if(!stack.length)fail('unbalanced graphics state');state=stack.pop();}
      else if(value==='cm'){arity(6);state.matrix=multiply(state.matrix,args);if(state.matrix.some(x=>!Number.isFinite(x)))fail('non-finite transform');}
      else if(value==='re'){arity(4);if(path)fail('multiple clipping paths');path=rectangle(state.matrix,args);}
      else if(value==='W'||value==='W*'){arity(0);if(!path||pendingClip)fail('unknown clipping path');pendingClip=true;}
      else if(value==='n'){arity(0);if(pendingClip)state.clips.push(path);path=null;pendingClip=false;}
      else if(value==='gs'){arity(1,'string');if(!safeGraphicsState(args[0]))fail('transparency or unsupported graphics state');}
      else if(value==='Do'){
        arity(1,'string');if(pendingClip||path)fail('unfinished clipping path');
        const m=state.matrix;if(m[0]<=0||m[3]<=0||m[1]!==0||m[2]!==0)fail('image is not upright');
        const bounds=rectangle(m,[0,0,1,1]),page=[box.x,box.y,box.x+box.width,box.y+box.height];
        if(!contains(page,bounds)||state.clips.some(clip=>!contains(clip,bounds)))fail('image pixels are clipped');
        draws.push({imageName:args[0],matrix:[...m],bounds,clipBounds:state.clips.map(x=>[...x])});
      } else if(['w','M','J','j','G','g'].includes(value))arity(1);
      else if(['RG','rg'].includes(value))arity(3);
      else if(['K','k'].includes(value))arity(4);
      else fail('unrendered operator '+value);
      args.length=0;
    }
    if(args.length||stack.length||path||pendingClip)fail('incomplete graphics state');
    if(draws.length!==1)fail('requires exactly one drawn screenshot');
    return {version:'tmn-single-image-graphics-v1',...draws[0],operatorCount};
  }
  return {inspect};
})();
if(typeof module!=='undefined')module.exports=TmnPdfImageProof;
