import {useCallback,useEffect,useState} from 'react'
import {CalendarClock,Plus,RefreshCw,Save} from 'lucide-react'
import {db} from '../lib/data'
import {PayrepDatePicker} from './PayrepDatePicker'
import {PayrepSelect} from './PayrepSelect'
import type {TimeBankPolicy} from '../lib/timeBank'

type Profile=TimeBankPolicy&{name:string;is_default:boolean;verified:boolean;active:boolean;slug:string;description:string;source_note:string}
type Draft={
 id?:string;name:string;description:string;source_note:string;valid_from:string;valid_until:string;
 weekday_factor:string;saturday_factor:string;sunday_factor:string;holiday_factor:string;
 daily_target_minutes:string;settlement_interval_months:string;settlement_months:string;settlement_half:string
}
const blank=():Draft=>({
 name:'',description:'',source_note:'',valid_from:new Date().toISOString().slice(0,10),
 valid_until:'2099-12-31',weekday_factor:'1',saturday_factor:'1',sunday_factor:'2',
 holiday_factor:'2',daily_target_minutes:'480',settlement_interval_months:'6',
 settlement_months:'2,8',settlement_half:'1'
})
const fromProfile=(p:Profile):Draft=>({
 id:p.id,name:p.name,description:p.description,source_note:p.source_note,
 valid_from:p.valid_from,valid_until:p.valid_until,
 weekday_factor:String(p.weekday_factor),saturday_factor:String(p.saturday_factor),
 sunday_factor:String(p.sunday_factor),holiday_factor:String(p.holiday_factor),
 daily_target_minutes:String(p.daily_target_minutes),settlement_interval_months:String(p.settlement_interval_months),
 settlement_months:p.settlement_months.join(','),settlement_half:String(p.settlement_half)
})
const toFactor=(value:string,label:string)=>{
 const result=Number(value.replace(',','.'))
 if(!Number.isFinite(result)||result<0.25||result>4)throw Error(label+': use um fator entre 0,25 e 4.')
 return result
}
export function AdminTimeBankPolicies(){
 const [profiles,setProfiles]=useState<Profile[]>([])
 const [draft,setDraft]=useState<Draft|null>(null)
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const [message,setMessage]=useState('')
 const load=useCallback(async()=>{
  if(!db)throw Error('Supabase indisponível.')
  const {data,error}=await db.from('bank_policy_profiles').select('*').order('is_default',{ascending:false}).order('name')
  if(error)throw Error(error.message)
  setProfiles((data||[]) as Profile[])
 },[])
 useEffect(()=>{void load().catch(e=>setError(e instanceof Error?e.message:String(e)))},[load])
 const patch=(value:Partial<Draft>)=>setDraft(x=>x?{...x,...value}:x)
 const save=async()=>{
  if(!db||!draft||busy)return
  setBusy(true);setError('');setMessage('')
  try{
   if(draft.name.trim().length<3||!draft.valid_from||!draft.valid_until||
    draft.valid_from>draft.valid_until)throw Error('Informe nome e vigência válida.')
   const target=Number(draft.daily_target_minutes)
   const interval=Number(draft.settlement_interval_months)
   const months=[...new Set(draft.settlement_months.split(',').map(x=>Number(x.trim())))]
   if(!Number.isInteger(target)||target<60||target>720)throw Error('Jornada deve ficar entre 60 e 720 minutos.')
   if(!Number.isInteger(interval)||interval<1||interval>12||
    !months.length||months.some(x=>!Number.isInteger(x)||x<1||x>12))
    throw Error('Confira prazo e meses de liquidação.')
   const payload={
    ...(draft.id?{id:draft.id}:{slug:'custom-'+crypto.randomUUID().replace(/-/g,'')}),
    name:draft.name.trim(),description:draft.description.trim(),source_note:draft.source_note.trim(),
    valid_from:draft.valid_from,valid_until:draft.valid_until,
    weekday_factor:toFactor(draft.weekday_factor,'Segunda a sexta'),
    saturday_factor:toFactor(draft.saturday_factor,'Sábado'),
    sunday_factor:toFactor(draft.sunday_factor,'Domingo'),
    holiday_factor:toFactor(draft.holiday_factor,'Feriado'),
    daily_target_minutes:target,settlement_interval_months:interval,
    settlement_months:months.sort((a,b)=>a-b),settlement_half:Number(draft.settlement_half)
   }
   const {error}=await db.from('bank_policy_profiles').upsert(payload)
   if(error)throw Error(error.message)
   await load()
   setDraft(null)
   setMessage('Perfil salvo. Agora ele pode ser selecionado em Definições.')
  }catch(e){setError(e instanceof Error?e.message:'Falha ao salvar perfil.')}
  finally{setBusy(false)}
 }
 return <section className="panel">
  <div className="panel-heading">
   <h2><CalendarClock size={18}/> Perfis do Banco de Horas</h2>
   <button type="button" className="secondary" disabled={busy} onClick={()=>void load().catch(e=>setError(String(e)))}>
    <RefreshCw size={16}/> Atualizar
   </button>
  </div>
  <p className="subtle">Administre os perfis uma única vez. A Genérica é atribuída automaticamente a novos usuários. Cada pessoa escolhe outro perfil em Definições, sem atribuições individuais pelo administrador.</p>
  <div className="time-bank-profile-list">
   {profiles.map(p=><div key={p.id} className="time-bank-profile-item">
    <div>
     <strong>{p.name}</strong> {p.is_default&&<span className="pill">Padrão</span>}
     {p.verified&&<span className="pill">Acordo verificado</span>}
     {!p.verified&&<span className="pill">Configuração manual</span>}
     <p className="subtle">Seg. a sex. {p.weekday_factor}:1 · Sáb. {p.saturday_factor}:1 · Dom. {p.sunday_factor}:1 · Feriado {p.holiday_factor}:1 · Jornada {p.daily_target_minutes/60}h</p>
     <small className="subtle">Vigência: {p.valid_from} a {p.valid_until}</small>
    </div>
    {!p.verified&&<button type="button" className="secondary" disabled={busy} onClick={()=>{setDraft(fromProfile(p));setMessage('');setError('')}}>Editar</button>}
   </div>)}
  </div>
  <button type="button" className="secondary" onClick={()=>{setDraft(blank());setError('');setMessage('')}}><Plus size={16}/> Novo perfil</button>
  {draft&&<div className="time-bank-profile-editor">
   <h3>{draft.id?'Editar perfil':'Cadastrar perfil'}</h3>
   <p className="subtle">Perfis já utilizados não podem ter fatores ou vigência alterados retroativamente. Para novas regras, cadastre outro perfil.</p>
   <div className="form-grid">
    <label>Nome do perfil<input value={draft.name} maxLength={100} onChange={e=>patch({name:e.target.value})}/></label>
    <label>Descrição<input value={draft.description} onChange={e=>patch({description:e.target.value})}/></label>
    <label>Vigência inicial<PayrepDatePicker value={draft.valid_from} onChange={value=>patch({valid_from:value})}/></label>
    <label>Vigência final<PayrepDatePicker value={draft.valid_until} onChange={value=>patch({valid_until:value})}/></label>
   </div>
   <div className="time-bank-policy-factors">
    {([['weekday_factor','Segunda a sexta'],['saturday_factor','Sábado'],['sunday_factor','Domingo'],['holiday_factor','Feriado']] as const).map(([key,label])=>
     <label key={key}>{label}
      <input type="number" min={0.25} max={4} step={0.25} value={draft[key]} onChange={e=>patch({[key]:e.target.value})}/>
     </label>)}
   </div>
   <details className="time-bank-profile-advanced">
    <summary>Opções avançadas</summary>
    <div className="form-grid">
     <label>Jornada (minutos)<input type="number" min={60} max={720} value={draft.daily_target_minutes} onChange={e=>patch({daily_target_minutes:e.target.value})}/></label>
     <label>Prazo compensação (meses)<input type="number" min={1} max={12} value={draft.settlement_interval_months} onChange={e=>patch({settlement_interval_months:e.target.value})}/></label>
     <label>Meses de liquidação<input value={draft.settlement_months} onChange={e=>patch({settlement_months:e.target.value})}/></label>
     <label>Quinzena de liquidação
      <PayrepSelect value={draft.settlement_half} onChange={value=>patch({settlement_half:value})} title="Quinzena de liquidação">
       <option value="1">Primeira</option><option value="2">Segunda</option>
      </PayrepSelect>
     </label>
     <label>Fonte / observações<input value={draft.source_note} onChange={e=>patch({source_note:e.target.value})}/></label>
    </div>
    <p className="subtle">Prazo e meses de liquidação são informativos. Pagamentos e zeramento automático ainda não estão implementados.</p>
   </details>
   <div className="admin-settings-actions">
    <button type="button" className="primary" disabled={busy} onClick={()=>void save()}><Save size={16}/>{busy?'Salvando...':'Salvar perfil'}</button>
    <button type="button" className="secondary" disabled={busy} onClick={()=>setDraft(null)}>Cancelar</button>
   </div>
  </div>}
  {message&&<p role="status" className="auth-success">{message}</p>}
  {error&&<p role="alert" className="error">{error}</p>}
 </section>
}
