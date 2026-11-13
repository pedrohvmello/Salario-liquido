import {useCallback,useEffect,useMemo,useState} from 'react'
import {ArrowLeft,ChevronDown,LifeBuoy,RefreshCw} from 'lucide-react'
import {db} from '../lib/data'
import {fetchAdminDashboard} from '../lib/admin'
import {PayrepSelect} from './PayrepSelect'
import {TicketConversation} from './TicketConversation'
import {
 filterSupportTickets,supportCategories,supportCategoryLabel,supportDate,supportError,supportStatuses,
 supportTicketCode,supportTicketFields,type SupportStatus,type SupportStatusFilter,type SupportTicket
} from '../lib/support'

export function AdminSupportTickets({onBack}:{onBack:()=>void}){
 const [tickets,setTickets]=useState<SupportTicket[]>([])
 const [identities,setIdentities]=useState<Record<string,string>>({})
 const [selectedId,setSelectedId]=useState<string|null>(null)
 const [statusFilter,setStatusFilter]=useState<SupportStatusFilter>('all')
 const [yearFilter,setYearFilter]=useState('all')
 const [categoryFilter,setCategoryFilter]=useState('all')
 const [loading,setLoading]=useState(true)
 const [busy,setBusy]=useState('')
 const [error,setError]=useState('')
 const [message,setMessage]=useState('')
 const load=useCallback(async()=>{
  if(!db){setLoading(false);return}
  setLoading(true)
  try{
   const collected:SupportTicket[]=[]
   for(let offset=0;offset<10000;offset+=200){
    const {data,error:readError}=await db.from('support_tickets').select(supportTicketFields)
     .order('created_at',{ascending:false}).range(offset,offset+199)
    if(readError)throw Error(supportError(readError.message))
    collected.push(...(data||[]) as SupportTicket[])
    if((data||[]).length<200)break
   }
   if(collected.length>=10000)throw Error('Quantidade de chamados acima do limite desta tela. Contate o suporte técnico.')
   // Keep the existing admin-only lookup. Do not expose other users' profiles to ordinary accounts.
   const dashboard=await fetchAdminDashboard()
   const names:Record<string,string>={}
   for(const user of dashboard.users)names[user.id]=user.displayName?.trim().replace(/\.\s*$/,'')||user.email||'Nome não informado'
   setIdentities(names)
   setTickets(collected)
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
 const availableYears=useMemo(()=>[...new Set(tickets.map(ticket=>ticket.ticket_year))].sort((a,b)=>b-a),[tickets])
 const visible=useMemo(()=>filterSupportTickets(tickets,statusFilter,yearFilter,categoryFilter),[tickets,statusFilter,yearFilter,categoryFilter])
 return <div className="stack payrep-admin-support-page">
  <div className="page-intro"><div><h2>Chamados de suporte</h2>
   <p>Consulte e responda aos chamados, acompanhe pendências e finalize os atendimentos.</p></div>
   <button type="button" className="secondary" onClick={onBack}><ArrowLeft size={16}/> Voltar às configurações</button>
  </div>
  <section className="panel">
   <div className="panel-heading"><h2><LifeBuoy size={18}/> Chamados de suporte</h2>
    <button type="button" className="secondary" onClick={()=>void load()} disabled={loading}><RefreshCw size={15}/> Atualizar</button>
   </div>
   <p className="subtle">Pendente de resposta inclui chamados em atendimento cuja última interação do usuário não foi respondida pelo suporte.</p>
   <div className="help-admin-filters">
    <label>Status<PayrepSelect title="Filtrar por status" value={statusFilter} onChange={v=>setStatusFilter(v as SupportStatusFilter)}>
     <option value="all">Todos os status</option>
     <option value="open">Aberto</option>
     <option value="in_progress">Em atendimento</option>
     <option value="resolved">Finalizado</option>
     <option value="pending">Pendente de resposta</option>
    </PayrepSelect></label>
    <label>Ano<PayrepSelect title="Filtrar por ano" value={yearFilter} onChange={setYearFilter}>
     <option value="all">Todos os anos</option>
     {availableYears.map(year=><option value={String(year)} key={year}>{year}</option>)}
    </PayrepSelect></label>
    <label>Categoria<PayrepSelect title="Filtrar por categoria" value={categoryFilter} onChange={setCategoryFilter}>
     <option value="all">Todas as categorias</option>
     {supportCategories.map(category=><option key={category.value} value={category.value}>{category.label}</option>)}
    </PayrepSelect></label>
   </div>
   {error&&<p role="alert" className="error">{error}</p>}
   {message&&<p role="status" className="auth-success">{message}</p>}
   <p className="subtle">{visible.length} chamado(s) encontrado(s).</p>
   {loading&&tickets.length===0?<p className="subtle">Carregando chamados...</p>:visible.length===0?<p className="subtle">Nenhum chamado corresponde aos filtros selecionados.</p>:
   <div className="help-admin-ticket-list">{visible.map(ticket=>{
    const expanded=selectedId===ticket.id
    return <article key={ticket.id} className={'help-admin-ticket support-compact-ticket support-compact-ticket-'+ticket.status+(expanded?' is-expanded':'')}>
     <div className="support-compact-row">
      <button type="button" className="support-compact-toggle" aria-expanded={expanded} aria-controls={'support-thread-'+ticket.id}
       aria-label={(expanded?'Recolher':'Expandir')+' chamado '+supportTicketCode(ticket)+': '+ticket.subject}
       onClick={()=>setSelectedId(old=>old===ticket.id?null:ticket.id)}>
       <span className="support-compact-details">
        <strong>{ticket.subject}</strong>
        <small>#{supportTicketCode(ticket)} · {supportDate(ticket.created_at)} · Categoria: {supportCategoryLabel(ticket.category)}</small>
        <small>Solicitante: {identities[ticket.user_id]||'Nome não informado'}</small>
       </span>
       <ChevronDown size={18} className={'support-compact-chevron'+(expanded?' is-expanded':'')} aria-hidden="true"/>
      </button>
      <div className="help-admin-ticket-status support-compact-status">
       <label>Status<PayrepSelect title="Status do chamado" className={'support-status-select support-status-select-'+ticket.status}
        value={ticket.status} disabled={busy===ticket.id||ticket.status==='resolved'}
        onChange={value=>void change(ticket.id,value as SupportStatus)}>
        {Object.entries(supportStatuses).map(([value,label])=><option key={value} value={value}>{label}</option>)}
       </PayrepSelect></label>
      </div>
     </div>
     {expanded&&<div className="support-compact-conversation" id={'support-thread-'+ticket.id}>
      <TicketConversation key={ticket.id} ticket={ticket} admin requesterName={identities[ticket.user_id]} onMessageSent={()=>void load()}/>
     </div>}
    </article>
   })}</div>}
  </section>
 </div>
}
