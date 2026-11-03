import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {localEvidence} from '../server/price-sources';
import {market,depth} from '../shared/analytics';
import {defaults} from '../shared/contracts';
import {savedVariables,cbor,table,string} from '../server/saved-variables';
import {decodeLocal,decodeListings,inspectAuctionator} from '../server/auctionator';
const now=Date.parse('2026-11-06T12:00:00Z');
const fixture=(price=100,at=now/1000)=>Buffer.from(`CLEOPATRAS_EYE_LOCAL = {version=1, markets={["PvP Alliance"]={realm="PvP",faction="Alliance",items={["123"]={price=${price},quantity=20,at=${at},name="Peacebloom"}}}}}`);
describe('bounded SavedVariables',()=>{
 it('preserves raw bytes and UTF-8 strings',()=>{const root=savedVariables(Buffer.from('X={a="\\000\\255\\034\\092", name="Hierba é"}'));expect(table(root.get('X')).get('a')).toEqual(Buffer.from([0,255,34,92]));expect(string(table(root.get('X')).get('name'))).toBe('Hierba é');});
 it.each(['X=os.execute("anything")','X=(function() return {} end)()','X={} X.a=1','X={a=1,a=2}','X="\\999"','X={','X="unfinished','X='+('{a='.repeat(40))+'1'+'}'.repeat(40)])('rejects executable, truncated or excessive inputs: %s',value=>expect(()=>savedVariables(Buffer.from(value))).toThrow());
 it('decodes definite and indefinite CBOR maps',()=>{expect(table(cbor(Buffer.from('a16776657273696f6e02','hex'))).get('version')).toBe(2);expect(table(cbor(Buffer.from('bf6776657273696f6e02ff','hex'))).get('version')).toBe(2);});
 it.each(['a167766572','1bffffffffffffffff','a2616101616102','a16776657273696f6e0200'])('rejects malformed CBOR: %s',hex=>expect(()=>cbor(Buffer.from(hex,'hex'))).toThrow());
 it('decodes a serialized Auctionator realm without inventing prices',()=>{const b=Buffer.from('a16776657273696f6e02','hex');const quoted=[...b].map(n=>'\\'+String(n).padStart(3,'0')).join('');expect(inspectAuctionator(Buffer.from(`AUCTIONATOR_PRICE_DATABASE={__dbversion=8,["PvP"]="${quoted}"}`)).items).toBe(0);});
});
describe('timestamped local observations',()=>{
 it('imports exact dates and aggregate quantities as a local source',()=>{const p=decodeLocal(fixture(),now)[0];expect(p.provider).toBe('Auctionator local');expect(p.observedAt.getTime()).toBe(now);expect(p.phase).toBe('live');expect(p.quantity).toBe(20);});
 it('does not infer a timestamp from capture time',()=>expect(decodeLocal(fixture(100,1791733552),now)[0].phase).toBe('prelaunch'));
 it('rejects mismatched scope, future prices, and incomplete rows',()=>{expect(()=>decodeLocal(Buffer.from(fixture().toString().replace('faction="Alliance"','faction="Horde"')),now)).toThrow();expect(()=>decodeLocal(fixture(100,now/1000+120),now)).toThrow();expect(()=>decodeLocal(Buffer.from(fixture().toString().replace('at='+now/1000+',','')),now)).toThrow();});
 it('deduplicates saved-file reloads by original observation',()=>expect(decodeLocal(fixture(),now)[0].id).toBe(decodeLocal(fixture(),now+10000)[0].id));
 it('runs the shipped Lua bridge against mocked game events without game actions',()=>{
  const {lua,lauxlib,lualib,to_luastring}=createRequire(import.meta.url)('fengari');const L=lauxlib.luaL_newstate();lualib.luaL_openlibs(L);
  const setup=`realm="PvP";faction="Alliance";hooks=0;Auctionator={Database={SetPrice=function() end},FullScan={Events={ScanComplete="complete"}},EventBus={Register=function(self,obj) receiver=obj end}};C_Item={GetItemInfo=function() return "Peacebloom" end};GetRealmName=function() return realm end;UnitFactionGroup=function() return faction end;time=function() return 1793966400 end;GetServerTime=time;CreateFrame=function() return {RegisterEvent=function() end,SetScript=function(self,event,fn) login=fn end} end;C_Timer={NewTicker=function(_,fn) tick=fn;return {Cancel=function() cancelled=true end} end};hooksecurefunc=function(object,name,fn) hooks=hooks+1;hook=fn end;`;
  const assertions=`login();tick();assert(hooks==1 and cancelled);hook(nil,"123",100,20);assert(CLEOPATRAS_EYE_LOCAL.markets["PvP Alliance"].items["123"].at==1793966400);hook(nil,"gr:123:suffix",5,1);assert(CLEOPATRAS_EYE_LOCAL.markets["PvP Alliance"].items["gr:123:suffix"]==nil);faction="Horde";hook(nil,"124",4,1);assert(CLEOPATRAS_EYE_LOCAL.markets["PvP Alliance"].items["124"]==nil);login();tick();assert(hooks==1);faction="Alliance";receiver:ReceiveEvent("complete",{{itemLink="item:123:0",auctionInfo={[1]="Peacebloom",[3]=3,[10]=100}}});assert(CLEOPATRAS_EYE_LOCAL.scans[1].rows[1].price==34);assert(CLEOPATRAS_EYE_LOCAL.scans[1].rows[1].buyout==100);receiver:ReceiveEvent("complete",{{itemLink="item:123:0",replicateInfo={[1]="Peacebloom",[3]=1,[10]=90}}});receiver:ReceiveEvent("complete",{{itemLink="item:123:0",auctionInfo={[1]="Peacebloom",[3]=1,[10]=80}}});assert(#CLEOPATRAS_EYE_LOCAL.scans==2);`;
  const code=setup+'\n'+readFileSync('addon/CleopatrasEyeBridge/Bridge.lua','utf8')+'\n'+assertions;
  const status=lauxlib.luaL_dostring(L,to_luastring(code));if(status!==lua.LUA_OK)throw Error(lua.lua_tojsstring(L,-1));lua.lua_close(L);
 });
});

describe('completed listing scans',()=>{
 const at=Math.floor(Date.now()/1000)-1;
 const bytes=()=>Buffer.from('CLEOPATRAS_EYE_LOCAL={version=1,markets={},scans={{at='+at+',realm="PvP",faction="Alliance",rows={{itemId=123,name="Herb",price=34,quantity=3,buyout=100},{itemId=123,name="Herb",price=50,quantity=2,buyout=100}}}}}');
 it('preserves listing levels and conservatively rounds per-unit stack prices',()=>{const scan=decodeListings(bytes())[0];const rows=scan.observations;expect(rows.map(r=>r.unitCopper)).toEqual([34,50]);expect(depth(rows,4).cost).toBe(152);});
 it('rejects inconsistent stack totals',()=>expect(()=>decodeListings(Buffer.from(bytes().toString().replace('price=34','price=30')))).toThrow('Inconsistent'));
 it('uses completed listing history over same-time summaries, without double counting',()=>{const scan={...decodeListings(bytes())[0],id:'full'};const summary={id:'summary',source:'Auctionator local',observedAt:scan.observedAt,observations:[{itemId:123,name:'Herb',unitCopper:34,quantity:5,summary:true}]};const selected=market(localEvidence([scan],[summary]),defaults);expect(selected[0].history).toHaveLength(1);expect(selected[0].latest.summary).toBe(false);const later={...summary,observedAt:new Date(Date.parse(scan.observedAt)+1000).toISOString()};expect(market(localEvidence([scan],[later]),defaults)[0].latest.summary).toBe(true);});
});
