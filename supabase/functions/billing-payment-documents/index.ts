import {createClient} from 'npm:@supabase/supabase-js@2.57.0'

// HML only: resolve the official Asaas documents for an authenticated owner's
// ledger payment. No provider credentials or raw payment data reach the browser.
const origin='https://payrep-hml.vercel.app'
const ref='nrpqcrhschztdwbfgnyo'
const cors={
 'Access-Control-Allow-Origin':origin,
 'Access-Control-Allow-Headers':'authorization,apikey,x-client-info,content-type',
 'Access-Control-Allow-Methods':'POST,OPTIONS',
 'Content-Type':'application/json; charset=utf-8',
 'Cache-Control':'no-store',
 'Vary':'Origin'
}
const reply=(body:Record<string,unknown>,status=200)=>
 new Response(JSON.stringify(body),{status,headers:cors})
const asText=(value:unknown)=>typeof value==='string'?value.trim():''
const cents=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)?Math.round(value*100):null
const uuid=/^[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$/
const payId=/^pay_[A-Za-z0-9_]{5,80}$/
function safeDocumentUrl(value:unknown):string|null{
 if(typeof value!=='string'||value.length>1600)return null
 try{
  const url=new URL(value)
  if(url.protocol!=='https:'||url.username||url.password||url.port||
   !['www.asaas.com','asaas.com','sandbox.asaas.com'].includes(url.hostname))return null
  return url.href
 }catch{return null}
}
Deno.serve(async(req:Request)=>{
 if(req.headers.get('origin')!==origin)return reply({error:'Origem não autorizada.'},403)
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors})
 if(req.method!=='POST')return reply({error:'Método não permitido.'},405)
 const projectUrl=Deno.env.get('SUPABASE_URL')||''
 const anon=Deno.env.get('SUPABASE_ANON_KEY')||''
 const sandboxKey=Deno.env.get('ASAAS_SANDBOX_API_KEY')||''
 if(projectUrl!=='https://'+ref+'.supabase.co'||!anon||!sandboxKey||
    Deno.env.get('PAYREP_ASAAS_SANDBOX_ENABLED')!=='true')
  return reply({error:'Documentos indisponíveis nesta configuração de homologação.'},503)
 const token=/^Bearer (.+)$/i.exec(req.headers.get('authorization')||'')?.[1]||''
 if(!token)return reply({error:'Faça login novamente.'},401)
 let paymentId=''
 try{
  const raw=await req.text()
  if(raw.length>500)return reply({error:'Dados inválidos.'},400)
  paymentId=asText(JSON.parse(raw).paymentId)
 }catch{return reply({error:'Dados inválidos.'},400)}
 if(!uuid.test(paymentId))return reply({error:'Pagamento inválido.'},400)
 const client=createClient(projectUrl,anon,{
  global:{headers:{Authorization:'Bearer '+token}},
  auth:{persistSession:false,autoRefreshToken:false}
 })
 const {data:{user},error:authError}=await client.auth.getUser(token)
 if(authError||!user)return reply({error:'Sessão inválida.'},401)
 // The query runs as the requesting user under the existing billing_payments
 // RLS policy, plus a redundant user_id predicate. It is read-only.
 const {data:payment,error:paymentError}=await client.from('billing_payments')
  .select('id,user_id,provider,provider_payment_id,amount_cents,currency')
  .eq('id',paymentId).eq('user_id',user.id).maybeSingle()
 if(paymentError)return reply({error:'Não foi possível consultar este pagamento.'},503)
 if(!payment||payment.provider!=='asaas'||!payId.test(payment.provider_payment_id))
  return reply({error:'Pagamento não encontrado.'},404)
 let charge:Record<string,unknown>
 try{
  const response=await fetch('https://api-sandbox.asaas.com/v3/payments/'+encodeURIComponent(payment.provider_payment_id),{
   headers:{'access_token':sandboxKey,'User-Agent':'Payrep-HML/1.0','Accept':'application/json'},
   signal:AbortSignal.timeout(15000)
  })
  if(!response.ok)return reply({error:'Não foi possível consultar a fatura no Asaas.'},502)
  charge=await response.json()
 }catch{return reply({error:'Asaas indisponível. Tente novamente.'},503)}
 if(asText(charge.id)!==payment.provider_payment_id||payment.currency!=='BRL'
   ||cents(charge.value)!==payment.amount_cents)
  return reply({error:'A cobrança retornada não corresponde ao pagamento registrado.'},409)
 const billingType=asText(charge.billingType)
 return reply({
  invoiceUrl:safeDocumentUrl(charge.invoiceUrl),
  receiptUrl:safeDocumentUrl(charge.transactionReceiptUrl),
  invoiceNumber:asText(charge.invoiceNumber).slice(0,60)||null,
  billingType:['PIX','BOLETO','CREDIT_CARD','DEBIT_CARD','TRANSFER','UNDEFINED','RECEIVED_IN_CASH'].includes(billingType)?billingType:null
 })
})
