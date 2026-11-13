import {db} from './data'

export type SupportAiLimits={
 userDailyLimit:number
 globalDailyLimit:number
 usedToday:number
 usersToday:number
 timezone:string
}
export function validSupportAiLimits(userLimit:number,globalLimit:number):boolean{
 return Number.isSafeInteger(userLimit)&&Number.isSafeInteger(globalLimit)
  &&userLimit>=1&&globalLimit>=1
}
function client(){if(!db)throw Error('Supabase não configurado');return db}
export async function fetchSupportAiLimits():Promise<SupportAiLimits>{
 const {data,error}=await client().rpc('get_support_ai_limits')
 if(error)throw Error(error.message)
 if(!data||!validSupportAiLimits(data.userDailyLimit,data.globalDailyLimit)
  ||!Number.isSafeInteger(data.usedToday)||!Number.isSafeInteger(data.usersToday))
  throw Error('Configuração de IA inválida.')
 return data as SupportAiLimits
}
export async function saveSupportAiLimits(userDailyLimit:number,globalDailyLimit:number):Promise<void>{
 if(!validSupportAiLimits(userDailyLimit,globalDailyLimit))
  throw Error('Informe limites inteiros válidos. ')
 const {error}=await client().rpc('set_support_ai_limits',{
  p_user_limit:userDailyLimit,p_global_limit:globalDailyLimit
 })
 if(error)throw Error(error.message)
}
