import 'dotenv/config';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import pg from 'pg';
import {PrismaClient} from '../server/generated/prisma/client';
import {PrismaPg} from '@prisma/adapter-pg';
import {AuctionHouseSync} from '../server/auctionhouse';
import {MARKET} from '../server/auctionhouse-protocol';
import {report} from '../server/workspace';
import {defaults} from '../shared/contracts';
const url=new URL(process.env.DATABASE_URL!);const admin=new pg.Client({connectionString:url.toString()});await admin.connect();
const database='cleopatra_sources_test_'+Date.now();assert.match(database,/^cleopatra_sources_test_\d+$/);
await admin.query(`CREATE DATABASE "${database}"`);url.pathname='/'+database;
const sql=new pg.Client({connectionString:url.toString()});const db=new PrismaClient({adapter:new PrismaPg({connectionString:url.toString()})});
let stop:undefined|(()=>void);
try{
 await sql.connect();for(const name of (await readdir('prisma/migrations')).filter(n=>/^\d/.test(n)).sort())await sql.query(await readFile(`prisma/migrations/${name}/migration.sql`,'utf8'));
 let now=Date.now()-4*3600000,calls=0,status=200;
 let payload={v:1,market:MARKET,at:now,scan:now,now,rows:[[1,100,50,now],[2,200,null,now]],days:[]};
 const transport:typeof fetch=async()=>{calls++;return status===200?new Response(JSON.stringify(payload),{headers:{etag:'test-'+calls}}):new Response(null,{status,headers:{'retry-after':'120'}});};
 const source=new AuctionHouseSync(db,{fetch:transport,now:()=>now,loadNames:false,liveSince:new Date(now-1000).toISOString()});
 const p=await db.profile.create({data:{name:'SYNTHETIC integration fixture',region:'Americas',realm:'PvP',faction:'Alliance',phase:'live',settings:{...defaults,feesVerified:true,feeRate:.05,feeEvidence:'SYNTHETIC test only'}}});
 await db.record.create({data:{profileId:p.id,kind:'deRule',data:{name:'Synthetic disenchant',itemId:1,requiredSkill:0,verified:true,evidence:'Synthetic test only',note:'',outcomes:[{probability:1,materials:[{itemId:2,name:'Material',quantity:1}]}]}}});
 stop=source.start(60000);for(let i=0;i<100;i++){if((await source.status()).lastSuccess)break;await new Promise(r=>setTimeout(r,20));}stop();stop=undefined;
 assert.equal(await db.pricePoint.count(),2,'automatic startup must import');
 now+=16*60000;await source.sync();assert.equal(await db.pricePoint.count(),2,'unchanged hourly rows must deduplicate');
 for(let i=0;i<3;i++){now+=3600000;payload={...payload,at:now,scan:now,now,rows:[[1,i===2?50:100,50,now],[2,200,null,now]]};await source.sync();}
 let workspace=await report(db,p.id);assert.equal(workspace.items.length,2);assert.equal(workspace.items[0].latest.source,'AuctionHouse.fyi');assert.equal(workspace.opportunities.length,1);assert.equal(workspace.opportunities[0].quantity,null);assert.equal(workspace.disenchanting[0].profit,140);assert.equal(workspace.items.find(i=>i.itemId===2)!.latest.units,null);
 const before=await db.pricePoint.count();now+=3600000;status=429;await source.sync();const failed=await source.status();assert.equal(failed.failures,1);assert.ok(failed.nextAttempt.getTime()>=now+120000);const requested=calls;await source.sync(true);assert.equal(calls,requested,'manual sync must honor backoff');assert.equal((await report(db,p.id)).items.length,2,'outage must preserve report');
 now+=3600000;status=200;payload={...payload,market:'wrong-market'};await source.sync();assert.equal(await db.pricePoint.count(),before,'invalid response imports nothing');
 now+=3600000;status=403;await source.sync();assert.equal((await source.status()).blocked,true);await source.sync(true);assert.equal((await source.status()).requests,8);
 await source.configure({enabled:false,intervalMinutes:15});const disabledCalls=calls;await source.sync();assert.equal(calls,disabledCalls);
 await db.scan.create({data:{fingerprint:'synthetic-local',source:'LOCAL synthetic scanner',region:'Americas',realm:'PvP',faction:'Alliance',phase:'live',observedAt:new Date(now-10*86400000),raw:'synthetic',observations:{create:[{itemId:1,name:'Local fixture',unitCopper:700,quantity:2}]}}});workspace=await report(db,p.id);assert.equal(workspace.items.find(i=>i.itemId===1)?.latest.min,700);assert.equal(workspace.items.find(i=>i.itemId===1)?.stale,true);assert.equal(workspace.items.find(i=>i.itemId===2)?.latest.source,'AuctionHouse.fyi');
 await source.configure({enabled:true,intervalMinutes:15});now+=3600000;status=200;payload={...payload,market:MARKET,at:now,scan:now,now,rows:[[2,null,0,now],[3,100,1,Date.parse('2026-10-11T00:00:00Z')]]};await source.sync();workspace=await report(db,p.id);assert.equal(workspace.items.length,1,'absence/prelaunch excluded, local kept');assert.equal((await source.status()).prelaunch,1);
 const lastCalls=calls;now+=3600000;status=304;await Promise.all([source.sync(),source.sync()]);assert.equal(calls,lastCalls+1,'shared lease permits only one request');
 console.log('PASS: isolated PostgreSQL integration: scheduler, dedup, report/flipping/DE, local priority, absence, prelaunch, failures, backoff, disabling and concurrent lease.');
}finally{stop?.();await db.$disconnect();await sql.end();await admin.query(`DROP DATABASE "${database}" WITH (FORCE)`);await admin.end();}


