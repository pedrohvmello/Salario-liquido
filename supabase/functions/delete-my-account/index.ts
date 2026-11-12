import {createClient} from 'npm:@supabase/supabase-js@2.119.0'

const cors={
 'Access-Control-Allow-Origin':'*',
 'Access-Control-Allow-Methods':'POST, OPTIONS',
 'Access-Control-Allow-Headers':'authorization, apikey, x-client-info, content-type',
 'Content-Type':'application/json'
}
const respond=(body:Record<string,unknown>,status=200)=>new Response(JSON.stringify(body),{status,headers:cors})
function serverSecrets(){
 const url=Deno.env.get('SUPABASE_URL')
 let key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
 if(!key){
  try{
   const raw=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}') as Record<string,string>
   key=raw.default
  }catch{}
 }
 if(!url||!key)throw Error('Credenciais privadas do serviço indisponíveis')
 return {url,key}
}
async function removeOwnedObjects(admin:ReturnType<typeof createClient>,bucket:string,userId:string){
 const storage=admin.storage.from(bucket)
 const files:string[]=[]
 const folders:string[]=[userId]
 while(folders.length){
  const folder=folders.pop()!
  let offset=0
  for(;;){
   const {data,error}=await storage.list(folder,{limit:100,offset,sortBy:{column:'name',order:'asc'}})
   if(error)throw Error('Falha ao consultar arquivos armazenados')
   if(!data?.length)break
   for(const entry of data){
    const path=folder+'/'+entry.name
    if(entry.id)files.push(path)
    else folders.push(path)
    if(files.length+folders.length>10000)throw Error('Quantidade de arquivos excede o limite seguro da exclusão')
   }
   if(data.length<100)break
   offset+=data.length
  }
 }
 for(let i=0;i<files.length;i+=100){
  const {error}=await storage.remove(files.slice(i,i+100))
  if(error)throw Error('Falha ao remover arquivos armazenados')
 }
}
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors})
 if(req.method!=='POST')return respond({error:'Método não permitido.'},405)
 const authHeader=req.headers.get('Authorization')||''
 const match=/^Bearer\s+([^\s]+)$/i.exec(authHeader)
 if(!match)return respond({error:'Autenticação obrigatória.'},401)
 let body:unknown
 try{body=await req.json()}catch{return respond({error:'Solicitação inválida.'},400)}
 if(!body||typeof body!=='object'||(body as {confirmation?:unknown}).confirmation!=='EXCLUIR')
  return respond({error:'Confirmação de exclusão inválida.'},400)
 try{
  const {url,key}=serverSecrets()
  const admin=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}})
  // Get identity from the JWT itself, never from request body / editable metadata.
  const {data:{user},error:authError}=await admin.auth.getUser(match[1])
  if(authError||!user)return respond({error:'Sessão inválida. Entre novamente.'},401)
  const {data:member,error:memberError}=await admin.from('app_members').select('role').eq('user_id',user.id).maybeSingle()
  if(memberError)throw memberError
  if(member?.role==='admin'){
   const {count,error:adminError}=await admin.from('app_members').select('user_id',{head:true,count:'exact'}).eq('role','admin').eq('active',true).eq('status','approved')
   if(adminError)throw adminError
   if((count??0)<=1)return respond({error:'A última conta administradora não pode ser excluída. Transfira a administração antes.'},409)
  }
  // Purge private files using the privileged Storage API, not direct SQL deletes.
  for(const bucket of ['payslips','profile-avatars'])await removeOwnedObjects(admin,bucket,user.id)
  const {error:deleteError}=await admin.auth.admin.deleteUser(user.id)
  if(deleteError)throw deleteError
  return respond({ok:true})
 }catch(err){
  console.error('Self-delete error:',err instanceof Error?err.message:'Unknown error')
  return respond({error:'Não foi possível concluir a exclusão. Nenhuma outra conta foi afetada. Tente novamente ou contate o administrador.'},500)
 }
})
