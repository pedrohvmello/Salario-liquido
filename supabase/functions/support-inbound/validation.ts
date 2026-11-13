// Maileroo Inbound Routing parsing and validation, kept independent of Deno for tests.
export type VerifiedEmailCandidate={
 eventId:string
 sourceMessageId:string
 recipient:string
 senderEmail:string
 body:string
 validationUrl:string
}
type Bag=Record<string,unknown>
const RECORD=(x:unknown):x is Bag=>!!x&&typeof x==='object'&&!Array.isArray(x)
const addr=/^[a-z0-9.!#$%&'*+/=?^`{|}~_-]+@[a-z0-9.-]+\.[a-z]{2,}$/i
export function safeValidationUrl(raw:string):boolean{
 try{
  const u=new URL(raw)
  return u.protocol==='https:'&&u.hostname==='inbound-api.maileroo.net'&&
   u.port===''&&u.username===''&&u.password===''&&u.search===''&&u.hash===''&&
   /^\/validate-callback\/[0-9a-f]{24}\/[0-9a-f]{16,128}$/.test(u.pathname)
 }catch{return false}
}
function header(headers:Bag,name:string):string|null{
 const key=Object.keys(headers).find(k=>k.toLowerCase()===name.toLowerCase())
 if(!key)return null
 const v=headers[key]
 return Array.isArray(v)&&v.length===1&&typeof v[0]==='string'?v[0]:null
}
function senderFromHeader(raw:string):string|null{
 // Reject ambiguous multiple addresses or named group lists.
 const text=raw.trim()
 const capture=text.match(/<([^<>\s]+@[^<>\s]+)>$/)
 const candidate=(capture?capture[1]:text).trim().toLowerCase()
 return addr.test(candidate)?candidate:null
}

export type InboundParseReason =
 |'invalid_structure'|'wrong_domain'|'spam'|'unaligned_dmarc'|'invalid_event_id'
 |'invalid_message_id'|'invalid_recipients'|'missing_sender'|'auto_response'
 |'missing_reply_text'|'reply_too_long'|'invalid_validation_url'
export type InboundParseResult=
 |{candidate:VerifiedEmailCandidate;reason:null}
 |{candidate:null;reason:InboundParseReason}
const fail=(reason:InboundParseReason):InboundParseResult=>({candidate:null,reason})

function latestText(body:Bag):string|null{
 const stripped=body.stripped_plaintext
 if(typeof stripped==='string'&&stripped.trim())return stripped.trim()
 // Some clients only provide an unstripped plaintext body. Avoid importing
 // quoted conversation history when a safe boundary is available.
 if(typeof body.plaintext!=='string'||!body.plaintext.trim())return null
 const lines=body.plaintext.replace(/\r\n?/g,'\n').split('\n')
 const result:string[]=[]
 for(const line of lines){
  if(/^>/.test(line.trimStart()) ||
    /^On .{8,240} wrote:\s*$/i.test(line) ||
    /^Em .{8,240} escreveu:\s*$/i.test(line) ||
    /^\s*-{3,}\s*(Original Message|Mensagem original)\s*-{3,}/i.test(line)
  )break
  result.push(line)
 }
 return result.join('\n').trim()||null
}

export function inspectMailerooEmail(raw:unknown):InboundParseResult{
 if(!RECORD(raw)||!RECORD(raw.headers)||!RECORD(raw.body))return fail('invalid_structure')
 if(typeof raw.domain!=='string'||raw.domain.toLowerCase()!=='payrep.com.br')return fail('wrong_domain')
 if(raw.is_spam!==false)return fail('spam')
 if(raw.is_dmarc_aligned!==true)return fail('unaligned_dmarc')
 // Attachment metadata can include signatures or inline images. We never
 // download, store or render attachments. Plaintext is the only stored part.
 const eventId=raw._id,sourceMessageId=raw.message_id
 if(typeof eventId!=='string'||!/^([0-9a-f]{24})$/.test(eventId))return fail('invalid_event_id')
 if(typeof sourceMessageId!=='string'||sourceMessageId.length<5||sourceMessageId.length>255)return fail('invalid_message_id')
 if(!Array.isArray(raw.recipients))return fail('invalid_recipients')
 const addresses=[...new Set(raw.recipients.filter((x):x is string=>typeof x==='string').map(x=>x.trim().toLowerCase())
  .filter(x=>/^hml-chamado-[0-9]{4}-[0-9]{4,}-[0-9a-f]{32}@payrep\.com\.br$/.test(x)))]
 if(addresses.length!==1)return fail('invalid_recipients')
 const from=header(raw.headers,'From')
 if(!from)return fail('missing_sender')
 const senderEmail=senderFromHeader(from)
 if(!senderEmail)return fail('missing_sender')
 if(header(raw.headers,'Auto-Submitted')&&!/^no$/i.test(header(raw.headers,'Auto-Submitted')!.trim()))return fail('auto_response')
 if(header(raw.headers,'List-Id')||header(raw.headers,'X-Auto-Response-Suppress'))return fail('auto_response')
 const body=latestText(raw.body)
 if(body===null)return fail('missing_reply_text')
 if(body.length>4000)return fail('reply_too_long')
 const validationUrl=raw.validation_url
 if(typeof validationUrl!=='string'||!safeValidationUrl(validationUrl))return fail('invalid_validation_url')
 return {candidate:{
  eventId,sourceMessageId,recipient:addresses[0],senderEmail,body,validationUrl
 },reason:null}
}
export function parseMailerooEmail(raw:unknown):VerifiedEmailCandidate|null{
 return inspectMailerooEmail(raw).candidate
}
