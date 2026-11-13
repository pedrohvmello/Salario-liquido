export type AiNeuronGroup={model:string;neurons:number}
export type AiNeuronUsage={used:number;models:AiNeuronGroup[]}
export function parseAiNeuronUsage(raw:unknown):AiNeuronUsage|null{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return null
 const root=raw as Record<string,unknown>
 if(Array.isArray(root.errors)&&root.errors.length>0)return null
 const data=root.data as Record<string,unknown>|undefined
 const viewer=data?.viewer as Record<string,unknown>|undefined
 const accounts=viewer?.accounts
 if(!Array.isArray(accounts)||accounts.length!==1)return null
 const account=accounts[0] as Record<string,unknown>|undefined
 const groups=account?.aiInferenceAdaptiveGroups
 if(!Array.isArray(groups))return null
 const byModel=new Map<string,number>()
 for(const group of groups){
  if(!group||typeof group!=='object')return null
  const row=group as Record<string,unknown>
  const metrics=row.sum as Record<string,unknown>|undefined
  const neurons=metrics?.totalNeurons
  if(typeof neurons!=='number'||!Number.isFinite(neurons)||neurons<0)return null
  const dimensions=row.dimensions as Record<string,unknown>|undefined
  const model=(typeof dimensions?.modelId==='string'&&dimensions.modelId.trim())
   ?dimensions.modelId.slice(0,120):'Outros modelos'
  byModel.set(model,(byModel.get(model)||0)+neurons)
 }
 const models=[...byModel.entries()].map(([model,neurons])=>({model,neurons}))
  .sort((a,b)=>b.neurons-a.neurons)
 return {used:models.reduce((total,r)=>total+r.neurons,0),models}
}
export const UTC_DAY=/^\d{4}-\d{2}-\d{2}$/
export function cloudflareNeuronsQuery(accountId:string,utcDay:string):string{
 if(!/^[a-f0-9]{32}$/i.test(accountId)||!UTC_DAY.test(utcDay))
  throw Error('Invalid Cloudflare analytics parameters')
 return `query{viewer{accounts(filter:{accountTag:"${accountId}"}){aiInferenceAdaptiveGroups(limit:500,filter:{date:"${utcDay}"}){dimensions{modelId}sum{totalNeurons}}}}}`
}
