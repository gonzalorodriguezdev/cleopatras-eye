import {describe,it,expect} from 'vitest';
import {parseSnapshot,points,MARKET,LIVE_SINCE,retryDelay,readJson} from '../server/auctionhouse-protocol';
import {selectSources} from '../server/price-sources';
import {market,depth,alerts} from '../shared/analytics';
import {defaults} from '../shared/contracts';
const now=Date.parse('2026-11-05T12:00:00Z');
const fixture=()=>({v:1,market:MARKET,at:now,scan:now-1000,now,rows:[[4294967297,100,null,now-1000],[2,null,0,now-1000]],days:[]});
const point=(id:number,price:number|null,at=now-1000)=>({...points(parseSnapshot({...fixture(),rows:[[id,price,null,at]]},now))[0],importedAt:new Date(now)});
describe('AuctionHouse.fyi protocol',()=>{
 it('keeps safe variant IDs, unknown quantity, absence, and original timestamps',()=>{const rows=points(parseSnapshot(fixture(),now));expect(rows[0].itemKey).toBe('4294967297');expect(rows[0].quantity).toBeNull();expect(rows[1].unitCopper).toBeNull();expect(rows[0].observedAt.getTime()).toBe(now-1000);});
 it('deduplicates unchanged observations across hourly publications',()=>{const a=parseSnapshot(fixture(),now);expect(points(a)[0].id).toBe(points({...a,at:a.at+3600000})[0].id);});
 it('quarantines each prelaunch row individually',()=>{const rows=points(parseSnapshot({...fixture(),rows:[[1,100,1,Date.parse(LIVE_SINCE)-1],[2,200,2,now-1000]]},now));expect(rows.map(p=>p.phase)).toEqual(['prelaunch','live']);});
 it.each([{market:'forever.pvp.horde.us'},{rows:[[1,100,1,now+999999]]},{rows:[[1,100,1,now-1],[1,200,1,now-1]]},{rows:[[Number.MAX_SAFE_INTEGER+1,100,1,now-1000]]},{rows:[[1,100]]},{scan:null}])('rejects wrong markets and incomplete/inconsistent payloads: %j',change=>expect(()=>parseSnapshot({...fixture(),...change},now)).toThrow());
 it('honors retry-after and grows bounded retries',()=>{expect(retryDelay(1,'3600',now,0)).toBe(3600000);expect(retryDelay(3,null,now,0)).toBe(240000);expect(retryDelay(1,new Date(now+120000).toUTCString(),now,0)).toBe(120000);});
 it('bounds response bodies',async()=>{await expect(readJson(new Response('0123456789'),5)).rejects.toThrow('size limit');});
});
describe('independent sources',()=>{
 it('counts corrections to one observation only once',()=>{const first=point(1,100),correction={...point(1,90),importedAt:new Date(now+1)};const selected=selectSources([],[first,correction]);expect(selected).toHaveLength(1);expect(selected[0].observations[0].unitCopper).toBe(90);});
 it('stale local observations win over newer community data and histories do not blend',()=>{const local={id:'local',source:'Auctionator local',observedAt:new Date(now-10*86400000).toISOString(),observations:[{itemId:1,name:'Local',unitCopper:500,quantity:2}]};const selected=selectSources([local],[point(1,100),point(2,200)]);const items=market(selected,defaults,now);expect(items.find(i=>i.itemId===1)?.latest.min).toBe(500);expect(items.find(i=>i.itemId===1)?.stale).toBe(true);expect(items.find(i=>i.itemId===1)?.history).toHaveLength(1);expect(items.find(i=>i.itemId===2)?.latest.summary).toBe(true);});
 it('does not resurrect an older price after an explicit absence',()=>expect(selectSources([],[point(1,null),point(1,100,now-2000)])).toHaveLength(0));
 it('never treats aggregate supply as order book depth or listing percentiles',()=>{const items=market(selectSources([],[point(1,100)]),defaults,now);expect(items[0].latest.units).toBeNull();expect(items[0].latest.median).toBeNull();expect(depth(items[0].latest.rows,5).levels).toEqual([]);expect(depth(items[0].latest.rows,5).cost).toBeNull();});
 it('uses stable alert identities for repeated observations',()=>{const items=market(selectSources([],[point(1,100,now-10*86400000)]),defaults,now);expect(alerts([],items)).toEqual(alerts([],items));expect(alerts([],items)[0].id).toContain(items[0].latest.scanId);});
});
