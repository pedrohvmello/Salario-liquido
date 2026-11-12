import {useCallback,useEffect,useState} from 'react'
import {ShieldCheck,Info,Trash2,Plus,Pencil} from 'lucide-react'
import {db} from '../lib/data'
import {cleanMfaLabel,displayMfaLabel,mfaLabelMetadataKey,readMfaLabels} from '../lib/mfaLabels'
import {AuthenticatorAppPicker} from './AuthenticatorAppPicker'

type TotpFactor={id:string;name:string}
type IncompleteFactor={id:string;name:string}
type Enrollment={id:string;qr:string;secret:string}
const digits=(value:string)=>value.replace(/\D/g,'').slice(0,6)

export function TotpSettings({onActivated}:{onActivated?:()=>void}={}){
 const [factors,setFactors]=useState<TotpFactor[]>([])
 const [pending,setPending]=useState<Enrollment|null>(null)
 const [incomplete,setIncomplete]=useState<IncompleteFactor[]>([])
 const [resumingId,setResumingId]=useState<string|null>(null)
 const [code,setCode]=useState('')
 const [busy,setBusy]=useState(false)
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')
 const [message,setMessage]=useState('')
 const [removal,setRemoval]=useState<string|null>(null)
 const [renameId,setRenameId]=useState<string|null>(null)
 const [renameValue,setRenameValue]=useState('')
 const [newProvider,setNewProvider]=useState('')
 const [otherName,setOtherName]=useState('')
 const load=useCallback(async()=>{
  if(!db)return
  const [factorResult,userResult]=await Promise.all([db.auth.mfa.listFactors(),db.auth.getUser()])
  if(factorResult.error)throw factorResult.error
  if(userResult.error||!userResult.data.user)throw userResult.error||Error('Sessão expirada. Faça login novamente.')
  const metadata=userResult.data.user.user_metadata
  setFactors(factorResult.data.totp.filter(x=>x.status==='verified').map((x,i)=>({
   id:x.id,name:displayMfaLabel(x.id,x.friendly_name||'Autenticador '+(i+1),metadata)
  })))
  setIncomplete(factorResult.data.all.filter(x=>x.factor_type==='totp'&&x.status==='unverified').map((x,i)=>({id:x.id,name:x.friendly_name||'Configuração pendente '+(i+1)})))
 },[])
 useEffect(()=>{
  let active=true
  void load().catch(e=>{if(active)setError(e instanceof Error?e.message:'Não foi possível carregar os autenticadores.')})
   .finally(()=>{if(active)setLoading(false)})
  return ()=>{active=false}
 },[load])
 const start=async()=>{
  if(!db)return
  setBusy(true);setError('');setMessage('')
  try{
   const label=cleanMfaLabel(newProvider==='Outro'?otherName:newProvider)
   const {data,error}=await db.auth.mfa.enroll({factorType:'totp',friendlyName:label})
   if(error)throw error
   if(!data.totp?.qr_code||!data.totp?.secret)throw Error('O Supabase não retornou o QR Code.')
   setPending({id:data.id,qr:data.totp.qr_code,secret:data.totp.secret})
   setResumingId(null)
   setCode('')
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível iniciar a configuração.')}
  finally{setBusy(false)}
 }
 const verify=async()=>{
  const factorId=pending?.id||resumingId
  if(!db||!factorId||code.length!==6)return
  setBusy(true);setError('');setMessage('')
  try{
   const {error}=await db.auth.mfa.challengeAndVerify({factorId,code})
   if(error)throw error
   const {data:level,error:levelError}=await db.auth.mfa.getAuthenticatorAssuranceLevel()
   if(levelError||level?.currentLevel!=='aal2')throw Error('A verificação não elevou a sessão para AAL2.')
   setPending(null);setResumingId(null);setCode('')
   await load()
   setMessage('Autenticador ativado e sessão verificada em dois fatores.')
   onActivated?.()
  }catch(e){setError(e instanceof Error?e.message:'Código inválido ou expirado. Tente novamente.')}
  finally{setBusy(false)}
 }
 const cancel=async()=>{
  if(!db||!pending)return
  setBusy(true);setError('');setMessage('')
  try{
   const {error}=await db.auth.mfa.unenroll({factorId:pending.id})
   if(error)throw error
   setPending(null);setCode('')
   await load()
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível cancelar. Tente novamente.')}
  finally{setBusy(false)}
 }
 const discardIncomplete=async(id:string)=>{
  if(!db||!incomplete.some(f=>f.id===id))return
  setBusy(true);setError('');setMessage('')
  try{
   const {error}=await db.auth.mfa.unenroll({factorId:id})
   if(error)throw error
   if(resumingId===id){setResumingId(null);setCode('')}
   await load()
   setMessage('Configuração incompleta descartada. Inicie uma nova ativação e substitua a entrada anterior no seu aplicativo autenticador.')
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível descartar a configuração incompleta.')}
  finally{setBusy(false)}
 }
 const rename=async(id:string)=>{
  if(!db)return
  setBusy(true);setError('');setMessage('')
  try{
   const name=cleanMfaLabel(renameValue)
   const {data:{user},error:userError}=await db.auth.getUser()
   if(userError||!user)throw userError||Error('Sessão expirada. Faça login novamente.')
   const current=readMfaLabels(user.user_metadata)
   const {error}=await db.auth.updateUser({data:{[mfaLabelMetadataKey]:{...current,[id]:name}}})
   if(error)throw error
   await load()
   setRenameId(null);setRenameValue('')
   setMessage('Nome atualizado para '+name+'. O código de autenticação não foi alterado.')
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível atualizar o nome do autenticador.')}
  finally{setBusy(false)}
 }
 const remove=async(id:string)=>{
  if(!db)return
  setBusy(true);setError('');setMessage('')
  try{
   const {data:assurance,error:assuranceError}=await db.auth.mfa.getAuthenticatorAssuranceLevel()
   if(assuranceError||assurance?.currentLevel!=='aal2')throw Error('Confirme o segundo fator antes de remover um autenticador.')
   const {error}=await db.auth.mfa.unenroll({factorId:id})
   if(error)throw error
   setRemoval(null);await load()
   await db.auth.refreshSession()
   setMessage('Autenticador removido.')
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível remover o autenticador.')}
  finally{setBusy(false)}
 }
 const qrData=pending?.qr.startsWith('data:image/')?pending.qr:'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(pending?.qr||'')
 return <div className="totp-settings">
  {loading&&<p className="subtle">Carregando autenticadores...</p>}
  {!loading&&<div className="totp-factors">
   <p className="subtle">{factors.length===0?'Nenhum autenticador ativo.':'Autenticadores ativos: '+factors.length}</p>
   {factors.map((f,i)=><div key={f.id} className="totp-factor-row">
    <div><ShieldCheck size={17}/><span>{f.name}</span>{i===0&&<small>Principal</small>}</div>
    {renameId===f.id
     ?<form className="totp-enrollment" onSubmit={e=>{e.preventDefault();void rename(f.id)}}>
       <label>Nome do aplicativo autenticador<input type="text" required maxLength={60} value={renameValue} onChange={e=>setRenameValue(e.target.value)} placeholder="Microsoft Authenticator" autoFocus/></label>
       <div className="totp-factor-actions"><button className="primary" type="submit" disabled={busy||!renameValue.trim()}>Salvar nome</button><button type="button" className="secondary" disabled={busy} onClick={()=>{setRenameId(null);setRenameValue('')}}>Cancelar</button></div>
      </form>
     :removal===f.id
      ?<div className="totp-factor-actions"><span>Remover este fator?</span><button type="button" className="secondary" disabled={busy} onClick={()=>setRemoval(null)}>Cancelar</button><button type="button" className="secondary profile-destructive" disabled={busy} onClick={()=>void remove(f.id)}>Confirmar remoção</button></div>
      :<div className="totp-factor-actions"><button type="button" className="secondary" disabled={busy||Boolean(pending)} onClick={()=>{setRenameId(f.id);setRenameValue(f.name);setRemoval(null);setError('')}}><Pencil size={15}/> Renomear</button><button type="button" className="secondary" disabled={busy||Boolean(pending)} onClick={()=>{setRemoval(f.id);setRenameId(null)}}><Trash2 size={15}/> Remover</button></div>}
   </div>)}
   {!pending&&incomplete.length===0&&factors.length<10&&<div className="totp-enrollment">
    <AuthenticatorAppPicker value={newProvider} onChange={name=>{setNewProvider(name);setOtherName('')}}/>
    {newProvider==='Outro'&&<label>Nome do aplicativo<input type="text" maxLength={60} value={otherName} onChange={e=>setOtherName(e.target.value)} placeholder="Nome do autenticador"/></label>}
    <button type="button" className="secondary" disabled={busy||!((newProvider==='Outro'?otherName:newProvider).trim())} onClick={()=>void start()}><Plus size={16}/>{factors.length?'Adicionar autenticador de reserva':'Ativar autenticador (TOTP)'}</button>
   </div>}
  </div>}
  {!pending&&incomplete.length>0&&<div className="totp-enrollment">
   <strong>Configuração de 2FA não concluída</strong>
   <p className="subtle">Uma chave foi gerada anteriormente, mas ainda não foi confirmada. Se ela está no seu aplicativo autenticador, use o código atual para concluir a ativação. A chave original não é exibida novamente por segurança.</p>
   {incomplete.map(f=><div className="totp-factor-row" key={f.id}>
    <div><ShieldCheck size={17}/><span>{f.name}</span><small>Pendente</small></div>
    {resumingId===f.id
     ?<form onSubmit={e=>{e.preventDefault();void verify()}}>
       <label>Código de 6 dígitos<input type="text" required autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e=>setCode(digits(e.target.value))} placeholder="000000"/></label>
       <div className="totp-enrollment-buttons"><button type="submit" className="primary" disabled={busy||code.length!==6}>Confirmar código e ativar</button><button type="button" className="secondary" disabled={busy} onClick={()=>{setResumingId(null);setCode('');setError('')}}>Voltar</button></div>
      </form>
     :<div className="totp-factor-actions"><button type="button" className="secondary" disabled={busy} onClick={()=>{setResumingId(f.id);setCode('');setError('')}}>Concluir ativação</button><button type="button" className="secondary" disabled={busy} onClick={()=>void discardIncomplete(f.id)}>Descartar e recomeçar</button></div>}
   </div>)}
  </div>}
  {pending&&<div className="totp-enrollment">
   <strong>Configurar autenticador</strong>
   <p className="subtle">1. Abra seu aplicativo autenticador e escaneie o QR Code abaixo. Não compartilhe o QR Code nem a chave.</p>
   <img className="totp-qr" src={qrData} alt="QR Code privado para configurar seu autenticador" width={205} height={205}/>
   <details><summary>Não consigo escanear o QR Code</summary><p className="subtle">Digite a chave manualmente no autenticador:</p><code className="totp-secret">{pending.secret}</code></details>
   <form onSubmit={e=>{e.preventDefault();void verify()}}>
    <label>2. Informe o código de 6 dígitos<input type="text" required autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e=>setCode(digits(e.target.value))} placeholder="000000"/></label>
    <div className="totp-enrollment-buttons"><button type="submit" className="primary" disabled={busy||code.length!==6}>Confirmar código e ativar</button><button type="button" className="secondary" disabled={busy} onClick={()=>void cancel()}>Cancelar</button></div>
   </form>
  </div>}
  {factors.length===1&&<div className="detail-hint"><Info size={16}/>Recomendamos cadastrar um segundo autenticador em outro aparelho. O Supabase não oferece códigos de recuperação.</div>}
  {message&&<p className="auth-success" role="status">{message}</p>}
  {error&&<p role="alert" className="error">{error}</p>}
 </div>
}
