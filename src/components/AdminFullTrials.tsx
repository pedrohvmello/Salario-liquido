import {useCallback,useEffect,useMemo,useState} from 'react'
import {Gift,RefreshCw,ShieldCheck} from 'lucide-react'
import {PayrepSelect} from './PayrepSelect'
import {fetchAdminDashboard,type AdminUser} from '../lib/admin'
import {db} from '../lib/data'
type Trial={userId:string;displayName:string;startsAt:string;endsAt:string;revokedAt:string|null;state:'active'|'expired'|'revoked'}
const fmt=(value:string)=>new Intl.DateTimeFormat('pt-BR',{
 dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'
}).format(new Date(value))
export function AdminFullTrials(){
 const [users,setUsers]=useState<AdminUser[]>([])
 const [trials,setTrials]=useState<Trial[]>([])
 const [target,setTarget]=useState('')
 const [days,setDays]=useState('14')
 const [loading,setLoading]=useState(true)
 const [busy,setBusy]=useState(false)
 const [pendingRevocation,setPendingRevocation]=useState<string|null>(null)
 const [error,setError]=useState('')
 const [message,setMessage]=useState('')
 const reload=useCallback(async()=>{
  if(!db)throw Error('Banco não configurado.')
  const [dashboard,records]=await Promise.all([
   fetchAdminDashboard(),db.rpc('list_hml_full_trials')
  ])
  if(records.error)throw records.error
  setUsers(dashboard.users)
  setTrials(Array.isArray(records.data)?records.data as Trial[]:[])
 },[])
 useEffect(()=>{let active=true
  void (async()=>{
   try{await reload()}catch(e){if(active)setError(e instanceof Error?e.message:'Erro ao carregar testes Full.')}
   finally{if(active)setLoading(false)}
  })()
  return ()=>{active=false}
 },[reload])
 const eligible=useMemo(()=>users.filter(user=>
  user.active&&user.status==='approved'&&user.plan==='free'&&
  !trials.some(trial=>trial.userId===user.id)),[users,trials])
 const grant=async()=>{
  if(!db||!target||busy)return
  setBusy(true);setError('');setMessage('')
  try{
   const {error}=await db.rpc('grant_hml_full_trial',{p_target:target,p_days:Number(days)})
   if(error)throw error
   await reload();setTarget('')
   setMessage('Teste Full concedido sem cobrança, cartão ou assinatura no Asaas.')
  }catch(e){setError(e instanceof Error?e.message:'Falha ao conceder teste.')}
  finally{setBusy(false)}
 }
 const revoke=async(id:string)=>{
  if(!db||busy)return
  setBusy(true);setError('');setMessage('')
  try{
   const {error}=await db.rpc('revoke_hml_full_trial',{p_target:id})
   if(error)throw error
   await reload();setPendingRevocation(null)
   setMessage('Teste encerrado. Nenhum pagamento foi criado.')
  }catch(e){setError(e instanceof Error?e.message:'Falha ao encerrar teste.')}
  finally{setBusy(false)}
 }
 return <section className="panel">
  <div className="panel-heading"><h2><Gift size={18}/> Testes gratuitos do Full</h2>
   <button className="secondary" type="button" disabled={busy||loading} onClick={()=>void reload().catch(e=>setError(String(e)))}><RefreshCw size={15}/> Atualizar</button>
  </div>
  <p className="subtle">Concessão manual para usuários Free aprovados. Sem cartão, checkout, Asaas ou renovação automática. Um teste por usuário, com expiração automática.</p>
  <div className="admin-trial-controls">
   <div><span className="admin-control-label">Usuário elegível</span>
    <PayrepSelect value={target} onChange={setTarget} title="Selecionar usuário para teste" disabled={busy||loading}>
     <option value="">Selecione um usuário</option>
     {eligible.map(user=><option key={user.id} value={user.id}>{user.displayName||user.email||'Usuário'} ({user.email||'sem e-mail'})</option>)}
    </PayrepSelect>
   </div>
   <div><span className="admin-control-label">Duração</span>
    <PayrepSelect value={days} onChange={setDays} title="Duração do teste" disabled={busy||loading}>
     <option value="7">7 dias</option><option value="14">14 dias</option><option value="30">30 dias</option>
    </PayrepSelect>
   </div>
   <button type="button" className="primary" disabled={!target||busy||loading} onClick={()=>void grant()}>
    <Gift size={16}/>{busy?'Processando...':'Conceder teste Full'}
   </button>
  </div>
  {message&&<p role="status" className="auth-success">{message}</p>}
  {error&&<p role="alert" className="error">{error}</p>}
  <div className="table-scroll"><table><thead><tr>
   <th>Usuário</th><th>Início</th><th>Fim</th><th>Status</th><th>Ação</th>
  </tr></thead><tbody>
   {trials.length===0&&<tr><td colSpan={5}>Nenhum teste Full concedido.</td></tr>}
   {trials.map(t=><tr key={t.userId}>
    <td>{t.displayName}</td><td>{fmt(t.startsAt)}</td><td>{fmt(t.endsAt)}</td>
    <td>{t.state==='active'?'Em teste':t.state==='revoked'?'Encerrado':'Expirado'}</td>
    <td>{t.state!=='active'?'—':pendingRevocation===t.userId
     ?<span className="row">
       <button type="button" className="secondary" onClick={()=>setPendingRevocation(null)} disabled={busy}>Voltar</button>
       <button type="button" className="secondary" onClick={()=>void revoke(t.userId)} disabled={busy}>Confirmar encerramento</button>
      </span>
     :<button type="button" className="secondary" onClick={()=>setPendingRevocation(t.userId)} disabled={busy}>Encerrar teste</button>}
    </td>
   </tr>)}
  </tbody></table></div>
  <p className="subtle"><ShieldCheck size={14}/> O acesso efetivo é calculado pelo servidor e volta a Free ao expirar o período. Permissões por recurso devem respeitar a matriz de benefícios a ser definida.</p>
 </section>
}
