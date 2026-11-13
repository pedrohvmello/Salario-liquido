import {createClient} from 'npm:@supabase/supabase-js@2.105.0'
import {cloudflareNeuronsQuery,parseAiNeuronUsage} from './metrics.ts'

// HML-only, admin-only Cloudflare Workers AI analytics. Never discloses tokens.
// Cloudflare's GraphQL dataset is account-wide and adaptively sampled.
const ORIGIN='https://payrep-hml.vercel.app'
const cors={
 'Access-Control-Allow-Origin':ORIGIN,
 'Access-Control-Allow-Methods':'GET, OPTIONS',
 'Access-Control-Allow-Headers':'authorization, apikey, x-client-info, content-type',
 'Vary':'Origin',
}
const json=(body:Record<string,unknown>,status=200)=>
 new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}})
const DAILY_FREE_NEURONS=10000
type Cached={day:string,expiry:number,result:Record<string,unknown>}
let cache:Cached|null=null
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors})
 if(req.method!=='GET')return json({error:'method_not_allowed'},405)
 const origin=req.headers.get('origin')
 if(origin&&origin!==ORIGIN)return json({error:'origin_not_allowed'},403)
 const apiUrl=Deno.env.get('SUPABASE_URL')
 const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
 if(!apiUrl?.includes('nrpqcrhschztdwbfgnyo.supabase.co')||!serviceKey)
  return json({error:'environment_unavailable'},503)
 const bearer=/^Bearer\s+(\S+)$/i.exec(req.headers.get('authorization')||'')
 if(!bearer)return json({error:'authentication_required'},401)
 const db=createClient(apiUrl,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}})
 const {data:{user},error:userError}=await db.auth.getUser(bearer[1])
 if(userError||!user)return json({error:'authentication_required'},401)
 const {data:member,error:memberError}=await db.from('app_members')
  .select('active,status,role').eq('user_id',user.id).maybeSingle()
 if(memberError||!member?.active||member.status!=='approved'||member.role!=='admin')
  return json({error:'administrator_required'},403)

 const day=new Date().toISOString().slice(0,10)
 const base={day,limit:DAILY_FREE_NEURONS,scope:'cloudflare_account',timezone:'UTC'}
 const analyticsToken=Deno.env.get('CLOUDFLARE_AI_USAGE_API_TOKEN')
 const account=Deno.env.get('CLOUDFLARE_ACCOUNT_ID')
 if(!analyticsToken||!account)
  return json({...base,status:'not_configured'})
 if(!/^[a-f0-9]{32}$/i.test(account))return json({...base,status:'not_configured'})
 if(cache&&cache.day===day&&cache.expiry>Date.now())return json(cache.result)
 const body=JSON.stringify({query:cloudflareNeuronsQuery(account,day)})
 try{
  const res=await fetch('https://api.cloudflare.com/client/v4/graphql',{
   method:'POST',
   headers:{Authorization:'Bearer '+analyticsToken,'Content-Type':'application/json'},
   body,redirect:'manual',signal:AbortSignal.timeout(10000)
  })
  if(!res.ok||res.status>=300)return json({...base,status:'unavailable'})
  const usage=parseAiNeuronUsage(await res.json())
  if(!usage)return json({...base,status:'unavailable'})
  const now=new Date().toISOString()
  const result={...base,status:'available',neuronsUsed:usage.used,
   neuronsRemaining:Math.max(0,DAILY_FREE_NEURONS-usage.used),
   models:usage.models,refreshedAt:now,
   note:'Total informado pela Cloudflare para a conta inteira; pode ter atraso e amostragem.'}
  cache={day,expiry:Date.now()+10*60*1000,result}
  return json(result)
 }catch(e){
  console.warn('Cloudflare Workers AI analytics unavailable',e instanceof Error?e.name:'unknown')
  return json({...base,status:'unavailable'})
 }
})
