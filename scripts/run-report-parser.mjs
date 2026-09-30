#!/usr/bin/env node
// Developer-only parser probe. Reads extracted report text from stdin and emits
// parsed metrics to stdout; it never writes report contents or results to disk.
import {parseReportText} from '../src/core/lab-parser.mjs';

let text='';
for await(const chunk of process.stdin)text+=chunk;
const metrics=parseReportText(text,{sex:null,age:null});
process.stdout.write(JSON.stringify(metrics,null,2)+'\n');
