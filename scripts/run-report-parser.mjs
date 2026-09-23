#!/usr/bin/env node
// Developer-only parser probe. Reads extracted report text from stdin and emits
// parsed metrics to stdout; it never writes report contents or results to disk.
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf('const STANDARD_RANGES =');
const end=html.indexOf('\nconst LS=',start);
if(start<0||end<=start)throw new Error('Embedded report parser was not found');
const context={console};
vm.createContext(context);
vm.runInContext(`${html.slice(start,end)}\nthis.__parseReportText=parseReportText;`,context);

let text='';
for await(const chunk of process.stdin)text+=chunk;
const metrics=context.__parseReportText(text,{sex:null,age:null});
process.stdout.write(JSON.stringify(metrics,null,2)+'\n');
