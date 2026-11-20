import {createClient} from 'npm:@supabase/supabase-js@2.57.0'

// HML only: stop future recurring charges, not a refund or immediate loss of access.
// A browser session alone is never permitted to choose another subscription ID.
const origin='https://payrep.com.br'
const ref='klvurrcmfrwetmynscjc'
const headers={
 'Content-Type':'application/json; charset=utf-8',
 'Access-Control-Allow-Origin':origin,
 'Access-Control-Allow-Headers':'authorization,apikey,x-client-info,content-type',
 'Access-Control-Allow-Methods':'POST,OPTIONS',
 'Cache-Control':'no-store','Vary':'Origin'
}
const reply=(data:Record<string,unknown>,status=200)=>
 new Response(JSON.stringify(data),{status,headers})
Deno.serve(async(req:Request)=>{
 if(req.headers.get('origin')!==origin)return reply({error:'Origem não autorizada.'},403)
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers})
 if(req.method!=='POST')return reply({error:'Método não permitido.'},405)
 const projectUrl=Deno.env.get('SUPABASE_URL')||''
 const anon=Deno.env.get('SUPABASE_ANON_KEY')||''
 const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||''
 const key=Deno.env.get('ASAAS_PRODUCTION_API_KEY')||''
 if(projectUrl!=='https://'+ref+'.supabase.co'||!anon||!service||!key
  ||Deno.env.get('PAYREP_ASAAS_PRODUCTION_ENABLED')!=='true'||Deno.env.get('PAYREP_ASAAS_LIVE_RELEASED')!=='true')
  return reply({error:'Cancelamento indisponível em homologação.'},503)
 const token=/^Bearer (.+)$/i.exec(req.headers.get('authorization')||'')?.[1]||''
 if(!token)return reply({error:'Sessão inválida.'},401)
 const userClient=createClient(projectUrl,anon,{global:{headers:{Authorization:'Bearer '+token}},
  auth:{persistSession:false,autoRefreshToken:false}})
 const admin=createClient(projectUrl,service,{auth:{persistSession:false,autoRefreshToken:false}})
 const {data:{user},error:authError}=await userClient.auth.getUser(token)
 if(authError||!user)return reply({error:'Sessão inválida.'},401)
 const {data:linked,error:linkedError}=await userClient.rpc('my_asaas_subscription_for_cancellation')
 if(linkedError||linked?.user_id!==user.id||typeof linked?.provider_subscription_id!=='string'
  ||typeof linked?.provider_customer_id!=='string')
  return reply({error:'Assinatura não autorizada para cancelamento.'},403)
 if(linked.cancel_at_period_end===true)return reply({canceledRenewal:true,alreadyCanceled:true})
 const subId=linked.provider_subscription_id
 if(!/^sub_[A-Za-z0-9_]{5,80}$/.test(subId))
  return reply({error:'Identificador de assinatura inválido.'},400)
 const providerHeaders={'access_token':key,'User-Agent':'Payrep-PRD/1.0','Accept':'application/json'}
 const api='https://api.asaas.com/v3/subscriptions/'+encodeURIComponent(subId)
 let current:Record<string,unknown>|null=null
 try{
  const response=await fetch(api,{headers:providerHeaders,signal:AbortSignal.timeout(15000)})
  if(response.ok)current=await response.json()
 }catch{}
 if(!current||current.id!==subId||current.customer!==linked.provider_customer_id)
  return reply({error:'Não foi possível verificar a assinatura no Asaas. Nenhuma alteração foi efetuada.'},503)
 if(current.status!=='ACTIVE'&&current.status!=='INACTIVE')
  return reply({error:'Assinatura em situação incompatível com cancelamento.'},409)
 let updated=current
 if(current.status==='ACTIVE'){
  try{
   const response=await fetch(api,{method:'PUT',
    headers:{...providerHeaders,'Content-Type':'application/json'},
    body:JSON.stringify({status:'INACTIVE',updatePendingPayments:false}),
    signal:AbortSignal.timeout(20000)})
   if(!response.ok)return reply({error:'O Asaas não aceitou a interrupção da renovação.'},502)
   updated=await response.json()
  }catch{
   return reply({error:'O resultado no Asaas é incerto. Verifique novamente antes de repetir a operação.'},503)
  }
 }
 if(updated?.id!==subId||updated?.status!=='INACTIVE')
  return reply({error:'O Asaas não confirmou o status INACTIVE. Verifique o suporte.'},503)
 const {data:finalized,error:finalizeError}=await admin.rpc('finalize_asaas_subscription_cancellation',{
  p_user_id:user.id,p_subscription_id:subId,p_status:'INACTIVE'
 })
 if(finalizeError||finalized?.canceledRenewal!==true){
  console.error('billing_cancel_local_finalize_failed',{code:finalizeError?.code||'unknown'})
  return reply({error:'Renovação interrompida no Asaas. Falha de sincronização no Payrep. Contate o suporte; não repita a operação.'},503)
 }
 return reply({canceledRenewal:true,accessUntil:linked.current_period_end,
  pendingInvoicesUnaffected:true})
})
