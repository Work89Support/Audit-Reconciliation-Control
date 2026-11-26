import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),P=require('../tmn-pdf-image-proof.js');
const box={x:0,y:0,width:600,height:800};
const wrapped='q 1 0 0 -1 0 800 cm q 0 0 600 800 re W* n 0.05 w 2 M 2 J 2 j 0 0 0 RG /Safe gs q 400 0 0 -700 90 780 cm /Image Do Q Q Q';
const options={safeGraphicsState:name=>name==='Safe'};
let proof=P.inspect(wrapped,box,options);
assert.deepEqual(proof.matrix,[400,0,0,700,90,20]);assert.deepEqual(proof.bounds,[90,20,490,720]);
assert.equal(proof.imageName,'Image');assert.equal(proof.clipBounds.length,1);
const simple='q 400 0 0 700 0 0 cm /Img Do Q';
assert.deepEqual(P.inspect(simple,box).matrix,[400,0,0,700,0,0]);
assert.equal(P.inspect('BT /Font 10 Tf 1 0 0 1 0 0 Tm ( ) Tj ET '+simple,box).imageName,'Img');
for(const content of [
 wrapped.replace('600 800 re','100 100 re'),
 wrapped.replace('90 780 cm','500 780 cm'),
 wrapped.replace('/Safe gs','/Unsafe gs'),
 wrapped.replace('/Image Do','/Image Do /Image Do'),
 wrapped.replace('/Image Do','1 0 0 1 0 0 cm /Image Do 0 0 10 10 re f'),
 wrapped.replace('400 0 0 -700','400 1 0 -700'),
 wrapped.replace('400 0 0 -700','-400 0 0 -700'),
 wrapped.replace('Q Q Q','Q Q'),
 'BT (native evidence) Tj ET '+simple,
 'BT <0041> Tj ET '+simple,
 'BT (( )) Tj ET '+simple,
 'BT 7.0 Tr ( ) Tj ET '+simple,
 'BT ( ) Tj /Other Do ET '+simple,
 'q Q',
 'q 0 0 600 800 re 10 10 20 20 re W n '+simple+' Q',
])assert.throws(()=>P.inspect(content,box,options),/TMN screenshot graphics/,content);
assert.throws(()=>P.inspect(simple,box,{rotation:90}),/rotated page/);
assert.throws(()=>P.inspect(wrapped,box),/graphics state/);
console.log('PASS TMN composed transforms, clipping containment, native evidence, overlay and transparency guards');
