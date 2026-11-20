import {db} from './data'
import {asaasMode} from './environment'

export type PasswordPreset='none'|'letters_numbers'|'mixed_case_numbers'|'mixed_case_numbers_symbols'
export type PasswordPolicy={minLength:number;preset:PasswordPreset}
export type PasswordPolicySnapshot={policy:PasswordPolicy;synced:boolean}
export const passwordPolicyDefaults:Readonly<PasswordPolicy>=Object.freeze({
 minLength:12,preset:'mixed_case_numbers_symbols'
})
export const passwordPresetOptions:ReadonlyArray<{value:PasswordPreset;label:string}>=[
 {value:'none',label:'Sem requisitos adicionais de composição'},
 {value:'letters_numbers',label:'Letras e números'},
 {value:'mixed_case_numbers',label:'Minúsculas, maiúsculas e números'},
 {value:'mixed_case_numbers_symbols',label:'Minúsculas, maiúsculas, números e símbolos'}
]
export function isPasswordPolicy(value:unknown):value is PasswordPolicy{
 if(!value||typeof value!=='object')return false
 const p=value as Record<string,unknown>
 return Number.isInteger(p.minLength)&&Number(p.minLength)>=6&&Number(p.minLength)<=128
  &&passwordPresetOptions.some(item=>item.value===p.preset)
}
export function validatePasswordPolicy(p:PasswordPolicy):string|null{
 if(!isPasswordPolicy(p))return 'Informe de 6 a 128 caracteres e selecione uma combinação de requisitos suportada pelo Supabase.'
 return null
}
export function checkPassword(value:string,policy:PasswordPolicy=passwordPolicyDefaults):string[]{
 const missing:string[]=[]
 if(value.length<policy.minLength)missing.push('mínimo de '+policy.minLength+' caracteres')
 if(policy.preset==='letters_numbers'&&!/[a-zA-Z]/.test(value))missing.push('letra')
 if(policy.preset==='mixed_case_numbers'||policy.preset==='mixed_case_numbers_symbols'){
  if(!/[a-z]/.test(value))missing.push('letra minúscula')
  if(!/[A-Z]/.test(value))missing.push('letra maiúscula')
 }
 if(policy.preset!=='none'&&!/[0-9]/.test(value))missing.push('número')
 if(policy.preset==='mixed_case_numbers_symbols'&&
  !/[!@#$%^&*()_+\-=\[\]{};'\\:"|<>?,./\`~]/.test(value))
  missing.push('caractere especial')
 return missing
}
export function passwordRequirements(policy:PasswordPolicy):string{
 const label=passwordPresetOptions.find(item=>item.value===policy.preset)?.label
 return 'Pelo menos '+policy.minLength+' caracteres'+(policy.preset==='none'?'.':', com '+(label||'os requisitos definidos') .toLowerCase()+'.')
}
export function passwordRuleIndicators(value:string,p:PasswordPolicy):Array<{id:string;label:string;met:boolean}>{
 const misses=checkPassword(value,p)
 const list=[{id:'length',label:'Pelo menos '+p.minLength+' caracteres',
  met:!misses.some(item=>item.startsWith('mínimo de '))}]
 const add=(id:string,label:string,miss:string)=>{
  list.push({id,label,met:!misses.includes(miss)})
 }
 if(p.preset==='letters_numbers')add('letters','Pelo menos uma letra','letra')
 if(p.preset==='mixed_case_numbers'||p.preset==='mixed_case_numbers_symbols'){
  add('lowercase','Pelo menos uma letra minúscula','letra minúscula')
  add('uppercase','Pelo menos uma letra maiúscula','letra maiúscula')
 }
 if(p.preset!=='none')add('numbers','Pelo menos um número','número')
 if(p.preset==='mixed_case_numbers_symbols')add('symbols','Pelo menos um caractere especial','caractere especial')
 return list
}
export async function loadPasswordPolicy():Promise<PasswordPolicySnapshot>{
 if(!db)throw Error('Banco não configurado.')
 const {data,error}=await db.rpc('get_payrep_password_policy')
 if(error)throw Error('Não foi possível consultar a política de senhas: '+error.message)
 if(!data||!isPasswordPolicy({minLength:data.minLength,preset:data.preset}))
  throw Error('Política de senhas indisponível.')
 return {policy:{minLength:data.minLength,preset:data.preset},synced:data.synced===true}
}
const errorMessages:Record<string,string>={
 management_token_not_configured:'A integração com o Supabase Auth precisa ser autorizada. Configure o token de gerenciamento nas Edge Function Secrets do '+(asaasMode==='sandbox'?'HML':'PRD')+'.',
 management_permission_denied:'O token de gerenciamento não tem permissão para ler e alterar a configuração de Auth.',
 environment_unavailable:'O ambiente do Supabase '+(asaasMode==='sandbox'?'HML':'PRD')+' não está configurado corretamente.',
 admin_mfa_required:'É necessário ser administrador e concluir o 2FA para alterar a política.',
 policy_changed_reload:'A política foi alterada no Supabase. Recarregue para revisar antes de salvar.',
 unsupported_remote_policy:'O Supabase utiliza uma combinação de requisitos ainda não reconhecida pelo Payrep.',
 verification_failed:'O Supabase não confirmou a nova política. Nenhuma alteração foi considerada concluída.',
 mirror_not_updated:'O Supabase respondeu, mas a sincronização com o Payrep falhou. Recarregue e verifique antes de tentar novamente.',
 management_api_unavailable:'Não foi possível validar a configuração de senhas no Supabase.',
 invalid_policy:'Informe um mínimo entre 6 e 128 e uma combinação de caracteres permitida.'
}
export async function callAuthPasswordPolicy(
 action:'get'|'save',policy?:PasswordPolicy,expected?:PasswordPolicy
):Promise<PasswordPolicy>{
 if(!db)throw Error('Banco não configurado.')
 const {data,error}=await db.functions.invoke('admin-password-policy',{
  body:action==='get'?{action}:{action,policy,expected}
 })
 if(error){
  let code=''
  try{
   const response=(error as {context?:{json?:()=>Promise<unknown>}}).context
   const payload=await response?.json?.()
   if(payload&&typeof payload==='object')code=String((payload as {error?:unknown}).error||'')
  }catch{}
  throw Error(errorMessages[code]||error.message)
 }
 if(!data?.verified||!isPasswordPolicy(data.policy))
  throw Error('O Supabase não confirmou uma política de senhas válida.')
 return data.policy as PasswordPolicy
}
