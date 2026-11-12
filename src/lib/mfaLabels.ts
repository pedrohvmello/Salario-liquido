/** Cosmetic labels only: never use this user-editable metadata for authorization. */
export const authenticatorApps=[
 'Microsoft Authenticator',
 'Google Authenticator',
 '1Password',
 'Authy',
 'Outro'
] as const

export const mfaLabelMetadataKey='payrep_mfa_factor_labels'
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function cleanMfaLabel(value:string):string {
 const name=value.trim().replace(/\s+/g,' ')
 if(!name||name.length>60)throw new Error('Informe um nome para o autenticador de até 60 caracteres.')
 return name
}

export function readMfaLabels(metadata:unknown):Record<string,string>{
 if(!metadata||typeof metadata!=='object')return {}
 const raw=(metadata as Record<string,unknown>)[mfaLabelMetadataKey]
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return {}
 const safe:Record<string,string>={}
 for(const [id,value] of Object.entries(raw)){
  if(uuid.test(id)&&typeof value==='string'&&value.trim()&&value.length<=60)safe[id]=value
 }
 return safe
}

export function displayMfaLabel(id:string,fallback:string,metadata:unknown):string{
 return readMfaLabels(metadata)[id]||fallback
}
