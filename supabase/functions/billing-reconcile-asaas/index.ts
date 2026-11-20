import {createClient} from 'npm:@supabase/supabase-js@2.57.0'

// HML only. One authenticated, user-scoped Asaas Sandbox reconciliation.
// Callback navigation does not authorize a subscription.
// Only a fresh verified provider charge (CONFIRMED/RECEIVED) plus stored,
// authenticated checkout/subscription/payment webhooks can activate a plan.
const origin='https://payrep.com.br'
const projectRef='klvurrcmfrwetmynscjc'
const headers={
 'Content-Type':'application/json; charset=utf-8',
 'Access-Control-Allow-Origin':origin,
 'Access-Control-Allow-Headers':'authorization,apikey,x-client-info,content-type',
 'Access-Control-Allow-Methods':'POST,OPTIONS',
 'Cache-Control':'no-store','Vary':'Origin'
}
const reply=(body:Record<string,unknown>,status=200)=>new Response(JSON.stringify(body),{status,headers})
const text=(v:unknown):string=>typeof v==='string'?v:''
const validId=(v:string,prefix:string)=>new RegExp('^'+prefix+'[a-zA-Z0-9_]{5,80}$').test(v)
const validDate=(v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v+'T12:00:00Z'))
const cents=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?Math.round(v*100):NaN

Deno.serve(async(req:Request)=>{
 if(req.headers.get('origin')!==origin)return reply({error:'Origem não autorizada.'},403)
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers})
 if(req.method!=='POST')return reply({error:'Método não permitido.'},405)
 const url=Deno.env.get('SUPABASE_URL')||''
 const anon=Deno.env.get('SUPABASE_ANON_KEY')||''
 const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||''
 const key=Deno.env.get('ASAAS_PRODUCTION_API_KEY')||''
 if(url!=='https://'+projectRef+'.supabase.co'||!anon||!service||!key
  ||Deno.env.get('PAYREP_ASAAS_PRODUCTION_ENABLED')!=='true')
  return reply({error:'Conciliação Sandbox indisponível.'},503)
 const token=/^Bearer (.+)$/i.exec(req.headers.get('authorization')||'')?.[1]||''
 if(!token)return reply({error:'Faça login novamente.'},401)
 const userClient=createClient(url,anon,{global:{headers:{Authorization:'Bearer '+token}},
  auth:{persistSession:false,autoRefreshToken:false}})
 const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}})
 const {data:{user},error:authError}=await userClient.auth.getUser(token)
 if(authError||!user)return reply({error:'Sessão inválida.'},401)
 const {data:member,error:memberError}=await admin.from('app_members')
  .select('active,status').eq('user_id',user.id).maybeSingle()
 if(memberError||!member||member.active!==true||member.status!=='approved')
  return reply({error:'Conta não autorizada.'},403)
 const {data:sub,error:subError}=await userClient.from('billing_subscriptions')
  .select('plan_code,status').eq('user_id',user.id).maybeSingle()
 if(subError)return reply({error:'Falha ao consultar assinatura.'},503)
 if(sub?.plan_code!=='free'&&sub?.status==='active')return reply({state:'active',plan:sub.plan_code})
 const {data:intent,error:intentError}=await userClient.from('billing_checkout_intents')
  .select('id,user_id,provider_checkout_id,plan_code,amount_cents,billing_account_id,status')
  .eq('user_id',user.id).eq('status','paid').order('created_at',{ascending:false})
  .limit(1).maybeSingle()
 if(intentError)return reply({error:'Falha ao consultar pagamento de teste.'},503)
 if(!intent)return reply({state:'no_paid_checkout'})
 if(typeof intent.provider_checkout_id!=='string'||intent.plan_code==='free'
   ||!Number.isSafeInteger(intent.amount_cents)||intent.amount_cents<500)
  return reply({state:'needs_review'})
 const checkoutId=intent.provider_checkout_id
 // Only stored Asaas-authenticated webhook events are considered as linkage.
 const [checkoutResponse,subResponse]=await Promise.all([
  admin.from('billing_webhook_events').select('payload').eq('provider','asaas')
   .eq('event_type','CHECKOUT_PAID')
   .eq('provider_checkout_id',checkoutId)
   .order('received_at',{ascending:false}).limit(1).maybeSingle(),
  admin.from('billing_webhook_events').select('payload').eq('provider','asaas')
   .eq('event_type','SUBSCRIPTION_CREATED')
   .contains('payload',{subscription:{checkoutSession:checkoutId}})
   .order('received_at',{ascending:false}).limit(1).maybeSingle()
 ])
 if(checkoutResponse.error||subResponse.error)return reply({error:'Falha ao consultar os eventos do provedor.'},503)
 const checkout=checkoutResponse.data?.payload?.checkout
 const subscription=subResponse.data?.payload?.subscription
 const subId=text(subscription?.id)
 const customerId=text(subscription?.customer)
 if(!checkout||text(checkout.id)!==checkoutId||text(checkout.status)!=='PAID'
  ||text(checkout.externalReference)!==intent.id
  ||!validId(subId,'sub_')||!validId(customerId,'cus_')
  ||text(subscription.checkoutSession)!==checkoutId)
  return reply({state:'needs_review'})
 const {data:paymentEvent,error:paymentEventError}=await admin.from('billing_webhook_events')
  .select('payload').eq('provider','asaas').eq('event_type','PAYMENT_CREATED')
  .contains('payload',{payment:{checkoutSession:checkoutId,subscription:subId}})
  .order('received_at',{ascending:false}).limit(1).maybeSingle()
 if(paymentEventError)return reply({error:'Falha ao consultar evento da cobrança.'},503)
 const eventPayment=paymentEvent?.payload?.payment
 const paymentId=text(eventPayment?.id)
 if(!validId(paymentId,'pay_')||text(eventPayment.customer)!==customerId)
  return reply({state:'needs_review'})
 const load=async(path:string)=>{
  try{
   const response=await fetch('https://api.asaas.com/v3/'+path,{
    headers:{'access_token':key,'User-Agent':'Payrep-PRD/1.0','Accept':'application/json'},
    signal:AbortSignal.timeout(12000)
   })
   if(!response.ok)return null
   return await response.json().catch(()=>null)
  }catch{return null}
 }
 const [currentSubscription,payment]=await Promise.all([
  load('subscriptions/'+encodeURIComponent(subId)),
  load('payments/'+encodeURIComponent(paymentId))
 ])
 if(!currentSubscription||!payment)return reply({
  state:'provider_unavailable',message:'O Asaas não confirmou os dados da cobrança. Nenhum plano foi liberado.'
 },503)
 if(text(currentSubscription.id)!==subId||text(currentSubscription.checkoutSession)!==checkoutId
  ||text(currentSubscription.customer)!==customerId
  ||text(currentSubscription.status)!=='ACTIVE'||text(currentSubscription.cycle)!=='MONTHLY'
  ||cents(currentSubscription.value)!==intent.amount_cents
  ||text(payment.id)!==paymentId||text(payment.customer)!==customerId
  ||text(payment.subscription)!==subId||text(payment.checkoutSession)!==checkoutId
  ||cents(payment.value)!==intent.amount_cents)
  return reply({state:'needs_review'})
 const paymentStatus=text(payment.status)
 if(!['CONFIRMED','RECEIVED'].includes(paymentStatus))
  return reply({state:'pending',providerPaymentStatus:paymentStatus||'UNKNOWN'})
 const nextDueDate=text(currentSubscription.nextDueDate)
 const paymentDueDate=text(payment.dueDate)
 if(!validDate(nextDueDate)||!validDate(paymentDueDate))
  return reply({state:'needs_review'})
 const {data:result,error:applyError}=await admin.rpc('apply_verified_asaas_initial_payment',{
  p_intent_id:intent.id,
  p_subscription_id:subId,
  p_payment_id:paymentId,
  p_customer_id:customerId,
  p_amount_cents:intent.amount_cents,
  p_next_due_date:nextDueDate,
  p_payment_due_date:paymentDueDate,
  p_payment_status:paymentStatus
 })
 if(applyError||!result?.applied){
  console.error('asaas_hml_reconciliation_failed',JSON.stringify({code:applyError?.code||'unknown'}))
  return reply({state:'needs_review',message:'A cobrança foi confirmada pelo Asaas, mas a conciliação precisa de revisão.'},503)
 }
 return reply({state:'active',plan:result.plan,paymentStatus})
})
