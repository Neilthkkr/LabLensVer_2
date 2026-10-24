// Plain-language summaries of a profile's saved reports. Pure and local: no AI, no network.
const RANK={normal:0,safe:0,borderline:1,low:2,high:2};
const rank=s=>RANK[s]??null;
const num=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
const time=r=>{const t=new Date(r.date||r.analyzedAt).getTime();return Number.isFinite(t)?t:0};
const fmt=v=>String(Math.round(v*100)/100);

// Compare the last two numeric readings of each marker. Returns changes, most important first.
export function markerChanges(reports,{limit=3,minChange=0.05}={}){
  const sorted=(reports||[]).slice().sort((a,b)=>time(a)-time(b));
  const series=new Map();
  for(const r of sorted)for(const m of r.metrics||[]){
    const v=num(m.value);if(v==null||!m.key)continue;
    if(!series.has(m.key))series.set(m.key,[]);
    series.get(m.key).push({v,status:m.status,name:m.name||m.key,unit:m.unit||''});
  }
  const out=[];
  for(const pts of series.values()){
    if(pts.length<2)continue;
    const prev=pts[pts.length-2],cur=pts[pts.length-1];
    const ra=rank(prev.status),rb=rank(cur.status);
    if(ra==null||rb==null)continue;
    const base=Math.abs(prev.v)||1,rel=(cur.v-prev.v)/base;
    let trend,weight;
    if(rb<ra){trend='improved';weight=2}
    else if(rb>ra){trend='worsened';weight=3}
    else if(rb===0||Math.abs(rel)<minChange)continue;
    else if(cur.status==='high'||prev.status==='high'){trend=cur.v<prev.v?'improved':'worsened';weight=1}
    else if(cur.status==='low'||prev.status==='low'){trend=cur.v>prev.v?'improved':'worsened';weight=1}
    else continue;
    const dir=cur.v>prev.v?'up':cur.v<prev.v?'down':'steady';
    const inRange=rb===0;
    const text=trend==='improved'
      ?`${cur.name} improved${inRange?', now in range':''}`
      :`${cur.name} is ${dir==='steady'?'still':dir==='up'?'rising':'falling'} ${rb===0?'but in range':'and outside range'}`;
    out.push({name:cur.name,trend,dir,weight,text,detail:`${fmt(prev.v)} → ${fmt(cur.v)}${cur.unit?' '+cur.unit:''}`});
  }
  return out.sort((a,b)=>b.weight-a.weight||a.name.localeCompare(b.name)).slice(0,limit);
}

// One card of data per profile: latest report state plus notable changes.
export function profileOverview(reports){
  const list=(reports||[]).filter(Boolean);
  if(!list.length)return {count:0,latest:null,changes:[]};
  const latest=list.slice().sort((a,b)=>time(b)-time(a))[0];
  const metrics=latest.metrics||[];
  const known=metrics.filter(m=>rank(m.status)!=null);
  return {
    count:list.length,
    latestDate:latest.date||latest.analyzedAt||null,
    total:known.length||latest.totalMetrics||metrics.length,
    outOfRange:known.length?known.filter(m=>rank(m.status)>0).length:(latest.outOfRangeCount||0),
    changes:markerChanges(list)
  };
}

// Latest reading of every marker across all reports, out-of-range first. Feeds the printable doctor summary.
export function latestReadings(reports){
  const latest=new Map();
  for(const r of (reports||[]).slice().sort((a,b)=>time(a)-time(b)))
    for(const m of r.metrics||[]){
      if(!m.key||m.value===''||m.value==null)continue;
      const prev=latest.get(m.key);
      latest.set(m.key,{key:m.key,name:m.name||m.key,value:m.valueText||String(m.value),unit:m.unit||'',range:m.normal_range||'',status:m.status,date:r.date||r.analyzedAt||null,prior:prev?(prev.value+(prev.unit?' '+prev.unit:'')):''});
    }
  const out=[...latest.values()];
  return out.sort((a,b)=>(rank(b.status)>0)-(rank(a.status)>0)||a.name.localeCompare(b.name));
}
