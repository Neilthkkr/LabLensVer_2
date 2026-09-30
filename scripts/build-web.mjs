import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const out=path.join(root,'dist-web');
await rm(out,{recursive:true,force:true});
await mkdir(out,{recursive:true});
for(const item of ['index.html','app.js','service-worker.js','manifest.webmanifest','icon.svg','icons','vendor']){
  await cp(path.join(root,item),path.join(out,item),{recursive:true});
}
for(const item of ['core','privacy']){
  const target=path.join(out,'src',item);
  await mkdir(path.dirname(target),{recursive:true});
  await cp(path.join(root,'src',item),target,{recursive:true});
}
