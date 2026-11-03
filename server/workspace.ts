import {LOCAL_PROVIDER} from './auctionator';
import {selectSources,localEvidence} from './price-sources';
import {MARKET,PROVIDER} from './auctionhouse-protocol';
import {Router} from 'express';
import {z} from 'zod';
import type {PrismaClient,Prisma} from './generated/prisma/client';
import {profileSchema,defaults,schemas,parseRecord,type Entry,type Kind,type Settings} from '../shared/contracts';
import {market,alerts,records,profession,disenchant,farming,empirical} from '../shared/analytics';
import {analyzeReport} from './ai';
import {execFile} from 'node:child_process';
import path from 'node:path';
const kindSchema=z.enum(['trade','watch','recipe','deRule','deResult','gathering','event','alert']);
const bodySchema=z.object({kind:kindSchema,data:z.unknown()}).strict();
const toEntries=(rows:{id:string;kind:string;data:unknown;revision:number;voided:boolean;createdAt:Date}[]):Entry[]=>rows.map(r=>({...r,kind:r.kind as Kind,createdAt:r.createdAt.toISOString()}));
const json=(v:unknown)=>v as Prisma.InputJsonValue;
export async function report(db:PrismaClient,id:string){
 const p=await db.profile.findUniqueOrThrow({where:{id}});
 const entries=toEntries(await db.record.findMany({where:{profileId:id},orderBy:{createdAt:'asc'}}));
 const scans=await db.scan.findMany({where:{region:p.region,realm:p.realm,faction:p.faction,phase:p.phase},orderBy:{observedAt:'desc'},take:200,include:{observations:true}});
 // Keep the last local scan for every item, including items outside the 200-scan history window.
 const anchors=await db.$queryRaw<{scanId:string}[]>`SELECT DISTINCT ON (o."itemId") o."scanId" FROM "Observation" o JOIN "Scan" s ON s.id=o."scanId" WHERE s.region=${p.region} AND s.realm=${p.realm} AND s.faction=${p.faction} AND s.phase=${p.phase} ORDER BY o."itemId",s."observedAt" DESC,s."importedAt" DESC`;
 const existingIds=new Set(scans.map(s=>s.id));const missingIds=[...new Set(anchors.map(a=>a.scanId))].filter(id=>!existingIds.has(id));
 if(missingIds.length)scans.push(...await db.scan.findMany({where:{id:{in:missingIds}},include:{observations:true}}));
 const settings=p.settings as Settings;
 const remote=p.region==='Americas'&&p.realm==='PvP'&&p.faction==='Alliance'&&p.phase==='live'?await db.pricePoint.findMany({where:{provider:PROVIDER,market:MARKET,phase:'live'},orderBy:{observedAt:'desc'},take:200000}):[];
 const localPoints=p.region==='Americas'&&p.realm==='PvP'&&p.faction==='Alliance'&&p.phase==='live'?await db.pricePoint.findMany({where:{provider:LOCAL_PROVIDER,market:MARKET,phase:'live'},orderBy:{observedAt:'desc'},take:200000}):[];
 if(p.region==='Americas'&&p.realm==='PvP'&&p.faction==='Alliance'&&p.phase==='live'){
  const latest=await db.$queryRaw<{id:string}[]>`SELECT DISTINCT ON ("itemKey") id FROM "PricePoint" WHERE provider=${LOCAL_PROVIDER} AND market=${MARKET} AND phase='live' ORDER BY "itemKey","observedAt" DESC,"importedAt" DESC`;
  const loaded=new Set(localPoints.map(p=>p.id));const missing=latest.map(p=>p.id).filter(id=>!loaded.has(id));if(missing.length)localPoints.push(...await db.pricePoint.findMany({where:{id:{in:missing}}}));
 }
 const localSummaries=selectSources([],localPoints);
 const selected=selectSources(localEvidence(scans.map(s=>({...s,observedAt:s.observedAt.toISOString(),importedAt:s.importedAt.toISOString()})),localSummaries),remote);
 const items=market(selected,settings);
 const opportunities=items.filter(i=>i.opportunity).map(i=>{
  if(i.latest.summary)return {itemId:i.itemId,name:i.name,quantity:null,cost:null,maximum:i.maximum,roi:i.roi,note:'Aggregate minimum only. Check available listings in game; no purchase quantity can be inferred.'};
  let budget=settings.exposureCopper,quantity=0,cost=0;
  for(const row of [...i.latest.rows].sort((a,b)=>a.unitCopper-b.unitCopper)){
   if(row.unitCopper>(i.maximum??0))continue;
   const take=Math.min(row.quantity??0,Math.floor(budget/row.unitCopper));quantity+=take;cost+=take*row.unitCopper;budget-=take*row.unitCopper;
  }
  return {itemId:i.itemId,name:i.name,quantity,cost,maximum:i.maximum,roi:i.roi,note:'Research ceiling, not an automatic buy order. Aggregate unit simulation may not match indivisible stacks.'};
 });
 return {generatedAt:new Date().toISOString(),profile:p,entries,items,opportunities,alerts:alerts(entries,items),professions:records(entries,'recipe').map(r=>profession(r,items,settings)),disenchanting:records(entries,'deRule').map(r=>disenchant(r,items,settings)),farming:records(entries,'gathering').map(r=>farming(r,items,settings)),empirical:[...new Set(records(entries,'deResult').map(r=>r.itemId))].map(id=>({itemId:id,...empirical(records(entries,'deResult').filter(r=>r.itemId===id))})),coverage:{scans:scans.length,communityObservations:remote.length,localObservations:localPoints.length,communityItems:items.filter(i=>i.latest.source===PROVIDER).length,limit:200,note:'Local observations take priority per item, even when stale. Community summaries fill missing items; histories remain separate. Latest 200 local scans plus older local item anchors, and up to 200,000 community observations. Asking prices are not completed sales.'}};
}
export function workspace(db:PrismaClient){
 const router=Router();
 let backupBusy=false;
 router.post('/backup',async(_req,res)=>{
  if(backupBusy){res.status(409).json({error:'Backup already running'});return;}
  backupBusy=true;
  try{await new Promise<void>((resolve,reject)=>execFile('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',['-NoProfile','-File',path.resolve('scripts/backup.ps1')],{windowsHide:true,timeout:120000},error=>error?reject(Error('Backup failed. Check Docker and available disk space.')):resolve()));res.json({saved:true});}finally{backupBusy=false;}
 });
 const aiBusy=new Set<string>();
 router.post('/profiles/:id/analyze',async(req,res)=>{
  const id=String(req.params.id);
  const input=z.object({apiKey:z.string().min(10).max(500),model:z.string().regex(/^[a-zA-Z0-9._:-]+$/).max(100),question:z.string().min(1).max(2000),consent:z.literal(true)}).strict().parse(req.body);
  if(aiBusy.has(id)){res.status(429).json({error:'An analysis is already running'});return;}
  aiBusy.add(id);
  try{const data=await report(db,id);const summary={...data,entries:data.entries.map(e=>({kind:e.kind,data:e.data})),items:data.items.map(i=>({...i,latest:{...i.latest,rows:undefined},history:i.history.map(h=>({...h,rows:undefined}))}))};res.json(await analyzeReport(input.apiKey,input.model,input.question,summary));}finally{aiBusy.delete(id);}
 });
 router.get('/profiles',async(_req,res)=>res.json(await db.profile.findMany({orderBy:{createdAt:'asc'}})));
 router.post('/profiles',async(req,res)=>{const p=profileSchema.parse(req.body);res.status(201).json(await db.profile.create({data:{...p,settings:json(p.settings)}}));});
 router.put('/profiles/:id',async(req,res)=>{const p=profileSchema.parse(req.body);const id=String(req.params.id);const existing=await db.profile.findUniqueOrThrow({where:{id}});if(['region','realm','faction','phase'].some(k=>existing[k as 'region']!==p[k as 'region']))throw Error('Create a new profile to change market scope; existing records must stay isolated');res.json(await db.profile.update({where:{id},data:{name:p.name,settings:json(p.settings)}}));});
 router.get('/profiles/:id/workspace',async(req,res)=>res.json(await report(db,String(req.params.id))));
 router.post('/profiles/:id/records',async(req,res)=>{
  const {kind,data}=bodySchema.parse(req.body),parsed=parseRecord(kind,data),profileId=String(req.params.id);
  const record=await db.$transaction(async tx=>{
   const p=await tx.profile.findUniqueOrThrow({where:{id:profileId}});
   const r=await tx.record.create({data:{profileId,kind,data:json(parsed)}});
   await tx.audit.create({data:{recordId:r.id,revision:1,data:json(parsed),voided:false}});return r;
  },{isolationLevel:'Serializable'});res.status(201).json(record);
 });
 router.put('/profiles/:id/records/:recordId',async(req,res)=>{
  const input=z.object({revision:z.number().int().positive(),data:z.unknown(),voided:z.boolean()}).strict().parse(req.body);
  const profileId=String(req.params.id),id=String(req.params.recordId);
  const record=await db.$transaction(async tx=>{
   const old=await tx.record.findFirstOrThrow({where:{id,profileId}});
   if(old.revision!==input.revision)throw Error('This record changed. Refresh before editing.');
   const parsed=parseRecord(old.kind as Kind,input.data),revision=old.revision+1;
   const r=await tx.record.update({where:{id},data:{data:json(parsed),revision,voided:input.voided}});
   const p=await tx.profile.findUniqueOrThrow({where:{id:profileId}});
   await tx.audit.create({data:{recordId:id,revision,data:json(parsed),voided:input.voided}});return r;
  },{isolationLevel:'Serializable'});res.json(record);
 });
 router.get('/profiles/:id/records/:recordId/audit',async(req,res)=>{const r=await db.record.findFirstOrThrow({where:{id:String(req.params.recordId),profileId:String(req.params.id)}});res.json(await db.audit.findMany({where:{recordId:r.id},orderBy:{revision:'asc'}}));});
 router.get('/profiles/:id/export',async(req,res)=>{
  const data=await report(db,String(req.params.id));const format=req.query.format;
  if(format==='csv'){
   const cell=(s:unknown)=>{let v=String(s??'');if(/^[=+@\-\t\r]/.test(v))v="'"+v;return '"'+v.replaceAll('"','""')+'"';};
   const rows=[['id','kind','revision','voided','name','itemId','type','quantity','unitCopper','feesCopper','at','details'],...data.entries.map(e=>{const d=e.data as Record<string,unknown>;return [e.id,e.kind,e.revision,e.voided,d.name,d.itemId,d.type,d.quantity,d.unitCopper,d.feesCopper,d.at,JSON.stringify(e.data)];})];res.attachment('cleopatras-eye-ledger.csv').type('text/csv').send(rows.map(r=>r.map(cell).join(',')).join('\r\n'));
  }else if(format==='text')res.attachment('cleopatras-eye-report.txt').type('text/plain').send(`Cleopatra’s Eye\n${data.profile.name} — ${data.profile.realm} / ${data.profile.faction} / ${data.profile.phase}\nGenerated: ${data.generatedAt}\n${data.items.length} tracked items, ${data.coverage.scans} scans\n${data.alerts.map(a=>a.title+': '+a.message).join('\n')}\nUnknown fees, stale data and unavailable game rules prevent recommendations. Full data is available in JSON export.`);
  else res.attachment('cleopatras-eye-report.json').json(data);
 });
 return router;
}
export async function ensureDefaultProfile(db:PrismaClient){if(await db.profile.count()===0)await db.profile.create({data:{name:'My economy',region:'Americas',realm:'PvP',faction:'Alliance',phase:'live',settings:json(defaults)}});}
