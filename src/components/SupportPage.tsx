import {useCallback,useEffect,useState,type FormEvent} from 'react'
import type {User} from '@supabase/supabase-js'
import {ArrowLeft,BookOpen,CheckCircle2,ExternalLink,Info,LifeBuoy,Mail,RefreshCw,Send,Ticket} from 'lucide-react'
import {PayrepSelect} from './PayrepSelect'
import {TicketConversation} from './TicketConversation'
import {db} from '../lib/data'
import {supportCategories,supportCategoryLabel,supportDate,supportError,supportStatuses,supportTicketCode,supportTicketFields,type SupportTicket} from '../lib/support'

export const SUPPORT_EMAIL='suporte@payrep.com.br'
export const helpFaq=[
 {question:'Como configurar meu salário e benefícios?',answer:'Defina sua Base em Definições e registre alterações de salário, descontos e benefícios em Eventos e vigências. As regras entram em vigor na data informada.'},
 {question:'Como importar meus holerites?',answer:'Abra Importar holerites, selecione um ou mais PDFs, confira os dados encontrados e confirme a importação. A leitura inicial acontece no navegador.'},
 {question:'Por que a projeção difere do meu holerite?',answer:'A Visão geral apresenta uma estimativa, enquanto o Histórico salarial apresenta valores efetivos importados. Confira competência, eventos vigentes e os descontos específicos da folha.'},
 {question:'Como consultar férias, PPR e 13º salário?',answer:'Importe os respectivos documentos em Importar holerites. O aplicativo mantém as ocorrências separadas e apresenta conciliações no histórico quando houver informações suficientes.'},
 {question:'Como alterar senha ou gerenciar autenticação?',answer:'Abra o avatar no canto superior e entre em Segurança. Ali ficam senha, autenticadores, sessões e chaves de acesso, conforme os recursos habilitados.'},
 {question:'Meus dados financeiros ficam visíveis para outros usuários?',answer:'Os registros financeiros são vinculados à sua conta e protegidos por regras de acesso. Não inclua senhas ou documentos financeiros completos em chamados de suporte.'},
 {question:'Como excluir minha conta?',answer:'Abra o avatar, escolha Segurança e procure Excluir minha conta. Confira cuidadosamente o efeito da exclusão antes de confirmar.'}
] as const

function TicketWorkspace({user,onBack}:{user:User;onBack:()=>void}){
 const [category,setCategory]=useState('acesso')
 const [subject,setSubject]=useState('')
 const [description,setDescription]=useState('')
 const [tickets,setTickets]=useState<SupportTicket[]>([])
 const [selectedId,setSelectedId]=useState<string|null>(null)
 const [loading,setLoading]=useState(true)
 const [busy,setBusy]=useState(false)
 const [message,setMessage]=useState('')
 const [error,setError]=useState('')
 const loadTickets=useCallback(async()=>{
  if(!db){setLoading(false);return}
  try{
   const {data,error:readError}=await db.from('support_tickets').select(supportTicketFields)
    .eq('user_id',user.id).order('created_at',{ascending:false}).limit(50)
   if(readError)throw Error(supportError(readError.message))
   const next=(data||[]) as SupportTicket[]
   setTickets(next)
   setSelectedId(old=>next.some(item=>item.id===old)?old:next[0]?.id||null)
   setError('')
  }catch(err){setError(err instanceof Error?err.message:'Não foi possível carregar seus chamados.')}
  finally{setLoading(false)}
 },[user.id])
 useEffect(()=>{void loadTickets()},[loadTickets])
 const submit=async(e:FormEvent<HTMLFormElement>)=>{
  e.preventDefault()
  if(!db||busy)return
  if(subject.trim().length<5||description.trim().length<20){setError('Informe um assunto com pelo menos 5 caracteres e uma descrição com pelo menos 20.');return}
  setBusy(true);setError('');setMessage('')
  try{
   const {data:{user:current},error:authError}=await db.auth.getUser()
   if(authError||!current||current.id!==user.id)throw Error('Sessão expirada. Faça login novamente.')
   const {data,error:insertError}=await db.from('support_tickets')
    .insert({user_id:current.id,category,subject:subject.trim(),description:description.trim()})
    .select(supportTicketFields).single()
   if(insertError||!data)throw Error(supportError(insertError?.message||'Não foi possível registrar o chamado.'))
   const next=data as SupportTicket
   setTickets(old=>[next,...old])
   setSelectedId(next.id)
   setSubject('');setDescription('');setCategory('acesso')
   setMessage('Chamado '+supportTicketCode(next)+' registrado. Você já pode adicionar mensagens.')
  }catch(err){setError(err instanceof Error?err.message:'Não foi possível registrar o chamado.')}
  finally{setBusy(false)}
 }
 const selected=tickets.find(ticket=>ticket.id===selectedId)
 return <div className="stack payrep-help-page">
  <div className="page-intro"><div><h2>Chamados de suporte</h2><p>Abra uma solicitação e converse com o suporte até a finalização.</p></div>
   <button type="button" className="secondary" onClick={onBack}><ArrowLeft size={16}/> Voltar à Ajuda</button></div>
  <section className="panel">
   <div className="panel-heading"><h2><LifeBuoy size={18}/> Abrir novo chamado</h2></div>
   <p className="subtle">Descreva a dificuldade sem enviar senha, código de autenticação ou holerite completo. Os chamados ficam vinculados à sua conta.</p>
   <form className="help-ticket-form" onSubmit={e=>void submit(e)}>
    <label>Categoria<PayrepSelect value={category} onChange={setCategory} title="Categoria do chamado">
     {supportCategories.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}
    </PayrepSelect></label>
    <label>Assunto<input type="text" value={subject} onChange={e=>setSubject(e.target.value)} maxLength={120} minLength={5} required placeholder="Resumo da sua solicitação"/></label>
    <label>Descrição<textarea value={description} onChange={e=>setDescription(e.target.value)} maxLength={4000} minLength={20} required rows={5} placeholder="Explique o que aconteceu, em qual tela e quais etapas reproduzem o problema."/></label>
    {message&&<div className="notice success" role="status"><CheckCircle2 size={17}/>{message}</div>}
    {error&&<div className="notice danger" role="alert"><Info size={17}/>{error}</div>}
    <button type="submit" className="primary" disabled={!db||busy}><Send size={17}/>{busy?'Registrando...':'Registrar chamado'}</button>
   </form>
  </section>
  <section className="panel">
   <div className="panel-heading"><h2><Ticket size={18}/> Meus chamados</h2>
    <button type="button" className="secondary" disabled={loading} onClick={()=>void loadTickets()}><RefreshCw size={15}/> Atualizar</button></div>
   {loading?<p className="subtle">Consultando chamados...</p>:tickets.length===0?<p className="subtle">Nenhum chamado cadastrado.</p>:
    <div className="help-ticket-list">{tickets.map(ticket=><button type="button"
     className={'help-ticket-item help-ticket-button'+(selectedId===ticket.id?' is-selected':'')}
     key={ticket.id} onClick={()=>setSelectedId(ticket.id)} aria-pressed={selectedId===ticket.id}>
     <span><strong>{ticket.subject}</strong><small>#{supportTicketCode(ticket)} · {supportCategoryLabel(ticket.category)} · {supportDate(ticket.created_at)}</small></span>
     <span className="help-ticket-status">{supportStatuses[ticket.status]}</span>
    </button>)}</div>}
  </section>
  {selected&&<section className="panel"><TicketConversation key={selected.id} ticket={selected}/></section>}
 </div>
}

export function SupportPage({user}:{user:User}){
 const [inTickets,setInTickets]=useState(false)
 if(inTickets)return <TicketWorkspace user={user} onBack={()=>setInTickets(false)}/>
 return <div className="stack payrep-help-page">
  <div className="page-intro"><div><h2>Central de Ajuda</h2><p>Consulte as orientações e entre em contato com o suporte quando precisar.</p></div></div>
  <section className="panel">
   <div className="panel-heading"><h2><BookOpen size={18}/> Perguntas frequentes (FAQ)</h2></div>
   <div className="help-faq-list">{helpFaq.map(item=><details className="help-faq-item" key={item.question}>
    <summary>{item.question}</summary><p>{item.answer}</p>
   </details>)}</div>
  </section>
  <section className="panel">
   <div className="panel-heading"><h2><LifeBuoy size={18}/> Abrir chamado</h2></div>
   <p>Precisa de atendimento individual? Abra um chamado para relatar um problema, acompanhar o andamento e trocar mensagens com o suporte. Todo o histórico permanece disponível até a finalização.</p>
   <button type="button" className="primary" onClick={()=>setInTickets(true)}><Ticket size={17}/> Acessar meus chamados</button>
  </section>
  <section className="panel">
   <div className="panel-heading"><h2><Mail size={18}/> Contato</h2></div>
   <p>Para dúvidas gerais ou quando os chamados estiverem indisponíveis, escreva para o atendimento do Payrep.</p>
   <a className="secondary help-contact-link" href={'mailto:'+SUPPORT_EMAIL}><Mail size={16}/>{SUPPORT_EMAIL}<ExternalLink size={14}/></a>
   <p className="subtle">Mensagens enviadas por e-mail não aparecem automaticamente em Meus chamados.</p>
  </section>
 </div>
}
