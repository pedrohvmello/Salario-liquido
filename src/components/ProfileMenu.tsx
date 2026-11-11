import {useEffect,useRef,useState} from 'react'
import type {User} from '@supabase/supabase-js'
import {Camera,Check,LogOut,Trash2,X,UserRound,CreditCard} from 'lucide-react'
import {db} from '../lib/data'
import {accountInitials,canConfirmDeletion} from '../lib/profile'
import {PhotoCropDialog} from './PhotoCropDialog'

const BUCKET='profile-avatars'
const MAX_SOURCE=5*1024*1024
const accepted=new Set(['image/jpeg','image/png','image/webp'])

export function ProfileMenu({user,onNavigate}:{user:User|null;onNavigate:(view:'profile'|'subscription')=>void}){
 const [open,setOpen]=useState(false)
 const [avatar,setAvatar]=useState<string|null>(null)
 const [avatarVersion,setAvatarVersion]=useState(0)
 const [cropFile,setCropFile]=useState<File|null>(null)
 const [busy,setBusy]=useState(false)
 const [message,setMessage]=useState('')
 const [error,setError]=useState('')
 const [confirmDelete,setConfirmDelete]=useState(false)
 const [deleteText,setDeleteText]=useState('')
 const [acknowledged,setAcknowledged]=useState(false)
 const root=useRef<HTMLDivElement>(null)
 const uploadInput=useRef<HTMLInputElement>(null)
 const initial=accountInitials(user)
 useEffect(()=>{
  if(!user||!db)return
  let mounted=true,objectUrl:string|null=null
  setAvatar(null)
  void db.storage.from(BUCKET).download(user.id+'/avatar.webp').then(({data,error:downloadError})=>{
   if(!downloadError&&data){
    objectUrl=URL.createObjectURL(data)
    if(mounted)setAvatar(objectUrl)
    else URL.revokeObjectURL(objectUrl)
   }
  }).catch(()=>{})
  return ()=>{mounted=false;if(objectUrl)URL.revokeObjectURL(objectUrl)}
 },[user?.id,avatarVersion])
 useEffect(()=>{
  if(!open)return
  const closeOutside=(event:PointerEvent)=>{if(root.current&&!root.current.contains(event.target as Node))setOpen(false)}
  const closeEscape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!cropFile){setConfirmDelete(false);setOpen(false)}}
  document.addEventListener('pointerdown',closeOutside)
  document.addEventListener('keydown',closeEscape)
  return ()=>{document.removeEventListener('pointerdown',closeOutside);document.removeEventListener('keydown',closeEscape)}
 },[open,cropFile])
 const perform=async(action:()=>Promise<void>,success?:string)=>{
  setBusy(true);setError('');setMessage('')
  try{await action();if(success)setMessage(success)}
  catch(e){setError(e instanceof Error?e.message:'Não foi possível completar a operação.')}
  finally{setBusy(false)}
 }
 const choosePhoto=(file?:File)=>{
  if(!file)return
  setError('');setMessage('')
  if(!accepted.has(file.type)){setError('Escolha uma imagem JPG, PNG ou WebP.');return}
  if(file.size>MAX_SOURCE){setError('A imagem deve ter até 5 MB.');return}
  setCropFile(file)
 }
 const savePhoto=async(photo:Blob)=>{
  if(!db||!user)throw Error('Faça login para alterar a imagem.')
  setBusy(true);setError('');setMessage('')
  try{
   const {error:storageError}=await db.storage.from(BUCKET).upload(user.id+'/avatar.webp',photo,{upsert:true,contentType:'image/webp',cacheControl:'60'})
   if(storageError)throw storageError
   setAvatarVersion(v=>v+1)
   setMessage('Foto atualizada.')
   setCropFile(null)
  }catch(err){
   throw err instanceof Error?err:Error('Não foi possível salvar a foto.')
  }finally{setBusy(false)}
 }

 const removePhoto=()=>perform(async()=>{
  if(!db||!user)throw Error('Faça login para remover a imagem.')
  const {error:storageError}=await db.storage.from(BUCKET).remove([user.id+'/avatar.webp'])
  if(storageError)throw storageError
  setAvatarVersion(v=>v+1)
 },'Foto removida.')
 const logout=()=>perform(async()=>{
  if(!db)return
  const {error:logoutError}=await db.auth.signOut()
  if(logoutError)throw logoutError
  setOpen(false)
 })
 const deleteAccount=()=>perform(async()=>{
  if(!db||!user)throw Error('Faça login novamente para excluir a conta.')
  if(!canConfirmDeletion(deleteText,acknowledged))throw Error('Confirme a exclusão para continuar.')
  const {data:{session},error:sessionError}=await db.auth.getSession()
  if(sessionError||!session)throw Error('Sessão inválida. Faça login novamente.')
  const {error:invokeError}=await db.functions.invoke('delete-my-account',{body:{confirmation:'EXCLUIR'},headers:{Authorization:'Bearer '+session.access_token}})
  if(invokeError){
   let detail='Não foi possível excluir a conta.'
   const response=(invokeError as {context?:Response}).context
   if(response&&typeof response.json==='function'){
    try{const json=await response.json() as {error?:string};if(json.error)detail=json.error}catch{}
   }
   throw Error(detail)
  }
  await db.auth.signOut({scope:'local'})
  setOpen(false)
 })
 if(!user||!db)return <span className="profile-avatar profile-avatar-demo">{initial}</span>
 return <div className="profile-menu-root" ref={root}>
  <button type="button" className="profile-avatar profile-avatar-trigger" aria-label="Abrir meu perfil" aria-haspopup="dialog" aria-expanded={open} onClick={()=>{setOpen(v=>!v);setConfirmDelete(false);setError('');setMessage('')}}>
   {avatar?<img src={avatar} alt="" className="profile-avatar-image"/>:initial}
  </button>
  {open&&<div className="profile-popover" role="dialog" aria-label="Meu perfil">
   <div className="profile-popover-header"><div><strong>Meu perfil</strong><small>{user.email}</small></div><button className="profile-icon-button" type="button" onClick={()=>setOpen(false)} aria-label="Fechar perfil"><X size={18}/></button></div>
   <div className="profile-photo-section">
    <div className="profile-avatar profile-avatar-large">{avatar?<img src={avatar} alt="Minha foto de perfil" className="profile-avatar-image"/>:initial}</div>
    <div className="profile-photo-actions"><button disabled={busy} type="button" className="secondary" onClick={()=>uploadInput.current?.click()}><Camera size={15}/> Alterar foto</button>{avatar&&<button disabled={busy} type="button" className="profile-text-action" onClick={removePhoto}>Remover foto</button>}</div>
    <input ref={uploadInput} className="profile-hidden-input" type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{choosePhoto(e.target.files?.[0]);e.currentTarget.value=''}} aria-label="Escolher foto de perfil"/>
   </div>

   {message&&<p className="profile-feedback success"><Check size={14}/>{message}</p>}
   {error&&<p className="profile-feedback danger">{error}</p>}
   <div className="profile-actions"><button type="button" disabled={busy} className="profile-action" onClick={()=>{setOpen(false);onNavigate('profile')}}><UserRound size={17}/> Editar perfil e cadastro</button><button type="button" disabled={busy} className="profile-action" onClick={()=>{setOpen(false);onNavigate('subscription')}}><CreditCard size={17}/> Assinatura</button><button type="button" disabled={busy} className="profile-action" onClick={logout}><LogOut size={17}/> Sair da conta</button><button type="button" disabled={busy} className="profile-action profile-destructive" onClick={()=>{setConfirmDelete(v=>!v);setDeleteText('');setAcknowledged(false)}}><Trash2 size={17}/> Excluir minha conta</button></div>
   {confirmDelete&&<div className="profile-delete-confirm">
    <strong>Excluir conta permanentemente</strong>
    <p>Esta ação remove sua conta, eventos, jornadas, holerites e arquivos enviados. Não será possível recuperar os dados.</p>
    <label htmlFor="profile-delete-phrase">Digite EXCLUIR para confirmar</label>
    <input id="profile-delete-phrase" autoComplete="off" value={deleteText} onChange={e=>setDeleteText(e.target.value)} placeholder="EXCLUIR"/>
    <label className="checkbox-label"><input type="checkbox" checked={acknowledged} onChange={e=>setAcknowledged(e.target.checked)}/>Entendo que esta exclusão é permanente.</label>
    <div className="profile-delete-buttons"><button type="button" className="secondary" onClick={()=>setConfirmDelete(false)} disabled={busy}>Cancelar</button><button type="button" className="profile-delete-submit" disabled={busy||!canConfirmDeletion(deleteText,acknowledged)} onClick={deleteAccount}>{busy?'Processando...':'Excluir permanentemente'}</button></div>
   </div>}
  </div>}
  {cropFile&&<PhotoCropDialog file={cropFile} onCancel={()=>setCropFile(null)} onConfirm={savePhoto}/>}
 </div>
}
