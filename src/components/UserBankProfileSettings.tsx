import {useEffect,useState} from 'react'
import {CalendarClock,Save} from 'lucide-react'
import {db} from '../lib/data'
import {todayInSaoPaulo} from '../lib/fortnight'
import {PayrepSelect} from './PayrepSelect'

type BankProfile={
 id:string;name:string;description:string;source_note:string;
 valid_from:string;valid_until:string;weekday_factor:number;saturday_factor:number;
 sunday_factor:number;holiday_factor:number;daily_target_minutes:number;
 active:boolean;verified:boolean;is_default:boolean
}
export function UserBankProfileSettings({onChanged}:{onChanged:()=>Promise<void>}){
 const [profiles,setProfiles]=useState<BankProfile[]>([])
 const [selected,setSelected]=useState('')
 const [saved,setSaved]=useState('')
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const [message,setMessage]=useState('')
 const [showRequest,setShowRequest]=useState(false)
 const [company,setCompany]=useState('')
 const [uf,setUf]=useState('SP')
 const [notes,setNotes]=useState('')
 useEffect(()=>{
  let alive=true
  async function load(){
   if(!db)throw Error('Banco indisponível.')
   const {data:auth,error:authError}=await db.auth.getUser()
   if(authError||!auth.user)throw Error('Faça login para consultar sua política.')
   const [p,u]=await Promise.all([
    db.from('bank_policy_profiles').select('*').eq('active',true).order('is_default',{ascending:false}).order('name'),
    db.from('user_bank_profile_selections').select('profile_id').eq('user_id',auth.user.id).maybeSingle()
   ])
   if(p.error||u.error)throw Error(p.error?.message||u.error?.message||'Falha ao consultar perfis.')
   if(!alive)return
   const found=(p.data||[]) as BankProfile[]
   setProfiles(found)
   const current=u.data?.profile_id||found.find(x=>x.is_default)?.id||''
   setSaved(current);setSelected(current)
  }
  void load().catch(e=>{if(alive)setError(e instanceof Error?e.message:'Falha ao carregar.')})
  return ()=>{alive=false}
 },[])
 const now=todayInSaoPaulo()
 const available=profiles.filter(p=>p.valid_from<=now&&p.valid_until>=now)
 const current=profiles.find(p=>p.id===selected)
 const save=async()=>{
  if(!db||busy||!selected)return
  setBusy(true);setMessage('');setError('')
  try{
   const {error}=await db.rpc('select_my_bank_profile',{p_profile_id:selected})
   if(error)throw Error(error.message)
   await onChanged()
   setSaved(selected)
   setMessage('Política atualizada. Os lançamentos já salvos não foram recalculados.')
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível salvar.')}
  finally{setBusy(false)}
 }
 const request=async()=>{
  if(!db||busy)return
  setError('');setMessage('');setBusy(true)
  try{
   if(company.trim().length<2||!/^[A-Z]{2}$/.test(uf))throw Error('Informe nome da empresa e UF.')
   const {data}=await db.auth.getUser()
   if(!data.user)throw Error('Sessão expirada.')
   const {error}=await db.from('collective_company_requests').insert({
    user_id:data.user.id,organization:company.trim(),uf,notes:notes.trim()||null
   })
   if(error)throw Error(error.message)
   setCompany('');setNotes('');setShowRequest(false)
   setMessage('Solicitação enviada à administração.')
  }catch(e){setError(e instanceof Error?e.message:'Erro ao solicitar empresa.')}
  finally{setBusy(false)}
 }
 return <section className="panel user-bank-profile-settings">
  <div className="panel-heading"><h2><CalendarClock size={18}/> Política do Banco de Horas</h2></div>
  <p className="subtle">Todo usuário começa com a política Genérica. Selecione uma política disponível para sua empresa e sua localidade quando houver uma versão válida.</p>
  <div className="form">
   <label>Política selecionada
    <PayrepSelect value={selected} onChange={value=>{setSelected(value);setMessage('');setError('')}}
     title="Política do Banco de Horas">
     <option value="">Selecione um perfil</option>
     {available.map(p=><option key={p.id} value={p.id}>{p.name}{p.is_default?' (padrão)':''}</option>)}
    </PayrepSelect>
   </label>
   {current&&<div className="user-bank-profile-preview">
    <strong>{current.name}</strong>
    <p className="subtle">{current.description}</p>
    <div className="user-bank-profile-factors">
     <span>Segunda a sexta: <strong>{current.weekday_factor}:1</strong></span>
     <span>Sábado: <strong>{current.saturday_factor}:1</strong></span>
     <span>Domingo: <strong>{current.sunday_factor}:1</strong></span>
     <span>Feriado: <strong>{current.holiday_factor}:1</strong></span>
    </div>
    <small className="subtle">Jornada de referência: {current.daily_target_minutes/60} h · Vigência: {current.valid_from} a {current.valid_until}</small>
    {!current.verified&&<p className="subtle">Perfil configurável, sem validação de aplicabilidade jurídica. Confira as regras de sua empresa antes de utilizar.</p>}
   </div>}
   <div className="admin-settings-actions">
    <button type="button" className="primary" disabled={!selected||selected===saved||busy} onClick={()=>void save()}>
     <Save size={16}/>{busy?'Salvando...':'Salvar política'}
    </button>
    <button type="button" className="secondary" onClick={()=>setShowRequest(x=>!x)}>
     {showRequest?'Cancelar solicitação':'Não encontrei minha empresa'}
    </button>
   </div>
   {showRequest&&<div className="collective-request-form">
    <div className="form-grid">
     <label>Empresa<input value={company} onChange={e=>setCompany(e.target.value)}/></label>
     <label>UF<input maxLength={2} value={uf} onChange={e=>setUf(e.target.value.toUpperCase())}/></label>
    </div>
    <label>Detalhes opcionais<textarea value={notes} onChange={e=>setNotes(e.target.value)}
     placeholder="Localidade, categoria ou número do ACT/CCT" rows={2}/></label>
    <button type="button" className="primary" disabled={busy} onClick={()=>void request()}>Solicitar cadastro</button>
   </div>}
   {message&&<p role="status" className="auth-success">{message}</p>}
   {error&&<p role="alert" className="error">{error}</p>}
  </div>
 </section>
}
