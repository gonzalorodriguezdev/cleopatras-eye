import {scanSchema} from './domain';
import {z} from 'zod';
import {randomUUID} from 'node:crypto';
import type {PrismaClient} from './generated/prisma/client';
import {savedVariables,cbor,table,string,type Value} from './saved-variables';
import {MARKET,LIVE_SINCE,hash} from './auctionhouse-protocol';
export const LOCAL_PROVIDER='Auctionator local';
function integer(value:Value|undefined,min=0){if(typeof value!=='number'||!Number.isSafeInteger(value)||value<min)throw Error('Invalid local numeric field');return value;}
export function inspectAuctionator(bytes:Buffer){
 const root=table(savedVariables(bytes).get('AUCTIONATOR_PRICE_DATABASE'));
 if(root.get('__dbversion')!==8)throw Error('Unsupported Auctionator database version');
 let items=0;const realms:string[]=[];
 for(const [realm,payload] of root){if(realm==='__dbversion')continue;const data=table(Buffer.isBuffer(payload)?cbor(payload):payload);if(data.get('version')!==2)throw Error('Unsupported Auctionator realm version');realms.push(realm);for(const [key,value] of data){if(key==='version')continue;const row=table(Buffer.isBuffer(value)?cbor(value):value);integer(row.get('m'));table(row.get('h'));items++;}}
 return {state:`Auctionator archive decoded · ${items} historical items; exact timestamps require the local bridge`,items,realms};
}
export function decodeLocal(bytes:Buffer,now=Date.now()){
 const root=table(savedVariables(bytes).get('CLEOPATRAS_EYE_LOCAL'));
 if(root.get('version')!==1)throw Error('Unsupported Cleopatra bridge version');
 if(root.get('lastError')!=null)throw Error('Bridge reported: '+string(root.get('lastError')));
 const markets=table(root.get('markets'));const scope=markets.get('PvP Alliance');if(!scope)return [];
 const market=table(scope);if(string(market.get('realm'))!=='PvP'||string(market.get('faction'))!=='Alliance')throw Error('Local market mismatch');
 const rows=table(market.get('items'));if(rows.size>100000)throw Error('Too many local items');
 const points=[];
 for(const [key,value] of rows){if(!/^[1-9]\d*$/.test(key)||!Number.isSafeInteger(Number(key)))throw Error('Unsupported local item key');const row=table(value);const at=integer(row.get('at'),1)*1000;if(at>now+60000)throw Error('Future local observation');const price=integer(row.get('price'),1);const quantity=row.get('quantity')==null?null:integer(row.get('quantity'));const name=string(row.get('name'));if(name.length>500)throw Error('Item name too long');points.push({id:hash([LOCAL_PROVIDER,MARKET,key,at,price,quantity]),provider:LOCAL_PROVIDER,market:MARKET,phase:at>=Date.parse(LIVE_SINCE)?'live':'prelaunch',itemKey:key,name,unitCopper:price,quantity,observedAt:new Date(at),publishedAt:new Date(at),quality:'local observed minimum and aggregate quantity; precise observation time; no order-book depth'});}
 return points;
}
export function decodeListings(bytes:Buffer,now=Date.now()){
 const root=table(savedVariables(bytes).get('CLEOPATRAS_EYE_LOCAL'));if(root.get('version')!==1)throw Error('Unsupported bridge version');
 const scans=root.get('scans');if(scans===undefined)return [];const saved=table(scans);if(saved.size>2)throw Error('Too many buffered local scans');
 return [...saved.values()].map(value=>{const data=table(value);const at=integer(data.get('at'),1)*1000;if(at>now+60000)throw Error('Future local scan');
  const rows=table(data.get('rows'));if(rows.size>100000)throw Error('Too many local listings');
  const result=scanSchema.omit({phase:true}).extend({phase:z.enum(['live','prelaunch'])}).parse({version:1,region:'Americas',realm:string(data.get('realm')),faction:string(data.get('faction')),phase:at>=Date.parse(LIVE_SINCE)?'live':'prelaunch',source:'Auctionator local listings',observedAt:new Date(at).toISOString(),observations:[...rows.values()].map(value=>{const row=table(value);const quantity=integer(row.get('quantity'),1),total=integer(row.get('buyout'),1),unitCopper=integer(row.get('price'),1);if(Math.ceil(total/quantity)!==unitCopper)throw Error('Inconsistent stack buyout');return {itemId:integer(row.get('itemId'),1),name:string(row.get('name')),quantity,unitCopper};})});
  if(result.realm!=='PvP'||result.faction!=='Alliance')throw Error('Local listing market mismatch');return result;
 });
}
export async function importLocal(db:PrismaClient,bytes:Buffer){
 const rows=decodeLocal(bytes),scans=decodeListings(bytes);
 const inserted=await db.$transaction(async tx=>{
  let count=0;for(let i=0;i<rows.length;i+=1000)count+=(await tx.pricePoint.createMany({data:rows.slice(i,i+1000),skipDuplicates:true})).count;
  for(const scan of scans){const {observations,version,...fields}=scan;const id=randomUUID();const created=await tx.scan.createMany({data:[{...fields,id,observedAt:new Date(fields.observedAt),fingerprint:hash(scan),raw:JSON.stringify(scan)}],skipDuplicates:true});
   if(created.count){for(let i=0;i<observations.length;i+=1000)await tx.observation.createMany({data:observations.slice(i,i+1000).map(o=>({...o,scanId:id}))});count+=observations.length;}
  }return count;
 },{timeout:60000});
 const live=rows.filter(r=>r.phase==='live').length,liveScans=scans.filter(s=>s.phase==='live').length;
 return {state:rows.length||scans.length?`Local import ready · ${liveScans} saved live scans · ${live} summary items · ${inserted} new observations`:'Bridge ready — waiting for Auctionator observations',items:rows.length,live,inserted};
}
