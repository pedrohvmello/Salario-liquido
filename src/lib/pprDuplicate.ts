/** Financial identity for a PPR receipt, independent of PDF metadata, filename or page. */
export type PprReceiptIdentity={
 period:string;paymentDate:string|null;gross:number|null;net:number|null;
 incomeTax:number|null;unionContribution:number|null
}
const numberKey=(value:number|null)=>value===null||!Number.isFinite(value)?'n':(Math.round(value*100)/100).toFixed(2)
export function pprReceiptKey(receipt:PprReceiptIdentity):string{
 return [receipt.period,receipt.paymentDate||'n',numberKey(receipt.gross),numberKey(receipt.net),
  numberKey(receipt.incomeTax),numberKey(receipt.unionContribution)].join('|')
}
