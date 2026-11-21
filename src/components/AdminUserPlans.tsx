import {useCallback,useEffect,useMemo,useState} from 'react'
import {RefreshCw,ShieldCheck,UsersRound} from 'lucide-react'
import {PayrepSelect} from './PayrepSelect'
import {changeAdminPlan,loadAdminAccessUsers,planName,type AdminAccessUser,type Plan} from '../lib/adminEntitlements'

export function AdminUserPlans(){
 const [users,setUsers]=useState<AdminAccessUser[]>([])
 const [selected,setSelected]=useState('')
 const [plan,setPlan]=useState('automatic')
 const [busy,setBusy]=useState(false)
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')
 const [message,setMessage]=useState('')
 const reload=useCallback(async()=>setUsers(await loadAdminAccessUsers()),[])
 useEffect(()=>{let active=true;void reload().catch(e=>{if(active)setError(String(e))}).finally(()=>{if(active)setLoading(false)});return ()=>{active=false}},[reload])
 const eligible=useMemo(()=>users.filter(u=>u.active&&u.status==='approved'&&u.role!=='admin'),[users])
 const chosen=eligible.find(u=>u.userId===selected)
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
  <p className="subtle">Defina manualmente o plano efetivo de usuários aprovados, ou retorne ao cálculo automático (assinatura e promoções). A alteração não cria, cancela nem reembolsa cobranças no Asaas.</p>
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
  {chosen&&<p className="subtle" role="status">Plano contratado: <strong>{planName(chosen.paidPlan)}</strong>. Acesso efetivo: <strong>{planName(chosen.effectivePlan)}</strong>. Alteração manual: <strong>{chosen.overridePlan?planName(chosen.overridePlan):'Não'}</strong>.</p>}
  {message&&<p className="auth-success" role="status">{message}</p>}
  {error&&<p className="error" role="alert">{error}</p>}
  <div className="table-scroll"><table><thead><tr><th>Usuário</th><th>Plano contratado</th><th>Acesso efetivo</th><th>Definição manual</th><th>Promoção ativa</th></tr></thead>
   <tbody>{users.length===0?<tr><td colSpan={5}>Nenhum usuário encontrado.</td></tr>:users.map(u=><tr key={u.userId}>
    <td>{u.displayName}<br/><small>{u.email}</small></td>
    <td>{planName(u.paidPlan)}</td><td><strong>{planName(u.effectivePlan)}</strong></td>
    <td>{u.role==='admin'?'Administrador':u.overridePlan?planName(u.overridePlan):'Automática'}</td>
    <td>{u.hasActivePromo?'Código':u.hasActiveManual?'Acesso manual':u.hasActiveLegacyTrial?'Teste legado':'—'}</td>
   </tr>)}</tbody>
  </table></div>
  <p className="subtle"><ShieldCheck size={14}/> O administrador continua com acesso integral por permissões de função. Ajustes de cobrança devem ser feitos pelo fluxo de assinatura correspondente.</p>
 </section>
}
