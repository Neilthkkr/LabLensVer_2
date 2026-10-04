#!/usr/bin/env node
// Local dev server: serves the static app and routes /api/curate and /api/chat to netlify/functions.
// Usage: GEMINI_API_KEY=... node scripts/dev-server.mjs [port]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const port=+process.argv[2]||8765;
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json','.woff2':'font/woff2','.wasm':'application/wasm','.gz':'application/gzip','.pdf':'application/pdf'};
const {default:curate}=await import('../netlify/functions/curate.mjs');
const {default:chat}=await import('../netlify/functions/chat.mjs');
http.createServer(async(req,res)=>{
  const url=new URL(req.url,`http://localhost:${port}`);
  if(url.pathname==='/api/curate'||url.pathname==='/api/chat'){
    const chunks=[];for await(const c of req)chunks.push(c);
    const r=await (url.pathname==='/api/chat'?chat:curate)(new Request(url,{method:req.method,headers:{'content-type':req.headers['content-type']||''},body:req.method==='POST'?Buffer.concat(chunks):undefined}));
    res.writeHead(r.status,{'content-type':'application/json'});res.end(await r.text());return;
  }
  let f=path.join(root,decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
  if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);res.end('not found');return}
  res.writeHead(200,{'content-type':types[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(res);
}).listen(port,()=>console.error(`dev server on http://localhost:${port}`));
