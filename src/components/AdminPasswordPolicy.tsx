import {useCallback,useEffect,useState} from 'react'
import {LockKeyhole,RefreshCw,Save} from 'lucide-react'
import {
 callAuthPasswordPolicy,passwordPolicyDefaults,passwordPresetOptions,
 validatePasswordPolicy,type PasswordPolicy,type PasswordPreset
} from '../lib/passwordPolicy'

export function AdminPasswordPolicy(){
 const [policy,setPolicy]=useState<PasswordPolicy>(passwordPolicyDefaults)
 const [saved,setSaved]=useState<PasswordPolicy|null>(null)
 const [loading,setLoading]=useState(true)
 const [saving,setSaving]=useState(false)
 const [error,setError]=useState('')
 const [message,setMessage]=useState('')
 const refresh=useCallback(async()=>{
  setLoading(true);setError('');setMessage('')
  try{
   const remote=await callAuthPasswordPolicy('get')
   setPolicy(remote);setSaved(remote)
  }catch(e){
   setSaved(null)
   setError(e instanceof Error?e.message:'Não foi possível consultar o Supabase Auth.')
  }finally{setLoading(false)}
 },[])
 useEffect(()=>{void refresh()},[refresh])
 const valid=validatePasswordPolicy(policy)===null
 const changed=!!saved&&(policy.minLength!==saved.minLength||policy.preset!==saved.preset)
 const save=async()=>{
  if(!saved||!valid||!changed||loading||saving)return
  setSaving(true);setError('');setMessage('')
  try{
   const verified=await callAuthPasswordPolicy('save',policy,saved)
   setSaved(verified);setPolicy(verified)
   setMessage('Política confirmada no Supabase Auth e sincronizada com o Payrep.')
  }catch(e){
   setError(e instanceof Error?e.message:'Não foi possível confirmar a alteração no Supabase.')
  }finally{setSaving(false)}
 }
 return <section className="panel">
  <div className="panel-heading">
   <h2><LockKeyhole size={18}/> Requisitos de senha</h2>
   <button type="button" className="secondary" onClick={()=>void refresh()} disabled={loading||saving}>
    <RefreshCw size={15}/> {loading?'Consultando...':'Atualizar do Supabase'}
   </button>
  </div>
  <p>Esta configuração altera os requisitos do <strong>Supabase Auth HML</strong> e as validações do Payrep.
   O salvamento só é confirmado após a consulta de verificação ao Supabase.</p>
  <div className="password-policy-layout">
   <label className="password-policy-length">Quantidade mínima de caracteres
    <input type="number" min={8} max={128} step={1}
     value={policy.minLength} disabled={!saved||loading||saving}
     onChange={e=>setPolicy(old=>({...old,minLength:Number(e.target.value)}))}
     aria-label="Mínimo de caracteres"/>
   </label>
   <label className="password-policy-length">Requisitos de composição
    <select value={policy.preset} disabled={!saved||loading||saving}
     onChange={e=>setPolicy(old=>({...old,preset:e.target.value as PasswordPreset}))}>
     {passwordPresetOptions.map(opt=><option key={opt.value} value={opt.value}>{opt.label}</option>)}
    </select>
   </label>
  </div>
  <p className="subtle">As combinações seguem exatamente as opções suportadas pelo Supabase.
   Outras combinações isoladas não são aceitas pela API.</p>
  {!valid&&<p role="alert" className="error">{validatePasswordPolicy(policy)}</p>}
  {error&&<div className="detail-hint" role="alert">{error}</div>}
  {!saved&&<p className="subtle">
   Edição bloqueada até confirmar a conexão com o Supabase Auth. Gere um token de acesso pessoal
   restrito ao projeto HML, com Auth Config (Read/Read-write) e Project Settings (Read-write),
   e configure-o como secret <code>PAYREP_AUTH_CONFIG_MANAGEMENT_TOKEN</code>
   em Supabase HML → Edge Functions → Secrets. Nunca informe o token no Payrep ou neste chat.
  </p>}
  <div className="admin-settings-actions">
   <button type="button" className="primary"
    disabled={!saved||!changed||!valid||loading||saving}
    onClick={()=>void save()}><Save size={16}/>
    {saving?'Validando no Supabase...':'Salvar no Payrep e Supabase'}
   </button>
   {message&&<span role="status" className="auth-success">{message}</span>}
  </div>
  <p className="subtle">Alterações de política se aplicam a novas senhas; não alteram automaticamente
   senhas existentes. Usuários com senha antiga poderão receber avisos de senha fraca.</p>
 </section>
}
