import {useCallback,useEffect,useState} from 'react'
import {Save,Sparkles} from 'lucide-react'
import {
 AI_LIMITS,fetchSupportAiLimits,saveSupportAiLimits,validSupportAiLimits,
 type SupportAiLimits
} from '../lib/supportAiLimits'

export function AdminSupportAiLimits(){
 const [limits,setLimits]=useState<SupportAiLimits|null>(null)
 const [userInput,setUserInput]=useState('8')
 const [globalInput,setGlobalInput]=useState('50')
 const [loading,setLoading]=useState(true)
 const [saving,setSaving]=useState(false)
 const [message,setMessage]=useState('')
 const [error,setError]=useState('')
 const load=useCallback(async()=>{
  setLoading(true);setError('')
  try{
   const result=await fetchSupportAiLimits()
   setLimits(result)
   setUserInput(String(result.userDailyLimit))
   setGlobalInput(String(result.globalDailyLimit))
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível carregar os limites da IA.')}
  finally{setLoading(false)}
 },[])
 useEffect(()=>{void load()},[load])
 const perUser=Number(userInput),global=Number(globalInput)
 const valid=userInput.trim()!==''&&globalInput.trim()!==''&&validSupportAiLimits(perUser,global)
 const changed=limits!==null&&(perUser!==limits.userDailyLimit||global!==limits.globalDailyLimit)
 const save=async()=>{
  if(!valid||!changed||saving)return
  setSaving(true);setMessage('');setError('')
  try{
   await saveSupportAiLimits(perUser,global)
   const result=await fetchSupportAiLimits()
   setLimits(result)
   setUserInput(String(result.userDailyLimit));setGlobalInput(String(result.globalDailyLimit))
   setMessage('Limites atualizados. As próximas perguntas já utilizarão os novos valores.')
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível salvar os limites.')}
  finally{setSaving(false)}
 }
 return <section className="panel">
  <div className="panel-heading"><h2><Sparkles size={18}/> Assistente Payrep: limites de mensagens</h2></div>
  <p>Configure quantas perguntas podem ser enviadas ao assistente por dia. Os limites são aplicados pelo servidor a todas as contas.</p>
  <div className="password-policy-layout">
   <label className="password-policy-length">Mensagens por usuário / dia
    <input type="number" min={1} max={AI_LIMITS.perUserMax} step={1}
     value={userInput} disabled={loading||saving} onChange={e=>{setUserInput(e.target.value);setMessage('')}}
     aria-label="Limite diário de mensagens por usuário"/>
   </label>
   <label className="password-policy-length">Mensagens totais / dia
    <input type="number" min={1} max={AI_LIMITS.globalMax} step={1}
     value={globalInput} disabled={loading||saving} onChange={e=>{setGlobalInput(e.target.value);setMessage('')}}
     aria-label="Limite diário total de mensagens da IA"/>
   </label>
  </div>
  {limits&&<p className="subtle" aria-live="polite">
   Uso hoje: <strong>{limits.usedToday} de {limits.globalDailyLimit}</strong> perguntas, por <strong>{limits.usersToday}</strong> usuário(s).
   A contagem reinicia à meia-noite UTC.
  </p>}
  <p className="subtle">Os limites não reiniciam o consumo já registrado hoje. O intervalo mínimo entre perguntas continua em 20 segundos. A franquia gratuita da Cloudflare é independente e pode acabar antes destes limites.</p>
  {!valid&&!loading&&<p role="alert" className="error">
   Use números inteiros: 1 a {AI_LIMITS.perUserMax} por usuário; limite total entre o valor por usuário e {AI_LIMITS.globalMax}.
  </p>}
  <div className="admin-settings-actions">
   <button type="button" className="primary" disabled={loading||saving||!valid||!changed}
    onClick={()=>void save()}><Save size={16}/> {saving?'Salvando...':'Salvar limites da IA'}</button>
   {message&&<span role="status" className="auth-success">{message}</span>}
   {error&&<span role="alert" className="error">{error}</span>}
  </div>
 </section>
}
