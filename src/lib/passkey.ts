/** Passkeys are experimental in Supabase and must be enabled per environment. */
export const passkeyFeatureEnabled=import.meta.env.VITE_ENABLE_PASSKEYS==='true'
/** Automatically offer the native passkey picker on first unauthenticated view in HML. */
export const passkeyAutoPromptEnabled=passkeyFeatureEnabled&&import.meta.env.VITE_AUTO_PASSKEY_PROMPT==='true'
export const passkeyAutoPreferenceKey='payrep:passkey-auto-prompt-v1'

export function autoPromptPreferred():boolean{
 try{return window.localStorage.getItem(passkeyAutoPreferenceKey)!=='off'}
 catch{return true}
}
export function setAutoPromptPreference(value:boolean):void{
 try{window.localStorage.setItem(passkeyAutoPreferenceKey,value?'on':'off')}catch{/* Private mode may deny storage. */}
}


export function supportsWebAuthn():boolean{
 return typeof window!=='undefined'
  && window.isSecureContext
  && typeof window.PublicKeyCredential==='function'
  && Boolean(window.navigator?.credentials)
}

export function passkeyErrorMessage(error:unknown):string{
 const name=error instanceof Error?error.name:''
 const raw=error instanceof Error?error.message:String(error??'')
 if(/passkey.disabled|passkeys? (are |is )?(not enabled|disabled)|not enabled for this project/i.test(raw))
  return 'O Supabase ainda não habilitou passkeys neste ambiente. É necessário configurar Authentication → Passkeys no projeto HML.'
 if(name==='NotAllowedError'||name==='AbortError'||/cancelled|canceled|not allowed|timed out/i.test(raw))
  return 'A autenticação foi cancelada ou expirou. Tente novamente.'
 if(name==='InvalidStateError'||/already registered|already exists/i.test(raw))
  return 'Esta chave de acesso já está cadastrada. Use outra chave ou gerencie a existente.'
 if(name==='SecurityError'||/relying party|origin|rp id|invalid domain/i.test(raw))
  return 'Este domínio não está autorizado para passkeys. Confira o domínio e a origem configurados no Supabase.'
 if(/not supported|not available|webauthn is unavailable/i.test(raw))
  return 'Este navegador ou dispositivo não oferece suporte a passkeys.'
 return raw||'Não foi possível completar a operação com a chave de acesso.'
}
