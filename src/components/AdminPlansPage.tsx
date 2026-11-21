import {useState} from 'react'
import {ArrowLeft,CreditCard,Gift,UsersRound,Ticket} from 'lucide-react'
import {AdminBillingPlans} from './AdminBillingPlans'
import {AdminFullTrials} from './AdminFullTrials'
import {AdminUserPlans} from './AdminUserPlans'
import {AdminPromoCodes} from './AdminPromoCodes'
import {asaasMode} from '../lib/environment'

type PlansSection='prices'|'trials'|'promos'|'users'|null

export function AdminPlansPage(){
 const [active,setActive]=useState<PlansSection>(null)
 return <div className="stack">
  {active===null?<div className="page-intro"><div>
   <h2>Planos e Assinaturas</h2>
   <p>Preços, assinantes e acessos promocionais. Controles administrativos do ambiente {asaasMode==='sandbox'?'de homologação':'de produção'}.</p>
  </div></div>:<div>
   <button type="button" className="secondary" onClick={()=>setActive(null)}>
    <ArrowLeft size={16}/> Voltar para Planos e Assinaturas
   </button>
  </div>}

  {active===null&&<>
   <section className="panel">
    <div className="panel-heading"><h2><CreditCard size={18}/> Planos e assinaturas</h2></div>
    <p>Configure os preços mensais e a disponibilidade dos planos Basic e Full para contratação.</p>
    <button type="button" className="primary" onClick={()=>setActive('prices')}>
     <CreditCard size={17}/> Configurar planos e assinaturas
    </button>
   </section>
   <section className="panel">
    <div className="panel-heading"><h2><Gift size={18}/> Acesso promocional</h2></div>
    <p>Conceda, acompanhe e revogue acessos temporários Basic e Full.</p>
    <button type="button" className="primary" onClick={()=>setActive('trials')}>
     <Gift size={17}/> Gerenciar acesso promocional
    </button>
   </section>
   <section className="panel">
    <div className="panel-heading"><h2><Ticket size={18}/> Códigos promocionais</h2></div>
    <p>Crie e gerencie códigos para acesso temporário aos planos Basic e Full.</p>
    <button type="button" className="primary" onClick={()=>setActive('promos')}>
     <Ticket size={17}/> Gerenciar códigos promocionais
    </button>
   </section>
   <section className="panel">
    <div className="panel-heading"><h2><UsersRound size={18}/> Planos por usuário</h2></div>
    <p>Consulte o plano contratado, o acesso efetivo e defina manualmente o nível Free, Basic ou Full de usuários aprovados, sem alterar cobranças no Asaas.</p>
    <button type="button" className="primary" onClick={()=>setActive('users')}><UsersRound size={17}/> Gerenciar planos dos usuários</button>
   </section>
  </>}
  {active==='prices'&&<AdminBillingPlans/>}
  {active==='users'&&<AdminUserPlans/>}
  {active==='trials'&&<AdminFullTrials/>}
  {active==='promos'&&<AdminPromoCodes/>}
 </div>
}
