import {createClient} from 'npm:@supabase/supabase-js@2.57.0'

// Read-only, admin-only Asaas financial reporting for Payrep HML.
// This function never creates transfers, refunds, payments or customers.
const origin='https://payrep.com.br'
const project='klvurrcmfrwetmynscjc'
const headers={
 'Content-Type':'application/json; charset=utf-8',
 'Access-Control-Allow-Origin':origin,
 'Access-Control-Allow-Headers':'authorization,apikey,x-client-info,content-type',
 'Access-Control-Allow-Methods':'POST,OPTIONS',
 'Cache-Control':'no-store','Vary':'Origin'
}
const respond=(body:Record<string,unknown>,status=200)=>
 new Response(JSON.stringify(body),{status,headers})
const str=(v:unknown,max=160)=>typeof v==='string'?v.slice(0,max):''
const amount=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?v:null
const number=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?v:null
const row=(v:unknown):Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{}
const text=(v:unknown)=>str(v,100)
const extract=(data:unknown)=>Array.isArray(row(data).data)?row(data).data as unknown[]:[]
const limited=(v:unknown,max=5000)=>{
 const n=Number(v)
 return Number.isSafeInteger(n)&&n>=0&&n<=max?n:0
}
function todayUTC(){return new Date().toISOString().slice(0,10)}
function daysBefore(days:number){return new Date(Date.now()-days*86400000).toISOString().slice(0,10)}
async function asaasGet(path:string,key:string){
 const response=await fetch('https://api.asaas.com/v3/'+path,{
  method:'GET',headers:{'access_token':key,'User-Agent':'Payrep-PRD/1.0','Accept':'application/json'},
  signal:AbortSignal.timeout(14000)
 })
 if(!response.ok)throw Error('Asaas status '+response.status)
 return await response.json()
}
Deno.serve(async(req:Request)=>{
 if(req.headers.get('origin')!==origin)return respond({error:'Origem não autorizada.'},403)
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers})
 if(req.method!=='POST')return respond({error:'Método não permitido.'},405)
 const url=Deno.env.get('SUPABASE_URL')||''
 const anon=Deno.env.get('SUPABASE_ANON_KEY')||''
 const key=Deno.env.get('ASAAS_PRODUCTION_API_KEY')||''
 if(url!=='https://'+project+'.supabase.co'||!anon||!key||
  Deno.env.get('PAYREP_ASAAS_PRODUCTION_ENABLED')!=='true'||Deno.env.get('PAYREP_ASAAS_LIVE_RELEASED')!=='true')
  return respond({error:'Consulta Asaas indisponível em homologação.'},503)
 const token=/^Bearer (.+)$/i.exec(req.headers.get('authorization')||'')?.[1]||''
 if(!token)return respond({error:'Sessão necessária.'},401)
 const userClient=createClient(url,anon,{global:{headers:{Authorization:'Bearer '+token}},
  auth:{persistSession:false,autoRefreshToken:false}})
 const {data:{user},error:userError}=await userClient.auth.getUser(token)
 if(userError||!user)return respond({error:'Sessão inválida.'},401)
 // The existing private.is_current_admin() enforces approved admin + AAL2 TOTP.
 const {data:isAdmin,error:adminError}=await userClient.rpc('is_app_admin')
 if(adminError||isAdmin!==true)return respond({error:'Somente administradores verificados.'},403)
 let params:Record<string,unknown>={}
 try{params=row(await req.json())}catch{return respond({error:'Parâmetros inválidos.'},400)}
 const period=params.days===7?7:params.days===90?90:30
 const offset=limited(params.offset)
 const limit=40
 const start=daysBefore(period-1)
 const end=todayUTC()
 const financialPath='financialTransactions?'+new URLSearchParams({
  limit:String(limit),offset:String(offset),startDate:start,finishDate:end
 }).toString()
 const paymentPath='payments?'+new URLSearchParams({
  limit:'50',offset:'0', 'dateCreated[ge]':start,'dateCreated[le]':end
 }).toString()
 try{
  const [balanceData,statementData,paymentsData]=await Promise.all([
   asaasGet('finance/balance',key),asaasGet(financialPath,key),asaasGet(paymentPath,key)
  ])
  const balance=amount(row(balanceData).balance)
  const transactions=extract(statementData).map(value=>{
   const v=row(value)
   return {
    id:str(v.id,100),date:str(v.date,40),description:str(v.description,220),
    type:text(v.type),value:amount(v.value),
    balance:amount(v.balance),paymentId:str(v.paymentId,100)
   }
  })
  const payments=extract(paymentsData).map(value=>{
   const v=row(value)
   return {
    id:str(v.id,100),status:text(v.status),dueDate:str(v.dueDate,40),
    paymentDate:str(v.paymentDate,40),value:amount(v.value),
    netValue:amount(v.netValue),billingType:text(v.billingType),
    subscription:str(v.subscription,100)
   }
  })
  return respond({
   environment:'production',currency:'BRL',periodDays:period,
   fetchedAt:new Date().toISOString(),balance,
   transactions,transactionsHasMore:row(statementData).hasMore===true,
   transactionsOffset:offset,transactionsLimit:limit,
   payments,paymentsHasMore:row(paymentsData).hasMore===true
  })
 }catch(error){
  const reason=error instanceof Error?error.message:'Falha na consulta ao Asaas'
  // Never return or log sensitive provider payloads, headers or credentials.
  const code=/Asaas status ([0-9]{3})/.exec(reason)?.[1]
  console.error('finance_asaas_read_failure',{code:code||'network'})
  return respond({error:code?
   'Consulta financeira indisponível no Asaas (HTTP '+code+').':
   'Não foi possível consultar saldo e extrato do Asaas agora.'},502)
 }
})
