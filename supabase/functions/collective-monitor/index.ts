import {createClient} from 'npm:@supabase/supabase-js@2.105.0'

type Source={id:string;organization:string;uf:string;source_url:string;last_hash:string|null}
type Outcome='new_document'|'unchanged'|'blocked'|'unsupported'|'error'
const MAX_BYTES=10*1024*1024
const allowedHosts=new Set(['mediador.trabalho.gov.br','www.gov.br'])
const json=(data:Record<string,unknown>,status=200)=>
 new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','cache-control':'no-store'}})
function directOfficialUrl(raw:string):boolean{
 try{
  const url=new URL(raw)
  return url.protocol==='https:'&&allowedHosts.has(url.hostname.toLowerCase())&&
   !url.username&&!url.password&&!url.port
 }catch{return false}
}
async function cappedBytes(response:Response):Promise<Uint8Array>{
 const estimate=Number(response.headers.get('content-length')||0)
 if(estimate>MAX_BYTES)throw Error('Documento excede o limite de 10 MB.')
 if(!response.body)throw Error('Documento sem corpo de resposta.')
 const reader=response.body.getReader()
 const parts:Uint8Array[]=[]
 let total=0
 try{
  while(true){
   const {value,done}=await reader.read()
   if(done)break
   total+=value.byteLength
   if(total>MAX_BYTES)throw Error('Documento excede o limite de 10 MB.')
   parts.push(value)
  }
 }finally{reader.releaseLock()}
 const buffer=new Uint8Array(total)
 let offset=0
 for(const chunk of parts){buffer.set(chunk,offset);offset+=chunk.byteLength}
 return buffer
}
async function hashHex(data:Uint8Array):Promise<string>{
 const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',data))
 return Array.from(digest).map(n=>n.toString(16).padStart(2,'0')).join('')
}
function clauseExcerpt(text:string):string|null{
 const clean=text.replace(/<script[\s\S]*?<\/script>/gi,' ')
  .replace(/<style[\s\S]*?<\/style>/gi,' ')
  .replace(/<[^>]+>/g,' ').replace(/\s+/g,' ')
 const match=/banco de horas|compensa[cç][aã]o de horas|horas extraordin/i.exec(clean)
 return match?clean.slice(Math.max(0,match.index-200),match.index+1300):null
}

Deno.serve(async req=>{
 if(req.method!=='POST')return json({error:'method_not_allowed'},405)
 const url=Deno.env.get('SUPABASE_URL')
 const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
 if(!url||!service||!url.includes('klvurrcmfrwetmynscjc.supabase.co'))
  return json({error:'environment_unavailable'},503)
 const admin=createClient(url,service,{auth:{autoRefreshToken:false,persistSession:false}})
 const token=req.headers.get('x-payrep-collective-worker-token')||''
 const {data:verified,error:authError}=await admin.rpc('verify_collective_monitor_token',{p_token:token})
 if(authError||verified!==true)return json({error:'unauthorized'},401)
 const {data:targetRows,error:listError}=await admin.from('collective_sources')
  .select('id,organization,uf,source_url,last_hash').eq('enabled',true)
  .not('source_url','is',null).order('last_checked_at',{ascending:true,nullsFirst:true}).limit(5)
 if(listError)return json({error:'sources_unavailable'},503)
 const sources=(targetRows||[]) as Source[]
 const stats:Record<Outcome,number>={new_document:0,unchanged:0,blocked:0,unsupported:0,error:0}
 for(const source of sources){
  let outcome:Outcome='error'
  let statusCode:number|null=null
  let nextHash:string|null=null
  let message:string|null=null
  try{
   if(!directOfficialUrl(source.source_url))throw Error('URL de domínio não permitido.')
   const response=await fetch(source.source_url,{
    method:'GET',redirect:'manual',signal:AbortSignal.timeout(12000),
    headers:{'accept':'application/pdf,text/html,text/plain;q=0.8','user-agent':'PayrepPolicyMonitor/1.0'}
   })
   statusCode=response.status
   if([401,403,429].includes(response.status)){
    outcome='blocked';message='A fonte oficial restringiu o acesso (HTTP '+response.status+').'
   }else if(response.status<200||response.status>=300){
    outcome='error';message='HTTP '+response.status+'. Redirecionamentos não são seguidos.'
   }else{
    const contentType=(response.headers.get('content-type')||'').toLowerCase()
    const isPdf=contentType.includes('application/pdf')
    const isHtml=contentType.includes('text/html')
    const isText=contentType.includes('text/plain')
    if(!isPdf&&!isHtml&&!isText){
     outcome='unsupported';message='Formato não suportado: '+contentType.slice(0,90)
    }else{
     const bytes=await cappedBytes(response)
     nextHash=await hashHex(bytes)
     const ext=isPdf?'pdf':isHtml?'html':'txt'
     let text:string|null=null
     if(!isPdf){
      text=new TextDecoder().decode(bytes).slice(0,400000)
      const resemblesInstrument=/(acordo coletivo|convenção coletiva|termo aditivo)/i.test(text)&&
       /(cláusula|clausula)/i.test(text)
      if(!resemblesInstrument){
       outcome='unsupported';message='O endereço não retornou um instrumento coletivo identificável.'
      }
     }
     if(outcome!=='unsupported'){
      const {data:known,error:knownError}=await admin.from('collective_documents')
       .select('id').eq('source_id',source.id).eq('content_hash',nextHash).maybeSingle()
      if(knownError)throw Error(knownError.message)
      if(known||source.last_hash===nextHash){
       outcome='unchanged'
      }else{
       const path='monitored/'+source.id+'/'+nextHash+'.'+ext
       const upload=await admin.storage.from('collective-agreements')
        .upload(path,bytes,{contentType:isPdf?'application/pdf':isHtml?'text/html':'text/plain',upsert:false})
       if(upload.error&&!upload.error.message.toLowerCase().includes('duplicate'))
        throw Error('Armazenamento indisponível: '+upload.error.message)
       const {error:insertError}=await admin.from('collective_documents').insert({
        source_id:source.id,
        title:'Documento detectado · '+source.organization+' / '+source.uf,
        document_type:'UNKNOWN',source_url:source.source_url,
        storage_path:path,content_hash:nextHash,
        raw_text:text,bank_clause_excerpt:text?clauseExcerpt(text):null,
        review_status:'pending'
       })
       if(insertError)throw Error('Falha ao registrar documento: '+insertError.message)
       outcome='new_document'
      }
     }
    }
   }
  }catch(error){
   outcome='error';message=error instanceof Error?error.message:'Falha ao consultar a fonte.'
  }
  const now=new Date().toISOString()
  const sourceUpdate:Record<string,unknown>={
   status:outcome==='blocked'?'blocked':outcome==='error'?'failed':'checked',
   last_checked_at:now,last_http_status:statusCode,last_error:message,
   updated_at:now
  }
  if(outcome==='new_document'||outcome==='unchanged')sourceUpdate.last_hash=nextHash||source.last_hash
  const results=await Promise.all([
   admin.from('collective_sources').update(sourceUpdate).eq('id',source.id),
   admin.from('collective_scan_runs').insert({
    source_id:source.id,status:outcome,status_code:statusCode,
    content_hash:nextHash,error_message:message,started_at:now,completed_at:now
   })
  ])
  if(results.some(r=>r.error))console.warn('collective monitor persistence failed for source',source.id)
  stats[outcome]+=1
 }
 return json({checked:sources.length,results:stats})
})
