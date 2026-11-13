import {db} from './data'
export type CloudflareNeuronModel={model:string;neurons:number}
export type CloudflareNeuronUsage={
 status:'available'|'not_configured'|'unavailable'
 day:string
 limit:number
 scope:'cloudflare_account'
 timezone:'UTC'
 neuronsUsed?:number
 neuronsRemaining?:number
 models?:CloudflareNeuronModel[]
 refreshedAt?:string
 note?:string
}
export async function fetchCloudflareNeurons():Promise<CloudflareNeuronUsage>{
 if(!db)throw Error('Supabase indisponível.')
 const {data,error}=await db.functions.invoke('support-ai-usage',{method:'GET'})
 if(error)throw Error('Não foi possível consultar o consumo de Neurons.')
 if(!data||!['available','not_configured','unavailable'].includes(data.status))
  throw Error('Resposta de consumo inválida.')
 return data as CloudflareNeuronUsage
}
