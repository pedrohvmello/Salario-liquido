export type Plan='free'|'basic'|'full'
export type UserLocation={plan:Plan;city:string|null;state:string|null}
export const planLabels:Record<Plan,string>={free:'Free',basic:'Basic',full:'Full'}
export function planCount(users:ReadonlyArray<UserLocation>):Record<Plan,number>{
 const out={free:0,basic:0,full:0}
 users.forEach(u=>{out[u.plan in out?u.plan:'free']++})
 return out
}
export function localityCounts(users:ReadonlyArray<UserLocation>):Array<{location:string;count:number}>{
 const counts=new Map<string,number>()
 for(const u of users){
  const city=u.city?.trim(),state=u.state?.trim()
  const key=city?(city+(state?' / '+state.toUpperCase():'')):'Não informado'
  counts.set(key,(counts.get(key)||0)+1)
 }
 return [...counts.entries()].map(([location,count])=>({location,count}))
  .sort((a,b)=>b.count-a.count||a.location.localeCompare(b.location,'pt-BR'))
}
