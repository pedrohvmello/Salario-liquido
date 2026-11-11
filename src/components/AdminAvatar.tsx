import {useEffect,useState} from 'react'
import {db} from '../lib/data'
import {accountInitials} from '../lib/profile'
/** Private avatars are downloadable by owners and approved administrators only. */
export function AdminAvatar({userId,email,name}:{userId:string;email:string|null;name?:string|null}){
 const [src,setSrc]=useState<string|null>(null)
 useEffect(()=>{
  if(!db)return
  let active=true,objectUrl:string|null=null
  setSrc(null)
  void db.storage.from('profile-avatars').download(userId+'/avatar.webp').then(({data,error})=>{
   if(error||!data)return
   objectUrl=URL.createObjectURL(data)
   if(active)setSrc(objectUrl)
   else URL.revokeObjectURL(objectUrl)
  }).catch(()=>{})
  return ()=>{active=false;if(objectUrl)URL.revokeObjectURL(objectUrl)}
 },[userId])
 return <span className="admin-user-avatar" aria-label={'Foto de '+(name||email||'usuário')}>
  {src?<img src={src} alt="" loading="lazy" />:accountInitials({email})}
 </span>
}
