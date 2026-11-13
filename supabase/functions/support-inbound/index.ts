// Authenticated inbound-email webhook for Payrep HML.
// Default disabled. Enable only after Maileroo route setup and HML acceptance.
// No user-facing credentials are accepted. Maileroo proves authenticity with a
// single-use validation URL, checked before any ticket data is inserted.
import {createClient} from 'npm:@supabase/supabase-js@2.105.0'
import {inspectMailerooEmail} from './validation.ts'

Deno.serve(async request=>{
 if(request.method!=='POST')return new Response('Method not allowed',{status:405})
 if(Deno.env.get('SUPPORT_INBOUND_ENABLED')!=='true'){
  return new Response('Inbound support email is not enabled',{status:503})
 }
 const len=Number(request.headers.get('content-length')||0)
 if(len>65536)return new Response('Payload too large',{status:413})
 const raw=await request.text()
 if(raw.length>65536)return new Response('Payload too large',{status:413})
 let payload:unknown
 try{payload=JSON.parse(raw)}catch{return new Response('Invalid JSON',{status:400})}
 const parsed=inspectMailerooEmail(payload)
 if(!parsed.candidate){
  // Reason codes only; never log email headers, addresses, tokens or message text.
  console.warn('Payrep inbound rejected format:',parsed.reason)
  // Unexpected provider payloads may be fixed before a provider retry, whereas
  // intentionally blocked spam/DMARC/autoresponses should not be retried.
  const retryable=['invalid_structure','invalid_event_id','invalid_message_id',
   'invalid_recipients','missing_sender','missing_reply_text','invalid_validation_url']
   .includes(parsed.reason)
  return Response.json({accepted:false,reason:'not_eligible'},{
   status:retryable?503:200
  })
 }
 const candidate=parsed.candidate
 const url=Deno.env.get('SUPABASE_URL')
 const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
 if(!url||!key)return new Response('Backend unavailable',{status:503})
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})
 // Ensure DB is reachable before consuming one-time Maileroo validation URL.
 const {error:pingError}=await db.from('support_ticket_reply_routes')
  .select('ticket_id',{head:true,count:'exact'}).limit(1)
 if(pingError)return new Response('Backend unavailable',{status:503})
 let proven=false
 try{
  // The parser validates the exact HTTPS origin and path, preventing SSRF.
  const verification=await fetch(candidate.validationUrl,{
   method:'GET',redirect:'error',signal:AbortSignal.timeout(5000)
  })
  const response=await verification.json() as {success?:boolean}
  proven=verification.ok&&response.success===true
 }catch{
  return new Response('Maileroo verification unavailable',{status:503})
 }
 if(!proven){
  // Duplicate callbacks can present a validation URL that has already been
  // consumed. No processing is attempted without a fresh verification.
  return Response.json({accepted:false,reason:'verification_failed'})
 }
 const {data,error}=await db.rpc('ingest_support_inbound_email',{
  p_recipient:candidate.recipient,
  p_sender_email:candidate.senderEmail,
  p_source_message_id:candidate.sourceMessageId,
  p_body:candidate.body
 })
 if(error){
  const denied=/Invalid email payload|Unknown recipient or sender|Backend authorization required/i.test(error.message)
  if(denied)return Response.json({accepted:false,reason:'unauthorized_or_unknown'})
  // Maileroo validation is one-time: failures after verification require
  // operational review; do not assume subsequent callbacks can re-validate.
  console.error('Payrep inbound ingestion failed:',error.code||'unknown')
  return new Response('Could not record validated message',{status:503})
 }
 return Response.json({accepted:true,result:data?.result||'unknown'})
})
