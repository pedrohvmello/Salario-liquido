import {startAuthentication,startRegistration,WebAuthnAbortService} from '@simplewebauthn/browser'
import type {PublicKeyCredentialCreationOptionsJSON,PublicKeyCredentialRequestOptionsJSON} from '@simplewebauthn/browser'
import {db} from './data'

/**
 * Like LRP, keep only a non-secret local credential hint. Supabase still
 * validates the signed challenge, credential ownership, RP ID, origin and session.
 * These hints are never an authorization decision.
 */
export const passkeyHintKey='payrep:passkey-credential:v1:last'
const perUserPrefix='payrep:passkey-credential:v1:user:'
export function validCredentialId(value:unknown):value is string{
 return typeof value==='string'&&value.length>=16&&value.length<=1024&&/^[A-Za-z0-9_-]+$/.test(value)
}
export function rememberedCredentialId():string{
 try{
  const value=window.localStorage.getItem(passkeyHintKey)
  return validCredentialId(value)?value:''
 }catch{return ''}
}
function rememberCredentialId(id:string,userId:string){
 if(!validCredentialId(id))return
 try{
  window.localStorage.setItem(passkeyHintKey,id)
  window.localStorage.setItem(perUserPrefix+userId,id)
 }catch{/* Storage may be unavailable in private mode. */}
}
export function forgetRememberedCredential(){
 try{window.localStorage.removeItem(passkeyHintKey)}catch{}
}
export function cancelPasskeyCeremony(){
 WebAuthnAbortService.cancelCeremony()
}
export async function registerDevicePasskey(){
 if(!db)throw Error('Autenticação indisponível.')
 const {data:challenge,error:challengeError}=await db.auth.passkey.startRegistration()
 if(challengeError||!challenge)throw challengeError||Error('Não foi possível solicitar a chave de acesso.')
 const credential=await startRegistration({optionsJSON:challenge.options as PublicKeyCredentialCreationOptionsJSON})
 const {data,error}=await db.auth.passkey.verifyRegistration({challengeId:challenge.challenge_id,credential})
 if(error)throw error
 const {data:userResult}=await db.auth.getUser()
 if(userResult.user)rememberCredentialId(credential.rawId,userResult.user.id)
 return data
}
/**
 * Restrict only the browser's requested credential list when this device
 * remembers a previous successful assertion. This mirrors LRP's allowCredentials.
 * If no hint exists, use discoverable credentials and remember the chosen one.
 */
export async function signInWithDevicePasskey(options?:{signal?:AbortSignal;useRemembered?:boolean}){
 if(!db)throw Error('Autenticação indisponível.')
 if(options?.signal?.aborted)throw new DOMException('Cancelled','AbortError')
 const {data:challenge,error:challengeError}=await db.auth.passkey.startAuthentication()
 if(challengeError||!challenge)throw challengeError||Error('Não foi possível iniciar a autenticação.')
 if(options?.signal?.aborted)throw new DOMException('Cancelled','AbortError')
 const remembered=options?.useRemembered===false?'':rememberedCredentialId()
 const request:PublicKeyCredentialRequestOptionsJSON={
  ...(challenge.options as PublicKeyCredentialRequestOptionsJSON),
  ...(remembered?{allowCredentials:[{id:remembered,type:'public-key' as const}]}:{})
 }
 const credential=await startAuthentication({optionsJSON:request})
 if(options?.signal?.aborted)throw new DOMException('Cancelled','AbortError')
 const {data,error}=await db.auth.passkey.verifyAuthentication({
  challengeId:challenge.challenge_id,credential
 })
 if(error)throw error
 if(options?.signal?.aborted)throw new DOMException('Cancelled','AbortError')
 // For the two-step API, explicitly persist returned tokens if needed.
 const {data:sessionResult}=await db.auth.getSession()
 const response=data as unknown as {session?:{access_token:string;refresh_token:string};user?:{id:string}}|null
 if(!sessionResult.session&&response?.session?.access_token&&response.session.refresh_token){
  const {error:sessionError}=await db.auth.setSession({
   access_token:response.session.access_token,refresh_token:response.session.refresh_token
  })
  if(sessionError)throw sessionError
 }
 const {data:finalSession,error:finalError}=await db.auth.getSession()
 if(finalError||!finalSession.session)throw finalError||Error('A autenticação não criou uma sessão válida.')
 rememberCredentialId(credential.rawId,finalSession.session.user.id)
 return finalSession.session
}
