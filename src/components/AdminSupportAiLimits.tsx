import {useCallback,useEffect,useState} from 'react'
import {Save,Sparkles} from 'lucide-react'
import {fetchPepLimits,savePepLimits,validPepLimits,type PepLimits} from '../lib/supportAiLimits'

type Key='help'|'basic'|'full'|'global'
const fields:{key:Key;label:string;description:string}[]=[
 {key:'help',label:'Pep Ajuda | consultas por usuário / dia',
  description:'Todos os planos. Orientações de uso do Payrep, sem acesso a dados financeiros.'},
 {key:'basic',label:'Pep Basic | consultas pessoais / dia',
  description:'Usuários Basic. Consultas aos registros próprios, sem análise de holerites PDF.'},
 {key:'full',label:'Pep Full | consultas pessoais / dia',
  description:'Usuários Full. Inclui consultas aos holerites, com a mesma contagem do Basic.'},
 {key:'global',label:'Limite global | consultas / dia',
  description:'Proteção adicional para a soma das consultas de usuários comuns dos dois tipos de Pep.'}
]
export function AdminSupportAiLimits(){
 const [limits,setLimits]=useState<PepLimits|null>(null)
 const [input,setInput]=useState<Record<Key,string>>({help:'50',basic:'20',full:'50',global:'500'})
 const [loading,setLoading]=useState(true)
 const [saving,setSaving]=useState(false)
 const [message,setMessage]=useState('')
 const [error,setError]=useState('')
 const load=useCallback(async()=>{
  setLoading(true);setError('')
  try{
   const result=await fetchPepLimits()
   setLimits(result)
   setInput({help:String(result.helpDailyLimit),basic:String(result.basicDailyLimit),
    full:String(result.fullDailyLimit),global:String(result.globalDailyLimit)})
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível carregar os limites do Pep.')}
  finally{setLoading(false)}
 },[])
 useEffect(()=>{void load()},[load])
 const values=[input.help,input.basic,input.full,input.global].map(Number)
 const valid=Object.values(input).every(x=>x.trim()!=='')&&validPepLimits(values[0],values[1],values[2],values[3])
 const changed=limits!==null&&(values[0]!==limits.helpDailyLimit||values[1]!==limits.basicDailyLimit
  ||values[2]!==limits.fullDailyLimit||values[3]!==limits.globalDailyLimit)
 const save=async()=>{
  if(!valid||!changed||saving)return
  setSaving(true);setMessage('');setError('')
  try{
   await savePepLimits(values[0],values[1],values[2],values[3])
   const updated=await fetchPepLimits()
   setLimits(updated)
   setInput({help:String(updated.helpDailyLimit),basic:String(updated.basicDailyLimit),
    full:String(updated.fullDailyLimit),global:String(updated.globalDailyLimit)})
   setMessage('Limites do Pep atualizados. As próximas perguntas utilizarão as novas regras.')
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível salvar os limites.')}
  finally{setSaving(false)}
 }
 return <section className="panel">
  <div className="panel-heading"><h2><Sparkles size={18}/> Limites do Pep</h2></div>
  <p>Defina franquias diárias independentes para o Pep Ajuda e as consultas pessoais dos planos Basic e Full. Administradores não têm limite interno. A cota externa da Cloudflare permanece aplicável.</p>
  <div className="password-policy-layout">
   {fields.map(field=><label key={field.key} className="password-policy-length">
    {field.label}
    <input type="number" min={1} step={1} value={input[field.key]}
     disabled={loading||saving}
     onChange={e=>{setInput(old=>({...old,[field.key]:e.target.value}));setMessage('')}}
     aria-label={field.label}/>
    <small className="subtle">{field.description}</small>
   </label>)}
  </div>
  {limits&&<p className="subtle" aria-live="polite">
   Uso total dos usuários comuns hoje: <strong>{limits.usedToday} de {limits.globalDailyLimit}</strong> consultas,
   por <strong>{limits.usersToday}</strong> usuário(s). Reinício às 00:00 UTC.
  </p>}
  <p className="subtle">Basic e Full compartilham o consumo pessoal do dia. Exemplo: 8 consultas no Basic equivalem a 8 já utilizadas no Full após um upgrade. Consultas na Ajuda não reduzem a franquia pessoal.</p>
  {!valid&&!loading&&<p role="alert" className="error">
   Informe números inteiros positivos. O limite Full deve ser igual ou superior ao Basic.
  </p>}
  <div className="admin-settings-actions">
   <button type="button" className="primary" disabled={loading||saving||!valid||!changed}
    onClick={()=>void save()}><Save size={16}/>{saving?'Salvando...':'Salvar limites do Pep'}</button>
   {message&&<span role="status" className="auth-success">{message}</span>}
   {error&&<span role="alert" className="error">{error}</span>}
  </div>
 </section>
}
