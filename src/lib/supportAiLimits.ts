import {db} from './data'
export type PepLimits={
 helpDailyLimit:number
 basicDailyLimit:number
 fullDailyLimit:number
 globalDailyLimit:number
 usedToday:number
 usersToday:number
 timezone:string
}
export function validPepLimits(help:number,basic:number,full:number,global:number):boolean{
 return [help,basic,full,global].every(n=>Number.isSafeInteger(n)&&n>=1)&&full>=basic
}
function client(){if(!db)throw Error('Supabase não configurado');return db}
export async function fetchPepLimits():Promise<PepLimits>{
 const {data,error}=await client().rpc('get_pep_limits')
 if(error)throw Error(error.message)
 if(!data||!validPepLimits(data.helpDailyLimit,data.basicDailyLimit,data.fullDailyLimit,data.globalDailyLimit)
  ||!Number.isSafeInteger(data.usedToday)||!Number.isSafeInteger(data.usersToday))
  throw Error('Configuração dos limites do Pep inválida.')
 return data as PepLimits
}
export async function savePepLimits(help:number,basic:number,full:number,global:number):Promise<void>{
 if(!validPepLimits(help,basic,full,global))throw Error('Informe limites positivos. O Full deve ter limite igual ou superior ao Basic.')
 const {error}=await client().rpc('set_pep_limits',{
  p_help:help,p_basic:basic,p_full:full,p_global:global
 })
 if(error)throw Error(error.message)
}
export type MyPepUsage={
 effectivePlan:'free'|'basic'|'full'
 unlimited:boolean
 helpUsed:number
 personalUsed:number
 helpLimit:number
 personalLimit:number
 timezone:string
}
export async function fetchMyPepUsage():Promise<MyPepUsage>{
 const {data,error}=await client().rpc('get_my_pep_usage')
 if(error)throw Error(error.message)
 if(!data||!['free','basic','full'].includes(data.effectivePlan)||typeof data.unlimited!=='boolean')
  throw Error('Não foi possível consultar seu limite do Pep.')
 return data as MyPepUsage
}
