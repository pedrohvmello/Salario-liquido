import {useEffect,useRef,useState} from 'react'
import type {User} from '@supabase/supabase-js'
import {Camera,Check,LogOut,X,UserRound,CreditCard,ShieldCheck,HelpCircle,Trash2} from 'lucide-react'
import {db} from '../lib/data'
import {accountInitials} from '../lib/profile'
import {PhotoCropDialog} from './PhotoCropDialog'

const BUCKET='profile-avatars'
const MAX_SOURCE=5*1024*1024
const accepted=new Set(['image/jpeg','image/png','image/webp'])

export function ProfileMenu({user,onNavigate}:{user:User|null;onNavigate:(view:'profile'|'subscription'|'account-settings'|'help')=>void}){
 const [open,setOpen]=useState(false)
 const [avatar,setAvatar]=useState<string|null>(null)
 const [avatarVersion,setAvatarVersion]=useState(0)
 const [cropFile,setCropFile]=useState<File|null>(null)
 const [photoDialogOpen,setPhotoDialogOpen]=useState(false)
 const [busy,setBusy]=useState(false)
 const [message,setMessage]=useState('')
 const [error,setError]=useState('')
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
  const closeOutside=(event:PointerEvent)=>{if(root.current&&!root.current.contains(event.target as Node)){setOpen(false);setPhotoDialogOpen(false)}}
  const closeEscape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!cropFile){if(photoDialogOpen)setPhotoDialogOpen(false);else setOpen(false)}}
  document.addEventListener('pointerdown',closeOutside)
  document.addEventListener('keydown',closeEscape)
  return ()=>{document.removeEventListener('pointerdown',closeOutside);document.removeEventListener('keydown',closeEscape)}
 },[open,cropFile,photoDialogOpen])
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
   setPhotoDialogOpen(false)
  }catch(err){
   throw err instanceof Error?err:Error('Não foi possível salvar a foto.')
  }finally{setBusy(false)}
 }

 const removePhoto=()=>perform(async()=>{
  if(!db||!user)throw Error('Faça login para remover a imagem.')
  const {error:storageError}=await db.storage.from(BUCKET).remove([user.id+'/avatar.webp'])
  if(storageError)throw storageError
  setAvatarVersion(v=>v+1)
  setPhotoDialogOpen(false)
 },'Foto removida.')
 const logout=()=>perform(async()=>{
  if(!db)return
  const {error:logoutError}=await db.auth.signOut()
  if(logoutError)throw logoutError
  setOpen(false)
 })

 if(!user||!db)return <span className="profile-avatar profile-avatar-demo">{initial}</span>
 return <div className="profile-menu-root" ref={root}>
  <button type="button" className="profile-avatar profile-avatar-trigger" aria-label="Abrir meu perfil" aria-haspopup="dialog" aria-expanded={open} onClick={()=>{setOpen(v=>!v);setPhotoDialogOpen(false);setError('');setMessage('')}}>
   {avatar?<img src={avatar} alt="" className="profile-avatar-image"/>:initial}
  </button>
  {open&&<div className="profile-popover" role="dialog" aria-label="Meu perfil">
   <div className="profile-popover-header"><div><strong>Meu perfil</strong><small>{user.email}</small></div><button className="profile-icon-button" type="button" onClick={()=>setOpen(false)} aria-label="Fechar perfil"><X size={18}/></button></div>
   <div className="profile-photo-section">
    <button type="button" className="profile-avatar profile-avatar-large profile-photo-open" disabled={busy} onClick={()=>setPhotoDialogOpen(true)} aria-haspopup="dialog" aria-label="Ampliar e gerenciar foto do perfil" title="Ver e gerenciar foto">{avatar?<img src={avatar} alt="" className="profile-avatar-image"/>:initial}</button>
    <input ref={uploadInput} className="profile-hidden-input" type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{choosePhoto(e.target.files?.[0]);e.currentTarget.value=''}} aria-label="Escolher foto de perfil"/>
   </div>

   {message&&<p className="profile-feedback success"><Check size={14}/>{message}</p>}
   {error&&<p className="profile-feedback danger">{error}</p>}
   <div className="profile-actions">
    <button type="button" disabled={busy} className="profile-action" onClick={()=>{setOpen(false);onNavigate('profile')}}><UserRound size={17}/> Meu cadastro</button>
    <button type="button" disabled={busy} className="profile-action" onClick={()=>{setOpen(false);onNavigate('subscription')}}><CreditCard size={17}/> Assinatura</button>
    <button type="button" disabled={busy} className="profile-action" onClick={()=>{setOpen(false);onNavigate('account-settings')}}><ShieldCheck size={17}/> Segurança</button>
    <button type="button" disabled={busy} className="profile-action" onClick={()=>{setOpen(false);onNavigate('help')}}><HelpCircle size={17}/> Ajuda</button>
    <button type="button" disabled={busy} className="profile-action" onClick={logout}><LogOut size={17}/> Sair da conta</button>
   </div>
  </div>}
  {open&&photoDialogOpen&&<div className="profile-photo-dialog-backdrop" onPointerDown={event=>{if(event.target===event.currentTarget)setPhotoDialogOpen(false)}}>
   <section role="dialog" aria-modal="true" aria-label="Foto do perfil" className="profile-photo-dialog">
    <header><strong>Foto do perfil</strong><button type="button" className="profile-icon-button" aria-label="Fechar foto ampliada" onClick={()=>setPhotoDialogOpen(false)}><X size={20}/></button></header>
    <div className="profile-photo-expanded">{avatar?<img src={avatar} alt="Foto de perfil ampliada"/>:<span>{initial}</span>}</div>
    <div className="profile-photo-dialog-actions"><button type="button" className="secondary" disabled={busy} onClick={()=>uploadInput.current?.click()}><Camera size={16}/> Alterar foto</button>
    {avatar&&<button type="button" className="secondary" disabled={busy} onClick={()=>void removePhoto()}><Trash2 size={16}/> Remover foto</button>}</div>
   </section>
  </div>}
  {cropFile&&<PhotoCropDialog file={cropFile} onCancel={()=>setCropFile(null)} onConfirm={savePhoto}/>}
 </div>
}
