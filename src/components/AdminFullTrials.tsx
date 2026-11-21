import {useCallback,useEffect,useMemo,useState} from 'react'
import {Gift,RefreshCw,ShieldCheck,Trash2} from 'lucide-react'
import {PayrepSelect} from './PayrepSelect'
import {daysRemaining,grantManualAccess,grantStateText,loadAdminAccessUsers,loadAdminManualGrants,planName,revokePromotionalAccess,type AccessGrant,type AdminAccessUser} from '../lib/adminEntitlements'

const fmt=(value:string)=>new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(new Date(value))
export function AdminFullTrials(){
 const [users,setUsers]=useState<AdminAccessUser[]>([])
 const [records,setRecords]=useState<AccessGrant[]>([])
 const [target,setTarget]=useState('')
 const [plan,setPlan]=useState<'basic'|'full'>('full')
 const [days,setDays]=useState('14')
 const [loading,setLoading]=useState(true)
 const [busy,setBusy]=useState(false)
 const [pendingRevoke,setPendingRevoke]=useState<string|null>(null)
 const [error,setError]=useState('')
 const [message,setMessage]=useState('')
 const reload=useCallback(async()=>{
  const [people,history]=await Promise.all([loadAdminAccessUsers(),loadAdminManualGrants()])
  setUsers(people);setRecords(history)
 },[])
 useEffect(()=>{let mounted=true
  void reload().catch(e=>{if(mounted)setError(String(e))}).finally(()=>{if(mounted)setLoading(false)})
  return ()=>{mounted=false}
 },[reload])
 const eligible=useMemo(()=>users.filter(u=>u.active&&u.status==='approved'&&u.role!=='admin'),[users])
 const grant=async()=>{
  if(!target||busy)return
  setBusy(true);setError('');setMessage('')
  try{
   await grantManualAccess(target,plan,Number(days))
   await reload();setTarget('')
   setMessage('Acesso promocional '+planName(plan)+' concedido sem pagamento ou renovação automática.')
  }catch(e){setError(e instanceof Error?e.message:'Falha ao conceder acesso.')}
  finally{setBusy(false)}
 }
 const revoke=async(row:AccessGrant)=>{
  if(busy)return
  setBusy(true);setError('');setMessage('')
  try{
   await revokePromotionalAccess(row.id,row.type)
   await reload();setPendingRevoke(null)
   setMessage('Acesso promocional revogado. A assinatura do Asaas não foi alterada.')
  }catch(e){setError(e instanceof Error?e.message:'Falha ao revogar acesso.')}
  finally{setBusy(false)}
 }
 return <section className="panel">
  <div className="panel-heading"><h2><Gift size={18}/> Acesso promocional</h2>
   <button className="secondary" type="button" disabled={busy||loading} onClick={()=>void reload().catch(e=>setError(String(e)))}><RefreshCw size={15}/> Atualizar</button>
  </div>
  <p className="subtle">Conceda acesso temporário Basic ou Full a um usuário aprovado, sem cartão, checkout ou cobrança no Asaas. As concessões ficam registradas no histórico e expiram automaticamente.</p>
  <div className="admin-promo-grant-controls">
   <div><span className="admin-control-label">Usuário</span>
    <PayrepSelect searchable value={target} onChange={setTarget} title="Selecionar usuário por nome ou e-mail" disabled={busy||loading}>
     <option value="">Selecione um usuário</option>
     {eligible.map(user=><option key={user.userId} value={user.userId}>{user.displayName} ({user.email})</option>)}
    </PayrepSelect>
   </div>
   <div><span className="admin-control-label">Plano</span><PayrepSelect value={plan} onChange={x=>setPlan(x as 'basic'|'full')} title="Plano promocional" disabled={busy||loading}>
    <option value="basic">Basic</option><option value="full">Full</option>
   </PayrepSelect></div>
   <div><span className="admin-control-label">Duração</span><PayrepSelect value={days} onChange={setDays} title="Dias de acesso" disabled={busy||loading}>
    <option value="7">7 dias</option><option value="14">14 dias</option><option value="30">30 dias</option>
    <option value="60">60 dias</option><option value="90">90 dias</option>
   </PayrepSelect></div>
   <button type="button" className="primary" disabled={!target||busy||loading} onClick={()=>void grant()}>
    <Gift size={16}/>{busy?'Processando...':'Conceder acesso'}
   </button>
  </div>
  {message&&<p role="status" className="auth-success">{message}</p>}
  {error&&<p role="alert" className="error">{error}</p>}
  <div className="table-scroll"><table><thead><tr>
   <th>Usuário</th><th>Plano</th><th>Início</th><th>Fim</th><th>Dias restantes</th><th>Status</th><th>Ação</th>
  </tr></thead><tbody>
   {records.length===0&&<tr><td colSpan={7}>Nenhum acesso promocional concedido manualmente.</td></tr>}
   {records.map(row=><tr key={row.type+':'+row.id}>
    <td><strong>{row.displayName}</strong><br/><small>{row.email}</small></td>
    <td>{planName(row.plan)}</td><td>{fmt(row.startsAt)}</td><td>{fmt(row.endsAt)}</td>
    <td>{daysRemaining(row.endsAt,row.state)}</td><td>{grantStateText(row.state)}</td>
    <td>{row.state!=='active'?'—':pendingRevoke===row.id
     ?<span className="row"><button type="button" className="secondary" onClick={()=>setPendingRevoke(null)} disabled={busy}>Cancelar</button>
       <button type="button" className="secondary" onClick={()=>void revoke(row)} disabled={busy}>Confirmar revogação</button></span>
     :<button type="button" className="secondary" title="Revogar acesso" aria-label={'Revogar acesso de '+row.displayName}
       onClick={()=>setPendingRevoke(row.id)} disabled={busy}><Trash2 size={16}/></button>}
    </td>
   </tr>)}
  </tbody></table></div>
  <p className="subtle"><ShieldCheck size={14}/> Resgates de códigos promocionais aparecem em Códigos promocionais. Alterações permanentes de plano são gerenciadas separadamente e não modificam a cobrança.</p>
 </section>
}
