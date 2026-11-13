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
export function parseMailerooEmail(raw:unknown):VerifiedEmailCandidate|null{
 if(!RECORD(raw)||!RECORD(raw.headers)||!RECORD(raw.body))return null
 if(raw.domain!=='payrep.com.br'||raw.is_spam!==false||raw.is_dmarc_aligned!==true)return null
 if(raw.attachments!==null&&raw.attachments!==undefined&&(!Array.isArray(raw.attachments)||raw.attachments.length>0))return null
 const eventId=raw._id,sourceMessageId=raw.message_id
 if(typeof eventId!=='string'||!/^([0-9a-f]{24})$/.test(eventId))return null
 if(typeof sourceMessageId!=='string'||sourceMessageId.length<5||sourceMessageId.length>255)return null
 if(!Array.isArray(raw.recipients))return null
 const addresses=raw.recipients.filter(x=>typeof x==='string'&&
  /^hml-chamado-[0-9]{4}-[0-9]{4,}-[0-9a-f]{32}@payrep\.com\.br$/i.test(x))
 if(addresses.length!==1)return null
 const from=header(raw.headers,'From')
 if(!from)return null
 const senderEmail=senderFromHeader(from)
 if(!senderEmail)return null
 if(header(raw.headers,'Auto-Submitted')&&!/^no$/i.test(header(raw.headers,'Auto-Submitted')!.trim()))return null
 if(header(raw.headers,'List-Id')||header(raw.headers,'X-Auto-Response-Suppress'))return null
 const body=raw.body.stripped_plaintext
 if(typeof body!=='string')return null
 const stripped=body.trim()
 if(stripped.length<1||stripped.length>4000)return null
 const validationUrl=raw.validation_url
 if(typeof validationUrl!=='string'||!safeValidationUrl(validationUrl))return null
 return {
  eventId,sourceMessageId,recipient:addresses[0].toLowerCase(),senderEmail,
  body:stripped,validationUrl
 }
}
