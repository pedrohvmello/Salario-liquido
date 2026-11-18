import {useCallback,useEffect,useMemo,useState} from 'react'
import {CalendarClock,RefreshCw,Save} from 'lucide-react'
import {db} from '../lib/data'
import {fetchAdminDashboard,type AdminUser} from '../lib/admin'
import {PayrepSelect} from './PayrepSelect'
import {PayrepDatePicker} from './PayrepDatePicker'
import type {TimeBankPolicy} from '../lib/timeBank'

type PolicyDraft={
 id?:string;user_id:string;title:string;source_reference:string;
 valid_from:string;valid_until:string;
 weekday_factor:string;saturday_factor:string;sunday_factor:string;holiday_factor:string;
 daily_target_minutes:string;settlement_interval_months:string;settlement_months:string;settlement_half:string
}
const blank=(userId:string):PolicyDraft=>({
 user_id:userId,title:'',source_reference:'',valid_from:'',valid_until:'',
 weekday_factor:'1',saturday_factor:'1',sunday_factor:'1',holiday_factor:'1',
 daily_target_minutes:'480',settlement_interval_months:'6',settlement_months:'2,8',settlement_half:'1'
})
const fromPolicy=(p:TimeBankPolicy):PolicyDraft=>({
 id:p.id,user_id:p.user_id,title:p.title,source_reference:p.source_reference,
 valid_from:p.valid_from,valid_until:p.valid_until,
 weekday_factor:String(p.weekday_factor),saturday_factor:String(p.saturday_factor),
 sunday_factor:String(p.sunday_factor),holiday_factor:String(p.holiday_factor),
 daily_target_minutes:String(p.daily_target_minutes),
 settlement_interval_months:String(p.settlement_interval_months),
 settlement_months:p.settlement_months.join(','),settlement_half:String(p.settlement_half)
})
const accentureTemplate=(userId:string):PolicyDraft=>({
 ...blank(userId),title:'ACT Accenture SP001901/2026',
 source_reference:'MTE SP001901/2026, cláusula 8ª',
 valid_from:'2025-09-01',valid_until:'2026-08-31',
 weekday_factor:'1',saturday_factor:'1',sunday_factor:'2',holiday_factor:'2'
})
const dateBR=(value:string)=>value?value.slice(8,10)+'/'+value.slice(5,7)+'/'+value.slice(0,4):''
const number=(v:string,name:string,min:number,max:number)=>{
 const parsed=Number(v.replace(',','.'))
 if(!Number.isFinite(parsed)||parsed<min||parsed>max)
  throw Error(name+' deve estar entre '+min+' e '+max+'.')
 return parsed
}
export function AdminTimeBankPolicies(){
 const [users,setUsers]=useState<AdminUser[]>([])
 const [policies,setPolicies]=useState<TimeBankPolicy[]>([])
 const [userId,setUserId]=useState('')
 const [draft,setDraft]=useState<PolicyDraft>(()=>blank(''))
 const [busy,setBusy]=useState(false)
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')
 const [message,setMessage]=useState('')
 const refresh=useCallback(async()=>{
  if(!db)throw Error('Supabase não configurado')
  const [dashboard,response]=await Promise.all([
   fetchAdminDashboard(),
   db.from('time_bank_policies').select('*').order('valid_from',{ascending:false})
  ])
  if(response.error)throw Error(response.error.message)
  setUsers(dashboard.users)
  setPolicies((response.data||[]) as TimeBankPolicy[])
 },[])
 useEffect(()=>{
  let mounted=true
  const load=async()=>{
   try{await refresh()}catch(e){if(mounted)setError(e instanceof Error?e.message:'Falha ao carregar políticas')}
   finally{if(mounted)setLoading(false)}
  }
  void load()
  return ()=>{mounted=false}
 },[refresh])
 const filtered=useMemo(()=>policies.filter(p=>p.user_id===userId),[policies,userId])
 const patch=(value:Partial<PolicyDraft>)=>{setDraft(prev=>({...prev,...value}));setMessage('');setError('')}
 const save=async()=>{
  if(!db||busy)return
  setError('');setMessage('');setBusy(true)
  try{
   if(!draft.user_id)throw Error('Selecione o usuário que receberá a política.')
   if(!draft.title.trim()||draft.title.trim().length<3)throw Error('Informe o nome da política.')
   if(!draft.valid_from||!draft.valid_until||draft.valid_from>draft.valid_until)
    throw Error('Informe um intervalo de vigência válido.')
   const factors={
    weekday_factor:number(draft.weekday_factor,'Fator de segunda a sexta',0.25,4),
    saturday_factor:number(draft.saturday_factor,'Fator do sábado',0.25,4),
    sunday_factor:number(draft.sunday_factor,'Fator do domingo',0.25,4),
    holiday_factor:number(draft.holiday_factor,'Fator do feriado',0.25,4)
   }
   const months=[...new Set(draft.settlement_months.split(',').map(v=>Number(v.trim())))]
   if(!months.length||months.some(m=>!Number.isInteger(m)||m<1||m>12))
    throw Error('Informe os meses de liquidação de 1 a 12, separados por vírgula.')
   const payload={
    ...(draft.id?{id:draft.id}:{}),
    user_id:draft.user_id,title:draft.title.trim(),source_reference:draft.source_reference.trim(),
    valid_from:draft.valid_from,valid_until:draft.valid_until,...factors,
    daily_target_minutes:Math.round(number(draft.daily_target_minutes,'Jornada de referência (minutos)',60,720)),
    settlement_interval_months:Math.round(number(draft.settlement_interval_months,'Prazo de compensação (meses)',1,12)),
    settlement_months:months.sort((a,b)=>a-b),settlement_half:Number(draft.settlement_half)
   }
   const {error:saveError}=await db.from('time_bank_policies').upsert(payload)
   if(saveError)throw Error(saveError.message)
   await refresh()
   setDraft(blank(draft.user_id))
   setMessage('Política salva no Supabase HML. Os fatores só serão aplicados às datas incluídas na vigência.')
  }catch(e){setError(e instanceof Error?e.message:'Falha ao salvar a política')}
  finally{setBusy(false)}
 }
 const fields=[
  ['weekday_factor','Segunda a sexta'],
  ['saturday_factor','Sábado'],
  ['sunday_factor','Domingo'],
  ['holiday_factor','Feriado']
 ] as const
 return <section className="panel">
  <div className="panel-heading"><h2><CalendarClock size={18}/> Regras do Banco de Horas</h2>
   <button type="button" className="secondary" onClick={()=>void refresh().catch(e=>setError(String(e)))}
    disabled={loading||busy}><RefreshCw size={16}/> Atualizar</button>
  </div>
  <p className="subtle">Cada usuário pode ter regras distintas e versões com vigência própria. Alterações em períodos já utilizados são bloqueadas para preservar o saldo histórico.</p>
  <div className="form">
   <label>Usuário a quem a política se aplica
    <PayrepSelect value={userId} onChange={value=>{setUserId(value);setDraft(blank(value));setError('');setMessage('')}}
     title="Selecionar usuário" disabled={loading||busy}>
     <option value="">Selecione um usuário</option>
     {users.map(user=><option key={user.id} value={user.id}>{user.displayName||user.email||user.id}{user.email?' · '+user.email:''}</option>)}
    </PayrepSelect>
   </label>
   {userId&&<>
    <div className="time-bank-policy-list">
     <strong>Políticas cadastradas ({filtered.length})</strong>
     {filtered.length===0&&<p className="subtle">Nenhuma vigência cadastrada para este usuário.</p>}
     {filtered.map(p=><button type="button" key={p.id} className="secondary"
      onClick={()=>{setDraft(fromPolicy(p));setError('');setMessage('')}}
      disabled={busy}>{p.title} · {dateBR(p.valid_from)} a {dateBR(p.valid_until)}</button>)}
    </div>
    <div className="admin-settings-actions">
     <button type="button" className="secondary" disabled={busy} onClick={()=>patch(blank(userId))}>Nova vigência</button>
     <button type="button" className="secondary" disabled={busy} onClick={()=>patch(accentureTemplate(userId))}>Usar modelo Accenture 2025/2026</button>
    </div>
    <div className="form-grid">
     <label>Nome da política<input type="text" maxLength={140} value={draft.title}
      onChange={e=>patch({title:e.target.value})} placeholder="ACT / empresa / versão"/></label>
     <label>Referência do acordo<input type="text" maxLength={350} value={draft.source_reference}
      onChange={e=>patch({source_reference:e.target.value})} placeholder="Registro MTE, cláusula"/></label>
     <label>Início da vigência<PayrepDatePicker value={draft.valid_from}
      onChange={date=>patch({valid_from:date})} title="Início da vigência"/></label>
     <label>Fim da vigência<PayrepDatePicker value={draft.valid_until}
      onChange={date=>patch({valid_until:date})} title="Fim da vigência"/></label>
    </div>
    <div className="time-bank-policy-factors">
     {fields.map(([key,label])=><label key={key}>{label} · multiplicador de crédito
      <input type="number" min={0.25} max={4} step={0.25} value={draft[key]}
       onChange={e=>patch({[key]:e.target.value})}/>
     </label>)}
    </div>
    <div className="form-grid">
     <label>Jornada de referência (minutos)
      <input type="number" min={60} max={720} step={30} value={draft.daily_target_minutes}
       onChange={e=>patch({daily_target_minutes:e.target.value})}/></label>
     <label>Prazo de compensação (meses)
      <input type="number" min={1} max={12} step={1} value={draft.settlement_interval_months}
       onChange={e=>patch({settlement_interval_months:e.target.value})}/></label>
     <label>Meses previstos para liquidação (1 a 12)
      <input type="text" value={draft.settlement_months} placeholder="2,8"
       onChange={e=>patch({settlement_months:e.target.value})}/></label>
     <label>Quinzena prevista para liquidação
      <PayrepSelect value={draft.settlement_half}
       onChange={value=>patch({settlement_half:value})} title="Quinzena de liquidação">
       <option value="1">Primeira quinzena</option>
       <option value="2">Segunda quinzena</option>
      </PayrepSelect></label>
    </div>
    <p className="subtle">Crédito de domingo/feriado usa o multiplicador selecionado. Débitos por jornada incompleta continuam na proporção de 1:1. Os meses e o prazo de liquidação são registrados como referência: a liquidação/pagamento automático ainda não está implementado.</p>
    <div className="admin-settings-actions">
     <button type="button" className="primary" disabled={busy} onClick={()=>void save()}>
      <Save size={16}/> {busy?'Salvando...':draft.id?'Salvar alterações':'Cadastrar política'}
     </button>
     {message&&<span className="auth-success" role="status">{message}</span>}
     {error&&<span className="error" role="alert">{error}</span>}
    </div>
   </>}
  </div>
 </section>
}
