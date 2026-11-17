import {useEffect,useState} from 'react'
import {CreditCard,RefreshCw,UsersRound} from 'lucide-react'
import {AdminBillingPlans} from './AdminBillingPlans'
import {AdminFullTrials} from './AdminFullTrials'
import {fetchAdminDashboard,type AdminDashboardData} from '../lib/admin'
export function AdminPlansPage(){
 const [dashboard,setDashboard]=useState<AdminDashboardData|null>(null)
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')
 const reload=async()=>{
  setError('')
  try{setDashboard(await fetchAdminDashboard())}
  catch(e){setError(e instanceof Error?e.message:'Não foi possível carregar assinantes.')}
  finally{setLoading(false)}
 }
 useEffect(()=>{void reload()},[])
 const users=dashboard?.users||[]
 const paid=users.filter(u=>u.plan!=='free')
 return <div className="stack">
  <div className="page-intro"><div><h2>Planos e Assinaturas</h2>
   <p>Preços, assinantes e testes gratuitos. Controles administrativos exclusivos do HML.</p>
  </div></div>
  <AdminBillingPlans/>
  <AdminFullTrials/>
  <section className="panel">
   <div className="panel-heading"><h2><UsersRound size={18}/> Assinantes cadastrados</h2>
    <button type="button" className="secondary" onClick={()=>void reload()}><RefreshCw size={15}/> Atualizar</button>
   </div>
   <p className="subtle">Planos pagos cadastrados no Payrep. O estado financeiro detalhado permanece na tela Assinatura do usuário e nos registros conciliados.</p>
   {loading?<p>Carregando assinantes...</p>:<div className="admin-finance-kpis">
    <div className="stat"><span>Cadastros</span><strong>{users.length}</strong></div>
    <div className="stat"><span>Basic</span><strong>{paid.filter(u=>u.plan==='basic').length}</strong></div>
    <div className="stat"><span>Full pago</span><strong>{paid.filter(u=>u.plan==='full').length}</strong></div>
   </div>}
   {error&&<p className="error" role="alert">{error}</p>}
   <div className="table-scroll"><table><thead><tr><th>Usuário</th><th>Plano pago</th><th>Situação da conta</th></tr></thead><tbody>
    {paid.length===0?<tr><td colSpan={3}>Nenhum plano pago registrado.</td></tr>
    :paid.map(user=><tr key={user.id}><td>{user.displayName||user.email||'Usuário'}</td>
     <td><CreditCard size={13}/> {user.plan==='basic'?'Basic':'Full'}</td>
     <td>{user.status==='approved'?'Aprovado':user.status}</td></tr>)}
   </tbody></table></div>
   <p className="subtle">Testes Full gratuitos aparecem na seção específica, não entram na receita e não alteram o plano cobrado pelo Asaas.</p>
  </section>
 </div>
}
