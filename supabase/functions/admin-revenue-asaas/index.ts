import {createClient} from 'npm:@supabase/supabase-js@2.57.0'

// Read-only Payrep HML revenue time series. Only paid Asaas checkouts with a
// verified SUBSCRIPTION_CREATED event are included, even after cancellation.
// No customer details, raw payments, keys, or webhook payloads leave the server.
const origin='https://payrep.com.br'
const project='klvurrcmfrwetmynscjc'
const headers={
 'Content-Type':'application/json; charset=utf-8',
 'Access-Control-Allow-Origin':origin,
 'Access-Control-Allow-Headers':'authorization,apikey,x-client-info,content-type',
 'Access-Control-Allow-Methods':'POST,OPTIONS',
 'Cache-Control':'no-store','Vary':'Origin'
}
const respond=(payload:Record<string,unknown>,status=200)=>
 new Response(JSON.stringify(payload),{status,headers})
const record=(v:unknown):Record<string,unknown>=>
 v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{}
const str=(v:unknown):string=>typeof v==='string'?v:''
const moneyCents=(v:unknown):number|null=>
 typeof v==='number'&&Number.isFinite(v)&&v>=0?Math.round(v*100):null
const validDay=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)
 &&!Number.isNaN(Date.parse(value+'T12:00:00Z'))
const paidStatuses=new Set(['CONFIRMED','RECEIVED'])
type Plan='basic'|'full'
type BucketValues={grossCents:number;netCents:number;paymentCount:number;missingNetCount:number}
type Bucket={period:string;label:string;basic:BucketValues;full:BucketValues}
const zero=():BucketValues=>({grossCents:0,netCents:0,paymentCount:0,missingNetCount:0})
const monthNames=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const maxRows=5000
const pageSize=100
const api='https://api.asaas.com/v3/'
async function getPayments(key:string,from:string,to:string){
 const payments:Record<string,unknown>[]=[]
 for(let offset=0;offset<maxRows;offset+=pageSize){
  const params=new URLSearchParams({
   limit:String(pageSize),offset:String(offset),
   'paymentDate[ge]':from,'paymentDate[le]':to
  })
  const response=await fetch(api+'payments?'+params.toString(),{
   headers:{access_token:key,'User-Agent':'Payrep-PRD/1.0',Accept:'application/json'},
   signal:AbortSignal.timeout(18000)
  })
  if(!response.ok)throw Error('Asaas HTTP '+response.status)
  const body=record(await response.json())
  if(!Array.isArray(body.data)||typeof body.hasMore!=='boolean')
   throw Error('Resposta de cobranças sem paginação válida')
  payments.push(...body.data.map(record))
  if(!body.hasMore)return payments
 }
 throw Error('Relatório supera 5.000 cobranças. Filtre um período menor antes de exportar.')
}
Deno.serve(async(req:Request)=>{
 if(req.headers.get('origin')!==origin)return respond({error:'Origem não autorizada.'},403)
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers})
 if(req.method!=='POST')return respond({error:'Método não permitido.'},405)
 const url=Deno.env.get('SUPABASE_URL')||''
 const anon=Deno.env.get('SUPABASE_ANON_KEY')||''
 const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||''
 const key=Deno.env.get('ASAAS_PRODUCTION_API_KEY')||''
 if(url!=='https://'+project+'.supabase.co'||!anon||!service||!key
  ||Deno.env.get('PAYREP_ASAAS_PRODUCTION_ENABLED')!=='true'||Deno.env.get('PAYREP_ASAAS_LIVE_RELEASED')!=='true')
  return respond({error:'Relatório de faturamento não configurado no HML.'},503)
 const token=/^Bearer (.+)$/i.exec(req.headers.get('authorization')||'')?.[1]||''
 if(!token)return respond({error:'Faça login novamente.'},401)
 const caller=createClient(url,anon,{
  global:{headers:{Authorization:'Bearer '+token}},
  auth:{persistSession:false,autoRefreshToken:false}
 })
 const {data:{user},error:authError}=await caller.auth.getUser(token)
 if(authError||!user)return respond({error:'Sessão inválida.'},401)
 // This backend authorization requires the verified admin's AAL2 TOTP.
 const {data:isAdmin,error:adminError}=await caller.rpc('is_app_admin')
 if(adminError||isAdmin!==true)return respond({error:'Acesso financeiro restrito ao administrador verificado.'},403)
 let args:Record<string,unknown>={}
 try{args=record(await req.json())}catch{return respond({error:'Parâmetros inválidos.'},400)}
 const view=args.view==='annual'?'annual':args.view==='monthly'?'monthly':null
 if(!view)return respond({error:'Escolha Mensal ou Anual.'},400)
 const currentYear=Number(new Intl.DateTimeFormat('en-US',{
  timeZone:'America/Sao_Paulo',year:'numeric'
 }).format(new Date()))
 const startYear=currentYear-4
 const year=typeof args.year==='number'?args.year:NaN
 if(view==='monthly'&&(!Number.isInteger(year)||year<startYear||year>currentYear))
  return respond({error:'Ano fora do intervalo disponível.'},400)
 const firstYear=view==='monthly'?year:startYear
 const lastYear=view==='monthly'?year:currentYear
 const from=firstYear+'-01-01'
 const to=lastYear+'-12-31'
 const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}})
 try{
  // Authoritative historical plan assignment. Never infer the plan from the
  // current subscription: an expired/canceled Full can revert to Free.
  const [intents,events]=await Promise.all([
   admin.from('billing_checkout_intents')
    .select('plan_code,provider_checkout_id')
    .eq('provider','asaas').eq('status','paid').in('plan_code',['basic','full'])
    .order('created_at',{ascending:false}).limit(maxRows),
   admin.from('billing_webhook_events')
    .select('payload').eq('provider','asaas').eq('event_type','SUBSCRIPTION_CREATED')
    .order('received_at',{ascending:false}).limit(maxRows)
  ])
  if(intents.error||events.error||!intents.data||!events.data)
   throw Error('Falha ao recuperar vínculo de assinaturas')
  if(intents.data.length>=maxRows||events.data.length>=maxRows)
   throw Error('O mapeamento histórico ultrapassou o limite de segurança')
  const checkoutPlans=new Map<string,Plan>()
  for(const intent of intents.data){
   if((intent.plan_code==='basic'||intent.plan_code==='full')
     &&typeof intent.provider_checkout_id==='string')
    checkoutPlans.set(intent.provider_checkout_id,intent.plan_code)
  }
  const subscriptionPlans=new Map<string,Plan>()
  const ambiguous=new Set<string>()
  for(const event of events.data){
   const subscription=record(record(event.payload).subscription)
   const subId=str(subscription.id)
   const checkoutId=str(subscription.checkoutSession)
   const plan=checkoutPlans.get(checkoutId)
   if(!/^sub_[A-Za-z0-9_]{5,80}$/.test(subId)||!plan)continue
   const previous=subscriptionPlans.get(subId)
   if(previous&&previous!==plan)ambiguous.add(subId)
   else subscriptionPlans.set(subId,plan)
  }
  for(const subId of ambiguous)subscriptionPlans.delete(subId)
  const providerPayments=await getPayments(key,from,to)
  const buckets:Bucket[]=[]
  if(view==='monthly'){
   for(let month=1;month<=12;month++)
    buckets.push({period:year+'-'+String(month).padStart(2,'0'),
     label:monthNames[month-1],basic:zero(),full:zero()})
  }else{
   for(let y=firstYear;y<=lastYear;y++)
    buckets.push({period:String(y),label:String(y),basic:zero(),full:zero()})
  }
  const byPeriod=new Map(buckets.map(item=>[item.period,item]))
  const seen=new Set<string>()
  let ignoredOutsidePayrep=0
  let invalidRows=0
  for(const payment of providerPayments){
   if(!paidStatuses.has(str(payment.status)))continue
   const paymentId=str(payment.id)
   if(!paymentId||seen.has(paymentId))continue
   seen.add(paymentId)
   const plan=subscriptionPlans.get(str(payment.subscription))
   if(!plan){ignoredOutsidePayrep++;continue}
   const when=str(payment.paymentDate)||str(payment.confirmedDate)
   const gross=moneyCents(payment.value)
   if(!validDay(when)||gross===null){invalidRows++;continue}
   const period=view==='monthly'?when.slice(0,7):when.slice(0,4)
   const bucket=byPeriod.get(period)
   if(!bucket){invalidRows++;continue}
   const entry=bucket[plan]
   entry.paymentCount++
   entry.grossCents+=gross
   const net=moneyCents(payment.netValue)
   if(net===null)entry.missingNetCount++
   else entry.netCents+=net
  }
  return respond({
   environment:'production',source:'asaas',currency:'BRL',
   view,year:view==='monthly'?year:null,firstYear,lastYear,
   fetchedAt:new Date().toISOString(),
   buckets,ignoredOutsidePayrep,invalidRows,
   countingRule:'confirmed_or_received_by_payment_date',
   netRule:'asaas_net_value_no_estimated_fees'
  })
 }catch(error){
  const reason=error instanceof Error?error.message:'Falha no relatório'
  const statusCode=/Asaas HTTP (\d{3})/.exec(reason)?.[1]
  console.error('hml_finance_revenue_error',{code:statusCode||'internal'})
  return respond({error:statusCode?
   'Consulta de faturamento indisponível no Asaas (HTTP '+statusCode+').':
   reason==='Relatório supera 5.000 cobranças. Filtre um período menor antes de exportar.'?reason:
   'Não foi possível consolidar o faturamento por plano no Asaas. Não exibimos valores parciais.'},503)
 }
})
