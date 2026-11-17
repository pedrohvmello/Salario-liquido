export type BillingReturn='success'|'cancel'|'expired'

/**
 * Asaas callback is an unauthenticated navigation hint, never a payment receipt.
 * Validated reconciliation must happen separately on the server.
 */
export function billingReturnFromUrl(value:string):BillingReturn|null{
 try{
  const parsed=new URL(value)
  const result=parsed.searchParams.get('billing')
  return result==='success'||result==='cancel'||result==='expired'?result:null
 }catch{return null}
}

export function withoutBillingReturn(value:string):string{
 const parsed=new URL(value)
 parsed.searchParams.delete('billing')
 return parsed.pathname+parsed.search+parsed.hash
}
