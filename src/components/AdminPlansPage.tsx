import {useEffect,useState} from 'react'
import {ArrowLeft,CreditCard,Gift,RefreshCw,UsersRound,Ticket} from 'lucide-react'
import {AdminBillingPlans} from './AdminBillingPlans'
import {AdminFullTrials} from './AdminFullTrials'
import {AdminPromoCodes} from './AdminPromoCodes'
import {fetchAdminDashboard,type AdminDashboardData} from '../lib/admin'
import {asaasMode} from '../lib/environment'

type PlansSection='prices'|'trials'|'promos'|'subscribers'|null

export function AdminPlansPage(){
 const [active,setActive]=useState<PlansSection>(null)
 const [dashboard,setDashboard]=useState<AdminDashboardData|null>(null)
 const [loading,setLoading]=useState(false)
 const [error,setError]=useState('')
 const reload=async()=>{
  setLoading(true);setError('')
  try{setDashboard(await fetchAdminDashboard())}
  catch(e){setError(e instanceof Error?e.message:'Não foi possível carregar assinantes.')}
  finally{setLoading(false)}
 }
 useEffect(()=>{
  if(active==='subscribers')void reload()
 },[active])
 const users=dashboard?.users||[]
 const paid=users.filter(user=>user.plan!=='free')

 return <div className="stack">
  {active===null?<div className="page-intro"><div>
   <h2>Planos e Assinaturas</h2>
   <p>Preços, assinantes e testes gratuitos. Controles administrativos do ambiente {asaasMode==='sandbox'?'de homologação':'de produção'}.</p>
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
    <div className="panel-heading"><h2><Gift size={18}/> Testes gratuitos do Full</h2></div>
    <p>Conceda, acompanhe e encerre períodos de teste gratuitos para usuários elegíveis.</p>
    <button type="button" className="primary" onClick={()=>setActive('trials')}>
     <Gift size={17}/> Gerenciar testes gratuitos
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
    <div className="panel-heading"><h2><UsersRound size={18}/> Assinantes cadastrados</h2></div>
    <p>Consulte usuários com planos pagos e acompanhe a situação das contas cadastradas.</p>
    <button type="button" className="primary" onClick={()=>setActive('subscribers')}>
     <UsersRound size={17}/> Consultar assinantes
    </button>
   </section>
  </>}
  {active==='prices'&&<AdminBillingPlans/>}
  {active==='trials'&&<AdminFullTrials/>}
  {active==='promos'&&<AdminPromoCodes/>}
  {active==='subscribers'&&<section className="panel">
   <div className="panel-heading"><h2><UsersRound size={18}/> Assinantes cadastrados</h2>
    <button type="button" className="secondary" disabled={loading} onClick={()=>void reload()}>
     <RefreshCw size={15}/> Atualizar
    </button>
   </div>
   <p className="subtle">Planos pagos cadastrados no Payrep. O estado financeiro detalhado permanece na tela Assinatura do usuário e nos registros conciliados.</p>
   {loading?<p>Carregando assinantes...</p>:<div className="admin-finance-kpis">
    <div className="stat"><span>Cadastros</span><strong>{users.length}</strong></div>
    <div className="stat"><span>Basic</span><strong>{paid.filter(u=>u.plan==='basic').length}</strong></div>
    <div className="stat"><span>Full pago</span><strong>{paid.filter(u=>u.plan==='full').length}</strong></div>
   </div>}
   {error&&<p className="error" role="alert">{error}</p>}
   <div className="table-scroll"><table>
    <thead><tr><th>Usuário</th><th>Plano pago</th><th>Situação da conta</th></tr></thead>
    <tbody>{paid.length===0?<tr><td colSpan={3}>Nenhum plano pago registrado.</td></tr>:
     paid.map(user=><tr key={user.id}>
      <td>{user.displayName||user.email||'Usuário'}</td>
      <td><CreditCard size={13}/> {user.plan==='basic'?'Basic':'Full'}</td>
      <td>{user.status==='approved'?'Aprovado':user.status}</td>
     </tr>)}</tbody>
   </table></div>
   <p className="subtle">Testes Full gratuitos aparecem na seção específica, não entram na receita e não alteram o plano cobrado pelo Asaas.</p>
  </section>}
 </div>
}
