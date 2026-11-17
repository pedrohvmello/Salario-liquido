import {createClient} from 'npm:@supabase/supabase-js@2.105.0'

// HML only. A scoped Management API token stays exclusively in Edge Secrets.
const PROJECT_REF='nrpqcrhschztdwbfgnyo'
const ALLOWED_ORIGIN='https://payrep-hml.vercel.app'
const CHARSETS:Record<string,string>={
  "none": "",
  "letters_numbers": "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ:0123456789",
  "mixed_case_numbers": "abcdefghijklmnopqrstuvwxyz:ABCDEFGHIJKLMNOPQRSTUVWXYZ:0123456789",
  "mixed_case_numbers_symbols": "abcdefghijklmnopqrstuvwxyz:ABCDEFGHIJKLMNOPQRSTUVWXYZ:0123456789:!@#$%^&*()_+-=[]{};'\\:\"|<>?,./`~"
}
type Policy={minLength:number;preset:keyof typeof CHARSETS}
const cors={
 'Access-Control-Allow-Origin':ALLOWED_ORIGIN,
 'Access-Control-Allow-Methods':'POST, OPTIONS',
 'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
 'Vary':'Origin'
}
const reply=(status:number,body:Record<string,unknown>)=>new Response(JSON.stringify(body),{
 status,headers:{...cors,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}
})
const isPolicy=(x:unknown):x is Policy=>{
 if(!x||typeof x!=='object')return false
 const p=x as Record<string,unknown>
 return Number.isInteger(p.minLength)&&Number(p.minLength)>=8&&Number(p.minLength)<=128
  &&typeof p.preset==='string'&&Object.prototype.hasOwnProperty.call(CHARSETS,p.preset)
}
// Management API versions can serialize supported character requirements as
// an Auth config preset or as colon-separated character classes. Resolve both
// forms without weakening/guessing any unknown requirement.
const PRESET_ALIASES:Record<string,Policy['preset']>={
 NO_REQUIRED_CHARS:'none',
 letters_digits:'letters_numbers',
 lower_upper_letters_digits:'mixed_case_numbers',
 lower_upper_letters_digits_symbols:'mixed_case_numbers_symbols'
}
const splitGroups=(value:string):string[]=>{
 const groups:string[]=[]
 let part=''
 for(let i=0;i<value.length;i++){
  if(value[i]==='\\'&&value[i+1]===':'){part+=':';i++;continue}
  if(value[i]===':'){groups.push(part);part='';continue}
  part+=value[i]
 }
 groups.push(part)
 return groups
}
const sameCharacters=(a:string,b:string):boolean=>
 a.length===b.length&&[...a].every(letter=>b.includes(letter))&&
 [...b].every(letter=>a.includes(letter))
const sameClasses=(a:string,b:string):boolean=>{
 const left=splitGroups(a),right=splitGroups(b)
 return left.length===right.length&&left.every((set,i)=>sameCharacters(set,right[i]))
}
const decodePreset=(raw:unknown):Policy['preset']|null=>{
 if(raw===null||raw===undefined||raw==='')return 'none'
 if(typeof raw!=='string')return null
 if(Object.prototype.hasOwnProperty.call(PRESET_ALIASES,raw))return PRESET_ALIASES[raw]
 const match=Object.entries(CHARSETS).find(([,value])=>value===raw||sameClasses(value,raw))
 return match?match[0] as Policy['preset']:null
}
const parsePolicy=(json:unknown):Policy|null=>{
 if(!json||typeof json!=='object')return null
 const obj=json as Record<string,unknown>
 const len=typeof obj.password_min_length==='string'&&/^\\d+$/.test(obj.password_min_length)
  ?Number(obj.password_min_length):obj.password_min_length
 const preset=decodePreset(obj.password_required_characters)
 return preset!==null&&isPolicy({minLength:len,preset})?
  {minLength:len as number,preset}:null
}
const matchPolicy=(a:Policy,b:Policy)=>a.minLength===b.minLength&&a.preset===b.preset

Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors})
 if(req.method!=='POST')return reply(405,{error:'method_not_allowed'})
 if(req.headers.get('origin')!==ALLOWED_ORIGIN)return reply(403,{error:'origin_not_allowed'})
 if(Number(req.headers.get('content-length')||0)>4096)return reply(413,{error:'payload_too_large'})
 const url=Deno.env.get('SUPABASE_URL')
 const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
 if(url!==`https://${PROJECT_REF}.supabase.co`||!serviceKey)
  return reply(503,{error:'environment_unavailable'})
 const accessToken=/^Bearer\s+(\S+)$/i.exec(req.headers.get('authorization')||'')?.[1]
 if(!accessToken)return reply(401,{error:'authentication_required'})

 const adminClient=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}})
 const {data:{user},error:userError}=await adminClient.auth.getUser(accessToken)
 if(userError||!user)return reply(401,{error:'authentication_required'})
 // This RPC enforces current active admin membership, session validity and TOTP AAL2.
 const signedClient=createClient(url,serviceKey,{
  global:{headers:{Authorization:'Bearer '+accessToken}},
  auth:{persistSession:false,autoRefreshToken:false}
 })
 const {data:admin,error:adminError}=await signedClient.rpc('is_app_admin')
 if(adminError||admin!==true)return reply(403,{error:'admin_mfa_required'})

 const managementToken=Deno.env.get('PAYREP_AUTH_CONFIG_MANAGEMENT_TOKEN')
 if(!managementToken)return reply(503,{error:'management_token_not_configured'})
 let body:Record<string,unknown>
 try{
  const raw=await req.json()
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return reply(400,{error:'invalid_payload'})
  body=raw as Record<string,unknown>
 }catch{return reply(400,{error:'invalid_payload'})}
 if(body.action!=='get'&&body.action!=='save')return reply(400,{error:'invalid_action'})

 const endpoint=`https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`
 const apiFetch=async(method:'GET'|'PATCH',payload?:Record<string,unknown>)=>{
  const response=await fetch(endpoint,{
   method,headers:{
    Authorization:'Bearer '+managementToken,
    Accept:'application/json',...(method==='PATCH'?{'Content-Type':'application/json'}:{})
   },
   ...(payload?{body:JSON.stringify(payload)}:{}),
   signal:AbortSignal.timeout(12000)
  })
  if(!response.ok)throw new Error('provider_status_'+response.status)
  return response.json()
 }
 const persist=async(policy:Policy)=>{
  const {data,error}=await adminClient.from('payrep_password_policy')
   .update({min_length:policy.minLength,required_preset:policy.preset,
    synced_at:new Date().toISOString(),updated_at:new Date().toISOString()})
   .eq('id',1).select('id').maybeSingle()
  if(error||!data)throw new Error('mirror_not_updated')
 }
 try{
  const remote=parsePolicy(await apiFetch('GET'))
  if(!remote)return reply(409,{error:'unsupported_remote_policy'})
  if(body.action==='get'){
   await persist(remote)
   return reply(200,{policy:remote,verified:true})
  }
  if(!isPolicy(body.policy)||!isPolicy(body.expected))
   return reply(400,{error:'invalid_policy'})
  if(!matchPolicy(remote,body.expected))
   return reply(409,{error:'policy_changed_reload',policy:remote})
  const desired=body.policy
  if(!matchPolicy(remote,desired)){
   await apiFetch('PATCH',{
    password_min_length:desired.minLength,
    password_required_characters:CHARSETS[desired.preset]
   })
  }
  // Do not report success until Supabase read-back AND local mirror agree.
  const checked=parsePolicy(await apiFetch('GET'))
  if(!checked||!matchPolicy(checked,desired))
   return reply(502,{error:'verification_failed'})
  await persist(checked)
  return reply(200,{policy:checked,verified:true})
 }catch(e){
  const code=e instanceof Error?e.message:'unknown'
  const status=/^provider_status_/.test(code)?Number(code.slice(16)):null
  if(status===401||status===403)
   return reply(503,{error:'management_permission_denied'})
  if(code==='mirror_not_updated')return reply(503,{error:'mirror_not_updated'})
  return reply(503,{error:'management_api_unavailable'})
 }
})
