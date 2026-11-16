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
 return respond({received:true,duplicate:data.duplicate===true,needsReview:data.needsReview===true})
})
