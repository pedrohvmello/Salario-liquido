import {createClient} from 'npm:@supabase/supabase-js@2.57.0'

// Asaas Sandbox only. Provider-authenticated notifications, no browser CORS.
// The header token is separate from the Asaas API key.
// Events are persisted; no paid plan is activated without later reconciliation.
const projectRef='nrpqcrhschztdwbfgnyo'
const respond=(data:Record<string,unknown>,status=200)=>
 new Response(JSON.stringify(data),{status,headers:{
 'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}})
const sameToken=(a:string,b:string)=>{
 if(!a||!b||a.length!==b.length)return false
 const left=new TextEncoder().encode(a),right=new TextEncoder().encode(b)
 let diff=0
 for(let i=0;i<left.length;i++)diff|=left[i]^right[i]
 return diff===0
}
const id=(value:unknown):string=>typeof value==='string'?value:''
const cents=(value:unknown):number=>typeof value==='number'&&Number.isFinite(value)
 ?Math.round(value*100):NaN
const validDate=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)
 &&!Number.isNaN(Date.parse(value+'T12:00:00Z'))
const asaasHeaders=(key:string)=>({
 'access_token':key,'User-Agent':'Payrep-HML/1.0','Accept':'application/json'
})
type Admin=ReturnType<typeof createClient>
async function providerGet(path:string,key:string):Promise<Record<string,unknown>|null>{
 try{
  const response=await fetch('https://api-sandbox.asaas.com/v3/'+path,{
   headers:asaasHeaders(key),signal:AbortSignal.timeout(12000)
  })
  if(!response.ok)return null
  const body=await response.json()
  return body&&typeof body==='object'&&!Array.isArray(body)?body:null
 }catch{return null}
}
async function processProviderBillingEvent(
 admin:Admin,event:Record<string,unknown>,key:string
):Promise<'processed'|'waiting'|'retry'>{
 const type=id(event.event)
 // Do not trust browser redirects, names, payer email, or payload alone.
 // All new entitlements require matching provider resources fetched afresh.
 if(!['PAYMENT_CONFIRMED','PAYMENT_RECEIVED','PAYMENT_CREATED',
  'SUBSCRIPTION_CREATED','CHECKOUT_PAID'].includes(type))return 'waiting'
 const paymentNode=(event.payment??{}) as Record<string,unknown>
 const subscriptionNode=(event.subscription??{}) as Record<string,unknown>
 const checkoutNode=(event.checkout??{}) as Record<string,unknown>
 const checkoutId=id(paymentNode.checkoutSession)||id(subscriptionNode.checkoutSession)||id(checkoutNode.id)
 const checkoutIdValid=/^[0-9a-fA-F-]{36}$/.test(checkoutId)
 if(!checkoutIdValid)return 'waiting'
 const {data:intent,error:intentError}=await admin.from('billing_checkout_intents')
  .select('id,user_id,plan_code,amount_cents,status,provider_checkout_id')
  .eq('provider','asaas').eq('provider_checkout_id',checkoutId).maybeSingle()
 if(intentError)return 'retry'
 if(!intent||intent.status!=='paid')return 'waiting'
 const {data:subEvent,error:subError}=await admin.from('billing_webhook_events')
  .select('payload').eq('provider','asaas').eq('event_type','SUBSCRIPTION_CREATED')
  .contains('payload',{subscription:{checkoutSession:checkoutId}})
  .order('received_at',{ascending:false}).limit(1).maybeSingle()
 if(subError)return 'retry'
 const sub=(subEvent?.payload?.subscription||{}) as Record<string,unknown>
 const subId=id(sub.id),customerId=id(sub.customer)
 if(!/^sub_[A-Za-z0-9_]{5,80}$/.test(subId)
  ||!/^cus_[A-Za-z0-9_]{5,80}$/.test(customerId))return 'waiting'
 const {data:paymentEvent,error:paymentError}=await admin.from('billing_webhook_events')
  .select('payload').eq('provider','asaas').eq('event_type','PAYMENT_CREATED')
  .contains('payload',{payment:{checkoutSession:checkoutId,subscription:subId}})
  .order('received_at',{ascending:false}).limit(1).maybeSingle()
 if(paymentError)return 'retry'
 const initial=(paymentEvent?.payload?.payment||{}) as Record<string,unknown>
 const initialId=id(initial.id)
 if(!/^pay_[A-Za-z0-9_]{5,80}$/.test(initialId))return 'waiting'
 const [currentSub,currentPay]=await Promise.all([
  providerGet('subscriptions/'+encodeURIComponent(subId),key),
  providerGet('payments/'+encodeURIComponent(initialId),key)
 ])
 if(!currentSub||!currentPay)return 'retry'
 if(id(currentSub.id)!==subId||id(currentSub.customer)!==customerId
  ||id(currentSub.checkoutSession)!==checkoutId
  ||id(currentSub.status)!=='ACTIVE'||id(currentSub.cycle)!=='MONTHLY'
  ||cents(currentSub.value)!==intent.amount_cents
  ||id(currentPay.id)!==initialId||id(currentPay.customer)!==customerId
  ||id(currentPay.subscription)!==subId||id(currentPay.checkoutSession)!==checkoutId
  ||cents(currentPay.value)!==intent.amount_cents)return 'waiting'
 const {data:local,error:localError}=await admin.from('billing_subscriptions')
  .select('plan_code,status,provider_subscription_id,cancel_at_period_end,current_period_end')
  .eq('user_id',intent.user_id).maybeSingle()
 if(localError)return 'retry'
 if(local?.provider_subscription_id===subId&&local?.plan_code!=='free'){
  // Already reconciled initial payment. Subsequent event may be a recurring
  // payment without checkoutSession, handled by the renewal branch below.
  return 'processed'
 }
 if(!['CONFIRMED','RECEIVED'].includes(id(currentPay.status)))return 'waiting'
 const nextDate=id(currentSub.nextDueDate),dueDate=id(currentPay.dueDate)
 if(!validDate(nextDate)||!validDate(dueDate))return 'waiting'
 const {data:result,error:applyError}=await admin.rpc('apply_verified_asaas_initial_payment',{
  p_intent_id:intent.id,p_subscription_id:subId,p_payment_id:initialId,
  p_customer_id:customerId,p_amount_cents:intent.amount_cents,
  p_next_due_date:nextDate,p_payment_due_date:dueDate,p_payment_status:id(currentPay.status)
 })
 if(applyError||result?.applied!==true){
  console.error('asaas_hml_initial_reconcile_failed',{code:applyError?.code||'unknown'})
  return 'retry'
 }
 return 'processed'
}
async function processRenewal(
 admin:Admin,event:Record<string,unknown>,key:string
):Promise<'processed'|'waiting'|'retry'>{
 const type=id(event.event)
 if(!['PAYMENT_CONFIRMED','PAYMENT_RECEIVED'].includes(type))return 'waiting'
 const payment=(event.payment||{}) as Record<string,unknown>
 const paymentId=id(payment.id),subId=id(payment.subscription)
 if(!/^pay_[A-Za-z0-9_]{5,80}$/.test(paymentId)
  ||!/^sub_[A-Za-z0-9_]{5,80}$/.test(subId))return 'waiting'
 const {data:local,error:localError}=await admin.from('billing_subscriptions')
  .select('user_id,provider_customer_id,provider_subscription_id,current_period_end,cancel_at_period_end,status')
  .eq('provider','asaas').eq('provider_subscription_id',subId).maybeSingle()
 if(localError)return 'retry'
 if(!local||local.cancel_at_period_end)return 'waiting'
 const [sub,charge]=await Promise.all([
  providerGet('subscriptions/'+encodeURIComponent(subId),key),
  providerGet('payments/'+encodeURIComponent(paymentId),key)
 ])
 if(!sub||!charge)return 'retry'
 if(id(sub.id)!==subId||id(sub.status)!=='ACTIVE'||id(sub.cycle)!=='MONTHLY'
  ||id(sub.customer)!==local.provider_customer_id||id(charge.id)!==paymentId
  ||id(charge.subscription)!==subId||id(charge.customer)!==local.provider_customer_id
  ||!['CONFIRMED','RECEIVED'].includes(id(charge.status)))return 'waiting'
 const nextDate=id(sub.nextDueDate),dueDate=id(charge.dueDate)
 if(!validDate(nextDate)||!validDate(dueDate))return 'waiting'
 const {data:result,error:err}=await admin.rpc('apply_verified_asaas_renewal',{
  p_subscription_id:subId,p_payment_id:paymentId,p_customer_id:local.provider_customer_id,
  p_amount_cents:cents(charge.value),p_next_due_date:nextDate,
  p_payment_due_date:dueDate,p_payment_status:id(charge.status)
 })
 if(err){console.error('asaas_hml_renewal_reconcile_failed',{code:err.code});return 'retry'}
 return result?.applied===true?'processed':'waiting'
}
Deno.serve(async(req:Request)=>{
 if(req.method!=='POST')return respond({error:'Método não permitido.'},405)
 const url=Deno.env.get('SUPABASE_URL')||''
 const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||''
 const expected=Deno.env.get('ASAAS_SANDBOX_WEBHOOK_TOKEN')||''
 if(url!==('https://'+projectRef+'.supabase.co')||!service
  ||Deno.env.get('PAYREP_ASAAS_SANDBOX_ENABLED')!=='true'
  ||expected.length<32)return respond({error:'Webhook do Sandbox ainda não configurado.'},503)
 if(!sameToken(req.headers.get('asaas-access-token')||'',expected))
  return respond({error:'Webhook não autenticado.'},401)
 const len=Number(req.headers.get('content-length')||0)
 if(len>131072)return respond({error:'Payload muito grande.'},413)
 let payload:Record<string,unknown>
 try{
  const txt=await req.text()
  if(txt.length>131072)return respond({error:'Payload muito grande.'},413)
  payload=JSON.parse(txt)
  if(!payload||typeof payload!=='object'||Array.isArray(payload)
     ||typeof payload.id!=='string'||typeof payload.event!=='string')
    return respond({error:'Evento inválido.'},400)
 }catch{return respond({error:'JSON inválido.'},400)}
 const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}})
 const {data,error}=await admin.rpc('receive_asaas_billing_event',{p_event:payload})
 // Failed storage MUST return a non-200 response so Asaas retries.
 if(error||!data?.stored)return respond({error:'Falha no armazenamento do webhook. Tente novamente.'},503)
 const type=id(payload.event)
 if(['PAYMENT_CONFIRMED','PAYMENT_RECEIVED','SUBSCRIPTION_CREATED',
  'CHECKOUT_PAID','PAYMENT_CREATED'].includes(type)){
  const key=Deno.env.get('ASAAS_SANDBOX_API_KEY')||''
  if(!key)return respond({received:true,needsReview:true,reason:'api_not_configured'})
  const renewal=await processRenewal(admin,payload,key)
  if(renewal==='processed'){
   await admin.from('billing_webhook_events')
    .update({processing_status:'processed',processed_at:new Date().toISOString(),last_error:null})
    .eq('provider','asaas').eq('provider_event_id',id(payload.id))
   return respond({received:true,processed:true})
  }
  const initial=await processProviderBillingEvent(admin,payload,key)
  if(initial==='processed'){
   await admin.from('billing_webhook_events')
    .update({processing_status:'processed',processed_at:new Date().toISOString(),last_error:null})
    .eq('provider','asaas').eq('provider_event_id',id(payload.id))
   return respond({received:true,processed:true})
  }
  if(renewal==='retry'||initial==='retry'){
   // A stored event remains idempotent; on a transient API failure request
   // provider retry so the same event can be safely reconciled again.
   return respond({error:'Evento armazenado. Conciliação temporariamente indisponível.'},503)
  }
 }
 return respond({received:true,duplicate:data.duplicate===true,needsReview:data.needsReview===true})
})
