import {useEffect,useState} from 'react'
import {Bell,Building2,RefreshCw} from 'lucide-react'
import {db} from '../lib/data'

type Profile={id:string;organization:string;uf:string;name:string}
type Version={id:string;profile_id:string;valid_from:string;valid_until:string;version:number}
type Notification={id:string;message:string;read_at:string|null;created_at:string}
const format=(iso:string)=>iso.slice(8,10)+'/'+iso.slice(5,7)+'/'+iso.slice(0,4)
export function CollectiveProfileExplorer({onAssigned}:{onAssigned?:()=>Promise<void>}){
 const [profiles,setProfiles]=useState<Profile[]>([])
 const [versions,setVersions]=useState<Version[]>([])
 const [followed,setFollowed]=useState<string[]>([])
 const [notices,setNotices]=useState<Notification[]>([])
 const [userId,setUserId]=useState('')
 const [open,setOpen]=useState(false)
 const [org,setOrg]=useState('')
 const [uf,setUf]=useState('SP')
 const [notes,setNotes]=useState('')
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const [message,setMessage]=useState('')
 const refresh=async()=>{
  if(!db)return
  const {data:user,error:e}=await db.auth.getUser()
  if(e||!user.user)return
  setUserId(user.user.id)
  const r=await Promise.all([
   db.from('collective_profiles').select('id,name,organization,uf'),
   db.from('collective_profile_versions').select('id,profile_id,valid_from,valid_until,version'),
   db.from('collective_profile_followers').select('profile_id').eq('user_id',user.user.id),
   db.from('collective_profile_notifications').select('id,message,read_at,created_at')
    .eq('user_id',user.user.id).order('created_at',{ascending:false}).limit(20)
  ])
  for(const item of r)if(item.error)throw Error(item.error.message)
  setProfiles((r[0].data||[]) as Profile[])
  setVersions((r[1].data||[]) as Version[])
  setFollowed((r[2].data||[]).map(x=>x.profile_id))
  setNotices((r[3].data||[]) as Notification[])
 }
 useEffect(()=>{void refresh().catch(e=>setError(String(e)))},[])
 const run=async(action:()=>Promise<void>,success:string)=>{
  setBusy(true);setError('');setMessage('')
  try{await action();await refresh();setMessage(success)}
  catch(e){setError(e instanceof Error?e.message:'Não foi possível concluir.')}
  finally{setBusy(false)}
 }
 const toggle=(id:string)=>run(async()=>{
  if(!db||!userId)throw Error('Faça login.')
  if(followed.includes(id)){
   const {error}=await db.from('collective_profile_followers').delete()
    .eq('user_id',userId).eq('profile_id',id)
   if(error)throw Error(error.message)
  }else{
   const {error}=await db.from('collective_profile_followers').insert({user_id:userId,profile_id:id})
   if(error)throw Error(error.message)
  }
 },'Preferência de acompanhamento atualizada. O perfil não foi atribuído ao seu Banco de Horas.')
 const request=()=>run(async()=>{
  if(!db||!userId)throw Error('Faça login.')
  if(org.trim().length<2||!uf.match(/^[A-Z]{2}$/))throw Error('Informe empresa e UF.')
  const {error}=await db.from('collective_company_requests').insert({
   user_id:userId,organization:org.trim(),uf,notes:notes.trim()||null
  })
  if(error)throw Error(error.message)
  setOrg('');setNotes('');setOpen(false)
 },'Solicitação enviada à administração.')
 const markRead=()=>run(async()=>{
  if(!db||!userId)throw Error('Faça login.')
  const unread=notices.filter(n=>!n.read_at).map(n=>n.id)
  if(!unread.length)return
  const {error}=await db.from('collective_profile_notifications').update({
   read_at:new Date().toISOString()
  }).eq('user_id',userId).in('id',unread)
  if(error)throw Error(error.message)
 },'Notificações marcadas como lidas.')
 return <section className="panel">
  <div className="panel-heading"><h2><Building2 size={17}/> Perfis de Banco de Horas</h2>
   <button type="button" className="secondary" onClick={()=>void refresh().catch(e=>setError(String(e)))}>
    <RefreshCw size={15}/> Atualizar</button>
  </div>
  <p className="subtle">Consulte perfis verificados e acompanhe novas versões. Seguir um perfil não altera seu Banco de Horas atual nem aplica regras automaticamente.</p>
  {profiles.length===0?<p className="subtle">Ainda não existem perfis verificados publicados na biblioteca.</p>:
   <div className="collective-profile-list">{profiles.map(profile=>{
    const v=versions.filter(v=>v.profile_id===profile.id).sort((a,b)=>b.valid_from.localeCompare(a.valid_from))[0]
    return <div key={profile.id} className="collective-profile-item">
     <div><strong>{profile.name}</strong><p className="subtle">{profile.organization} · {profile.uf}
      {v?' · Vigência '+format(v.valid_from)+' a '+format(v.valid_until):''}</p></div>
     <div className="collective-profile-actions">
      <button type="button" className="secondary" disabled={busy} onClick={()=>void toggle(profile.id)}>
       {followed.includes(profile.id)?'Deixar de acompanhar':'Acompanhar atualizações'}
      </button>
      {v&&<button type="button" className="primary" disabled={busy||v.valid_until<new Date().toISOString().slice(0,10)}
       title={v.valid_until<new Date().toISOString().slice(0,10)?'Versão vencida: não pode ser atribuída como política atual.':'Verifique a aplicabilidade à sua categoria antes de atribuir.'}
       onClick={()=>void run(async()=>{
        if(!db)throw Error('Supabase não configurado')
        const {error}=await db.rpc('assign_my_collective_profile_version',{p_version_id:v.id})
        if(error)throw Error(error.message)
        if(onAssigned)await onAssigned()
       },'Perfil atribuído ao seu Banco de Horas. Vigência e fatores registrados no Supabase.')}>
       Usar este perfil
      </button>}
     </div>
    </div>
   })}</div>}
  {notices.some(n=>!n.read_at)&&<div className="collective-alerts">
   <div className="panel-heading"><h3><Bell size={17}/> Novas versões</h3>
    <button type="button" className="text-button" disabled={busy} onClick={()=>void markRead()}>Marcar como lidas</button></div>
   {notices.filter(n=>!n.read_at).map(n=><p key={n.id} className="subtle">{n.message} · {new Date(n.created_at).toLocaleDateString('pt-BR')}</p>)}
  </div>}
  <button className="secondary" type="button" onClick={()=>setOpen(x=>!x)}>
   {open?'Fechar solicitação':'Solicitar cadastro de empresa'}
  </button>
  {open&&<div className="collective-request-form">
   <div className="form-grid">
    <label>Empresa<input value={org} onChange={e=>setOrg(e.target.value)}/></label>
    <label>UF<input maxLength={2} value={uf} onChange={e=>setUf(e.target.value.toUpperCase())}/></label>
   </div>
   <label>Informações adicionais (opcional)<textarea rows={2} value={notes} onChange={e=>setNotes(e.target.value)}
    placeholder="Categoria, localidade e referência do ACT/CCT se souber"/></label>
   <button type="button" className="primary" disabled={busy} onClick={()=>void request()}>Enviar solicitação</button>
  </div>}
  {message&&<p className="auth-success" role="status">{message}</p>}
  {error&&<p className="error" role="alert">{error}</p>}
 </section>
}
