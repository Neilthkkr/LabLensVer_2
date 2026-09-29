/* De-identification for text that may leave the device.
 *
 * Used twice: in the browser before anything is sent, and again in the
 * serverless function as a second gate. It is deliberately conservative — it
 * removes anything that looks like identity or contact info and keeps result
 * rows. Age and sex are passed separately by the caller; they are the only
 * demographics that are shared.
 */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.LabLensDeid=factory();
})(typeof self!=='undefined'?self:this,function(){
  'use strict';

  // A line that begins with one of these labels is header/footer material about
  // a person, place or document — never a lab result.
  const IDENTITY_LINE=/^[\s:;.,-]*(?:report(?:ed)?\s*(?:date|on)|registration\s*date|collect(?:ion|ed)\s*(?:date|on|at)|received\s*(?:date|on)|patient(?:\s+name)?|pt\.?\s*name|name|full\s*name|mr\.?|mrs\.?|ms\.?|master|miss|shri|smt|age(?:\s*\/\s*sex)?|sex|gender|d\.?o\.?b|date\s+of\s+birth|address|addr|city|phone|mobile|mob|tel|telephone|contact|e-?mail|mrn|uhid|pid|patient\s+id|reg(?:istration)?\.?\s*(?:no|number|id)?|sample\s*(?:id|no)|specimen\s*(?:id|no)|accession|barcode|lab\s*(?:id|no)|order\s*(?:id|no)|bill|invoice|visit|ward|bed|ip\s*no|op\s*no|aadhaar|aadhar|passport|emirates\s*id|insurance|policy|referr?ed?\s*by|ref\.?\s*by|ref\.?\s*doctor|doctor|dr\.|consultant|physician|pathologist|technologist|signed|authori[sz]ed|verified\s*by|printed|page\s+\d)/i;
  // Anywhere in a line: identifiers and demographic banners are never result rows.
  const IDENTITY_ANYWHERE=/\b(?:ref\.?\s*id|patient\s*id|report\s*ref|barcode|uhid|mrn|reg(?:istration)?\s*(?:no|id))\b|^\s*\d{1,3}\s*(?:year\(s\)|years?|yrs?)\s*[\/,|-]?\s*(?:male|female|m|f)?\s*$/i;
  // Web addresses, corrupted repeated overlay text from PDF footers, and stray @ fragments.
  const NOISE_LINE=/\b[a-z0-9-]{3,}\.(?:com|in|org|net|co|health)\b|@|for\s+assistance|([A-Za-z]{4,})\1{2,}/i;
  const MEASURE=/\d\s*(?:g\/|mg|gm|ng|pg|pmol|nmol|umol|u\/|miu|uiu|mmol|ug|iu|%|fl|sec|mil|cell|10\s*\^|\/u?l|\/m[lL]|mm\/hr)/i;

  const EMAIL=/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
  const URL_RE=/\b(?:https?:\/\/|www\.)\S+/gi;
  const DATE=[
    // One consistent separator only, so ranges such as "13.5-18" are never read as dates.
    /\b\d{4}([-/.])\d{1,2}\1\d{1,2}\b/g,
    /\b\d{1,2}([-/.])\d{1,2}\1(?:\d{4}|\d{2}(?!\d))\b/g,
    /\b\d{1,2}[\s-]+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*[\s,.-]+\d{2,4}\b/gi,
    /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+\d{2,4}\b/gi
  ];
  const CLINICIAN=/\b(?:dr|prof)\.?\s+[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,3}/g;
  const HONORIFIC_NAME=/\b(?:mr|mrs|ms|miss|master|shri|smt)\.?\s+[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,3}/g;

  function escapeRe(s){return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}

  function nameTokens(names){
    const out=new Set();
    (names||[]).forEach(n=>{
      String(n||'').split(/[\s,.;:/()-]+/).forEach(t=>{
        const w=t.trim();
        if(w.length>=3&&!/^(?:mr|mrs|miss|master|shri|smt|the|and)$/i.test(w))out.add(w);
      });
    });
    return [...out];
  }

  function deidentify(text,opts){
    opts=opts||{};
    const stats={lines:0,emails:0,urls:0,phones:0,ids:0,dates:0,clinicians:0,names:0};
    const tokens=nameTokens(opts.names);
    const nameRe=tokens.length?new RegExp('\\b(?:'+tokens.map(escapeRe).join('|')+')\\b','gi'):null;
    const kept=[];
    String(text||'').split(/\r?\n/).forEach(raw=>{
      let line=raw.replace(/\s+$/,'');
      if(!line.trim())return;
      if((IDENTITY_LINE.test(line)||IDENTITY_ANYWHERE.test(line)||NOISE_LINE.test(line))&&!MEASURE.test(line)){stats.lines++;return}
      line=line.replace(EMAIL,()=>{stats.emails++;return '[EMAIL]'});
      line=line.replace(URL_RE,()=>{stats.urls++;return '[URL]'});
      DATE.forEach(re=>{line=line.replace(re,()=>{stats.dates++;return '[DATE]'})});
      line=line.replace(CLINICIAN,()=>{stats.clinicians++;return '[CLINICIAN]'});
      line=line.replace(HONORIFIC_NAME,()=>{stats.names++;return '[NAME]'});
      if(nameRe)line=line.replace(nameRe,()=>{stats.names++;return '[NAME]'});
      // Phone numbers and long identifiers: any run of 9+ digits (allowing
      // spaces, dashes, brackets and a leading +) that is not a decimal.
      line=line.replace(/\+?\d[\d\s\-()]{7,}\d/g,m=>{
        const digits=m.replace(/\D/g,'').length;
        if(digits<9)return m;
        // A reference range ("150000-450000", "4000 - 11000") is two similar-length plain numbers.
        const range=/^(\d{1,7})\s*[-–]\s*(\d{1,7})$/.exec(m.trim());
        if(range&&Math.abs(range[1].length-range[2].length)<=2)return m;
        stats.phones++;return '[NUMBER]';
      });
      line=line.replace(/\b[A-Z]{0,4}\d{7,}[A-Z0-9-]*\b/g,()=>{stats.ids++;return '[ID]'});
      kept.push(line);
    });
    return {text:kept.join('\n'),stats};
  }

  // Age is shared as a whole number of years; sex only as male/female.
  function demographics(age,sex){
    const a=Number.isFinite(age)&&age>=0&&age<=120?Math.round(age):null;
    const s=sex==='male'||sex==='female'?sex:null;
    return {age:a,sex:s};
  }

  return {deidentify,demographics};
});
