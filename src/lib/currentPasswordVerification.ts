import {createClient} from '@supabase/supabase-js'
import {db} from './data'

type VerificationError={message:string;status?:number}|null
export interface PasswordVerifier {
 auth:{
  signInWithPassword(credentials:{email:string;password:string}):Promise<{
   data:{user:{id:string}|null;session:unknown|null};error:VerificationError
  }>
  signOut(options:{scope:'local'}):Promise<{error:VerificationError}>
 }
}
export interface PasswordUpdater {
 updateUser(credentials:{password:string;current_password:string}):Promise<{error:VerificationError}>
}

/**
 * Fail closed. A separate, non-persistent auth client verifies the actual password
 * without replacing the active Payrep session. Its temporary session is revoked
 * BEFORE the active client's password-update endpoint is called.
 *
 * This protects the UI flow, not direct Auth API calls. The native Supabase setting
 * "Require current password when updating" must also be enabled on the server.
 */
export async function verifyThenChangePassword(
 user:{id:string;email?:string|null},
 currentPassword:string,
 newPassword:string,
 verifier:PasswordVerifier,
 updater:PasswordUpdater
):Promise<void>{
 if(!user.email||!currentPassword)throw new Error('Informe a senha atual.')
 if(currentPassword===newPassword)throw new Error('A nova senha deve ser diferente da senha atual.')
 const {data,error}=await verifier.auth.signInWithPassword({
  email:user.email,
  password:currentPassword
 })
 // Even successful credential checks must not leave an extra session behind.
 if(data?.session){
  const {error:logoutError}=await verifier.auth.signOut({scope:'local'})
  if(logoutError)throw new Error('Não foi possível finalizar a validação. Tente novamente.')
 }
 if(error){
  if(error.status===400||error.status===401)throw new Error('Senha atual incorreta.')
  throw new Error('Não foi possível validar a senha atual. Tente novamente.')
 }
 if(!data?.session||!data.user||data.user.id!==user.id)
  throw new Error('Não foi possível confirmar a senha da conta atual.')
 const result=await updater.updateUser({
  password:newPassword,
  current_password:currentPassword
 })
 if(result.error)throw result.error
}

export async function changePasswordWithCurrentVerification(
 currentPassword:string,
 newPassword:string
):Promise<void>{
 if(!db)throw new Error('Autenticação indisponível.')
 const {data,error}=await db.auth.getUser()
 if(error||!data.user)throw new Error('Sua sessão expirou. Faça login novamente.')
 const url=import.meta.env.VITE_SUPABASE_URL as string|undefined
 const key=(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY||
  import.meta.env.VITE_SUPABASE_ANON_KEY) as string|undefined
 if(!url||!key)throw new Error('Configuração de autenticação indisponível.')
 // Keep this client independent of the primary application session.
 const verifier=createClient(url,key,{
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
 })
 await verifyThenChangePassword(
  data.user,currentPassword,newPassword,verifier,db.auth
 )
}
