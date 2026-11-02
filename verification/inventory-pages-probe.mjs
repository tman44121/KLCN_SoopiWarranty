import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync } from 'node:fs';
const base='http://localhost:8080/api/v1';
async function login(username) {
  const r=await fetch(base+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password:'1234',remember:false})});
  assert.equal(r.status,200); return (await r.json()).accessToken;
}
const token=await login('khovattu');
let checks=0;
async function get(path,who=token) {
  const start=performance.now(),r=await fetch(base+path,{headers:{Authorization:'Bearer '+who}}),text=await r.text();
  return {status:r.status,data:JSON.parse(text),bytes:Buffer.byteLength(text),ms:performance.now()-start};
}
const same=(actual,expected)=>{assert.deepEqual(actual,expected);checks++;};
const results=[];
for(const [kind,dateKey] of [['receipts','createdAt'],['issues','requestedAt'],['transfers','createdAt']]) {
  const path='/stock-'+kind, legacy=await get(path); same(legacy.status,200); assert(Array.isArray(legacy.data));
  const sorted=[...legacy.data].sort((a,b)=>new Date(b[dateKey])-new Date(a[dateKey])||b.code.localeCompare(a.code));
  let page=await get(path+'/search?page=0&size=25'); same(page.status,200); same(page.data.totalItems,sorted.length); same(page.data.items,sorted.slice(0,25));
  same((await get(path+'/search?page=1&size=25')).data.items,sorted.slice(25,50));
  same((await get(path+'/search?sort=oldest&size=25')).data.items,[...sorted].reverse().slice(0,25));
  const pending=sorted.filter(d=>d.status==='PENDING'); same((await get(path+'/search?status=PENDING&size=100')).data.items,pending.slice(0,100));
  const first=sorted[0]; same((await get(path+'/search?q='+encodeURIComponent(first.code))).data.items,[first]);
  same((await get(path+'/search?q=%25')).data.totalItems,0);
  const day=first[dateKey].slice(0,10), dayResult=await get(path+`/search?size=100&from=${day}T00:00:00%2B07:00&to=${day}T23:59:59%2B07:00`);
  same(dayResult.data.items,sorted.filter(d=>d[dateKey].slice(0,10)===day).slice(0,100));
  for(const query of ['status=INVALID','sort=unknown','page=-1','size=100000','from=2030-01-02T00:00:00Z&to=2030-01-01T00:00:00Z']) same((await get(path+'/search?'+query)).status,400);
  const times=[];for(let i=0;i<4;i++){page=await get(path+'/search?size=25');if(i)times.push(page.ms);}
  results.push({kind,total:sorted.length,pageRows:page.data.items.length,bytes:page.bytes,warmMedianMs:times.sort((a,b)=>a-b)[1]});
}
const parts=(await get('/parts')).data, issues=(await get('/stock-issues')).data;
const sku=issues.find(i=>i.lines.length)?.lines[0].sku, part=parts.find(p=>p.sku===sku);
const matchedSkus=new Set(parts.filter(p=>p.name.includes(part.name)).map(p=>p.sku));
const partSearch=await get('/stock-issues/search?size=100&q='+encodeURIComponent(part.name));
same(partSearch.data.totalItems,issues.filter(i=>i.lines.some(l=>matchedSkus.has(l.sku))).length);
const tech=await login('kythuat');for(const kind of ['issues','receipts','transfers']) same((await get('/stock-'+kind+'/search',tech)).status,403);
mkdirSync('artifacts/impeccable-optimize',{recursive:true});
writeFileSync('artifacts/impeccable-optimize/api-after.json',JSON.stringify({checks,results},null,2));
console.log(JSON.stringify({checks,results}));
