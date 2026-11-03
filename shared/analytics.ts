import {schemas,type Entry,type Settings,type Data} from './contracts';
export type Row={itemId:number;name:string;unitCopper:number;quantity:number|null;summary?:boolean};
export type MarketScan={id:string;observedAt:string;source:string;importedAt?:string;observations:Row[]};
export function quantile(values:number[],p:number){if(!values.length)return null;const a=[...values].sort((x,y)=>x-y);const i=(a.length-1)*p;return a[Math.floor(i)]+(a[Math.ceil(i)]-a[Math.floor(i)])*(i%1);}
export function records<K extends keyof typeof schemas>(entries:Entry[],kind:K):Data<K>[] {return entries.filter(e=>!e.voided&&e.kind===kind).map(e=>schemas[kind].parse(e.data) as Data<K>);}
export function market(scans:MarketScan[],settings:Settings,now=Date.now()){
 const grouped=new Map<number,{scan:MarketScan;rows:Row[]}[]>();
 for(const scan of scans){const rowsById=new Map<number,Row[]>();for(const row of scan.observations){const rows=rowsById.get(row.itemId)??[];rows.push(row);rowsById.set(row.itemId,rows);}for(const [id,rows] of rowsById){const history=grouped.get(id)??[];history.push({scan,rows});grouped.set(id,history);}}
 return [...grouped].map(([itemId,observations])=>{
  const history=observations.sort((a,b)=>Date.parse(a.scan.observedAt)-Date.parse(b.scan.observedAt)).map(({scan,rows})=>({at:scan.observedAt,importedAt:scan.importedAt??null,scanId:scan.id,source:scan.source,summary:rows.some(r=>r.summary),min:Math.min(...rows.map(r=>r.unitCopper)),median:rows.some(r=>r.summary)?null:quantile(rows.map(r=>r.unitCopper),.5),p25:rows.some(r=>r.summary)?null:quantile(rows.map(r=>r.unitCopper),.25),p75:rows.some(r=>r.summary)?null:quantile(rows.map(r=>r.unitCopper),.75),units:rows.some(r=>r.quantity===null)?null:rows.reduce((a,r)=>a+(r.quantity??0),0),rows}));
  const latest=history.at(-1)!;const prior=history.slice(0,-1);const reference=quantile(prior.map(h=>h.min),.5);
  const ageHours=(now-Date.parse(latest.at))/3600000;
  const stale=ageHours>settings.maxAgeHours;
  const eligible=prior.length>=settings.minScans&&!stale&&settings.feesVerified;
  const netTarget=reference===null?null:Math.floor(reference*(1-settings.feeRate));
  const roi=netTarget===null?null:(netTarget-latest.min)/latest.min;
  const maximum=netTarget===null?null:Math.floor(netTarget/(1+settings.minRoi));
  const median=quantile(prior.map(h=>h.min),.5);
  const mad=median===null?null:quantile(prior.map(h=>Math.abs(h.min-median)),.5);
  const priceAnomaly=prior.length>=settings.minScans&&median!==null&&((mad!>0&&Math.abs(latest.min-median)>6*mad!)||(mad===0&&(latest.min<median*.5||latest.min>median*2)));
  const supplyReference=quantile(prior.flatMap(h=>h.units===null?[]:[h.units]),.5);
  const supplyAnomaly=latest.units!==null&&prior.filter(h=>h.units!==null).length>=settings.minScans&&supplyReference!==null&&(latest.units<supplyReference*.2||latest.units>supplyReference*5);
  const anomalous=priceAnomaly||supplyAnomaly;
  const reasons=[...(stale?['Stale observation']:[]),...(prior.length<settings.minScans?['Insufficient independent scan history']:[]),...(!settings.feesVerified?['Auction fees not verified']:[]),...(anomalous?['Unusual price requires review']:[])];
  return {itemId,name:latest.rows[0].name,latest,history,reference,ageHours,stale,roi,maximum,anomalous,priceAnomaly,supplyAnomaly,reasons,opportunity:eligible&&!anomalous&&roi!==null&&roi>=settings.minRoi,liquidity:'Unknown — asking prices are not sales',risk:'Resale and listing costs remain uncertain'};
 });
}
export type ItemMarket=ReturnType<typeof market>[number];
export function portfolio(entries:Entry[],settings:Settings,prices:ItemMarket[]=[]){
 let cash=settings.openingCopper,realized=0;
 const holdings=new Map<number,{itemId:number;name:string;quantity:number;cost:number;realized:number}>();
 const item=(id:number,name:string)=>{let h=holdings.get(id);if(!h){h={itemId:id,name,quantity:0,cost:0,realized:0};holdings.set(id,h);}return h;};
 const add=(id:number,name:string,q:number,cost:number)=>{const h=item(id,name);h.quantity+=q;h.cost+=cost;};
 const remove=(id:number,name:string,q:number)=>{const h=item(id,name);if(q>h.quantity)throw Error(`Insufficient recorded inventory for ${name} (${id})`);const cost=h.cost*q/h.quantity;h.quantity-=q;h.cost=Math.max(0,h.cost-cost);return cost;};
 const active=entries.filter(e=>!e.voided&&['trade','deResult','gathering'].includes(e.kind)).sort((a,b)=>String((a.data as {at:string}).at).localeCompare(String((b.data as {at:string}).at))||a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));
 for(const entry of active){
  if(entry.kind==='trade'){
   const t=schemas.trade.parse(entry.data),gross=t.unitCopper*t.quantity;
   if(t.type==='buy'){cash-=gross+t.feesCopper;add(t.itemId,t.name,t.quantity,gross+t.feesCopper);}
   else if(t.type==='sell'){const cost=remove(t.itemId,t.name,t.quantity);const profit=gross-t.feesCopper-cost;cash+=gross-t.feesCopper;realized+=profit;item(t.itemId,t.name).realized+=profit;}
   else if(t.type==='cash-in')cash+=gross;
   else if(t.type==='cash-out')cash-=gross;
   else {cash-=gross+t.feesCopper;realized-=gross+t.feesCopper;}
  }else{
   const d=entry.kind==='deResult'?schemas.deResult.parse(entry.data):schemas.gathering.parse(entry.data);
   let cost=0;
   if('costCopper' in d){cost=d.costCopper;cash-=cost;}else cost=remove(d.itemId,d.name,d.quantity);
   const units=d.materials.reduce((sum,m)=>sum+m.quantity,0);
   for(const m of d.materials)add(m.itemId,m.name,m.quantity,cost*m.quantity/units);
  }
 }
 if([cash,realized,...[...holdings.values()].flatMap(h=>[h.quantity,h.cost])].some(n=>!Number.isFinite(n)||Math.abs(n)>Number.MAX_SAFE_INTEGER))throw Error('Ledger exceeds supported numerical precision');
 const inventory=[...holdings.values()].map(h=>{const p=prices.find(p=>p.itemId===h.itemId&&!p.stale);const value=p&&settings.feesVerified?h.quantity*p.latest.min*(1-settings.feeRate):null;return {...h,value,unrealized:value===null?null:value-h.cost};});
 return {cash,realized,inventory,invested:inventory.reduce((s,h)=>s+h.cost,0),estimatedValue:inventory.every(h=>!h.quantity||h.value!==null)?inventory.reduce((s,h)=>s+(h.value??0),0):null,unrealized:inventory.every(h=>!h.quantity||h.unrealized!==null)?inventory.reduce((s,h)=>s+(h.unrealized??0),0):null,warning:cash<0?'Negative cash: reconcile opening balance and missing transactions':null};
}
export function depth(rows:Row[],requested:number){
 if(rows.some(r=>r.summary||r.quantity===null))return {levels:[],requested,filled:0,unfilled:requested,cost:null,average:null,slippage:null,note:'Depth unavailable: community summaries do not contain listing price levels. Total supply may include bid-only auctions.'};
 let remaining=requested,cost=0,filled=0;const levels:{price:number;units:number;cumulative:number}[]=[];
 const grouped=new Map<number,number>();for(const r of rows)grouped.set(r.unitCopper,(grouped.get(r.unitCopper)??0)+(r.quantity??0));
 let cumulative=0;for(const [price,units] of [...grouped].sort((a,b)=>a[0]-b[0])){cumulative+=units;levels.push({price,units,cumulative});const take=Math.min(units,remaining);cost+=take*price;filled+=take;remaining-=take;}
 const cheapest=levels[0]?.price??null;
 return {levels,requested,filled,unfilled:remaining,cost,average:filled?cost/filled:null,slippage:filled&&cheapest?cost/filled/cheapest-1:null,note:'Observed supply only. Fill simulation assumes listed units can be bought individually. Sales capacity cannot be inferred.'};
}
export function timing(item:ItemMarket,timeZone:string){
 const groups=new Map<string,{values:number[];days:Set<string>}>();
 const format=new Intl.DateTimeFormat('en-US',{timeZone,weekday:'short',hour:'2-digit',hourCycle:'h23',year:'numeric',month:'2-digit',day:'2-digit'});
 for(const h of item.history){const parts=format.formatToParts(new Date(h.at));const part=(k:string)=>parts.find(p=>p.type===k)?.value??'';const key=part('weekday')+' '+part('hour')+':00';const value=groups.get(key)??{values:[],days:new Set<string>()};value.values.push(h.min);value.days.add(part('year')+part('month')+part('day'));groups.set(key,value);}
 return [...groups].map(([period,g])=>({period,median:quantile(g.values,.5)!,observations:g.values.length,days:g.days.size,reliable:g.days.size>=3})).sort((a,b)=>a.median-b.median);
}
export function salesEvidence(entries:Entry[],itemId:number,timeZone:string,now=Date.now()){
 const sales=records(entries,'trade').filter(t=>t.type==='sell'&&t.itemId===itemId&&Date.parse(t.at)>=now-30*86400000);
 const format=new Intl.DateTimeFormat('en-US',{timeZone,weekday:'short',hour:'2-digit',hourCycle:'h23'});
 const groups=new Map<string,{units:number;net:number;transactions:number}>();
 for(const t of sales){const period=format.format(new Date(t.at));const group=groups.get(period)??{units:0,net:0,transactions:0};group.units+=t.quantity;group.net+=t.quantity*t.unitCopper-t.feesCopper;group.transactions++;groups.set(period,group);}
 return {units:sales.reduce((s,t)=>s+t.quantity,0),perDay:sales.reduce((s,t)=>s+t.quantity,0)/30,periods:[...groups].map(([period,g])=>({period,...g,netUnit:g.net/g.units})).sort((a,b)=>b.netUnit-a.netUnit),note:'Only your recorded sales in the last 30 days. This is not total market demand or a guaranteed sell-through rate.'};
}
function price(id:number,items:ItemMarket[]){const p=items.find(p=>p.itemId===id&&!p.stale);return p?.latest.min??null;}
function materialsValue(materials:{itemId:number;quantity:number}[],items:ItemMarket[]){let value=0;for(const m of materials){const p=price(m.itemId,items);if(p===null)return null;value+=p*m.quantity;}return value;}
export function profession(recipe:Data<'recipe'>,items:ItemMarket[],settings:Settings){
 const input=materialsValue(recipe.inputs,items),output=materialsValue([recipe.output],items);
 const blocked=!recipe.verified||!recipe.evidence||!settings.feesVerified||input===null||output===null;
 const cost=input===null?null:input+recipe.extraCostCopper;
 const net=output===null?null:output*(1-settings.feeRate);
 return {name:recipe.name,blocked,cost,net:blocked?null:net,profit:blocked?null:net!-cost!,roi:blocked||!cost?null:(net!-cost)/cost,reason:blocked?'Requires verified Forever recipe, fees and fresh input/output prices':'Asking-price estimate; sales are not guaranteed'};
}
export function disenchant(rule:Data<'deRule'>,items:ItemMarket[],settings:Settings){
 const buy=price(rule.itemId,items);
 const values=rule.outcomes.map(o=>({probability:o.probability,gross:materialsValue(o.materials,items)}));
 const blocked=!rule.verified||!rule.evidence||settings.enchantingSkill<rule.requiredSkill||!settings.feesVerified||buy===null||values.some(v=>v.gross===null);
 if(blocked)return {name:rule.name,blocked:true,reason:'Requires verified eligibility/outcomes, sufficient skill, fees and fresh prices',expectedNet:null,profit:null,roi:null,lossProbability:null,maximum:null,directNet:null};
 const expectedNet=values.reduce((s,v)=>s+v.probability*v.gross!*(1-settings.feeRate),0);
 return {name:rule.name,blocked:false,reason:'Expected value based on entered verified outcome distribution; excludes unknown relisting losses',expectedNet,profit:expectedNet-buy!,roi:(expectedNet-buy!)/buy!,lossProbability:values.filter(v=>v.gross!*(1-settings.feeRate)<buy!).reduce((s,v)=>s+v.probability,0),maximum:Math.floor(expectedNet/(1+settings.minRoi)),directNet:buy!*(1-settings.feeRate)};
}
export function farming(session:Data<'gathering'>,items:ItemMarket[],settings:Settings){const gross=materialsValue(session.materials,items);const net=gross===null||!settings.feesVerified?null:gross*(1-settings.feeRate)-session.costCopper;return {name:session.name,minutes:session.minutes,gross,net,perHour:net===null?null:net*60/session.minutes};}
export function empirical(results:Data<'deResult'>[]){
 const single=results.filter(r=>r.quantity===1);const n=single.length;const counts=new Map<string,number>();
 for(const r of single){const key=JSON.stringify([...r.materials].sort((a,b)=>a.itemId-b.itemId).map(m=>[m.itemId,m.quantity]));counts.set(key,(counts.get(key)??0)+1);}
 return {trials:n,excludedBatchRecords:results.length-n,outcomes:[...counts].map(([outcome,k])=>{const z=1.96,p=k/n,den=1+z*z/n,center=(p+z*z/(2*n))/den,half=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/den;return {outcome,count:k,probability:p,low:Math.max(0,center-half),high:Math.min(1,center+half)};}),note:'Empirical frequencies with marginal 95% Wilson intervals; unseen outcomes are possible. Not verified game probabilities.'};
}
export function alerts(entries:Entry[],items:ItemMarket[]){
 const result=items.filter(i=>i.stale||i.anomalous||i.opportunity).map(i=>({id:'market-'+i.itemId+'-'+i.latest.scanId,title:i.name,message:i.stale?'Market data is stale':i.anomalous?'Unusual price — review source before trading':'Potential discount against prior asking prices'}));
 for(const a of records(entries,'alert')){const p=items.find(i=>i.itemId===a.itemId&&!i.stale);if(a.enabled&&p&&(a.direction==='below'?p.latest.min<=a.thresholdCopper:p.latest.min>=a.thresholdCopper))result.push({id:'rule-'+a.itemId+'-'+a.direction+'-'+a.thresholdCopper+'-'+p.latest.scanId,title:a.name,message:'Observed price reached your '+a.direction+' threshold'});}
 for(const w of records(entries,'watch')){const p=items.find(i=>i.itemId===w.itemId&&!i.stale);if(p&&p.latest.min>=w.targetCopper)result.push({id:'watch-'+w.itemId+'-'+p.latest.scanId,title:w.name,message:'Watchlist target reached in asking prices'});}
 return [...new Map(result.map(a=>[a.id,a])).values()];
}
