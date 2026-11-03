import {Router} from 'express';
import {z} from 'zod';
import type {PrismaClient,Prisma} from './generated/prisma/client';
import {MARKET,PROVIDER,LIVE_SINCE,parseSnapshot,points,hash,HttpFailure,retryDelay,readJson} from './auctionhouse-protocol';
const BASE='https://auctionhouse.fyi/api/v1';
const optionsSchema=z.object({enabled:z.boolean(),intervalMinutes:z.number().int().min(15).max(1440)}).strict();
const namesSchema=z.object({v:z.literal(1),items:z.array(z.tuple([z.number().int().positive().max(Number.MAX_SAFE_INTEGER),z.string().max(500),z.number(),z.union([z.string(),z.number()]),z.number(),z.number()])).max(200000)});
type Options={fetch?:typeof fetch;id?:string;liveSince?:string;now?:()=>number;loadNames?:boolean};
export class AuctionHouseSync{
 private transport:typeof fetch;private now:()=>number;readonly id:string;readonly liveSince:string;
 private names=new Map<number,string>();private namesAt=0;
 constructor(private db:PrismaClient,private options:Options={}){this.transport=options.fetch??fetch;this.now=options.now??Date.now;this.id=options.id??'auctionhouse';this.liveSince=options.liveSince??process.env.AHF_LIVE_SINCE??LIVE_SINCE;}
 async init(){return this.db.sourceSync.upsert({where:{id:this.id},create:{id:this.id,nextAttempt:new Date(this.now()),leaseUntil:new Date(0),enabled:process.env.AHF_ENABLED!=='false',intervalMinutes:Math.max(15,Math.min(1440,Number(process.env.AHF_INTERVAL_MINUTES)||15))},update:{}});}
 async status(){const state=await this.init();const [live,prelaunch]=await Promise.all(['live','prelaunch'].map(phase=>this.db.pricePoint.count({where:{provider:PROVIDER,market:MARKET,phase}})));return {...state,market:MARKET,provider:PROVIDER,liveSince:this.liveSince,live,prelaunch,mode:'Public hourly snapshot',priority:'Local observations always take precedence, even when stale.'};}
 async configure(input:unknown){const data=optionsSchema.parse(input);await this.init();return this.db.sourceSync.update({where:{id:this.id},data:{...data,blocked:false}});}
 async sync(manual=false){
  const state=await this.init(),now=this.now();
  if(!state.enabled||state.blocked)return {skipped:state.blocked?'Connection blocked. Save settings after resolving access.':'Source disabled'};
  // Shared database lease prevents concurrent desktop/dev workers. Manual actions also honor backoff.
  const due=manual&&state.failures===0?new Date(now-60000):null;
  const claimed=await this.db.sourceSync.updateMany({where:{id:this.id,enabled:true,blocked:false,leaseUntil:{lte:new Date(now)},...(due?{OR:[{lastAttempt:null},{lastAttempt:{lte:due}}]}:{nextAttempt:{lte:new Date(now)}})},data:{leaseUntil:new Date(now+300000),lastAttempt:new Date(now),requests:{increment:1}}});
  if(!claimed.count)return {skipped:'Already syncing or waiting for the next allowed request'};
  try{
   const response=await this.transport(`${BASE}/ah/${MARKET}/snapshot`,{headers:state.etag?{'If-None-Match':state.etag}:{},signal:AbortSignal.timeout(30000)});
   if(!response.ok&&response.status!==304)throw new HttpFailure(response.status,response.headers.get('retry-after'));
   if(this.options.loadNames!==false&&this.now()-this.namesAt>86400000){
    this.namesAt=this.now();
    try{const r=await this.transport(BASE+'/items/search-index',{signal:AbortSignal.timeout(15000)});if(r.ok)this.names=new Map(namesSchema.parse(await readJson(r)).items.map(row=>[row[0],row[1]]));}catch{console.warn('AuctionHouse.fyi names unavailable; preserving exact item IDs');}
   }
   if(this.names.size)await this.db.$executeRaw`UPDATE "PricePoint" p SET name=n.name FROM jsonb_to_recordset(${JSON.stringify([...this.names].map(([key,name])=>({key:String(key),name})))}::jsonb) AS n(key text,name text) WHERE p.provider=${PROVIDER} AND p.market=${MARKET} AND p."itemKey"=n.key AND p.name='Item ' || p."itemKey"`;
   if(response.status===304){await this.finish(state.intervalMinutes,{etag:state.etag});return {inserted:0,unchanged:true};}
   const snapshot=parseSnapshot(await readJson(response),this.now());
   const rows=points(snapshot,this.names,this.liveSince);const snapshotId=hash([PROVIDER,MARKET,snapshot.rows]);
   const inserted=await this.db.$transaction(async tx=>{
    await tx.sourceSnapshot.createMany({data:[{id:snapshotId,provider:PROVIDER,market:MARKET,publishedAt:new Date(snapshot.at),raw:JSON.stringify(snapshot)}],skipDuplicates:true});
    let count=0;for(let i=0;i<rows.length;i+=1000)count+=(await tx.pricePoint.createMany({data:rows.slice(i,i+1000),skipDuplicates:true})).count;
    await tx.sourceSync.update({where:{id:this.id},data:{inserted:{increment:count},duplicates:{increment:rows.length-count},lastObserved:snapshot.scan===null?null:new Date(snapshot.scan)}});return count;
   },{timeout:60000});
   await this.finish(state.intervalMinutes,{etag:response.headers.get('etag')});
   console.info(JSON.stringify({source:PROVIDER,market:MARKET,inserted,duplicates:rows.length-inserted,observedAt:snapshot.scan}));
   return {inserted,duplicates:rows.length-inserted};
  }catch(error){
   const status=error instanceof HttpFailure?error.status:null;
   const message=error instanceof HttpFailure?error.message:error instanceof z.ZodError?'Incomplete or incompatible response; no prices imported':error instanceof Error&&error.name==='TimeoutError'?'Connection timed out':'Sync failed; previous data retained';
   const errors=[{at:new Date(this.now()).toISOString(),message},...(Array.isArray(state.errors)?state.errors:[])].slice(0,10);
   await this.db.sourceSync.update({where:{id:this.id},data:{failures:{increment:1},blocked:status===401||status===403,leaseUntil:new Date(0),nextAttempt:new Date(this.now()+retryDelay(state.failures+1,error instanceof HttpFailure?error.retryAfter:null,this.now())),errors:errors as Prisma.InputJsonValue}});
   console.warn(message);return {error:message};
  }
 }
 private async finish(interval:number,data:{etag:string|null}){await this.db.sourceSync.update({where:{id:this.id},data:{...data,lastSuccess:new Date(this.now()),nextAttempt:new Date(this.now()+interval*60000),leaseUntil:new Date(0),failures:0}});}
 start(interval=30000){const tick=()=>{void this.sync().catch(()=>console.warn('Data source scheduler could not reach the database'));};tick();const timer=setInterval(tick,interval);timer.unref();return ()=>clearInterval(timer);}
 router(){const router=Router();router.get('/',async(_req,res)=>res.json(await this.status()));router.put('/',async(req,res)=>res.json(await this.configure(req.body)));router.post('/sync',async(_req,res)=>res.json(await this.sync(true)));return router;}
}

