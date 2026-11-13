import {useCallback,useEffect,useState,type FormEvent} from 'react'
import {CheckCircle2,RefreshCw,Send} from 'lucide-react'
import {db} from '../lib/data'
import {supportDate,supportError,supportStatuses,supportTicketCode,type SupportTicket,type SupportTicketMessage} from '../lib/support'

export function TicketConversation({ticket,admin=false,requesterName,onMessageSent}:{
 ticket:SupportTicket;admin?:boolean;requesterName?:string;onMessageSent?:()=>void
}){
 const [current,setCurrent]=useState(ticket)
 const [messages,setMessages]=useState<SupportTicketMessage[]>([])
 const [draft,setDraft]=useState('')
 const [loading,setLoading]=useState(true)
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const [success,setSuccess]=useState('')
 const displayRequester=requesterName?.trim()||'Nome não informado'
 useEffect(()=>setCurrent(ticket),[ticket])
 const refresh=useCallback(async()=>{
  if(!db)return
  try{
   const statusResult=await db.from('support_tickets').select('status,updated_at,last_user_activity_at,last_admin_activity_at').eq('id',ticket.id).single()
   if(statusResult.error)throw Error(statusResult.error.message)
   if(statusResult.data){
    const updated=statusResult.data
    setCurrent(old=>({...old,
     status:updated.status as SupportTicket['status'],updated_at:updated.updated_at,
     last_user_activity_at:updated.last_user_activity_at,last_admin_activity_at:updated.last_admin_activity_at
    }))
   }
   const collected:SupportTicketMessage[]=[]
   for(let offset=0;offset<10000;offset+=200){
    const {data,error:readError}=await db.from('support_ticket_messages')
     .select('id,ticket_id,sender_id,sender_role,body,created_at').eq('ticket_id',ticket.id)
     .order('created_at',{ascending:true}).order('id',{ascending:true}).range(offset,offset+199)
    if(readError)throw Error(readError.message)
    collected.push(...(data||[]) as SupportTicketMessage[])
    if((data||[]).length<200)break
   }
   setMessages(collected)
   setError('')
  }catch(err){setError(supportError(err instanceof Error?err.message:'Não foi possível consultar a conversa.'))}
  finally{setLoading(false)}
 },[ticket.id])
 useEffect(()=>{
  setMessages([]);setDraft('');setLoading(true);setError('');setSuccess('')
  void refresh()
  const timer=window.setInterval(()=>void refresh(),15000)
  return ()=>window.clearInterval(timer)
 },[refresh])
 const send=async(event:FormEvent<HTMLFormElement>)=>{
  event.preventDefault()
  const body=draft.trim()
  if(!db||busy||current.status==='resolved'||!body)return
  setBusy(true);setError('');setSuccess('')
  try{
   const {data:{user},error:authError}=await db.auth.getUser()
   if(authError||!user)throw Error('Sua sessão expirou. Entre novamente.')
   const {error:sendError}=await db.from('support_ticket_messages')
    .insert({ticket_id:ticket.id,sender_id:user.id,body})
   if(sendError)throw Error(supportError(sendError.message))
   setDraft('')
   setSuccess('Mensagem enviada.')
   await refresh()
   onMessageSent?.()
  }catch(err){setError(err instanceof Error?err.message:'Não foi possível enviar a mensagem.')}
  finally{setBusy(false)}
 }
 return <section className="help-conversation" aria-label={'Conversa do chamado '+supportTicketCode(current)}>
  <div className="help-conversation-heading">
   <div><strong>Conversa do chamado {supportTicketCode(current)}</strong><small>{current.subject}</small></div>
   <div className="help-conversation-heading-actions"><span className="help-ticket-status">{supportStatuses[current.status]}</span>
    <button type="button" className="secondary" onClick={()=>void refresh()} aria-label="Atualizar conversa"><RefreshCw size={15}/> Atualizar</button>
   </div>
  </div>
  <ol className="help-message-list" aria-live="polite">
   <li className="help-message help-message-user">
    <span className="help-message-meta">{displayRequester} · Solicitação inicial · {supportDate(current.created_at)}</span>
    <p>{current.description}</p>
   </li>
   {messages.map(item=><li className={'help-message '+(item.sender_role==='admin'?'help-message-admin':'help-message-user')} key={item.id}>
    <span className="help-message-meta">{item.sender_role==='admin'?'Suporte Payrep':displayRequester} · {supportDate(item.created_at)}</span>
    <p>{item.body}</p>
   </li>)}
  </ol>
  {loading&&<p className="subtle">Carregando a conversa...</p>}
  {error&&<p role="alert" className="error">{error}</p>}
  {success&&<p role="status" className="auth-success">{success}</p>}
  {current.status==='resolved'?
   <p className="help-ticket-closed"><CheckCircle2 size={17}/> Chamado finalizado pelo suporte. Esta conversa está disponível apenas para consulta.</p>:
   <form className="help-message-form" onSubmit={e=>void send(e)}>
    <label htmlFor={'support-message-'+ticket.id}>{admin?'Responder ao usuário':'Adicionar mensagem'}</label>
    <textarea id={'support-message-'+ticket.id} rows={3} maxLength={4000} minLength={1} required value={draft}
     placeholder={admin?'Escreva sua resposta para o usuário.':'Acrescente informações ou responda ao suporte.'} onChange={e=>setDraft(e.target.value)}/>
    <button type="submit" className="primary" disabled={busy||!draft.trim()}><Send size={16}/>{busy?'Enviando...':'Enviar mensagem'}</button>
   </form>}
 </section>
}
