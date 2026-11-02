import 'dotenv/config';
import assert from 'node:assert/strict';
import {PrismaClient} from '../server/generated/prisma/client';
import {PrismaPg} from '@prisma/adapter-pg';
import {defaults} from '../shared/contracts';
const db=new PrismaClient({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL!})});
const base='http://127.0.0.1:4312/api';
async function request(path:string,method='GET',body?:unknown){const r=await fetch(base+path,{method,headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};}
let id='';const scanIds:string[]=[];const realm='Synthetic test '+Date.now();
try{
 const created=await request('/profiles','POST',{name:'Integration test ONLY',region:'Americas',realm,faction:'Alliance',phase:'sample',settings:{...defaults,openingCopper:0,exposureCopper:1000,feesVerified:true,feeEvidence:'Synthetic fixture only',feeRate:.05}});
 assert.equal(created.status,201);id=created.data.id;const route='/profiles/'+id;
 const result={itemId:123,name:'Synthetic only',quantity:1,materials:[{itemId:124,name:'Synthetic dust',quantity:2}],at:'2026-01-01T00:00:00Z',note:''};
 const saved=await request(route+'/records','POST',{kind:'deResult',data:result});assert.equal(saved.status,201);
 const farm=await request(route+'/records','POST',{kind:'gathering',data:{name:'Synthetic route',minutes:30,costCopper:5,materials:result.materials,at:result.at,note:''}});assert.equal(farm.status,201);
 const ws=await request(route+'/workspace');assert.ok(!('portfolio' in ws.data));assert.equal(ws.data.empirical[0].trials,1);
 const edit=await request(route+'/records/'+saved.data.id,'PUT',{revision:1,data:{...result,note:'corrected'},voided:false});assert.equal(edit.status,200);
 assert.equal((await request(route+'/records/'+saved.data.id+'/audit')).data.length,2);
 assert.equal((await request('/profiles/unknown/records/'+saved.data.id+'/audit')).status,404);
 for(const [index,price] of [100,100,100,50].entries()){
  const scan=await request('/scans','POST',{version:1,region:'Americas',realm,faction:'Alliance',phase:'sample',source:'Synthetic integration fixture',observedAt:new Date(Date.now()-(3-index)*86400000).toISOString(),observations:[{itemId:123,name:'Synthetic item',quantity:2,unitCopper:price}]});assert.equal(scan.status,201);scanIds.push(scan.data.id);
 }
 const market=await request(route+'/workspace');assert.equal(market.data.opportunities[0].quantity,2);assert.equal(market.data.opportunities[0].cost,100);
 const exported=await fetch(base+route+'/export?format=text');assert.equal(exported.status,200);assert.ok(!(await exported.text()).includes('Cash:'));
 const csv=await fetch(base+route+'/export?format=csv');assert.equal(csv.status,200);assert.ok((await csv.text()).includes('Synthetic'));
 console.log('PASS: observations without inventory, revisions, isolation, budget independent of gold, reports without balances.');
}finally{
 await db.$transaction(async tx=>{if(id){await tx.audit.deleteMany({where:{record:{profileId:id}}});await tx.record.deleteMany({where:{profileId:id}});await tx.profile.delete({where:{id}});}await tx.observation.deleteMany({where:{scanId:{in:scanIds}}});await tx.scan.deleteMany({where:{id:{in:scanIds}}});});
 await db.$disconnect();
}
