// Render the authored SVG shots without a browser; complements, never replaces, UI screenshots.
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const require=createRequire(import.meta.url);
const nextRequire=createRequire(require.resolve('next'));
const sharp=nextRequire('sharp');
function load(file) {
 const output=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const module={exports:{}};
 const localRequire=(id)=>id==='./engine'?load('src/labs/storytelling/engine.ts'):require(id);
 new Function('require','module','exports',output)(localRequire,module,module.exports);
 return module.exports;
}
const {Scene}=load('src/labs/storytelling/Scene.tsx');
const beats=['arrival','notice','lantern','reaction','reunion'];
const layers=[];
for(let i=0;i<beats.length;i++){
 const svg=renderToStaticMarkup(React.createElement(Scene,{beat:beats[i]})).replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" width="500" height="280" ');
 layers.push({input:await sharp(Buffer.from(svg)).png().toBuffer(),left:i%2*500,top:Math.floor(i/2)*280});
}
await mkdir('docs/screenshots/storytelling',{recursive:true});
await sharp({create:{width:1000,height:840,channels:4,background:'#111615'}}).composite(layers).png().toFile('docs/screenshots/storytelling/scene-contact-sheet.png');
