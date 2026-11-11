import {useCallback,useEffect,useMemo,useState} from 'react'
import {RefreshCw,ShieldCheck,UsersRound,UserCheck,Clock3,ShieldAlert,Activity,Info,CreditCard,MapPin} from 'lucide-react'
import {AdminUserDetailDialog} from './AdminUserDetail'
import {AdminAvatar} from './AdminAvatar'
import {localityCounts,planCount,planLabels,type Plan} from '../lib/adminMetrics'
import {fetchAdminDashboard,fetchAdminUserDetail,changeApprovalRequirement,changeUserStatus,type AdminUserDetail,type AdminDashboardData,type AdminUser,type AccessStatus} from '../lib/admin'

const statuses:Record<AccessStatus,string>={
 pending:'Aguardando aprovação',approved:'Aprovado',suspended:'Suspenso',rejected:'Rejeitado'
}
const dateTime=(raw:string|null)=>raw?new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(new Date(raw)):'—'
const smallDate=(raw:string|null)=>raw?new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeZone:'America/Sao_Paulo'}).format(new Date(raw)):'—'
function Kpi({label,value,note,icon:Icon}:{label:string;value:number|string;note:string;icon:typeof UsersRound}){
 return <div className="stat"><div className="admin-kpi-label"><Icon size={15}/><span>{label}</span></div><strong>{value}</strong><small>{note}</small></div>
}

export function AdminDashboard(){
 const [data,setData]=useState<AdminDashboardData|null>(null)
 const [error,setError]=useState('')
 const [message,setMessage]=useState('')
 const [feedbackTarget,setFeedbackTarget]=useState<'policy'|'account'>('policy')
 const [busy,setBusy]=useState(false)
 const [loading,setLoading]=useState(true)
 const [requireApproval,setRequireApproval]=useState(true)
 const [query,setQuery]=useState('')
 const [filter,setFilter]=useState<'all'|AccessStatus>('all')
 const [planFilter,setPlanFilter]=useState<'all'|Plan>('all')
 const [selectedId,setSelectedId]=useState<string|null>(null)
 const [selectedDetails,setSelectedDetails]=useState<AdminUserDetail|null>(null)
 const [detailsLoading,setDetailsLoading]=useState(false)
 const [detailsError,setDetailsError]=useState('')
 const load=useCallback(async()=>{
  setError('')
  try{
   const next=await fetchAdminDashboard()
   setData(next);setRequireApproval(next.requireApproval)
  }catch(e){setError(e instanceof Error?e.message:'Falha ao carregar usuários')}
  finally{setLoading(false)}
 },[])
 useEffect(()=>{void load()},[load])
 const changePolicy=async()=>{
  if(!data)return
  setFeedbackTarget('policy')
  setError('');setMessage('');setBusy(true)
  try{
   await changeApprovalRequirement(requireApproval)
   await load()
   setMessage('Política de aprovação atualizada.')
  }catch(e){setError(e instanceof Error?e.message:'Falha ao alterar política')}
  finally{setBusy(false)}
 }
 const changeStatus=async(user:AdminUser,status:AccessStatus)=>{
  if(['rejected','suspended'].includes(status)&&!window.confirm('Confirma '+(status==='suspended'?'a suspensão':'a rejeição')+' de '+(user.email||'esta conta')+'? O acesso aos dados será bloqueado.'))return
  setFeedbackTarget('account')
  setBusy(true);setError('');setMessage('')
  try{
   await changeUserStatus(user.id,status)
   await load()
   setMessage('Status atualizado para '+statuses[status]+'.')
  }catch(e){setError(e instanceof Error?e.message:'Falha ao atualizar acesso')}
  finally{setBusy(false)}
 }
 const openDetails=async(id:string)=>{
  setSelectedId(id);setSelectedDetails(null);setDetailsError('');setDetailsLoading(true)
  try{const details=await fetchAdminUserDetail(id);setSelectedDetails(details)}
  catch(e){setDetailsError(e instanceof Error?e.message:'Falha ao carregar detalhes.')}
  finally{setDetailsLoading(false)}
 }
 const users=data?.users??[]
 const counts=useMemo(()=>({
  total:users.length,
  approved:users.filter(u=>u.status==='approved').length,
  pending:users.filter(u=>u.status==='pending').length,
  blocked:users.filter(u=>u.status==='suspended'||u.status==='rejected').length,
  new30:users.filter(u=>Date.now()-new Date(u.createdAt).getTime()<=30*86400_000).length
 }),[users])
 const planCounts=useMemo(()=>planCount(users),[users])
 const locations=useMemo(()=>localityCounts(users),[users])
 const filtered=useMemo(()=>users.filter(u=>
  (filter==='all'||u.status===filter)&&(planFilter==='all'||u.plan===planFilter)&&
  ((u.email||'').toLowerCase().includes(query.trim().toLowerCase())||u.id.includes(query.trim()))
 ),[users,filter,planFilter,query])
 return <div className="stack">
  <div className="page-intro"><div><h2>Gestão de usuários</h2>
   <p>Aprovação de cadastros, controle de acesso e indicadores de utilização. Somente administradores podem consultar esta área.</p>
  </div><button type="button" className="secondary" onClick={()=>{setLoading(true);void load()}} disabled={loading||busy}><RefreshCw size={16}/>Atualizar</button></div>
  {error&&<p className="error" role="alert">{error}</p>}
  {message&&feedbackTarget==='account'&&<div className="payrep-feedback-toast" role="status">{message}<button type="button" onClick={()=>setMessage('')} aria-label="Fechar mensagem">×</button></div>}
  {loading&&!data?<div className="panel">Carregando usuários...</div>:null}
  {data&&<>
   <div className="admin-kpis">
    <Kpi label="Cadastrados" value={counts.total} note={counts.new30+' novos em 30 dias'} icon={UsersRound}/>
    <Kpi label="Aprovados" value={counts.approved} note="Contas com acesso liberado" icon={UserCheck}/>
    <Kpi label="Pendentes" value={counts.pending} note="Aguardando decisão" icon={Clock3}/>
    <Kpi label="Suspensos / rejeitados" value={counts.blocked} note="Acesso aos dados bloqueado" icon={ShieldAlert}/>
    <Kpi label="Sessões iniciadas (30 dias)" value={data.sessions30d} note="Cada sessão única conta uma vez" icon={Activity}/>
    <Kpi label="Usuários que acessaram (30 dias)" value={data.uniqueUsers30d} note="Contas distintas com sessão registrada" icon={ShieldCheck}/>
    <Kpi label="Free" value={planCounts.free} note="Plano gratuito" icon={CreditCard}/>
    <Kpi label="Basic" value={planCounts.basic} note="Assinaturas Basic" icon={CreditCard}/>
    <Kpi label="Full" value={planCounts.full} note="Assinaturas Full" icon={CreditCard}/>
    <Kpi label="Localidades" value={locations.filter(x=>x.location!=='Não informado').length} note="Cidades com cadastro informado" icon={MapPin}/>
   </div>
   <section className="panel">
    <div className="panel-heading"><h2>Usuários cadastrados</h2><span className="pill">{filtered.length} usuário(s)</span></div>
    <div className="admin-filters">
     <label>Pesquisar<input type="search" placeholder="E-mail ou identificador" value={query} onChange={e=>setQuery(e.target.value)}/></label>
     <label>Situação<select value={filter} onChange={e=>setFilter(e.target.value as 'all'|AccessStatus)}>
      <option value="all">Todos</option>
      {Object.entries(statuses).map(([value,label])=><option key={value} value={value}>{label}</option>)}
     </select></label>
     <label>Plano<select value={planFilter} onChange={e=>setPlanFilter(e.target.value as 'all'|Plan)}>
      <option value="all">Todos os planos</option>
      {Object.entries(planLabels).map(([code,label])=><option key={code} value={code}>{label}</option>)}
     </select></label>
    </div>
    <div className="table-scroll"><table><thead><tr>
     <th>Usuário</th><th>Criado em</th><th>Último login</th><th>Último acesso ao app</th>
     <th>Sessões (30 dias)</th><th>Plano</th><th>Localidade</th><th>Status</th><th>Ações</th>
    </tr></thead><tbody>
     {filtered.map(u=><tr key={u.id} className="clickable" tabIndex={0} role="button" aria-label={'Ver detalhes de '+(u.email||'usuário')} onClick={()=>void openDetails(u.id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();void openDetails(u.id)}}}>
      <td><div className="admin-user-identity"><AdminAvatar userId={u.id} email={u.email} name={u.displayName}/><div className="admin-user-identity-text"><strong>{u.displayName||u.email||'E-mail não disponível'}</strong><div className="subtle">{u.email||'E-mail não disponível'}</div></div></div></td>
      <td>{smallDate(u.createdAt)}</td><td>{dateTime(u.lastSignInAt)}</td>
      <td>{dateTime(u.lastAppAccess)}</td><td>{u.sessions30d}</td>
      <td><span className="pill">{planLabels[u.plan||'free']}</span></td>
      <td>{u.city?(u.city+(u.state?' / '+u.state:'')):'Não informado'}</td>
      <td><span className={'admin-state admin-state-'+u.status}>{statuses[u.status]}</span></td>
      <td><div className="admin-actions" onClick={e=>e.stopPropagation()} onKeyDown={e=>e.stopPropagation()}><button type="button" className="secondary" onClick={()=>void openDetails(u.id)}>Detalhes</button>{u.role==='admin'?
       <span className="subtle">Conta protegida</span>:<>
       {u.status!=='approved'&&<button type="button" className="secondary" disabled={busy} onClick={()=>void changeStatus(u,'approved')}>Aprovar</button>}
       {u.status==='approved'&&<button type="button" className="secondary" disabled={busy} onClick={()=>void changeStatus(u,'suspended')}>Suspender</button>}
       {u.status==='pending'&&<button type="button" className="secondary" disabled={busy} onClick={()=>void changeStatus(u,'rejected')}>Rejeitar</button>}
       {u.status==='suspended'&&<button type="button" className="secondary" disabled={busy} onClick={()=>void changeStatus(u,'rejected')}>Rejeitar</button>}
       {u.status==='rejected'&&<button type="button" className="secondary" disabled={busy} onClick={()=>void changeStatus(u,'pending')}>Reabrir</button>}
      </>}</div></td>
     </tr>)}
     {filtered.length===0&&<tr><td colSpan={9} className="subtle">Nenhuma conta corresponde aos filtros.</td></tr>}
    </tbody></table></div>
    <div className="detail-hint"><Info size={16}/>“Último login” vem do provedor de autenticação. O contador de sessões começa com a ativação deste recurso, não inclui histórico anterior e não mede páginas visualizadas. Suspender uma conta revoga o acesso aos dados pela política do banco, inclusive se o usuário permanecer autenticado.</div>
   </section>
   <section className="panel">
    <div className="panel-heading"><h2>Usuários por localidade</h2><span className="pill">{users.length} usuário(s)</span></div>
    <div className="admin-locality-list">{locations.map(loc=><div className="admin-locality-row" key={loc.location}>
      <span>{loc.location}</span><div className="admin-locality-track"><div style={{width:((loc.count/Math.max(1,locations[0]?.count||1))*100)+'%'}}/></div><strong>{loc.count}</strong>
    </div>)}</div>
    <p className="subtle">Localidade informada no cadastro do usuário. Contas sem endereço aparecem como “Não informado”.</p>
   </section>
   <section className="panel">
    <div className="panel-heading"><h2>Política de cadastro</h2></div>
    <label className="admin-switch"><input type="checkbox" checked={requireApproval} disabled={busy} onChange={e=>setRequireApproval(e.target.checked)}/>
     <span><strong>Exigir aprovação administrativa para novos usuários</strong><small>{requireApproval?'Novas contas ficam pendentes até sua aprovação.':'Novas contas serão liberadas automaticamente após o cadastro e autenticação.'}</small></span>
    </label>
    <button type="button" className="primary" disabled={busy||requireApproval===data.requireApproval} onClick={()=>void changePolicy()}>
     Salvar política de aprovação
    </button>
    {message&&feedbackTarget==='policy'&&<p className="auth-success" role="status">{message}</p>}
    <div className="detail-hint"><Info size={16}/>Essa opção controla o acesso ao aplicativo, não a criação de contas no Supabase Authentication. Para permitir cadastro público, a opção de criação de usuários também precisa estar habilitada no provedor. A alteração só afeta novos cadastros; contas já existentes mantêm seu status.</div>
   </section>
   <section className="panel"><div className="panel-heading"><h2>Auditoria recente</h2></div>
    {data.recentActions.length?<div className="table-scroll"><table><thead><tr><th>Data</th><th>Ação</th><th>Usuário</th><th>Anterior</th><th>Novo</th></tr></thead>
     <tbody>{data.recentActions.map((a,i)=><tr key={i}>
      <td>{dateTime(a.performedAt)}</td><td>{a.action==='require_approval'?'Política de aprovação':'Situação da conta'}</td>
      <td>{users.find(u=>u.id===a.targetId)?.email||'Configuração geral'}</td>
      <td>{a.old??'—'}</td><td>{a.new??'—'}</td>
     </tr>)}</tbody></table></div>:<p className="subtle">Nenhuma alteração administrativa registrada desde a ativação.</p>}
   </section>
  </>}
  {selectedId&&<AdminUserDetailDialog user={selectedDetails} totalAccesses={users.find(u=>u.id===selectedId)?.sessions??null} loading={detailsLoading} error={detailsError} onClose={()=>{setSelectedId(null);setSelectedDetails(null)}}/>}
 </div>
}
