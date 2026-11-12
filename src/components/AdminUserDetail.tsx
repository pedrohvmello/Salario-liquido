import {X,UserRound,CreditCard,MapPin,ShieldCheck} from 'lucide-react'
import type {AdminUserDetail} from '../lib/admin'
import {planLabels} from '../lib/adminMetrics'
const date=(value:string|null)=>value?new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(new Date(value)):'Não informado'
const fullDate=(value:string|null)=>value?new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(new Date(value)):'Não informado'
const orBlank=(s:string|null|undefined)=>s?.trim()||'Não informado'
const amount=(cents:number,currency:string)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:currency||'BRL'}).format(cents/100)
function Detail({title,value}:{title:string;value:string|number}){return <div className="admin-detail-field"><span>{title}</span><strong>{value}</strong></div>}
export function AdminUserDetailDialog({user,totalAccesses,loading,error,onClose}:{user:AdminUserDetail|null;totalAccesses:number|null;loading:boolean;error:string;onClose:()=>void}){
 const p=user?.profile,s=user?.subscription
 return <div className="admin-detail-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
  <section className="admin-detail-dialog" role="dialog" aria-modal="true" aria-label="Detalhes do usuário">
   <header className="admin-detail-header"><div><h2>Detalhes do usuário</h2><p>Cadastro, acesso, assinatura e pagamentos</p></div><button className="profile-icon-button" type="button" onClick={onClose} aria-label="Fechar"><X size={22}/></button></header>
   <div className="admin-detail-body">
    {loading&&<p>Carregando detalhes...</p>}
    {error&&<p className="error">{error}</p>}
    {user&&<>
     <section className="admin-detail-section"><h3><UserRound size={17}/> Conta e identificação</h3><div className="admin-detail-grid">
      <Detail title="Nome" value={orBlank(p?.display_name)}/><Detail title="E-mail" value={orBlank(user.email)}/>
      <Detail title="Telefone" value={orBlank(p?.phone)}/><Detail title="Perfil" value={user.role==='admin'?'Administrador':'Usuário'}/>
      <Detail title="Status do acesso" value={user.status}/><Detail title="E-mail confirmado" value={user.emailConfirmed?'Sim':'Não'}/>
      <Detail title="Cadastro" value={date(user.createdAt)}/><Detail title="Último login" value={date(user.lastSignInAt)}/>
      <Detail title="Identificador da conta" value={user.id}/>
     </div></section>
     <section className="admin-detail-section"><h3><MapPin size={17}/> Endereço</h3><div className="admin-detail-grid">
      <Detail title="CEP" value={orBlank(p?.postal_code)}/>
      <Detail title="Logradouro" value={orBlank(p?.street)}/>
      <Detail title="Número" value={orBlank(p?.street_number)}/>
      <Detail title="Complemento" value={orBlank(p?.complement)}/>
      <Detail title="Bairro" value={orBlank(p?.neighborhood)}/>
      <Detail title="Cidade" value={orBlank(p?.city)}/>
      <Detail title="Estado / UF" value={orBlank(p?.state)}/>
      <Detail title="País" value={orBlank(p?.country)}/>
     </div></section>
     <section className="admin-detail-section"><h3><CreditCard size={17}/> Assinatura</h3><div className="admin-detail-grid">
      <Detail title="Plano" value={planLabels[s?.plan||'free']}/>
      <Detail title="Status da assinatura" value={s?.status||'active'}/>
      <Detail title="Provedor de pagamentos" value={orBlank(s?.provider)}/>
      <Detail title="Identificador da assinatura" value={orBlank(s?.providerSubscriptionId)}/>
      <Detail title="Identificador do cliente no provedor" value={orBlank(s?.providerCustomerId)}/>
      <Detail title="Início da vigência" value={date(s?.periodStart||null)}/>
      <Detail title="Fim da vigência" value={date(s?.periodEnd||null)}/>
      <Detail title="Cancelamento agendado" value={s?.cancelAtPeriodEnd?'Sim':'Não'}/>
     </div>
     {s?.plan==='free'&&<p className="subtle">Plano gratuito. Nenhuma cobrança é ativada por este painel.</p>}
     </section>
     <section className="admin-detail-section"><h3><ShieldCheck size={17}/> Uso e pagamentos</h3>
      <div className="admin-detail-grid">
       <Detail title="Holerites registrados" value={user.payslipCount}/>
       <Detail title="Eventos cadastrados" value={user.eventCount}/>
       <Detail title="Pagamentos registrados" value={user.payments.length}/>
       <Detail title="Total de acessos" value={totalAccesses===null?'Não disponível':totalAccesses}/>
      </div>
      <p className="subtle">Sessões únicas registradas desde a ativação do controle de acessos. Não inclui histórico anterior nem visualizações de páginas.</p>
      {user.payments.length?<div className="table-scroll"><table><thead><tr><th>Data</th><th>Descrição</th><th>Valor</th><th>Status</th><th>Provedor</th></tr></thead><tbody>
       {user.payments.map(payment=><tr key={payment.id}><td>{fullDate(payment.paidAt||payment.createdAt)}</td><td>{payment.description||'Cobrança'}</td><td>{amount(payment.amountCents,payment.currency)}</td><td>{payment.status}</td><td>{payment.provider}</td></tr>)}
      </tbody></table></div>:<p className="subtle">Nenhum pagamento registrado.</p>}
     </section>
    </>}
   </div>
  </section>
 </div>
}
