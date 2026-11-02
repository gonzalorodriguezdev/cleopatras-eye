import {describe,it,expect} from 'vitest';
import {portfolio,market,depth,timing,profession,disenchant,empirical,quantile} from '../shared/analytics';
import {defaults,schemas,type Entry} from '../shared/contracts';
const entry=(id:string,data:unknown,kind:Entry['kind']='trade'):Entry=>({id,kind,data,revision:1,voided:false,createdAt:'2026-01-01T00:00:00Z'});
const trade=(type:string,quantity:number,unitCopper:number,at='2026-01-01T00:00:00Z')=>({type,itemId:1,name:'Synthetic item',quantity,unitCopper,feesCopper:0,strategy:'flipping',at,note:''});
const settings={...defaults,feesVerified:true,feeRate:.05,feeEvidence:'Synthetic test evidence',openingCopper:10000};
describe('inventory accounting',()=>{
 it('uses average cost, not current asking price, for realized profit',()=>{const p=portfolio([entry('1',trade('buy',2,100)),entry('2',trade('buy',2,200)),entry('3',trade('sell',2,250,'2026-01-02T00:00:00Z'))],settings);expect(p.cash).toBe(9900);expect(p.realized).toBe(200);expect(p.invested).toBe(300);});
 it('rejects overselling and corrections that would create negative inventory',()=>{expect(()=>portfolio([entry('1',trade('sell',1,100))],settings)).toThrow('Insufficient');});
 it('excludes voided records',()=>{expect(portfolio([{...entry('1',trade('buy',1,100)),voided:true}],settings).cash).toBe(10000);});
 it('transfers disenchant cost to actual outputs',()=>{const p=portfolio([entry('1',trade('buy',1,120)),entry('2',{itemId:1,name:'Synthetic item',quantity:1,materials:[{itemId:2,name:'Dust',quantity:3}],at:'2026-01-02T00:00:00Z',note:''},'deResult')],settings);expect(p.inventory.find(i=>i.itemId===2)?.cost).toBe(120);expect(p.invested).toBe(120);expect(p.realized).toBe(0);});
});
const scans=[100,110,90,50].map((p,i)=>({id:String(i),source:'synthetic',observedAt:`2026-01-0${i+1}T12:00:00Z`,observations:[{itemId:1,name:'Synthetic',unitCopper:p,quantity:2}]}));
describe('evidence gates',()=>{
 it('uses prior observations only for reference',()=>{const m=market(scans,settings,Date.parse('2026-01-04T13:00:00Z'))[0];expect(m.reference).toBe(100);expect(m.opportunity).toBe(true);});
 it('blocks stale and unverified signals',()=>{expect(market(scans,settings,Date.parse('2026-02-01T00:00:00Z'))[0].opportunity).toBe(false);expect(market(scans,{...settings,feesVerified:false},Date.parse('2026-01-04T13:00:00Z'))[0].opportunity).toBe(false);});
 it('does not imply complete fills when quantity is unavailable',()=>{const d=depth([{itemId:1,name:'A',unitCopper:100,quantity:2},{itemId:1,name:'A',unitCopper:200,quantity:2}],5);expect(d.cost).toBe(600);expect(d.unfilled).toBe(1);expect(d.slippage).toBe(.5);});
 it('requires repeated dates for time patterns',()=>{const t=timing(market(scans,settings,Date.parse('2026-01-04T13:00:00Z'))[0],'UTC');expect(t.every(x=>!x.reliable)).toBe(true);});
 it('blocks recipes with missing material prices',()=>{const r=schemas.recipe.parse({name:'Synthetic',profession:'Alchemy',output:{itemId:1,name:'A',quantity:1},inputs:[{itemId:2,name:'B',quantity:1}],extraCostCopper:0,verified:true,evidence:'fixture',note:''});expect(profession(r,market(scans,settings,Date.parse('2026-01-04T13:00:00Z')),settings).profit).toBeNull();});
 it('rejects outcome distributions that do not sum to one',()=>expect(schemas.deRule.safeParse({itemId:1,name:'A',requiredSkill:1,verified:false,evidence:'',outcomes:[{probability:.2,materials:[{itemId:2,name:'B',quantity:1}]}],note:''}).success).toBe(false));
 it('does not treat batch results as individual trials',()=>{const r=schemas.deResult.parse({itemId:1,name:'A',quantity:2,materials:[{itemId:2,name:'B',quantity:3}],at:'2026-01-01T00:00:00Z',note:''});expect(empirical([r]).trials).toBe(0);});
 it('returns null for absent statistics',()=>expect(quantile([],.5)).toBeNull());
 it('calculates verified disenchant expectation and loss probability from complete outcomes',()=>{
  const items=market([{id:'x',source:'synthetic',observedAt:'2026-01-04T12:00:00Z',observations:[{itemId:1,name:'Input',quantity:1,unitCopper:100},{itemId:2,name:'Material',quantity:1,unitCopper:80}]}],settings,Date.parse('2026-01-04T13:00:00Z'));
  const rule=schemas.deRule.parse({itemId:1,name:'Input',requiredSkill:1,verified:true,evidence:'Synthetic only',outcomes:[{probability:.5,materials:[{itemId:2,name:'Material',quantity:1}]},{probability:.5,materials:[{itemId:2,name:'Material',quantity:3}]}],note:''});
  const result=disenchant(rule,items,{...settings,enchantingSkill:1});expect(result.expectedNet).toBe(152);expect(result.profit).toBe(52);expect(result.lossProbability).toBe(.5);
  expect(disenchant(rule,items,{...settings,enchantingSkill:0}).blocked).toBe(true);
 });
 it('subtracts materials, extra costs and sale cut from crafting returns',()=>{
  const items=market([{id:'x',source:'synthetic',observedAt:'2026-01-04T12:00:00Z',observations:[{itemId:1,name:'Output',quantity:1,unitCopper:200},{itemId:2,name:'Material',quantity:1,unitCopper:30}]}],settings,Date.parse('2026-01-04T13:00:00Z'));
  const recipe=schemas.recipe.parse({name:'Test',profession:'Alchemy',output:{itemId:1,name:'Output',quantity:1},inputs:[{itemId:2,name:'Material',quantity:2}],extraCostCopper:10,verified:true,evidence:'Synthetic',note:''});
  expect(profession(recipe,items,settings).profit).toBe(120);
 });
 it('does not turn observed certainty into a certain probability',()=>{
  const r=schemas.deResult.parse({itemId:1,name:'Input',quantity:1,materials:[{itemId:2,name:'Material',quantity:1}],at:'2026-01-01T00:00:00Z',note:''});const e=empirical([r,r]);expect(e.outcomes[0].probability).toBe(1);expect(e.outcomes[0].low).toBeLessThan(.5);
 });
});
