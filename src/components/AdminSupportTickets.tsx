import {useEffect,useState} from 'react'
import {LifeBuoy,RefreshCw} from 'lucide-react'
import {db} from '../lib/data'
import {PayrepSelect} from './PayrepSelect'
import {supportStatuses,type SupportTicket} from './SupportPage'

export function AdminSupportTickets(){
 const [tickets,setTickets]=useState<SupportTicket[]>([])
 const [loading,setLoading]=useState(false)
 const [busy,setBusy]=useState('')
 const [error,setError]=useState('')
 const [message,setMessage]=useState('')
 const load=async()=>{
  if(!db)return
  setLoading(true);setError('')
  try{
   const {data,error}=await db.from('support_tickets').select('id,user_id,category,subject,description,status,created_at,updated_at')
    .order('created_at',{ascending:false}).limit(50)
   if(error)throw Error(error.message)
   setTickets((data||[]) as SupportTicket[])
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível carregar os chamados.')}
  finally{setLoading(false)}
 }
 useEffect(()=>{void load()},[])
 const change=async(id:string,status:SupportTicket['status'])=>{
  if(!db)return
  setBusy(id);setError('');setMessage('')
  try{
   const {error}=await db.from('support_tickets').update({status,updated_at:new Date().toISOString()}).eq('id',id)
   if(error)throw Error(error.message)
   setTickets(t=>t.map(item=>item.id===id?{...item,status}:item))
   setMessage('Status do chamado atualizado.')
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível atualizar o chamado.')}
  finally{setBusy('')}
 }
 return <section className="panel">
  <div className="panel-heading"><h2><LifeBuoy size={18}/> Chamados de suporte</h2>
   <button type="button" className="secondary" onClick={()=>void load()} disabled={loading}><RefreshCw size={15}/> Atualizar</button></div>
  <p className="subtle">Últimos 50 chamados, com consulta restrita à administração. O Maileroo não envia avisos automáticos nesta etapa.</p>
  {error&&<p role="alert" className="error">{error}</p>}
  {message&&<p role="status" className="auth-success">{message}</p>}
  {loading?<p className="subtle">Carregando chamados...</p>:tickets.length===0?<p className="subtle">Nenhum chamado registrado.</p>:
  <div className="help-admin-ticket-list">{tickets.map(ticket=><article key={ticket.id} className="help-admin-ticket">
   <div><strong>{ticket.subject}</strong><small>{new Date(ticket.created_at).toLocaleString('pt-BR')} · Conta {ticket.user_id} · {ticket.category}</small><p>{ticket.description}</p></div>
   <div className="help-admin-ticket-status"><label>Status<PayrepSelect title="Status do chamado" value={ticket.status} disabled={busy===ticket.id}
    onChange={value=>void change(ticket.id,value as SupportTicket['status'])}>
     {Object.entries(supportStatuses).map(([value,label])=><option key={value} value={value}>{label}</option>)}
    </PayrepSelect></label></div>
  </article>)}</div>}
 </section>
}
