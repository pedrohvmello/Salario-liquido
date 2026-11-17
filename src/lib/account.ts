import {db} from './data'
import {profileDisplayName} from './profile'
import {checkoutInvokeErrorMessage} from './checkoutError'
import type {User} from '@supabase/supabase-js'

export type PayrepProfile={
 display_name:string;phone:string;postal_code:string;street:string;street_number:string;
 complement:string;neighborhood:string;city:string;state:string;country:string
}
export type PlanCode='free'|'basic'|'full'
export type BillingSubscription={
 plan_code:PlanCode;status:string;provider:string|null;provider_customer_id:string|null;
 provider_subscription_id:string|null;current_period_start:string|null;
 current_period_end:string|null;cancel_at_period_end:boolean
}
export type BillingPayment={
 id:string;provider:string;description:string;amount_cents:number;currency:string;status:string;
 due_at:string|null;paid_at:string|null;created_at:string
}
export type BillingPlan={
 code:PlanCode;label:string;monthly_price_cents:number|null;
 currency:string;available_for_checkout:boolean
}
export type BillingCheckoutIntent={
 id:string;plan_code:'basic'|'full';amount_cents:number;currency:string;
 status:'pending'|'checkout_created'|'paid'|'canceled'|'expired'|'failed';
 created_at:string;expires_at:string
}
export async function loadMyCheckoutIntents():Promise<BillingCheckoutIntent[]>{
 const user=await identity()
 const {data,error}=await db!.from('billing_checkout_intents')
  .select('id,plan_code,amount_cents,currency,status,created_at,expires_at')
  .eq('user_id',user.id).order('created_at',{ascending:false}).limit(5)
 if(error)throw Error(error.message)
 return (data||[]) as BillingCheckoutIntent[]
}
export async function startAsaasSandboxCheckout(plan:'basic'|'full'):Promise<string>{
 if(!db)throw Error('Banco não configurado.')
 const {data:{session},error:sessionError}=await db.auth.getSession()
 if(sessionError||!session)throw Error('Faça login novamente.')
 const {data,error}=await db.functions.invoke('billing-checkout-asaas',{
  body:{plan},headers:{Authorization:'Bearer '+session.access_token}
 })
 if(error){
  throw Error(await checkoutInvokeErrorMessage(error))
 }
 if(data?.mode!=='sandbox'||typeof data.checkoutUrl!=='string')throw Error('Resposta inesperada do checkout.')
 const dest=new URL(data.checkoutUrl)
 if(dest.protocol!=='https:'||dest.hostname!=='asaas.com'||dest.pathname!=='/checkoutSession/show')
  throw Error('Destino de pagamento não autorizado.')
 return dest.toString()
}

export const blankProfile=(user?:User|null):PayrepProfile=>({
 display_name:profileDisplayName(user||null),
 phone:'',postal_code:'',street:'',street_number:'',complement:'',
 neighborhood:'',city:'',state:'',country:'Brasil'
})
const requiredFields:ReadonlyArray<keyof PayrepProfile>=['display_name','phone','postal_code','street','street_number','complement','neighborhood','city','state','country']
export function validateProfile(value:PayrepProfile):PayrepProfile{
 const out={...value}
 for(const key of requiredFields)out[key]=(out[key]||'').trim().replace(/\s+/g,' ')
 if(out.display_name.length<2||out.display_name.length>100)throw Error('Informe um nome entre 2 e 100 caracteres.')
 if(out.phone&&!/^[+0-9()\s-]{8,30}$/.test(out.phone))throw Error('Informe um telefone válido, com DDD.')
 if(out.postal_code&&!/^[0-9]{5}-?[0-9]{3}$/.test(out.postal_code))throw Error('Informe o CEP no formato 00000-000.')
 if(out.state&&out.country.toLowerCase()==='brasil'&&!/^[a-zA-Z]{2}$/.test(out.state))throw Error('Informe a UF com duas letras.')
 const limits:Partial<Record<keyof PayrepProfile,number>>={
 phone:30,postal_code:20,street:160,street_number:24,complement:100,
 neighborhood:100,city:100,state:80,country:80
 }
 for(const [key,limit] of Object.entries(limits))if(out[key as keyof PayrepProfile].length>limit)throw Error('Campo '+key+' excede o limite de caracteres.')
 return out
}
async function identity(){
 if(!db)throw Error('Banco não configurado.')
 const {data:{user},error}=await db.auth.getUser()
 if(error||!user)throw Error('Faça login novamente.')
 return user
}
export async function loadMyProfile():Promise<PayrepProfile>{
 const user=await identity()
 const {data,error}=await db!.from('user_profiles').select('display_name,phone,postal_code,street,street_number,complement,neighborhood,city,state,country').eq('user_id',user.id).maybeSingle()
 if(error)throw Error(error.message)
 return {...blankProfile(user),...(data||{}),display_name:data?.display_name||profileDisplayName(user)}
}
export async function saveMyProfile(data:PayrepProfile):Promise<PayrepProfile>{
 const user=await identity()
 const profile=validateProfile(data)
 const {error}=await db!.from('user_profiles').upsert({user_id:user.id,...profile,updated_at:new Date().toISOString()},{onConflict:'user_id'})
 if(error)throw Error(error.message)
 // Mirror the display name to Auth for consistency with OAuth and other surfaces.
 const {error:authError}=await db!.auth.updateUser({data:{display_name:profile.display_name}})
 if(authError)throw Error('Dados salvos. Não foi possível sincronizar o nome com a autenticação: '+authError.message)
 return profile
}
export async function loadMyBilling():Promise<{subscription:BillingSubscription;payments:BillingPayment[];plans:BillingPlan[]}>{
 const user=await identity()
 const [sub,payments,plans]=await Promise.all([
  db!.from('billing_subscriptions').select('plan_code,status,provider,provider_customer_id,provider_subscription_id,current_period_start,current_period_end,cancel_at_period_end').eq('user_id',user.id).maybeSingle(),
  db!.from('billing_payments').select('id,provider,description,amount_cents,currency,status,due_at,paid_at,created_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(50),
  db!.from('billing_plans').select('code,label,monthly_price_cents,currency,available_for_checkout').order('code')
 ])
 for(const r of [sub,payments,plans])if(r.error)throw Error(r.error.message)
 return {
  subscription:(sub.data||{plan_code:'free',status:'active',provider:null,provider_customer_id:null,provider_subscription_id:null,current_period_start:null,current_period_end:null,cancel_at_period_end:false}) as BillingSubscription,
  payments:(payments.data||[]) as BillingPayment[],
  plans:(plans.data||[]) as BillingPlan[]
 }
}
