import {useCallback,useEffect,useState} from 'react'
import {ShieldCheck,LockKeyhole,Info,Save,BookOpen} from 'lucide-react'
import {LegalHistoryViewer} from './LegalHistoryViewer'
import {fetchAdminDashboard,changeApprovalRequirement} from '../lib/admin'
import {passwordPolicyDefaults,type PasswordPolicy} from '../lib/passwordPolicy'

const policyLabels:{key:keyof Omit<PasswordPolicy,'minLength'>;label:string}[]=[
 {key:'requireLowercase',label:'Exigir letras minúsculas'},
 {key:'requireUppercase',label:'Exigir letras maiúsculas'},
 {key:'requireNumbers',label:'Exigir números'},
 {key:'requireSymbols',label:'Exigir caracteres especiais'}
]

export function AdminSettingsPage(){
 const [approval,setApproval]=useState(true)
 const [savedApproval,setSavedApproval]=useState(true)
 const policy=passwordPolicyDefaults
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
  <section className="panel"><div className="panel-heading"><h2><ShieldCheck size={18}/> Política de cadastro</h2></div>
   <label className="admin-switch"><input type="checkbox" checked={approval} disabled={loading||busy} onChange={e=>setApproval(e.target.checked)}/><span><strong>Exigir aprovação administrativa</strong><small>{approval?'Novos usuários precisam ser aprovados para acessar dados financeiros.':'Novos usuários poderão ser aprovados automaticamente após autenticação.'}</small></span></label>
   <div className="admin-settings-actions"><button type="button" className="primary" disabled={loading||busy||approval===savedApproval} onClick={()=>void save()}><Save size={16}/> Salvar política</button>
    {message&&<span className="auth-success" role="status">{message}</span>}{error&&<span role="alert" className="error">{error}</span>}
   </div>
   <p className="subtle">A política de aprovação controla o acesso ao Payrep, não a criação de usuários no Supabase Auth.</p>
  </section>
  <section className="panel"><div className="panel-heading"><h2><LockKeyhole size={18}/> Requisitos de senha</h2></div>
   <p className="subtle">Padrão da Fase 1 aplicado ao cadastro e à alteração de senha na interface do Payrep.</p>
   <div className="password-policy-layout">
    <label className="password-policy-length">Quantidade mínima de caracteres<input type="number" value={policy.minLength} readOnly aria-label="Mínimo de caracteres"/></label>
    {policyLabels.map(({key,label})=><label key={key} className="password-policy-toggle"><span>{label}</span><input type="checkbox" checked={policy[key]} readOnly disabled/></label>)}
   </div>
   <div className="detail-hint"><Info size={16}/>O padrão está disponível na interface. Para torná-lo obrigatório também na API, configure os mesmos requisitos no Supabase Auth. Até lá, os controles administrativos ficam bloqueados para não criar divergência entre cliente e servidor.</div>
   <p className="subtle">No Supabase HML, configure mínimo de 12 caracteres e os quatro grupos: minúsculas, maiúsculas, números e símbolos. Habilite a exigência de senha atual na troca de senha, se disponível.</p>
   <a className="secondary" href="https://supabase.com/dashboard/project/nrpqcrhschztdwbfgnyo/auth/providers?provider=Email" target="_blank" rel="noopener noreferrer">Abrir configurações de senha no Supabase HML</a>
  </section>
  <section className="panel">
   <div className="panel-heading"><h2><BookOpen size={18}/> Histórico dos documentos legais</h2></div>
   <p className="subtle">Selecione uma revisão da Política de Privacidade ou dos Termos de Uso e abra a versão arquivada. Antes da abertura pública, todas as revisões permanecem identificadas como V1.0.</p>
   <LegalHistoryViewer/>
  </section>
 </div>
}
