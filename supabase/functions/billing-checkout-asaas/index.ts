import {createClient} from 'npm:@supabase/supabase-js@2.57.0'

// HML only. Hosted recurring checkout (Asaas Sandbox). No card data reaches Payrep.
// Fail closed until API key, test-mode flag, and saleable plan prices exist.
const origin='https://payrep-hml.vercel.app'
const projectRef='nrpqcrhschztdwbfgnyo'
const headers={
 'Access-Control-Allow-Origin':origin,
 'Access-Control-Allow-Headers':'authorization,apikey,x-client-info,content-type',
 'Access-Control-Allow-Methods':'POST,OPTIONS',
 'Content-Type':'application/json; charset=utf-8',
 'Cache-Control':'no-store','Vary':'Origin'
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
  return reply({error:'Configuração de homologação indisponível.'},503)
 const key=Deno.env.get('ASAAS_SANDBOX_API_KEY')||''
 if(Deno.env.get('PAYREP_ASAAS_SANDBOX_ENABLED')!=='true'||!key)
  return reply({error:'Checkout de teste ainda não habilitado. Configure o Sandbox Asaas no Supabase HML.'},503)
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
   description:'Assinatura mensal de teste. Sandbox sem movimentação financeira real.',
   quantity:1,value:intent.amountCents/100}],
  subscription:{cycle:'MONTHLY',nextDueDate}
 }
 let response:Response
 try{
  response=await fetch('https://api-sandbox.asaas.com/v3/checkouts',{
   method:'POST',headers:{
    'access_token':key,'User-Agent':'Payrep-HML/1.0',
    'Content-Type':'application/json','Accept':'application/json'},
   body:JSON.stringify(body),signal:AbortSignal.timeout(60000)
  })
 }catch{
  // Outcome unknown: never automatically retry to avoid duplicate checkouts.
  return reply({error:'Não foi possível confirmar a criação do checkout no Asaas. Consulte o suporte antes de repetir.'},502)
 }
 const result=await response.json().catch(()=>null)
 if(!response.ok||!result||typeof result.id!=='string'){
  if(response.status>=400&&response.status<500){
   await admin.from('billing_checkout_intents').update({status:'failed',updated_at:new Date().toISOString()})
    .eq('id',intent.id).eq('user_id',user.id).eq('status','pending')
  }
  return reply({error:'O Sandbox Asaas recusou a criação do checkout. Confira a integração e as configurações do plano.'},502)
 }
 if(!/^[0-9a-zA-Z_-]{8,120}$/.test(result.id))
  return reply({error:'Resposta do checkout inesperada. Nenhuma assinatura foi liberada.'},502)
 const {data:saved,error:saveError}=await admin.from('billing_checkout_intents')
  .update({provider_checkout_id:result.id,status:'checkout_created',updated_at:new Date().toISOString()})
  .eq('id',intent.id).eq('user_id',user.id).eq('status','pending')
  .select('id').maybeSingle()
 if(saveError||!saved)return reply({error:'Checkout criado no provedor, mas a vinculação precisa de revisão pelo suporte. Não repita o pagamento.'},503)
 return reply({checkoutUrl:'https://asaas.com/checkoutSession/show?id='+encodeURIComponent(result.id),
  checkoutId:intent.id,mode:'sandbox',plan,intentStatus:'checkout_created'})
})
