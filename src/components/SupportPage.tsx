import {useEffect,useState,type FormEvent} from 'react'
import type {User} from '@supabase/supabase-js'
import {BookOpen,CheckCircle2,ExternalLink,LifeBuoy,Mail,Send,Ticket,Info} from 'lucide-react'
import {PayrepSelect} from './PayrepSelect'
import {db} from '../lib/data'

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

export type SupportTicket={
 id:string
 user_id:string
 category:string
 subject:string
 description:string
 status:'open'|'in_progress'|'resolved'
 created_at:string
 updated_at:string
}
export const supportStatuses:Record<SupportTicket['status'],string>={
 open:'Aberto',in_progress:'Em atendimento',resolved:'Resolvido'
}
const supportCategories=[
 {value:'acesso',label:'Acesso e segurança'},
 {value:'holerites',label:'Holerites e importação'},
 {value:'calculos',label:'Cálculos e projeções'},
 {value:'conta',label:'Cadastro e conta'},
 {value:'outro',label:'Outro assunto'}
]
const formatDate=(value:string)=>new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'}).format(new Date(value))
const friendlyError=(message:string)=>/support_tickets|schema cache|relation .* does not exist/i.test(message)?'Abertura de chamados indisponível neste ambiente. Use o contato por e-mail.':message

export function SupportPage({user}:{user:User}){
 const [category,setCategory]=useState('acesso')
 const [subject,setSubject]=useState('')
 const [description,setDescription]=useState('')
 const [tickets,setTickets]=useState<SupportTicket[]>([])
 const [loading,setLoading]=useState(true)
 const [busy,setBusy]=useState(false)
 const [message,setMessage]=useState('')
 const [error,setError]=useState('')
 useEffect(()=>{
  let active=true
  if(!db){setLoading(false);return}
  void db.from('support_tickets').select('id,user_id,category,subject,description,status,created_at,updated_at')
   .eq('user_id',user.id).order('created_at',{ascending:false}).limit(30)
   .then(({data,error})=>{
    if(!active)return
    if(error)setError(friendlyError(error.message))
    else setTickets((data||[]) as SupportTicket[])
    setLoading(false)
   })
  return ()=>{active=false}
 },[user.id])
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
    .select('id,user_id,category,subject,description,status,created_at,updated_at').single()
   if(insertError||!data)throw Error(friendlyError(insertError?.message||'Não foi possível registrar o chamado.'))
   setTickets(old=>[data as SupportTicket,...old])
   setSubject('');setDescription('');setCategory('acesso')
   setMessage('Chamado registrado: '+String(data.id)+'. Acompanhe o status nesta página.')
  }catch(err){setError(err instanceof Error?err.message:'Não foi possível registrar o chamado.')}
  finally{setBusy(false)}
 }
 return <div className="stack payrep-help-page">
  <div className="page-intro"><div><h2>Central de Ajuda</h2><p>Encontre orientações, registre uma solicitação e acompanhe os chamados associados à sua conta.</p></div></div>
  <section className="panel">
   <div className="panel-heading"><h2><BookOpen size={18}/> Perguntas frequentes (FAQ)</h2></div>
   <div className="help-faq-list">{helpFaq.map(item=><details className="help-faq-item" key={item.question}>
    <summary>{item.question}</summary><p>{item.answer}</p>
   </details>)}</div>
  </section>
  <section className="panel">
   <div className="panel-heading"><h2><LifeBuoy size={18}/> Abrir chamado</h2></div>
   <p className="subtle">Descreva a dificuldade sem enviar senha, código de autenticação ou holerite completo. Os chamados ficam vinculados à sua conta.</p>
   <form className="help-ticket-form" onSubmit={e=>void submit(e)}>
    <label>Categoria<PayrepSelect value={category} onChange={setCategory} title="Categoria do chamado">
     {supportCategories.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}
    </PayrepSelect></label>
    <label>Assunto<input type="text" value={subject} onChange={e=>setSubject(e.target.value)} maxLength={120} minLength={5} required placeholder="Resumo da sua solicitação"/></label>
    <label>Descrição<textarea value={description} onChange={e=>setDescription(e.target.value)} maxLength={4000} minLength={20} required rows={6} placeholder="Explique o que aconteceu, em qual tela e quais etapas reproduzem o problema."/></label>
    {message&&<div className="notice success" role="status"><CheckCircle2 size={17}/>{message}</div>}
    {error&&<div className="notice danger" role="alert"><Info size={17}/>{error}</div>}
    <button type="submit" className="primary" disabled={!db||busy}><Send size={17}/>{busy?'Registrando...':'Registrar chamado'}</button>
   </form>
  </section>
  <section className="panel">
   <div className="panel-heading"><h2><Ticket size={18}/> Meus chamados</h2></div>
   {loading?<p className="subtle">Consultando chamados...</p>:tickets.length===0?<p className="subtle">Nenhum chamado cadastrado.</p>:
    <div className="help-ticket-list">{tickets.map(ticket=><article className="help-ticket-item" key={ticket.id}>
     <div><strong>{ticket.subject}</strong><small>{formatDate(ticket.created_at)} · Protocolo {ticket.id}</small></div>
     <span className="help-ticket-status">{supportStatuses[ticket.status]}</span>
    </article>)}</div>}
  </section>
  <section className="panel">
   <div className="panel-heading"><h2><Mail size={18}/> Contato</h2></div>
   <p>Para dúvidas gerais ou quando o formulário estiver indisponível, escreva para o atendimento do Payrep.</p>
   <a className="secondary help-contact-link" href={`mailto:${SUPPORT_EMAIL}`}><Mail size={16}/>{SUPPORT_EMAIL}<ExternalLink size={14}/></a>
   <p className="subtle">O envio por e-mail exige confirmação no seu aplicativo de correio. Mensagens enviadas por esse canal não aparecem automaticamente em Meus chamados.</p>
  </section>
 </div>
}
