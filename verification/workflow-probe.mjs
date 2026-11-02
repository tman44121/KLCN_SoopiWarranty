// Real API checks against the disposable local fixture; never sends requests to a remote server.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
const base = 'http://localhost:8080/api/v1';
const root = new URL('../artifacts/local-reset/', import.meta.url);
const latest = readdirSync(root).sort().at(-1);
const cases = JSON.parse(readFileSync(new URL(`${latest}/cases.json`, root), 'utf8').replace(/^\uFEFF/, ''));
const fixture = key => { const c=cases.find(c=>c.case===key); assert(c, key); return c; };
const tokens = new Map();
let checks=0;
const results=[];
async function request(path, token, body) {
  const response=await fetch(base+path, {method:body===undefined?'GET':'POST', headers:{...(token?{Authorization:`Bearer ${token}`} : {}), ...(body===undefined?{}:{'Content-Type':'application/json'})}, ...(body===undefined?{}:{body:JSON.stringify(body)})});
  return {status:response.status,data:await response.json()};
}
async function login(username) {
  if(username==='letan') username='tiepnhan.an';
  if(!tokens.has(username)) {
    const r=await request('/auth/login',null,{username,password:'1234',remember:false});
    assert.equal(r.status,200,username); assert(r.data.accessToken, username);
    tokens.set(username,r.data.accessToken);
  }
  return tokens.get(username);
}
function check(name, actual, expected) {assert.deepEqual(actual,expected,name);checks++;results.push({name,passed:true});}
const dispatch=await login('dieuphoi'), reception=await login('tiepnhan.an'), warehouse=await login('khovattu');
check('tracking configuration survives reset',(await request('/access/heartbeat',dispatch,{})).status,200);
const all=await request('/quotations?approvalStatus=ALL&page=0&size=25',dispatch);
check('quote search',all.status,200);
assert(all.data.totalItems>100);check('server page size',all.data.items.length,25);
const next=await request('/quotations?approvalStatus=ALL&page=1&size=25',dispatch);
check('pages do not overlap',next.data.items.some(q=>all.data.items.some(p=>p.code===q.code)),false);
check('latest quote first',all.data.items.every((q,i,rows)=>!i||rows[i-1].createdAt>=q.createdAt),true);
const first=all.data.items[0], ticket=(await request('/tickets/'+first.ticketCode,dispatch)).data;
for(const q of [first.code,first.ticketCode,ticket.customer.fullName,ticket.customer.phone]) {
  const r=await request('/quotations?approvalStatus=ALL&q='+encodeURIComponent(q),dispatch);
  check('search '+q,r.data.items.some(row=>row.code===first.code),true);
}
const rejected=await request('/quotations?approvalStatus=REJECTED',dispatch);
check('rejected filter',rejected.data.items.length>0&&rejected.data.items.every(q=>q.approval.status==='REJECTED'),true);
check('bad date range',(await request('/quotations?from=2026-11-03T00:00:00%2B07:00&to=2026-11-02T23:59:59%2B07:00',dispatch)).status,400);
check('bad status',(await request('/quotations?approvalStatus=INVALID',dispatch)).status,400);
const day=first.createdAt.slice(0,10);
const range=await request(`/quotations?approvalStatus=ALL&from=${day}T00:00:00%2B07:00&to=${day}T23:59:59%2B07:00`,dispatch);
check('inclusive date boundary',range.data.items.some(q=>q.code===first.code),true);
check('tech cannot search others quotes',(await request('/quotations?approvalStatus=ALL',await login(fixture('STOCK_ZERO').account))).status,403);
check('unassigned ticket is not exposed',(await request('/tickets/'+fixture('TECH_NOT_ASSIGNED').code,await login(fixture('TECH_NOT_ASSIGNED').account))).status,404);

const shortage=fixture('STOCK_ZERO'), tech=await login(shortage.account);
const techProfile=(await request('/auth/me',tech)).data;
const activeStatuses='INSPECTING,DIAGNOSED,AWAITING_QUOTE_APPROVAL,AWAITING_CUSTOMER_CONFIRMATION,AWAITING_PARTS,REPAIRING';
const expectedQueue=(await request(`/tickets?technician=${techProfile.employeeId}&status=${activeStatuses}&size=100`,dispatch)).data;
const actualQueue=(await request('/technicians/me/queue',tech)).data;
check('technician queue includes all assigned active tickets',actualQueue.length,expectedQueue.totalItems);
check('technician queue newest first',actualQueue.every((q,i,rows)=>!i||rows[i-1].receivedAt>=q.receivedAt),true);
const before=(await request('/tickets/'+shortage.code,tech)).data;
const failed=await request('/stock-issues',tech,{ticketCode:shortage.code,quotationCode:before.activeQuotationCode});
check('out of stock',[failed.status,failed.data.code],[409,'STOCK_INSUFFICIENT']);
check('no stock issue saved',(await request('/stock-issues/mine',tech)).data.some(x=>x.ticketCode===shortage.code),false);
const zero=(await request('/parts/LK-TEST-ZERO',warehouse)).data;
check('no reservation leaked',[zero.onHand,zero.reserved],[0,0]);
const bin=fixture('STOCK_BIN_EMPTY');
const binBefore=(await request('/parts/LK-TEST-BIN',warehouse)).data;
const binFailed=await request('/stock-issues/'+bin.code+'/approve',warehouse,{lineBins:[{sku:'LK-TEST-BIN',binCode:'KHO-Z-01-01'}]});
check('empty bin',[binFailed.status,binFailed.data.code],[409,'STOCK_BIN_INSUFFICIENT']);
const binAfter=(await request('/parts/LK-TEST-BIN',warehouse)).data;
check('empty bin rolls stock back',[binAfter.onHand,binAfter.reserved,binAfter.bins],[binBefore.onHand,binBefore.reserved,binBefore.bins]);
check('issue remains pending',(await request('/stock-issues?status=PENDING',warehouse)).data.some(x=>x.code===bin.code),true);
const expired=await request('/quotations/'+fixture('QUOTE_EXPIRED').code+'/customer-decision',reception,{decision:'ACCEPT'});
check('expired quote',[expired.status,expired.data.code],[422,'QUOTE_EXPIRED']);
check('locked demo account',(await request('/auth/login',null,{username:'kythuat_khoa',password:'1234',remember:false})).status,403);
check('public review not fabricated',(await request('/public/reviews')).data.items.length,0);
const attachment=await fetch(base+'/files/1',{headers:{Authorization:`Bearer ${reception}`}});
check('seeded attachment exists',[attachment.status,attachment.headers.get('content-type')],[200,'image/png']);
const signature=new Uint8Array(await attachment.arrayBuffer());
check('attachment contains PNG bytes',[...signature.slice(0,4)],[137,80,78,71]);
const customer=await login('kh.tuan'), catalog=(await request('/portal/catalog')).data;
const category=catalog.categories.find(c=>c.deviceTypes.some(t=>t.identifierType==='SERIAL'));
const type=category.deviceTypes.find(t=>t.identifierType==='SERIAL');
for(const [from,to] of [['2030-10-06T10:00:00+07:00','2030-10-06T11:00:00+07:00'],['2030-10-02T17:15:00+07:00','2030-10-02T17:30:00+07:00']]) {
  const form=new FormData();
  form.append('data',new Blob([JSON.stringify({categoryCode:category.code,deviceTypeCode:type.code,brandModel:'Thiết bị kiểm thử',identifierType:'SERIAL',serialOrImei:'WF-NEGATIVE-001',symptom:'Kiểm tra giờ hẹn',preferredStation:catalog.stations[0].code,preferredFrom:from,preferredTo:to})],{type:'application/json'}),'data.json');
  const response=await fetch(base+'/portal/my/warranty-requests',{method:'POST',headers:{Authorization:`Bearer ${customer}`},body:form});
  const error=await response.json();
  check('API business hours '+from,[response.status,error.code],[422,'APPOINTMENT_OUTSIDE_BUSINESS_HOURS']);
}
mkdirSync(new URL('../artifacts/workflow-audit/',import.meta.url),{recursive:true});
writeFileSync(new URL('../artifacts/workflow-audit/api-results.json',import.meta.url),JSON.stringify({checks,results},null,2));
console.log(`PASS: ${checks} real local API checks; no successful business mutations.`);
