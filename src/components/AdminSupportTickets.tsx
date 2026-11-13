import {useCallback,useEffect,useState} from 'react'
import {LifeBuoy,RefreshCw} from 'lucide-react'
import {db} from '../lib/data'
import {PayrepSelect} from './PayrepSelect'
import {TicketConversation} from './TicketConversation'
import {supportCategoryLabel,supportDate,supportError,supportStatuses,supportTicketCode,supportTicketFields,type SupportStatus,type SupportTicket} from '../lib/support'

export function AdminSupportTickets(){
 const [tickets,setTickets]=useState<SupportTicket[]>([])
 const [selectedId,setSelectedId]=useState<string|null>(null)
 const [loading,setLoading]=useState(true)
 const [busy,setBusy]=useState('')
 const [error,setError]=useState('')
 const [message,setMessage]=useState('')
 const load=useCallback(async()=>{
  if(!db){setLoading(false);return}
  setLoading(true)
  try{
   const {data,error:readError}=await db.from('support_tickets').select(supportTicketFields)
    .order('created_at',{ascending:false}).limit(50)
   if(readError)throw Error(supportError(readError.message))
   setTickets((data||[]) as SupportTicket[])
   setError('')
  }catch(err){setError(err instanceof Error?err.message:'Não foi possível carregar os chamados.')}
  finally{setLoading(false)}
 },[])
 useEffect(()=>{void load()},[load])
 const change=async(id:string,status:SupportStatus)=>{
  if(!db)return
  if(status==='resolved'&&!window.confirm('Finalizar este chamado? Depois disso, não será possível enviar novas mensagens ou reabrir a conversa.'))return
  setBusy(id);setError('');setMessage('')
  try{
   const {data,error:updateError}=await db.from('support_tickets')
    .update({status,updated_at:new Date().toISOString()}).eq('id',id).select('id,status,updated_at').single()
   if(updateError||!data)throw Error(supportError(updateError?.message||'Não foi possível atualizar o chamado.'))
   setTickets(old=>old.map(item=>item.id===id?{...item,status:data.status as SupportStatus,updated_at:data.updated_at}:item))
   setMessage(status==='resolved'?'Chamado finalizado. A conversa agora é somente leitura.':'Status atualizado.')
  }catch(err){setError(err instanceof Error?err.message:'Não foi possível atualizar o chamado.')}
  finally{setBusy('')}
 }
 const selected=tickets.find(ticket=>ticket.id===selectedId)
 return <section className="panel">
  <div className="panel-heading"><h2><LifeBuoy size={18}/> Chamados de suporte</h2>
   <button type="button" className="secondary" onClick={()=>void load()} disabled={loading}><RefreshCw size={15}/> Atualizar</button></div>
  <p className="subtle">Últimos 50 chamados. Abra uma conversa para responder ao usuário. Apenas a administração pode alterar o status ou finalizar um chamado.</p>
  {error&&<p role="alert" className="error">{error}</p>}
  {message&&<p role="status" className="auth-success">{message}</p>}
  {loading?<p className="subtle">Carregando chamados...</p>:tickets.length===0?<p className="subtle">Nenhum chamado registrado.</p>:
  <div className="help-admin-ticket-list">{tickets.map(ticket=><article key={ticket.id} className="help-admin-ticket">
   <div className="help-admin-ticket-main"><strong>{ticket.subject}</strong>
    <small>#{supportTicketCode(ticket)} · {supportDate(ticket.created_at)} · Categoria: {supportCategoryLabel(ticket.category)}</small>
    <small>Conta: {ticket.user_id}</small>
    <p>{ticket.description}</p>
    <button type="button" className="secondary" onClick={()=>setSelectedId(old=>old===ticket.id?null:ticket.id)}>
     {selectedId===ticket.id?'Ocultar conversa':'Ver conversa e responder'}
    </button>
   </div>
   <div className="help-admin-ticket-status"><label>Status<PayrepSelect title="Status do chamado" value={ticket.status} disabled={busy===ticket.id||ticket.status==='resolved'}
    onChange={value=>void change(ticket.id,value as SupportStatus)}>
     {Object.entries(supportStatuses).map(([value,label])=><option key={value} value={value}>{label}</option>)}
    </PayrepSelect></label></div>
  </article>)}</div>}
  {selected&&<div className="help-admin-conversation"><TicketConversation key={selected.id} ticket={selected} admin/></div>}
 </section>
}
