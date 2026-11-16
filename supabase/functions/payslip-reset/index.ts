import {createClient} from 'npm:@supabase/supabase-js@2.57.0'

// PRD only. Reset runs as the authenticated user in a transaction. The service
// role is used exclusively to remove private PDF objects belonging to this UID.
const allowedOrigins=new Set(['https://payrep.com.br','https://www.payrep.com.br','https://payrep.vercel.app'])
const primaryOrigin='https://payrep.com.br'
const projectRef='klvurrcmfrwetmynscjc'
const cors={
 'Access-Control-Allow-Origin':primaryOrigin,
 'Access-Control-Allow-Headers':'authorization,apikey,x-client-info,content-type',
 'Access-Control-Allow-Methods':'POST,OPTIONS',
 'Vary':'Origin'
}
const respond=(payload:Record<string,unknown>,status=200)=>
 new Response(JSON.stringify(payload),{status,headers:{...cors,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}})

Deno.serve(async(req:Request)=>{
 const requestOrigin=req.headers.get('origin')||primaryOrigin
 if(!allowedOrigins.has(requestOrigin))return respond({error:'Origem não autorizada.'},403)
 // Restrict CORS to the exact allowlisted caller, never echo arbitrary origins.
 cors['Access-Control-Allow-Origin']=requestOrigin
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors})
 if(req.method!=='POST')return respond({error:'Método não permitido.'},405)

 const url=Deno.env.get('SUPABASE_URL')||''
 const anon=Deno.env.get('SUPABASE_ANON_KEY')||''
 const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||''
 if(url!==`https://${projectRef}.supabase.co`||!anon||!serviceKey)
  return respond({error:'Configuração de produção indisponível.'},503)

 const token=/^Bearer (.+)$/i.exec(req.headers.get('authorization')||'')?.[1]||''
 if(!token)return respond({error:'Faça login novamente.'},401)
 let confirmation=''
 let mode:'payroll'|'account'='payroll'
 try{
  const payload=await req.json()
  confirmation=payload?.confirmation||''
  if(payload?.mode!==undefined&&payload.mode!=='payroll'&&payload.mode!=='account')
   return respond({error:'Operação inválida.'},400)
  mode=payload?.mode==='account'?'account':'payroll'
 }catch{return respond({error:'Solicitação inválida.'},400)}
 if(confirmation!=='EXCLUIR')return respond({error:'Digite EXCLUIR para confirmar.'},400)

 const userClient=createClient(url,anon,{global:{headers:{Authorization:'Bearer '+token}},auth:{persistSession:false,autoRefreshToken:false}})
 const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}})
 const {data:{user},error:authError}=await userClient.auth.getUser(token)
 if(authError||!user)return respond({error:'Sua sessão expirou. Faça login novamente.'},401)

 const {data:membership,error:memberError}=await userClient.from('app_members').select('active,status').eq('user_id',user.id).maybeSingle()
 if(memberError||membership?.active!==true||membership?.status!=='approved')
  return respond({error:'Conta não autorizada.'},403)

 // Establish a storage snapshot before clearing DB metadata. Never sweep a
 // different user's folder or newly created files uploaded after this snapshot.
 const pdfKeys:string[]=[]
 for(let offset=0;offset<50000;offset+=1000){
  const {data:items,error:listError}=await admin.storage.from('payslips').list(user.id,{limit:1000,offset})
  if(listError)return respond({error:'Não foi possível consultar seus arquivos. Nenhum dado foi apagado.'},503)
  for(const file of items||[]){
   if(!/^[0-9a-f]{64}(?:-p[1-9]\d*)?\.pdf$/i.test(file.name))
    return respond({error:'Um PDF precisa de revisão antes da exclusão. Nenhum dado foi apagado.'},409)
   pdfKeys.push(user.id+'/'+file.name)
  }
  if((items||[]).length<1000)break
  if(offset>=49000)return respond({error:'Limite de documentos excedido. Nenhum dado foi apagado.'},413)
 }

 // The RPC enforces auth.uid(), approved membership and active MFA session.
 // Deletions of all payroll tables are atomic inside PostgreSQL.
 const action=mode==='account'?'close_my_account':'clear_my_payroll_data'
 const {data:result,error:resetError}=await userClient.rpc(action,
  mode==='account'?{p_confirmation:confirmation}:{confirmation})
 if(resetError||result?.reset!==true)
  return respond({error:'A exclusão foi bloqueada: '+(resetError?.message||'verificação de segurança pendente')},409)

 let filesRemoved=0
 const failures:string[]=[]
 for(let start=0;start<pdfKeys.length;start+=100){
  const batch=pdfKeys.slice(start,start+100)
  const {error:removeError}=await admin.storage.from('payslips').remove(batch)
  if(removeError)failures.push('Falha ao remover um lote de PDFs.')
  else filesRemoved+=batch.length
 }
 // Verify both table state and object cleanup before reporting full success.
 const targets=['statements','salary_events','time_entries','annual_tax_comparisons','user_settings'] as const
 const counts:Record<string,number>={}
 for(const table of targets){
  const {count,error}=await admin.from(table).select('*',{head:true,count:'exact'}).eq('user_id',user.id)
  if(error)return respond({reset:true,cleanupPending:true,error:'Dados removidos, mas a conferência final falhou.'},200)
  counts[table]=count??0
 }
 const {data:remaining,error:verifyFilesError}=await admin.storage.from('payslips').list(user.id,{limit:100})
 const missing=verifyFilesError||Boolean(remaining?.length)||failures.length>0
 const dbClean=Object.values(counts).every(v=>v===0)
 return respond({
  reset:dbClean,
  accountSuspended:mode==='account'&&result?.accountSuspended===true,
  cleanupPending:missing||!dbClean,
  pdfFilesRemoved:filesRemoved,
  removed:result,
  message:dbClean&&!missing
   ?(mode==='account'?'Dados financeiros apagados e conta suspensa. A reativação poderá exigir aprovação.':'Dados salariais excluídos. Seu cadastro e configurações de segurança foram preservados.')
   :'Os dados financeiros foram limpos, mas parte da verificação ou limpeza dos PDFs precisa ser revisada.',
  ...(missing?{storageVerificationPending:true}:{}),
  ...(!dbClean?{error:'Ainda existem dados financeiros associados à conta.'}:{})
 },dbClean?200:500)
})
