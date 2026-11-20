// The functions client can return a Response, a network Error, or a relay failure
// as error.context. Do not assume that every context supports Response.json().
export async function checkoutInvokeErrorMessage(
 error:unknown,
 fallback='Não foi possível acessar o checkout do Asaas. Tente novamente ou consulte o suporte.'
):Promise<string>{
 if(!error||typeof error!=='object'||!('context' in error))return fallback
 const context=error.context
 if(!context||typeof context!=='object'||!('json' in context)||typeof context.json!=='function')
  return fallback
 try{
  const payload:unknown=await context.json()
  if(payload&&typeof payload==='object'&&'error' in payload
   &&typeof payload.error==='string'&&payload.error.trim())return payload.error
 }catch{
  // A gateway error may have an empty or non-JSON body.
 }
 return fallback
}
