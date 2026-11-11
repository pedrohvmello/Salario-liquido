import {normalizeOverviewCards,type OverviewCardId} from './overview'

/** Do not mutate production preferences while testing UI in the shared-Supabase HML. */
export function isHomologationHost(hostname:string):boolean{
 return hostname==='salario-liquido-hml.vercel.app'||/^salario-liquido-hml-[a-z0-9-]+\.vercel\.app$/.test(hostname)
}
const keyFor=(userId:string)=>'payrep:hml:overview-cards:'+userId
export function readHomologationCards(userId:string):OverviewCardId[]|null{
 try{
  const value=window.localStorage.getItem(keyFor(userId))
  return value===null?null:normalizeOverviewCards(JSON.parse(value))
 }catch{return null}
}
export function saveHomologationCards(userId:string,cards:OverviewCardId[]):void{
 window.localStorage.setItem(keyFor(userId),JSON.stringify(normalizeOverviewCards(cards)))
}
