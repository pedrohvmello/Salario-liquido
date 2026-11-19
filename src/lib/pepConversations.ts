import {db} from './data'

export type PepChatMessage={role:'user'|'assistant';content:string;sources?:string[]}
export type PepConversationSummary={
 id:string;title:string;mode:'help'|'personal';created_at:string;updated_at:string
}
export type PepConversation=PepConversationSummary&{messages:PepChatMessage[]}

async function authenticatedId():Promise<string>{
 if(!db)throw new Error('Banco não configurado.')
 const {data,error}=await db.auth.getUser()
 if(error||!data.user)throw new Error('Entre novamente na sua conta para acessar o histórico do Pep.')
 return data.user.id
}
export function pepConversationTitle(messages:PepChatMessage[]):string{
 const first=messages.find(message=>message.role==='user')?.content.trim().replace(/\s+/g,' ')||'Conversa com o Pep'
 const summary=first.replace(/[?!.,;:]+$/,'').slice(0,76).trim()
 return (summary.length>=first.length?summary:summary.replace(/\s+\S*$/,'')+'…')||'Conversa com o Pep'
}
function sanitized(messages:PepChatMessage[]):PepChatMessage[]{
 const clean=messages.slice(0,100).filter(item=>item.role==='user'||item.role==='assistant')
  .map(item=>({
   role:item.role,
   content:item.content.slice(0,1400),
   ...(item.sources?.length?{sources:item.sources.slice(0,2).map(x=>x.slice(0,140))}:{})
  }))
 if(!clean.length||clean.length!==messages.length)throw new Error('Conversa vazia ou muito longa para salvar.')
 return clean
}
export async function listPepConversations(mode:'help'|'personal'):Promise<PepConversationSummary[]>{
 const userId=await authenticatedId()
 const {data,error}=await db!.from('pep_conversations')
  .select('id,title,mode,created_at,updated_at')
  .eq('user_id',userId).eq('mode',mode).order('updated_at',{ascending:false}).limit(80)
 if(error)throw new Error('Não foi possível carregar o histórico do Pep: '+error.message)
 return (data||[]) as PepConversationSummary[]
}
export async function getPepConversation(id:string,mode:'help'|'personal'):Promise<PepConversation>{
 const userId=await authenticatedId()
 const {data,error}=await db!.from('pep_conversations')
  .select('id,title,mode,created_at,updated_at,messages')
  .eq('user_id',userId).eq('mode',mode).eq('id',id).single()
 if(error||!data)throw new Error('Conversa não encontrada ou sem permissão de acesso.')
 return data as PepConversation
}
export async function savePepConversation(mode:'help'|'personal',messages:PepChatMessage[],id?:string|null):Promise<string>{
 const userId=await authenticatedId()
 const clean=sanitized(messages)
 const payload={
  title:pepConversationTitle(clean),messages:clean,updated_at:new Date().toISOString()
 }
 if(id){
  const {data,error}=await db!.from('pep_conversations').update(payload)
   .eq('id',id).eq('user_id',userId).eq('mode',mode).select('id').single()
  if(error||!data)throw new Error('Não foi possível atualizar esta conversa: '+(error?.message||'registro indisponível'))
  return data.id as string
 }
 const {data,error}=await db!.from('pep_conversations')
  .insert({...payload,mode,user_id:userId}).select('id').single()
 if(error||!data)throw new Error('Não foi possível salvar esta conversa: '+(error?.message||'registro indisponível'))
 return data.id as string
}
