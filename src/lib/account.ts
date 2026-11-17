import {db} from './data'
import {profileDisplayName} from './profile'
import {checkoutInvokeErrorMessage} from './checkoutError'
import {cpfDigits,isValidCpf,validBirthDate} from './brazilIdentity'
import {validatedSandboxCheckoutUrl} from './checkoutUrl'
import type {User} from '@supabase/supabase-js'

export type PayrepProfile={
   display_name:string;cpf:string;birth_date:string;phone:string;postal_code:string;street:string;street_number:string;
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
 return validatedSandboxCheckoutUrl(data.checkoutUrl)
}

export type BillingReconciliationResult={
 state:'active'|'pending'|'needs_review'|'no_paid_checkout'|'provider_unavailable';
 plan?:'free'|'basic'|'full';
 paymentStatus?:string;
 providerPaymentStatus?:string
}
export async function reconcileMyAsaasSandboxBilling():Promise<BillingReconciliationResult>{
 if(!db)throw Error('Banco não configurado.')
 const {data,error}=await db.functions.invoke('billing-reconcile-asaas',{body:{}})
 if(error){
  const message=await checkoutInvokeErrorMessage(error)
  throw Error(message.includes('checkout de homologação')?
   'Não foi possível verificar o pagamento no Asaas. Tente novamente.':message)
 }
 const state=data?.state
 if(!['active','pending','needs_review','no_paid_checkout','provider_unavailable'].includes(state))
  throw Error('Resposta inesperada da conciliação Asaas.')
 return data as BillingReconciliationResult
}

export async function cancelMyAsaasSandboxRenewal():Promise<{canceledRenewal:boolean;accessUntil?:string}>{
 if(!db)throw Error('Banco não configurado.')
 const {data,error}=await db.functions.invoke('billing-cancel-asaas',{body:{}})
 if(error)throw Error(await checkoutInvokeErrorMessage(error))
 if(data?.canceledRenewal!==true)throw Error('Cancelamento não confirmado pelo Asaas.')
 return data as {canceledRenewal:boolean;accessUntil?:string}
}

export type EffectivePayrepPlan={
 effectivePlan:'free'|'basic'|'full';
 paidPlan:'free'|'basic'|'full';
 trialActive:boolean;
 trialStartsAt:string|null;
 trialEndsAt:string|null;
 trialRevokedAt:string|null
}
export async function loadMyEffectivePayrepPlan():Promise<EffectivePayrepPlan>{
 if(!db)throw Error('Banco não configurado.')
 const {data,error}=await db.rpc('my_effective_payrep_plan')
 if(error)throw Error(error.message)
 if(!data||!['free','basic','full'].includes(data.effectivePlan)||typeof data.trialActive!=='boolean')
  throw Error('Dados inválidos do acesso ao plano.')
 return data as EffectivePayrepPlan
}

export const blankProfile=(user?:User|null):PayrepProfile=>({
 display_name:profileDisplayName(user||null),cpf:'',birth_date:'',
 phone:'',postal_code:'',street:'',street_number:'',complement:'',
 neighborhood:'',city:'',state:'',country:'Brasil'
})
const requiredFields:ReadonlyArray<keyof PayrepProfile>=['display_name','phone','postal_code','street','street_number','complement','neighborhood','city','state','country']
export function validateProfile(value:PayrepProfile):PayrepProfile{
 const out={...value}
 for(const key of requiredFields)out[key]=(out[key]||'').trim().replace(/\s+/g,' ')
 if(out.display_name.length<2||out.display_name.length>100)throw Error('Informe um nome entre 2 e 100 caracteres.')
 out.cpf=cpfDigits(out.cpf||'')
 if(out.cpf&&!isValidCpf(out.cpf))throw Error('CPF inválido. Confira os dígitos informados.')
 if(out.birth_date&&!validBirthDate(out.birth_date))throw Error('Informe uma data de nascimento válida, não futura.')
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
 const [profile,identityData]=await Promise.all([
  db!.from('user_profiles').select('display_name,phone,postal_code,street,street_number,complement,neighborhood,city,state,country').eq('user_id',user.id).maybeSingle(),
  db!.rpc('my_payrep_billing_identity')
 ])
 if(profile.error)throw Error(profile.error.message)
 if(identityData.error)throw Error(identityData.error.message)
 const data=profile.data
 const extra=identityData.data||{}
 return {...blankProfile(user),...(data||{}),cpf:extra.cpf||'',birth_date:extra.birth_date||'',
  display_name:data?.display_name||profileDisplayName(user)}
}
export async function saveMyProfile(data:PayrepProfile):Promise<PayrepProfile>{
 const user=await identity()
 const profile=validateProfile(data)
 const {cpf,birth_date,...publicProfile}=profile
 // Store CPF and birth date in a private schema, never in user_profiles/Auth metadata.
 const {error:privateError}=await db!.rpc('save_my_payrep_billing_identity',{
  p_cpf:cpf||null,p_birth_date:birth_date||null
 })
 if(privateError)throw Error(privateError.message)
 const {error}=await db!.from('user_profiles')
  .upsert({user_id:user.id,...publicProfile,updated_at:new Date().toISOString()},{onConflict:'user_id'})
 if(error)throw Error('Dados pessoais salvos, mas houve erro nos demais campos: '+error.message)
 // Mirror ONLY the display name to Auth, not the CPF or birth date.
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
