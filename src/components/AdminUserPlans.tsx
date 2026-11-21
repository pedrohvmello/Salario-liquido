import {useCallback,useEffect,useMemo,useState} from 'react'
import {RefreshCw,ShieldCheck,UsersRound} from 'lucide-react'
import {PayrepSelect} from './PayrepSelect'
import {changeAdminPlan,loadAdminAccessUsers,planName,type AdminAccessUser,type Plan} from '../lib/adminEntitlements'

type PlanFilter='all'|'free'|'basic'|'full'
export function AdminUserPlans(){
 const [users,setUsers]=useState<AdminAccessUser[]>([])
 const [selected,setSelected]=useState('')
 const [plan,setPlan]=useState('automatic')
 const [filter,setFilter]=useState<PlanFilter>('all')
 const [search,setSearch]=useState('')
 const [busy,setBusy]=useState(false)
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')
 const [message,setMessage]=useState('')
 const reload=useCallback(async()=>setUsers(await loadAdminAccessUsers()),[])
 useEffect(()=>{let active=true;void reload().catch(e=>{if(active)setError(String(e))}).finally(()=>{if(active)setLoading(false)});return ()=>{active=false}},[reload])
 const eligible=useMemo(()=>users.filter(u=>u.active&&u.status==='approved'&&u.role!=='admin'),[users])
 const selectedUser=eligible.find(u=>u.userId===selected)
 const counts=useMemo(()=>({
  all:users.length,free:eligible.filter(u=>u.effectivePlan==='free').length,
  basic:eligible.filter(u=>u.effectivePlan==='basic').length,
  full:eligible.filter(u=>u.effectivePlan==='full').length
 }),[eligible])
 const listed=useMemo(()=>{
  const query=search.trim().toLocaleLowerCase('pt-BR')
  return users.filter(u=>(filter==='all'||(u.active&&u.status==='approved'&&u.role!=='admin'&&u.effectivePlan===filter))
   &&(!query||[u.displayName,u.email,u.userId].some(s=>s?.toLocaleLowerCase('pt-BR').includes(query))))
 },[users,filter,search])
 const selectUser=(id:string)=>{
  setSelected(id);const u=eligible.find(x=>x.userId===id)
  setPlan(u?.overridePlan||'automatic');setError('');setMessage('')
 }
 const save=async()=>{
  if(!selected||busy)return
  setBusy(true);setError('');setMessage('')
  try{
   await changeAdminPlan(selected,plan==='automatic'?null:plan as Plan)
   await reload()
   setMessage('Acesso atualizado. A assinatura, pagamentos e renovações no Asaas não foram modificados.')
  }catch(e){setError(e instanceof Error?e.message:'Falha ao alterar o acesso.')}
  finally{setBusy(false)}
 }
 return <section className="panel">
  <div className="panel-heading"><h2><UsersRound size={18}/> Planos por usuário</h2>
   <button className="secondary" type="button" onClick={()=>void reload().catch(e=>setError(String(e)))} disabled={loading||busy}><RefreshCw size={16}/> Atualizar</button>
  </div>
  <section className="admin-user-edit-section" aria-labelledby="admin-user-edit-title">
   <h3 id="admin-user-edit-title">Alterar acesso de um usuário</h3>
   <p className="subtle">Escolha uma conta e defina seu acesso efetivo, independentemente do plano contratado. Para voltar às regras normais de assinatura e promoções, selecione Automático.</p>
   <div className="admin-promo-grant-controls admin-user-plan-controls">
    <div><span className="admin-control-label">Usuário</span><PayrepSelect searchable value={selected} onChange={selectUser} title="Buscar usuário por nome ou e-mail" disabled={loading||busy}>
     <option value="">Selecione um usuário</option>
     {eligible.map(u=><option key={u.userId} value={u.userId}>{u.displayName} ({u.email})</option>)}
    </PayrepSelect></div>
    <div><span className="admin-control-label">Plano de acesso</span><PayrepSelect value={plan} onChange={setPlan} title="Alterar plano efetivo" disabled={!selected||busy}>
     <option value="automatic">Automático (assinatura e promoções)</option>
     <option value="free">Free</option><option value="basic">Basic</option><option value="full">Full</option>
    </PayrepSelect></div>
    <button className="primary" type="button" disabled={!selected||busy} onClick={()=>void save()}>Salvar plano</button>
   </div>
   {selectedUser&&<p className="subtle" role="status">Plano contratado: <strong>{planName(selectedUser.paidPlan)}</strong>. Acesso efetivo: <strong>{planName(selectedUser.effectivePlan)}</strong>. Alteração manual: <strong>{selectedUser.overridePlan?planName(selectedUser.overridePlan):'Não'}</strong>.</p>}
   {message&&<p className="auth-success" role="status">{message}</p>}
   {error&&<p className="error" role="alert">{error}</p>}
  </section>
  <section className="admin-user-list-section" aria-labelledby="admin-user-list-title">
   <h3 id="admin-user-list-title">Usuários e assinaturas cadastradas</h3>
   <p className="subtle">Clique nos indicadores para filtrar por acesso efetivo. Administradores não entram na contagem dos planos comerciais.</p>
   <div className="admin-user-plan-cards" role="group" aria-label="Filtrar por plano efetivo">
    {([{key:'all',label:'Usuários'}, {key:'free',label:'Free'},{key:'basic',label:'Basic'}, {key:'full',label:'Full'}] as const).map(c=>
     <button key={c.key} type="button" className={'admin-user-plan-card'+(filter===c.key?' is-active':'')}
      aria-pressed={filter===c.key} onClick={()=>setFilter(current=>current===c.key?'all':c.key)}>
      <span>{c.label}</span><strong>{counts[c.key]}</strong>
     </button>)}
   </div>
   <div className="admin-user-list-toolbar">
    <label>Pesquisar usuários<input type="search" value={search} placeholder="Nome ou e-mail" onChange={e=>setSearch(e.target.value)}/></label>
    <span className="subtle">{listed.length} registro(s) na lista</span>
   </div>
   <div className="table-scroll"><table><thead><tr><th>Usuário</th><th>Plano contratado</th><th>Acesso efetivo</th><th>Definição manual</th><th>Promoção ativa</th></tr></thead>
    <tbody>{listed.length===0?<tr><td colSpan={5}>Nenhum usuário encontrado.</td></tr>:listed.map(u=><tr key={u.userId}>
     <td>{u.displayName}<br/><small>{u.email}</small></td>
     <td>{planName(u.paidPlan)}</td><td><strong>{planName(u.effectivePlan)}</strong></td>
     <td>{u.role==='admin'?'Administrador':u.overridePlan?planName(u.overridePlan):'Automática'}</td>
     <td>{u.hasActivePromo?'Código':u.hasActiveManual?'Acesso manual':u.hasActiveLegacyTrial?'Teste legado':'—'}</td>
    </tr>)}</tbody>
   </table></div>
   <p className="subtle"><ShieldCheck size={14}/> O administrador mantém acesso integral por permissões próprias. Alterações manuais de acesso não modificam cobranças nem contratos Asaas.</p>
  </section>
 </section>
}
