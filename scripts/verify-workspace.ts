import 'dotenv/config';
import assert from 'node:assert/strict';
import {PrismaClient} from '../server/generated/prisma/client';
import {PrismaPg} from '@prisma/adapter-pg';
import {defaults} from '../shared/contracts';
const db=new PrismaClient({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL!})});
const base='http://127.0.0.1:4312/api';
async function request(path:string,method='GET',body?:unknown){const r=await fetch(base+path,{method,headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};}
let id='';
try{
 const created=await request('/profiles','POST',{name:'Integration test ONLY',region:'Americas',realm:'Synthetic isolated test',faction:'Alliance',phase:'sample',settings:{...defaults,openingCopper:10000}});
 assert.equal(created.status,201);id=created.data.id;const route='/profiles/'+id;
 const trade={type:'buy',itemId:123,name:'Synthetic only',quantity:2,unitCopper:100,feesCopper:10,strategy:'flipping',at:'2026-01-01T00:00:00Z',note:''};
 const buy=await request(route+'/records','POST',{kind:'trade',data:trade});assert.equal(buy.status,201);
 const sale=await request(route+'/records','POST',{kind:'trade',data:{...trade,type:'sell',quantity:1,unitCopper:200,at:'2026-01-02T00:00:00Z'}});assert.equal(sale.status,201);
 const ws=await request(route+'/workspace');assert.equal(ws.data.portfolio.cash,9980);assert.equal(ws.data.portfolio.realized,85);assert.equal(ws.data.portfolio.invested,105);
 const oversell=await request(route+'/records','POST',{kind:'trade',data:{...trade,type:'sell',quantity:10,at:'2026-01-03T00:00:00Z'}});assert.equal(oversell.status,400);
 const invalidVoid=await request(route+'/records/'+buy.data.id,'PUT',{revision:1,data:trade,voided:true});assert.equal(invalidVoid.status,400);
 assert.equal((await request(route+'/workspace')).data.entries.length,2);
 const edit=await request(route+'/records/'+buy.data.id,'PUT',{revision:1,data:{...trade,unitCopper:120},voided:false});assert.equal(edit.status,200);
 assert.equal((await request(route+'/records/'+buy.data.id+'/audit')).data.length,2);
 assert.equal((await request(route+'/workspace')).data.portfolio.realized,65);
 assert.equal((await request('/profiles/unknown/records/'+buy.data.id+'/audit')).status,404);
 const csv=await fetch(base+route+'/export?format=csv');assert.equal(csv.status,200);assert.ok((await csv.text()).includes('Synthetic only'));
 console.log('PASS: PostgreSQL transactions, cost accounting, oversell rollback, invalid void rollback, edits, audit history, scope isolation, CSV export.');
}finally{
 if(id){await db.$transaction(async tx=>{await tx.audit.deleteMany({where:{record:{profileId:id}}});await tx.record.deleteMany({where:{profileId:id}});await tx.profile.delete({where:{id}});});}
 await db.$disconnect();
}
