import {useCallback,useEffect,useState} from 'react'
import {Fingerprint,KeyRound,Plus,Pencil,Trash2,RefreshCw,ShieldCheck} from 'lucide-react'
import {db} from '../lib/data'
import {passkeyErrorMessage,supportsWebAuthn} from '../lib/passkey'
import {forgetRememberedCredential,registerDevicePasskey} from '../lib/devicePasskeys'

type RegisteredPasskey={
 id:string
 friendly_name?:string|null
 created_at:string
 last_used_at?:string|null
}
function dateLabel(value:string|null|undefined):string{
 if(!value)return 'Nunca utilizada'
 const date=new Date(value)
 return Number.isNaN(date.getTime())?'Data indisponível':date.toLocaleDateString('pt-BR')
}

export function PasskeySettings(){
 const [items,setItems]=useState<RegisteredPasskey[]>([])
 const [loading,setLoading]=useState(true)
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const [message,setMessage]=useState('')
 const [unavailable,setUnavailable]=useState(false)
 const [editing,setEditing]=useState<string|null>(null)
 const [label,setLabel]=useState('')
 const [confirmDelete,setConfirmDelete]=useState<string|null>(null)
 const browserSupported=supportsWebAuthn()

 const load=useCallback(async()=>{
  if(!db)throw Error('Autenticação indisponível.')
  const {data,error}=await db.auth.passkey.list()
  if(error)throw error
  setItems((data||[]) as RegisteredPasskey[])
  setUnavailable(false)
 },[])

 const refresh=async()=>{
  setLoading(true);setError('')
  try{await load()}
  catch(e){
   const text=passkeyErrorMessage(e)
   setUnavailable(text.includes('Supabase ainda não habilitou passkeys'))
   setError(text)
  }
  finally{setLoading(false)}
 }
 useEffect(()=>{
  void refresh()
 },[load])

 const add=async()=>{
  if(!db||!browserSupported||busy||unavailable)return
  setBusy(true);setError('');setMessage('')
  try{
   await registerDevicePasskey()
   await load()
   setMessage('Chave de acesso cadastrada. Agora você pode usá-la para entrar no Payrep HML.')
  }catch(e){
   const text=passkeyErrorMessage(e)
   if(text.includes('Supabase ainda não habilitou passkeys'))setUnavailable(true)
   setError(text)
  }finally{setBusy(false)}
 }

 const saveName=async(id:string)=>{
  if(!db||busy)return
  const name=label.trim().replace(/\s+/g,' ')
  if(!name||name.length>120){setError('Informe um nome de até 120 caracteres.');return}
  setBusy(true);setError('');setMessage('')
  try{
   const {error}=await db.auth.passkey.update({passkeyId:id,friendlyName:name})
   if(error)throw error
   await load();setEditing(null);setLabel('')
   setMessage('Nome da chave de acesso atualizado.')
  }catch(e){setError(passkeyErrorMessage(e))}
  finally{setBusy(false)}
 }

 const remove=async(id:string)=>{
  if(!db||busy)return
  setBusy(true);setError('');setMessage('')
  try{
   const {error}=await db.auth.passkey.delete({passkeyId:id})
   if(error)throw error
   forgetRememberedCredential()
   await load();setConfirmDelete(null)
   setMessage('Chave de acesso removida. As demais opções de login permanecem disponíveis.')
  }catch(e){setError(passkeyErrorMessage(e))}
  finally{setBusy(false)}
 }

 return <div className="passkey-settings">
  <p className="subtle">Use a impressão digital, reconhecimento facial ou PIN do aparelho para entrar sem digitar a senha. A chave privada permanece protegida pelo dispositivo ou gerenciador de senhas.</p>
  {!browserSupported&&<div className="notice warning" role="status">Este navegador não oferece WebAuthn em uma conexão segura. Abra o Payrep em um navegador compatível usando HTTPS.</div>}
  <div className="passkey-actions">
   <button type="button" className="secondary" disabled={busy||loading||unavailable||!browserSupported} onClick={()=>void add()}><Plus size={16}/>{busy?'Aguarde...':'Cadastrar chave de acesso'}</button>
   <button type="button" className="secondary" disabled={busy||loading} onClick={()=>void refresh()} aria-label="Atualizar chaves cadastradas"><RefreshCw size={16}/>Atualizar</button>
  </div>
  {loading?<p className="subtle">Consultando chaves de acesso...</p>:
   items.length===0?<p className="subtle">Nenhuma chave de acesso cadastrada nesta conta.</p>:
   <div className="passkey-list">
    {items.map(item=><div className="passkey-item" key={item.id}>
     <div className="passkey-item-header"><KeyRound size={18}/><div><strong>{item.friendly_name||'Chave de acesso'}</strong><small>Criada em {dateLabel(item.created_at)} · Último uso: {dateLabel(item.last_used_at)}</small></div></div>
     {editing===item.id?<form className="passkey-rename" onSubmit={e=>{e.preventDefault();void saveName(item.id)}}>
      <label>Nome da chave de acesso<input required maxLength={120} value={label} onChange={e=>setLabel(e.target.value)} autoFocus/></label>
      <div className="passkey-item-actions"><button className="primary" type="submit" disabled={busy||!label.trim()}>Salvar</button><button className="secondary" type="button" disabled={busy} onClick={()=>setEditing(null)}>Cancelar</button></div>
     </form>:confirmDelete===item.id?<div className="passkey-confirm">
      <p>Remover esta chave de acesso? Ela deixará de funcionar para entrar no Payrep.</p>
      <div className="passkey-item-actions"><button className="secondary" type="button" disabled={busy} onClick={()=>setConfirmDelete(null)}>Cancelar</button><button className="secondary profile-destructive" type="button" disabled={busy} onClick={()=>void remove(item.id)}>Confirmar remoção</button></div>
     </div>:<div className="passkey-item-actions">
      <button type="button" className="secondary" disabled={busy} onClick={()=>{setEditing(item.id);setLabel(item.friendly_name||'');setConfirmDelete(null)}}><Pencil size={15}/>Renomear</button>
      <button type="button" className="secondary" disabled={busy} onClick={()=>{setConfirmDelete(item.id);setEditing(null)}}><Trash2 size={15}/>Remover</button>
     </div>}
    </div>)}
   </div>}
  {message&&<div className="notice success" role="status"><ShieldCheck size={16}/>{message}<button type="button" onClick={()=>setMessage('')}>Fechar</button></div>}
  {error&&<div className="notice danger" role="alert">{error}<button type="button" onClick={()=>setError('')}>Fechar</button></div>}
  <p className="passkey-footnote"><Fingerprint size={16}/>A chave de acesso não substitui a verificação TOTP exigida para contas que possuem 2FA. Guarde seu autenticador de reserva.</p>
 </div>
}
