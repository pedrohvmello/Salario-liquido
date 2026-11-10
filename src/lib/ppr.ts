import {roundMoney} from './money'
import type {PayrollLine} from './parse'

export type PdfRow={text:string;items:Array<{text:string;x:number;y:number}>;y:number}
export type PprDetails={gross:number|null;incomeTax:number;unionContribution:number}
const BR_DATE=/^(\d{2})\/(\d{2})\/(\d{4})$/
function toISO(date:string):string|null{
 const m=date.match(BR_DATE)
 if(!m)return null
 const value=m[3]+'-'+m[2]+'-'+m[1]
 const actual=new Date(value+'T12:00:00Z')
 return Number.isFinite(actual.getTime())&&actual.toISOString().slice(0,10)===value?value:null
}
/** "Folha: PPR" in the document header, not an incidental PPR reference in monthly rubrics. */
export function isPprPayslip(rows:PdfRow[]):boolean{
 const i=rows.findIndex(r=>r.items.some(x=>x.text.trim()==='Folha:'&&x.x<120))
 if(i<0)return false
 return (rows[i+1]?.items||[]).some(x=>x.text.trim().toUpperCase()==='PPR'&&x.x<120)
}
export function paymentDateFromHeader(rows:PdfRow[]):string|null{
 const i=rows.findIndex(r=>r.items.some(x=>x.text.trim()==='Dt. pagt.:'))
 if(i<0)return null
 for(const r of rows.slice(i+1,i+4)){
  for(const item of r.items){
   if(item.x>=385&&item.x<490){
    const date=toISO(item.text.trim())
    if(date)return date
   }
  }
 }
 return null
}
export function pprDetails(lines:readonly PayrollLine[]):PprDetails{
 const gross=lines.filter(l=>l.side==='credit'&&(l.code==='00845'||/^PPR(?:\s|$)/i.test(l.description)))
 const tax=lines.filter(l=>l.side==='debit'&&(l.code==='07095'||/^IRRF\s+PPR/i.test(l.description)))
 const union=lines.filter(l=>l.side==='debit'&&(l.code==='05755'||/^CONTRIBUICAO\s+NEGOCIAL\s+PPR/i.test(l.description)))
 return {
  gross:gross.length?roundMoney(gross.reduce((a,l)=>a+l.amount,0)):null,
  incomeTax:roundMoney(tax.reduce((a,l)=>a+l.amount,0)),
  unionContribution:roundMoney(union.reduce((a,l)=>a+l.amount,0))
 }
}
export type PprEventSource={
 period:string;paymentDate:string|null;grossPpr:number|null;credits:number|null;debits:number|null;net:number|null
}
export function makePprEvent(source:PprEventSource):{kind:'ppr';effective_date:string;value:number;notes:string}{
 if(!source.paymentDate||source.grossPpr===null||source.net===null||source.credits===null||source.debits===null)
   throw new Error('PPR incompleto: revise a data e os totais antes de criar o evento')
 if(Math.abs(roundMoney(source.credits-source.debits)-source.net)>0.02)
   throw new Error('PPR com totais divergentes; evento não criado')
 return {
  kind:'ppr',effective_date:source.paymentDate,value:source.grossPpr,
  notes:'PPR importado do holerite; competência '+source.period+'; proventos '+source.credits.toFixed(2)+
     '; descontos '+source.debits.toFixed(2)+'; líquido pago '+source.net.toFixed(2)
 }
}
