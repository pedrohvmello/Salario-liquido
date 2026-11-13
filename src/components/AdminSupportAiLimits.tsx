import {useCallback,useEffect,useState} from 'react'
import {Save,Sparkles} from 'lucide-react'
import {
 fetchSupportAiLimits,saveSupportAiLimits,validSupportAiLimits,
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
  <p>Configure os limites diários de perguntas para usuários comuns. Administradores não têm limite interno de perguntas no Payrep e não consomem a cota dos demais usuários.</p>
  <div className="password-policy-layout">
   <label className="password-policy-length">Mensagens por usuário comum / dia
    <input type="number" min={1} step={1}
     value={userInput} disabled={loading||saving} onChange={e=>{setUserInput(e.target.value);setMessage('')}}
     aria-label="Limite diário de mensagens por usuário"/>
   </label>
   <label className="password-policy-length">Mensagens totais de usuários comuns / dia
    <input type="number" min={1} step={1}
     value={globalInput} disabled={loading||saving} onChange={e=>{setGlobalInput(e.target.value);setMessage('')}}
     aria-label="Limite diário total de mensagens da IA"/>
   </label>
  </div>
  {limits&&<p className="subtle" aria-live="polite">
   Uso dos usuários comuns hoje: <strong>{limits.usedToday} de {limits.globalDailyLimit}</strong> perguntas, por <strong>{limits.usersToday}</strong> usuário(s).
   A contagem reinicia à meia-noite UTC.
  </p>}
  <p className="subtle">Os limites não reiniciam o consumo já registrado hoje. Administradores não consomem a cota de usuários comuns e não têm limite interno. A franquia externa da Cloudflare continua válida.</p>
  {!valid&&!loading&&<p role="alert" className="error">
   Informe números inteiros positivos. Os limites são independentes e não têm tetos adicionais definidos pelo Payrep.
  </p>}
  <div className="admin-settings-actions">
   <button type="button" className="primary" disabled={loading||saving||!valid||!changed}
    onClick={()=>void save()}><Save size={16}/> {saving?'Salvando...':'Salvar limites da IA'}</button>
   {message&&<span role="status" className="auth-success">{message}</span>}
   {error&&<span role="alert" className="error">{error}</span>}
  </div>
 </section>
}
