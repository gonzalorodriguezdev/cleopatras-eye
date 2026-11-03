import {AuctionHouseSync} from './auctionhouse';
import {workspace,ensureDefaultProfile} from './workspace';
import {ZodError} from 'zod';
import {SavedVariablesCapture} from './capture';
import path from 'node:path';
import 'dotenv/config';import express from 'express';import {PrismaClient} from './generated/prisma/client';import {PrismaPg} from '@prisma/adapter-pg';import {scanSchema,fingerprint} from './domain';
const db=process.env.DATABASE_URL?new PrismaClient({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL})}):null;
const capture=process.env.AUCTIONATOR_FILE ? new SavedVariablesCapture(process.env.AUCTIONATOR_FILE,path.resolve('data/raw/auctionator')) : null;
if(capture){void capture.poll();setInterval(()=>void capture.poll(),5000).unref();}
const app=express();app.use(express.json({limit:'20mb'}));app.use((req,res,next)=>{if(!['127.0.0.1','localhost'].includes(req.hostname)){res.sendStatus(403);return;}const o=req.get('origin');if(o&&!['http://127.0.0.1:5173','http://localhost:5173','http://127.0.0.1:4312'].includes(o)){res.sendStatus(403);return;}next();});
app.get('/api/capture',(_req,res)=>res.json(capture?.status ?? {state:'not configured'}));
app.get('/api/status',async(_req,res)=>{try{if(!db)throw Error();await db.$queryRaw`SELECT 1`;res.json({database:'connected'});}catch{res.json({database:'unavailable'});}});
app.post('/api/scans/validate',(req,res)=>{const r=scanSchema.safeParse(req.body);res.status(r.success?200:400).json(r.success?{valid:true,count:r.data.observations.length}:{error:r.error.issues});});
app.post('/api/scans',async(req,res,next)=>{const r=scanSchema.safeParse(req.body);if(!r.success){res.status(400).json({error:r.error.issues});return;}if(!db){res.status(503).json({error:'Database unavailable. Nothing saved.'});return;}const {observations,version,...data}=r.data;try{const s=await db.scan.create({data:{...data,observedAt:new Date(data.observedAt),fingerprint:fingerprint(r.data),raw:JSON.stringify(req.body),observations:{create:observations}}});res.status(201).json({id:s.id});}catch(e){if((e as {code?:string}).code==='P2002'){res.status(409).json({error:'Duplicate scan'});return;}next(e);}});
app.get('/api/scans',async(req,res,next)=>{if(!db){res.status(503).json({error:'Database unavailable'});return;}const {region,realm,faction,phase}=req.query;if(![region,realm,faction,phase].every(x=>typeof x==='string'&&x.length)){res.status(400).json({error:'All market filters required'});return;}try{res.json(await db.scan.findMany({where:{region:String(region),realm:String(realm),faction:String(faction),phase:String(phase)},orderBy:{observedAt:'desc'},take:50,select:{id:true,source:true,observedAt:true,_count:{select:{observations:true}}}}));}catch(e){next(e);}});
if(db){const source=new AuctionHouseSync(db);app.use('/api/sources/auctionhouse',source.router());source.start();app.use('/api',workspace(db));void ensureDefaultProfile(db).catch(()=>console.error('Default profile setup failed'));}
app.use(express.static(path.resolve('dist')));
app.use((e:unknown,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{console.error(e instanceof Error?e.message:'Request failure');if(e instanceof ZodError){res.status(400).json({error:e.issues.map(i=>i.path.join('.')+': '+i.message).join('; ')});return;} const code=(e as {code?:string}).code; if(code==='P2025'){res.status(404).json({error:'Record not found'});return;} if(code==='P2034'){res.status(409).json({error:'Concurrent change. Refresh and retry.'});return;} res.status(400).json({error:code?'Database operation failed':e instanceof Error?e.message:'Request failed'});});app.listen(Number(process.env.PORT ?? 4311),'127.0.0.1',()=>console.log('FAI API ready on port 4311'));



