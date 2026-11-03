import {createHash} from 'node:crypto';
import {z} from 'zod';
export const MARKET='forever.pvp.alliance.us';
export const PROVIDER='AuctionHouse.fyi';
// Blizzard's published global release boundary; older observations stay quarantined.
export const LIVE_SINCE='2026-11-04T23:00:00.000Z';
const integer=z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const time=integer.positive();
export const snapshotSchema=z.object({v:z.literal(1),market:z.literal(MARKET),at:time,scan:time.nullable(),now:time,rows:z.array(z.tuple([integer.positive(),integer.positive().nullable(),integer.nullable(),time])).max(200000),days:z.array(z.tuple([integer.positive(),z.array(z.tuple([integer,integer.nullable(),integer.nullable()]))]))});
export type Snapshot=z.infer<typeof snapshotSchema>;
export const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function parseSnapshot(input:unknown,now=Date.now()){
 const s=snapshotSchema.parse(input);
 if(s.at>now+60000||s.now>now+60000||(s.scan!==null&&s.scan>s.at+60000))throw Error('Invalid snapshot timestamp');
 const keys=new Set<number>();
 for(const [key,,,at] of s.rows){if(keys.has(key))throw Error('Duplicate item key in snapshot');keys.add(key);if(at>s.at+60000||at>now+60000||s.scan===null||at>s.scan)throw Error('Invalid observation timestamp');}
 return s;
}
export function points(s:Snapshot,names=new Map<number,string>(),liveSince=LIVE_SINCE){
 const boundary=Date.parse(liveSince);if(!Number.isFinite(boundary))throw Error('Invalid live boundary');
 return s.rows.map(([key,unitCopper,quantity,at])=>({id:hash([PROVIDER,s.market,key,at,unitCopper,quantity]),provider:PROVIDER,market:s.market,phase:at>=boundary?'live':'prelaunch',itemKey:String(key),name:names.get(key)??`Item ${key}`,unitCopper,quantity,observedAt:new Date(at),publishedAt:new Date(s.at),quality:'community minimum / aggregate supply; not an order book'}));
}
export class HttpFailure extends Error{constructor(public status:number,public retryAfter:string|null){super(`AuctionHouse.fyi returned HTTP ${status}`);}}
export function retryDelay(failures:number,retryAfter:string|null,now=Date.now(),random=Math.random()){
 const seconds=retryAfter===null?NaN:Number(retryAfter);const explicit=Number.isFinite(seconds)?seconds*1000:Date.parse(retryAfter??'')-now;
 return Math.max(60000,Number.isFinite(explicit)?explicit:0,Math.min(6*3600000,60000*2**Math.min(9,failures-1))*(1+random*.2));
}
export async function readJson(response:Response,limit=32*1024*1024){
 if(Number(response.headers.get('content-length'))>limit)throw Error('Response exceeds size limit');
 const reader=response.body?.getReader();if(!reader)throw Error('Empty response');const chunks:Uint8Array[]=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit)throw Error('Response exceeds size limit');chunks.push(value);}}finally{await reader.cancel();}
 return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}
