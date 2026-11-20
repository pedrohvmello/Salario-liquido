import {createClient} from 'npm:@supabase/supabase-js@2.57.0'

// Production-capable hosted recurring checkout. No card data reaches Payrep.
// Fail closed until API key, test-mode flag, and saleable plan prices exist.
const origin='https://payrep.com.br'
const projectRef='klvurrcmfrwetmynscjc'
const headers={
 'Access-Control-Allow-Origin':origin,
 'Access-Control-Allow-Headers':'authorization,apikey,x-client-info,content-type',
 'Access-Control-Allow-Methods':'POST,OPTIONS',
 'Content-Type':'application/json; charset=utf-8',
 'Cache-Control':'no-store','Vary':'Origin'
}
// Only reuse data belonging to the authenticated user. These fields are sent
// server-to-server to Asaas; do not log, return, or store this payload in an intent.
type PayerProfile={
 display_name?:string|null;phone?:string|null;postal_code?:string|null;
 street?:string|null;street_number?:string|null;complement?:string|null;
 neighborhood?:string|null;country?:string|null
}
function cleanPayerName(value:unknown):string{
 return typeof value==='string'?value.trim().replace(/\s+/g,' '):''
}
function validPayerName(value:unknown):boolean{
 const name=cleanPayerName(value)
 if(name.length<5||name.length>100)return false
 const tokens=name.split(' ')
 return tokens.length>=2&&tokens.every(token=>
  /^[\p{L}][\p{L}'’.-]*$/u.test(token)&&token.replace(/[^\p{L}]/gu,'').length>=2)
}
function checkoutCustomerData(profile:PayerProfile|null,email:string|undefined,cpf:string):Record<string,string>{
 const data:Record<string,string>={cpfCnpj:cpf}
 const clean=(value:unknown,max:number)=>typeof value==='string'?value.trim().slice(0,max):''
 const name=cleanPayerName(profile?.display_name)
 if(validPayerName(name))data.name=name
 const authEmail=clean(email,254)
 if(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(authEmail))data.email=authEmail
 const number=clean(profile?.phone,30).replace(/\D/g,'')
 const localPhone=number.length===13&&number.startsWith('55')?number.slice(2):number
 if(/^\d{10,11}$/.test(localPhone))data.phone=localPhone
 if(!profile||!['brasil','brazil','br'].includes(clean(profile.country,80).toLowerCase()))
  return data
 const postal=clean(profile.postal_code,20).replace(/\D/g,'')
 if(/^\d{8}$/.test(postal))data.postalCode=postal
 const address=clean(profile.street,160)
 const addressNumber=clean(profile.street_number,24)
 const complement=clean(profile.complement,100)
 const province=clean(profile.neighborhood,100)
 if(address)data.address=address
 if(addressNumber)data.addressNumber=addressNumber
 if(complement)data.complement=complement
 if(province)data.province=province
 // Payrep stores city as free text, while Asaas expects a numeric city ID.
 // Never invent a municipality code. The buyer can confirm the city in checkout.
 // The CPF is read separately from private.payrep_billing_identity.
 return data
}
// Construct only the documented Asaas Production checkout destination.
// Never redirect to URLs supplied in the request or an untrusted provider field.
const productionCheckoutUrl=(_candidate:unknown,id:string):string|null=>{
 if(!/^[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$/.test(id))return null
 return 'https://asaas.com/checkoutSession/show?id='+id
}
const reply=(body:Record<string,unknown>,status=200)=>
 new Response(JSON.stringify(body),{status,headers})
Deno.serve(async(req:Request)=>{
 if(req.headers.get('origin')!==origin)return reply({error:'Origem não autorizada.'},403)
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers})
 if(req.method!=='POST')return reply({error:'Método não permitido.'},405)
 const url=Deno.env.get('SUPABASE_URL')||''
 const anon=Deno.env.get('SUPABASE_ANON_KEY')||''
 const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||''
 if(url!==('https://'+projectRef+'.supabase.co')||!anon||!service)
  return reply({error:'Configuração de produção indisponível.'},503)
 const key=Deno.env.get('ASAAS_PRODUCTION_API_KEY')||''
 if(Deno.env.get('PAYREP_ASAAS_PRODUCTION_ENABLED')!=='true'||!key)
  return reply({error:'Checkout de produção indisponível até a conclusão da configuração e homologação financeira.'},503)
 const token=/^Bearer (.+)$/i.exec(req.headers.get('authorization')||'')?.[1]||''
 if(!token)return reply({error:'Faça login novamente.'},401)
 let plan=''
 try{const body=await req.json();plan=typeof body.plan==='string'?body.plan:''}
 catch{return reply({error:'Dados de checkout inválidos.'},400)}
 if(!['basic','full'].includes(plan))return reply({error:'Plano inválido.'},400)
 const userClient=createClient(url,anon,{global:{headers:{Authorization:'Bearer '+token}},
  auth:{persistSession:false,autoRefreshToken:false}})
 const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}})
 const {data:{user},error:authError}=await userClient.auth.getUser(token)
 if(authError||!user)return reply({error:'Sessão inválida.'},401)
 const {data:member,error:memberError}=await admin.from('app_members')
  .select('active,status').eq('user_id',user.id).maybeSingle()
 if(memberError||!member||member.active!==true||member.status!=='approved')
  return reply({error:'Conta não autorizada para contratar ou retomar checkout.'},403)
 // A CPF is optional at signup. It becomes necessary only for a paid checkout.
 // Read it from the authenticated user's private identity, never from the
 // request body. Reject before creating any billing intent or provider charge.
 const {data:identity,error:identityError}=await admin.rpc('billing_identity_for_asaas',{
  p_user_id:user.id
 })
 if(identityError)return reply({error:'Não foi possível validar o CPF cadastrado.'},503)
 const cpf=typeof identity?.cpf==='string'?identity.cpf:''
 if(!/^[0-9]{11}$/.test(cpf))
  return reply({code:'CPF_REQUIRED',error:'Informe seu CPF para iniciar uma assinatura. O CPF será salvo em seu cadastro.'},422)
 // Fetch the authenticated account's payer data on the server; never accept
 // arbitrary customer IDs or personal details from the checkout request body.
 const [{data:profile,error:profileError},{data:billing,error:billingError}]=await Promise.all([
  admin.from('user_profiles')
   .select('display_name,phone,postal_code,street,street_number,complement,neighborhood,country')
   .eq('user_id',user.id).maybeSingle(),
  admin.from('billing_subscriptions')
   .select('provider,provider_customer_id')
   .eq('user_id',user.id).maybeSingle()
 ])
 if(profileError||billingError)return reply({error:'Não foi possível consultar os dados do pagador.'},503)
 const knownCustomer=billing?.provider==='asaas'
  &&typeof billing.provider_customer_id==='string'
  &&/^cus_[A-Za-z0-9_]{5,80}$/.test(billing.provider_customer_id)
  ?billing.provider_customer_id:null
 // Do not send nickname-like profile names (e.g. "LRP") to Asaas.
 // Validate before begin_my_billing_checkout so no failed attempt is recorded.
 if(!knownCustomer&&!validPayerName(profile?.display_name))
  return reply({code:'NAME_REQUIRED',error:'Informe seu nome completo (nome e sobrenome) para contratar. O nome será salvo em Meu cadastro.'},422)
 const customerData=knownCustomer?null:checkoutCustomerData(profile,user.email,cpf)
 // Reusing an Asaas customer is safe only if its CPF matches the user's
 // newly confirmed CPF. Otherwise do not create or update a payer by guess.
 if(knownCustomer){
  let savedCustomer:Record<string,unknown>|null=null
  try{
   const response=await fetch('https://api.asaas.com/v3/customers/'+encodeURIComponent(knownCustomer),{
    method:'GET',headers:{access_token:key,'User-Agent':'Payrep-PRD/1.0','Accept':'application/json'},
    signal:AbortSignal.timeout(12000)
   })
   if(response.ok)savedCustomer=await response.json()
  }catch{}
  const customerCpf=typeof savedCustomer?.cpfCnpj==='string'
   ?savedCustomer.cpfCnpj.replace(/\D/g,''):''
  if(!savedCustomer||savedCustomer.id!==knownCustomer||customerCpf!==cpf)
   return reply({error:'O CPF do cadastro não corresponde ao cliente vinculado no Asaas ou não pôde ser verificado. Contate o suporte antes de contratar.'},409)
 }
 // A prior checkout may already exist even if the user saw a 404 on the old redirect.
 // Read only the authenticated user's RLS-protected attempts to avoid duplicate billing.
 const {data:existing,error:existingError}=await userClient.from('billing_checkout_intents')
  .select('id,plan_code,status,provider_checkout_id,expires_at')
  .eq('user_id',user.id).in('status',['pending','checkout_created'])
  .gt('expires_at',new Date().toISOString())
  .order('created_at',{ascending:false}).limit(1).maybeSingle()
 if(existingError)return reply({error:'Não foi possível consultar um checkout já iniciado.'},403)
 if(existing){
  if(existing.plan_code!==plan)return reply({error:'Já existe um checkout em andamento para outro plano. Aguarde a expiração antes de trocar de plano.'},409)
  if(existing.status==='pending'||!existing.provider_checkout_id)
   return reply({error:'Já existe uma tentativa de checkout em processamento. Não crie outra cobrança.'},409)
  const {data:event,error:eventError}=await admin.from('billing_webhook_events')
   .select('payload').eq('provider','asaas').eq('event_type','CHECKOUT_CREATED')
   .eq('provider_checkout_id',existing.provider_checkout_id)
   .order('received_at',{ascending:false}).limit(1).maybeSingle()
  if(eventError)return reply({error:'Checkout localizado, mas a URL ainda não pôde ser verificada.'},503)
  const resumedLink=productionCheckoutUrl(event?.payload?.checkout?.link,existing.provider_checkout_id)
  if(!resumedLink)return reply({error:'Checkout existente, mas o link do Asaas ainda não foi recebido ou validado. Não gere uma nova cobrança.'},409)
  return reply({checkoutUrl:resumedLink,checkoutId:existing.id,mode:'production',plan,intentStatus:'checkout_created',resumed:true})
 }
 const {data:intent,error:intentError}=await userClient.rpc('begin_my_billing_checkout',{p_plan:plan})
 if(intentError)return reply({error:intentError.message},409)
 if(typeof intent?.id!=='string'||!Number.isSafeInteger(intent?.amountCents)||intent.amountCents<=0)
  return reply({error:'Não foi possível confirmar o preço.'},503)
 const nextDueDate=new Date(Date.now()+10*60*1000).toISOString().slice(0,19).replace('T',' ')
 const body={
  billingTypes:['CREDIT_CARD'],
  chargeTypes:['RECURRENT'],
  minutesToExpire:60,
  externalReference:intent.id,
  callback:{
   successUrl:origin+'/?billing=success',
   cancelUrl:origin+'/?billing=cancel',
   expiredUrl:origin+'/?billing=expired'
  },
  items:[{name:'Payrep '+(plan==='basic'?'Basic':'Full'),
   description:'Assinatura mensal Payrep. Cobrança real recorrente após confirmação no Asaas.',
   quantity:1,value:intent.amountCents/100}],
  subscription:{cycle:'MONTHLY',nextDueDate},
  // Asaas supports either an existing linked customer OR prefilled payer data.
  // Never send both. CPF always comes from the server-side verified identity.
  ...(knownCustomer?{customer:knownCustomer}
   :customerData&&Object.keys(customerData).length>0?{customerData}:{})
 }
 let response:Response
 try{
  response=await fetch('https://api.asaas.com/v3/checkouts',{
   method:'POST',headers:{
    'access_token':key,'User-Agent':'Payrep-PRD/1.0',
    'Content-Type':'application/json','Accept':'application/json'},
   body:JSON.stringify(body),signal:AbortSignal.timeout(60000)
  })
 }catch{
  // Outcome unknown: never automatically retry to avoid duplicate checkouts.
  return reply({error:'Não foi possível confirmar a criação do checkout no Asaas. Consulte o suporte antes de repetir.'},502)
 }
 const result=await response.json().catch(()=>null)
 if(!response.ok||!result||typeof result.id!=='string'){
  // Report only the documented, non-sensitive validation diagnostics.
  // Never log response bodies, API credentials, request headers, or payer data.
  const providerErrors=Array.isArray(result?.errors)?result.errors.slice(0,3):[]
  const codes=providerErrors.map((item:unknown)=>{
   const code=(item&&typeof item==='object'&&'code' in item)?item.code:null
   return typeof code==='string'&&/^[a-zA-Z0-9_-]{1,50}$/.test(code)?code:null
  }).filter((x:string|null):x is string=>x!==null)
  const descriptions=providerErrors.map((item:unknown)=>{
   const value=(item&&typeof item==='object'&&'description' in item)?item.description:null
   if(typeof value!=='string')return null
   const description=value.trim().split(String.fromCharCode(10)).join(' ').split(String.fromCharCode(13)).join(' ')
   if(!description||description.length>180)return null
   const forbidden=['@','://','token','api key','apikey','senha','password','secret','bearer','<','>']
   const normalized=description.toLowerCase()
   if(forbidden.some(word=>normalized.includes(word))||/[0-9]{6,}/.test(description))return null
   return description
  }).filter((x:string|null):x is string=>x!==null)
  console.error('asaas_production_checkout_rejected',JSON.stringify({
   status:response.status,codes,descriptions,parseable:result!==null
  }))
  if(response.status>=400&&response.status<500){
   await admin.from('billing_checkout_intents').update({status:'failed',updated_at:new Date().toISOString()})
    .eq('id',intent.id).eq('user_id',user.id).eq('status','pending')
  }
  const reason=response.status===401
   ?'Verifique se a chave de API corresponde ao ambiente de produção e possui permissão para criar checkouts.'
   :response.status===403
   ?'O Asaas negou a operação. Verifique as permissões da conta de produção.'
   :descriptions.length?descriptions.join(' '):'Consulte o suporte com o status informado.'
  return reply({error:'Asaas (HTTP '+response.status+'): '+reason,
   providerStatus:response.status,providerErrorCodes:codes},502)
 }
 if(!/^[0-9a-zA-Z_-]{8,120}$/.test(result.id))
  return reply({error:'Resposta do checkout inesperada. Nenhuma assinatura foi liberada.'},502)
 const {data:saved,error:saveError}=await admin.from('billing_checkout_intents')
  .update({provider_checkout_id:result.id,status:'checkout_created',updated_at:new Date().toISOString()})
  .eq('id',intent.id).eq('user_id',user.id).eq('status','pending')
  .select('id').maybeSingle()
 if(saveError||!saved)return reply({error:'Checkout criado no provedor, mas a vinculação precisa de revisão pelo suporte. Não repita o pagamento.'},503)
 const providerLink=productionCheckoutUrl(result.link,result.id)
 if(!providerLink)return reply({error:'Checkout criado no Asaas, mas a URL do checkout não passou na validação de produção. Não repita a cobrança; contate o suporte.',checkoutId:intent.id},503)
 return reply({checkoutUrl:providerLink,
  checkoutId:intent.id,mode:'production',plan,intentStatus:'checkout_created'})
})
