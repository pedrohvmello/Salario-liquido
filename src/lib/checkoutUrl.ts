// Redirect only to a hosted Asaas checkout URL in the Sandbox environment.
// In particular, the Sandbox link may include an account prefix before checkoutSession.
export function validatedSandboxCheckoutUrl(candidate:unknown):string{
 if(typeof candidate!=='string'||candidate.length>400)throw Error('Destino de pagamento não autorizado.')
 let url:URL
 try{url=new URL(candidate)}catch{throw Error('Destino de pagamento não autorizado.')}
 const parts=url.pathname.split('/').filter(Boolean)
 const tail=parts.length===4&&/^[0-9]{3}$/.test(parts[0])?parts.slice(1):parts
 const hasCheckoutPath=tail.length===3&&tail[0]==='checkoutSession'&&tail[1]==='show'
 const isCheckoutId=hasCheckoutPath&&/^[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$/.test(tail[2])
 if(url.protocol!=='https:'||url.hostname!=='sandbox.asaas.com'
  ||url.username||url.password||url.search||url.hash||!isCheckoutId)
  throw Error('Destino de pagamento não autorizado.')
 return url.toString()
}
