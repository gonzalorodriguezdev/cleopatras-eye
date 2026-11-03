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
