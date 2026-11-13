// Payrep support mail worker. Deploy only after configuring the secrets in the
// isolated Supabase project. No credentials are ever sent to the browser.
// Invoke from a trusted scheduler with X-Payrep-Worker-Token. Never expose that token.
import {createClient} from 'npm:@supabase/supabase-js@2.105.0'

type EmailEvent={
 id:string;ticket_id:string;message_id:string|null;kind:string;attempts:number
}
type Ticket={
 id:string;user_id:string;ticket_year:number;ticket_sequence:number
 category:string;subject:string;description:string
}
type Message={body:string}
const textMax=(v:string,max=4000)=>v.slice(0,max)
const trustedAuth=(given:string,expected:string)=>{
 if(!given||!expected||given.length!==expected.length)return false
 let mismatch=0
 for(let i=0;i<given.length;i++)mismatch|=given.charCodeAt(i)^expected.charCodeAt(i)
 return mismatch===0
}
Deno.serve(async req=>{
 if(req.method!=='POST')return new Response('Method not allowed',{status:405})
 const env=(key:string)=>Deno.env.get(key)||''
 const token=env('SUPPORT_MAILER_WORKER_TOKEN')
 if(!trustedAuth(req.headers.get('X-Payrep-Worker-Token')||'',token))return new Response('Unauthorized',{status:401})
 const mailKey=env('MAILEROO_API_KEY'),from=env('SUPPORT_FROM_EMAIL')
 const url=env('SUPABASE_URL'),service=env('SUPABASE_SERVICE_ROLE_KEY')
 const app=env('SUPPORT_APP_URL')
 if(!mailKey||!from||!url||!service||!app)return new Response('Mail worker not configured',{status:503})
 if(!/^https:\/\/[^/]+/.test(app))return new Response('Invalid app URL',{status:503})
 const db=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}})
 const now=new Date().toISOString()
 const {data:jobs,error:queueError}=await db.from('support_email_outbox')
  .select('id,ticket_id,message_id,kind,attempts').eq('state','pending')
  .lte('next_attempt_at',now).order('created_at',{ascending:true}).limit(20)
 if(queueError)return new Response('Queue unavailable',{status:503})
 let sent=0,failed=0
 for(const item of (jobs||[]) as EmailEvent[]){
  const {data:claimed,error:claimError}=await db.from('support_email_outbox')
   .update({state:'processing',claimed_at:new Date().toISOString(),attempts:item.attempts+1})
   .eq('id',item.id).eq('state','pending')
   .select('id').maybeSingle()
  if(claimError||!claimed)continue
  try{
   const {data:ticket,error:ticketError}=await db.from('support_tickets')
    .select('id,user_id,ticket_year,ticket_sequence,category,subject,description')
    .eq('id',item.ticket_id).single()
   if(ticketError||!ticket)throw Error('Ticket not available')
   const t=ticket as Ticket
   const {data:userLookup,error:userError}=await db.auth.admin.getUserById(t.user_id)
   if(userError||!userLookup.user?.email)throw Error('Recipient account has no valid email')
   const {data:profile}=await db.from('user_profiles').select('display_name').eq('user_id',t.user_id).maybeSingle()
   const senderName=(profile?.display_name||userLookup.user.email).trim()
   const ticketCode=String(t.ticket_year)+'-'+String(t.ticket_sequence).padStart(4,'0')
   let messageBody=t.description
   if(item.message_id){
    const {data:stored,error:messageError}=await db.from('support_ticket_messages')
     .select('body').eq('id',item.message_id).eq('ticket_id',item.ticket_id).single()
    if(messageError||!stored)throw Error('Ticket message not available')
    messageBody=(stored as Message).body
   }
   const toSupport=item.kind==='ticket_opened'||item.kind==='user_message'
   const recipient=toSupport?'suporte@payrep.com.br':userLookup.user.email
   const eventLabel:Record<string,string>={
    ticket_opened:'Novo chamado',user_message:'Mensagem do usuário',
    admin_message:'Resposta do suporte',ticket_closed:'Chamado finalizado'
   }
   const prefix=eventLabel[item.kind]
   if(!prefix)throw Error('Unexpected mail event')
   const notice=item.kind==='ticket_closed'?'O atendimento foi finalizado pelo suporte.':textMax(messageBody)
   const subject='[Payrep #'+ticketCode+'] '+prefix+': '+textMax(t.subject,115).replace(/[\r\n]+/g,' ')
   const plain=[
    prefix+' · Protocolo '+ticketCode,
    'Assunto: '+t.subject,
    'Categoria: '+t.category,
    'Solicitante: '+senderName,
    'Contato: '+userLookup.user.email,
    '',
    notice,
    '',
    'Acompanhe o chamado no Payrep: '+app,
    'Não inclua senhas, códigos de autenticação ou documentos financeiros completos por e-mail.'
   ].join('\n')
   const response=await fetch('https://smtp.maileroo.com/api/v2/emails',{
    method:'POST',
    headers:{'Authorization':'Bearer '+mailKey,'Content-Type':'application/json'},
    body:JSON.stringify({
     from:{address:from,display_name:'Suporte Payrep'},
     to:{address:recipient},
     reply_to:{address:'suporte@payrep.com.br'},
     subject,plain,tracking:false,
     tags:{purpose:'payrep-support',event:item.kind},
     headers:{'X-Payrep-Ticket':ticketCode}
    })
   })
   const result=await response.json().catch(()=>null) as {success?:boolean}|null
   if(!response.ok||!result?.success)throw Error('Maileroo did not accept message (HTTP '+response.status+')')
   const {error:saveError}=await db.from('support_email_outbox')
    .update({state:'sent',sent_at:new Date().toISOString(),last_error:null}).eq('id',item.id)
   if(saveError)throw Error('Email accepted but delivery record could not be updated')
   sent++
  }catch(e){
   failed++
   const attempts=item.attempts+1
   const next=new Date(Date.now()+Math.min(60,2**Math.min(attempts,6))*60_000).toISOString()
   const detail=e instanceof Error?e.message:'Delivery error'
   // Retry only up to five times; do not disclose customer data in logs.
   await db.from('support_email_outbox').update({
    state:attempts>=5?'failed':'pending',
    last_error:detail.slice(0,200),next_attempt_at:next
   }).eq('id',item.id)
  }
 }
 return Response.json({processed:(jobs||[]).length,sent,failed})
})
