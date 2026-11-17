/** Supabase Auth returns a typed status for unconfirmed e-mail. */
export function isUnconfirmedEmailError(error:unknown):boolean{
 if(!error||typeof error!=='object')return false
 const data=error as {code?:unknown;message?:unknown}
 return data.code==='email_not_confirmed'||
  (typeof data.message==='string'&&/^email not confirmed$/i.test(data.message.trim()))
}
