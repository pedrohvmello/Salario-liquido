import {createClient} from 'npm:@supabase/supabase-js@2.57.0'

// HML only. A user's own JWT is verified by Supabase Auth. Row deletion
// is executed under the user's RLS/MFA policies, NOT the service role.
const allowedOrigin='https://payrep-hml.vercel.app'
const projectRef='nrpqcrhschztdwbfgnyo'
const cors={
 'Access-Control-Allow-Origin':allowedOrigin,
 'Access-Control-Allow-Headers':'authorization,apikey,x-client-info,content-type',
 'Access-Control-Allow-Methods':'POST,OPTIONS',
 'Vary':'Origin'
}
const reply=(data:Record<string,unknown>,status=200)=>
 new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}})

Deno.serve(async(req:Request)=>{
 if(req.headers.get('origin')!==allowedOrigin)return reply({error:'Origem não autorizada.'},403)
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors})
 if(req.method!=='POST')return reply({error:'Método não permitido.'},405)
 const url=Deno.env.get('SUPABASE_URL')||''
 const anon=Deno.env.get('SUPABASE_ANON_KEY')||''
 const role=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||''
 if(url!==`https://${projectRef}.supabase.co`||!anon||!role)return reply({error:'Ambiente HML indisponível.'},503)
 const bearer=req.headers.get('authorization')||''
 const token=/^Bearer (.+)$/i.exec(bearer)?.[1]||''
 if(!token)return reply({error:'Faça login novamente.'},401)
 let id=''
 try{
  const body=await req.json()
  id=typeof body?.id==='string'?body.id:''
 }catch{return reply({error:'Solicitação inválida.'},400)}
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
  return reply({error:'Documento inválido.'},400)
 const userClient=createClient(url,anon,{global:{headers:{Authorization:'Bearer '+token}},auth:{persistSession:false,autoRefreshToken:false}})
 const admin=createClient(url,role,{auth:{persistSession:false,autoRefreshToken:false}})
 const {data:{user},error:authError}=await userClient.auth.getUser(token)
 if(authError||!user)return reply({error:'Sessão inválida ou expirada.'},401)
 const {data:membership,error:memberError}=await userClient.from('app_members').select('active,status').eq('user_id',user.id).maybeSingle()
 if(memberError||membership?.active!==true||membership?.status!=='approved')
  return reply({error:'Conta sem permissão de acesso.'},403)
 // The RLS SELECT policy checks ownership, current session, and enrolled MFA.
 const {data:document,error:readError}=await userClient.from('statements')
  .select('id,user_id,source_sha256,source_page,storage_key').eq('id',id).eq('user_id',user.id).maybeSingle()
 if(readError)return reply({error:'Não foi possível verificar o documento.'},500)
 if(!document)return reply({error:'Documento não encontrado ou segurança de sessão pendente.'},404)
 const sharedKey=user.id+'/'+document.source_sha256+'.pdf'
 const individualKey=user.id+'/'+document.source_sha256+'-p'+document.source_page+'.pdf'
 if(!/^[0-9a-f]{64}$/i.test(document.source_sha256||'')||![sharedKey,individualKey].includes(document.storage_key))
  return reply({error:'Referência do PDF inconsistente. A exclusão foi bloqueada.'},409)
 const expected=document.storage_key
 // Deleting the statement cascades only to its own rubric lines and linked events.
 const {data:removed,error:deleteError}=await userClient.from('statements')
  .delete().eq('id',id).eq('user_id',user.id).select('id')
 if(deleteError||removed?.length!==1)
  return reply({error:'Não foi possível excluir o holerite. Confira sua autenticação.'},409)
 const {count,error:countError}=await admin.from('statements')
  .select('id',{head:true,count:'exact'}).eq('storage_key',expected)
 if(countError)return reply({deleted:true,fileDeleted:false,cleanupPending:true,message:'Registro removido. A limpeza do PDF precisa ser revisada.'})
 if((count??0)>0)return reply({deleted:true,fileDeleted:false,remainingRecords:count})
 const {error:storageError}=await admin.storage.from('payslips').remove([expected])
 if(storageError)return reply({deleted:true,fileDeleted:false,cleanupPending:true,message:'Registro removido. A limpeza do PDF precisa ser revisada.'})
 return reply({deleted:true,fileDeleted:true})
})
