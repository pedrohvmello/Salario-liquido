import {useCallback,useEffect,useState} from 'react'
import {ShieldCheck,Save,BookOpen,UsersRound,LifeBuoy} from 'lucide-react'
import {LegalHistoryViewer} from './LegalHistoryViewer'
import {AdminPasswordPolicy} from './AdminPasswordPolicy'
import {fetchAdminDashboard,changeApprovalRequirement} from '../lib/admin'
export function AdminSettingsPage({onNavigate}:{onNavigate:(view:'admin'|'admin-support')=>void}){
 const [approval,setApproval]=useState(true)
 const [savedApproval,setSavedApproval]=useState(true)
 const [loading,setLoading]=useState(true)
 const [busy,setBusy]=useState(false)
 const [message,setMessage]=useState('')
 const [error,setError]=useState('')
 const load=useCallback(async()=>{
  try{const data=await fetchAdminDashboard();setSavedApproval(data.requireApproval);setApproval(data.requireApproval)}
  catch(e){setError(e instanceof Error?e.message:'Não foi possível carregar a política administrativa.')}
  finally{setLoading(false)}
 },[])
 useEffect(()=>{void load()},[load])
 const save=async()=>{
  setBusy(true);setMessage('');setError('')
  try{await changeApprovalRequirement(approval);setSavedApproval(approval);setMessage('Política de aprovação salva.')}
  catch(e){setError(e instanceof Error?e.message:'Erro ao salvar a política.')}
  finally{setBusy(false)}
 }
 return <div className="stack">
  <div className="page-intro"><div><h2>Configurações administrativas</h2><p>Políticas globais do Payrep, disponíveis apenas para administradores.</p></div></div>
  <section className="panel">
   <div className="panel-heading"><h2><UsersRound size={18}/> Gestão de usuários</h2></div>
   <p>Consulte contas cadastradas, aprove novos acessos, gerencie situações dos usuários e acompanhe indicadores de utilização.</p>
   <button type="button" className="primary" onClick={()=>onNavigate('admin')}><UsersRound size={17}/> Acessar gestão de usuários</button>
  </section>
  <section className="panel">
   <div className="panel-heading"><h2><LifeBuoy size={18}/> Chamados de suporte</h2></div>
   <p>Consulte solicitações, responda às mensagens, filtre chamados por status e ano e finalize os atendimentos.</p>
   <button type="button" className="primary" onClick={()=>onNavigate('admin-support')}><LifeBuoy size={17}/> Gerenciar chamados</button>
  </section>
  <section className="panel"><div className="panel-heading"><h2><ShieldCheck size={18}/> Política de cadastro</h2></div>
   <label className="admin-switch"><input type="checkbox" checked={approval} disabled={loading||busy} onChange={e=>setApproval(e.target.checked)}/><span><strong>Exigir aprovação administrativa</strong><small>{approval?'Novos usuários precisam ser aprovados para acessar dados financeiros.':'Novos usuários poderão ser aprovados automaticamente após autenticação.'}</small></span></label>
   <div className="admin-settings-actions"><button type="button" className="primary" disabled={loading||busy||approval===savedApproval} onClick={()=>void save()}><Save size={16}/> Salvar política</button>
    {message&&<span className="auth-success" role="status">{message}</span>}{error&&<span role="alert" className="error">{error}</span>}
   </div>
   <p className="subtle">A política de aprovação controla o acesso ao Payrep, não a criação de usuários no Supabase Auth.</p>
  </section>
  <AdminPasswordPolicy/>
  <section className="panel">
   <div className="panel-heading"><h2><BookOpen size={18}/> Histórico dos documentos legais</h2></div>
   <p className="subtle">Selecione uma revisão da Política de Privacidade ou dos Termos de Uso e abra a versão arquivada. Antes da abertura pública, todas as revisões permanecem identificadas como V1.0.</p>
   <LegalHistoryViewer/>
  </section>
 </div>
}
