import {useCallback,useEffect,useState} from 'react'
import {ShieldCheck,LockKeyhole,Info,Save} from 'lucide-react'
import {fetchAdminDashboard,changeApprovalRequirement} from '../lib/admin'
import {passwordPolicyDefaults,validatePasswordPolicy,type PasswordPolicy} from '../lib/passwordPolicy'

const policyLabels:{key:keyof Omit<PasswordPolicy,'minLength'>;label:string}[]=[
 {key:'requireLetters',label:'Exigir letras'},
 {key:'requireUppercase',label:'Exigir letras maiúsculas'},
 {key:'requireNumbers',label:'Exigir números'},
 {key:'requireSymbols',label:'Exigir caracteres especiais'}
]

export function AdminSettingsPage(){
 const [approval,setApproval]=useState(true)
 const [savedApproval,setSavedApproval]=useState(true)
 const [policy,setPolicy]=useState<PasswordPolicy>(passwordPolicyDefaults)
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
 const policyError=validatePasswordPolicy(policy)
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
   <p className="subtle">Modelo para criação e redefinição de senhas. Senhas atuais não são alteradas por esta tela.</p>
   <div className="password-policy-layout">
    <label className="password-policy-length">Quantidade mínima de caracteres<input type="number" inputMode="numeric" min={8} max={128} value={policy.minLength} onChange={e=>setPolicy(p=>({...p,minLength:Number(e.target.value)}))}/></label>
    {policyLabels.map(({key,label})=><label key={key} className="password-policy-toggle"><span>{label}</span><input type="checkbox" checked={policy[key]} onChange={e=>setPolicy(p=>({...p,[key]:e.target.checked}))}/></label>)}
   </div>
   {policyError&&<p className="error" role="alert">{policyError}</p>}
   <div className="detail-hint"><Info size={16}/>Prévia visual. Estas opções ainda não alteram as regras do Supabase Auth. Para segurança efetiva, a validação deve ser aplicada no provedor, inclusive em cadastros feitos fora da interface do Payrep.</div>
   <button className="primary" type="button" disabled aria-label="Aplicar política indisponível até integração com Supabase Auth"><Save size={16}/> Aplicar política no Supabase (pendente)</button>
  </section>
 </div>
}
