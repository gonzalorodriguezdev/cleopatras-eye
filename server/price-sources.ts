import type {PricePoint} from './generated/prisma/client';
import type {MarketScan} from '../shared/analytics';
// Never splice community history into local history. Stale local evidence still wins.
export function selectSources(local:MarketScan[],remote:PricePoint[]):MarketScan[]{
 const localIds=new Set(local.flatMap(s=>s.observations.map(r=>r.itemId)));
 const grouped=new Map<number,PricePoint[]>();
 for(const p of remote){const id=Number(p.itemKey);if(localIds.has(id))continue;const rows=grouped.get(id)??[];rows.push(p);grouped.set(id,rows);}
 const result=[...local];
 for(const [itemId,points] of grouped){
  points.sort((a,b)=>b.observedAt.getTime()-a.observedAt.getTime()||b.importedAt.getTime()-a.importedAt.getTime());
  // Explicit absence must not resurrect an old price.
  if(points[0].unitCopper===null)continue;
  const seen=new Set<number>();
  for(const p of points){const at=p.observedAt.getTime();if(seen.has(at))continue;seen.add(at);if(seen.size>200)break;if(p.unitCopper===null)continue;result.push({id:p.id,source:p.provider,observedAt:p.observedAt.toISOString(),importedAt:p.importedAt.toISOString(),observations:[{itemId,name:p.name,unitCopper:p.unitCopper,quantity:p.quantity,summary:true}]});}
 }
 return result;
}

// Choose one local history per item: use listing evidence when equally recent.
export function localEvidence(listings:MarketScan[],summaries:MarketScan[]):MarketScan[]{
 const latest=new Map<number,number>();for(const scan of listings)for(const row of scan.observations)latest.set(row.itemId,Math.max(latest.get(row.itemId)??0,Date.parse(scan.observedAt)));
 const useSummary=new Set<number>();for(const scan of summaries)for(const row of scan.observations)if(Date.parse(scan.observedAt)>(latest.get(row.itemId)??0))useSummary.add(row.itemId);
 return [...listings.map(s=>({...s,observations:s.observations.filter(r=>!useSummary.has(r.itemId))})),...summaries.filter(s=>s.observations.some(r=>useSummary.has(r.itemId)))].filter(s=>s.observations.length);
}
