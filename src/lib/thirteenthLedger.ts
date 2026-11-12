/** 13º cash by annual paycheck, with reconciliation of instalments already
 * counted inside a regular monthly paycheck or an optional vacation receipt.
 * Never add 07215 to cash if the earlier payment was already included.
 */
import {roundMoney} from './money'
import type {StatementRubric} from './vacation'
export type ThirteenthStatement={
 id:string;period:string;document_type:'monthly'|'ppr'|'vacation'|'thirteenth';
 payment_date:string|null;credits:number|null;net:number|null;
 thirteenth_gross:number|null;thirteenth_advance:number;thirteenth_inss:number;
 thirteenth_irrf:number;thirteenth_pension:number
}
export type ThirteenthOccurrence={
 year:string;period:string;statementId:string;paymentDate:string|null;
 gross:number;closingNet:number;advance:number;matchedAdvance:number;
 unmatchedAdvance:number;cashAdditional:number;inss:number;irrf:number;pension:number;
 state:'reconciled'|'estimated'|'partial'|'difference';note:string
}
export type ThirteenthLedger={
 occurrences:ThirteenthOccurrence[];byYear:Map<string,ThirteenthOccurrence>;
 cashByMonth:Map<string,number>
}
export function reconcileThirteenth(
  statements:readonly ThirteenthStatement[],rubrics:readonly StatementRubric[]
):ThirteenthLedger{
 const byStatement=new Map<string,StatementRubric[]>()
 for(const r of rubrics){
  const arr=byStatement.get(r.statement_id)||[];arr.push(r);byStatement.set(r.statement_id,arr)
 }
 const yearlyEvidence=new Map<string,{monthly:number;vacation:number}>()
 for(const s of statements.filter(x=>x.document_type==='monthly'||x.document_type==='vacation')){
  const year=(s.document_type==='vacation'?s.payment_date:s.period)?.slice(0,4)
  if(!year)continue
  let evidence=yearlyEvidence.get(year)
  if(!evidence){evidence={monthly:0,vacation:0};yearlyEvidence.set(year,evidence)}
  const lines=byStatement.get(s.id)||[]
  if(s.document_type==='monthly'){
   evidence.monthly+=lines.filter(l=>l.side==='debit'&&l.code==='07210').reduce((a,l)=>a+l.amount,0)
   // In some payroll layouts the first instalment is a credit already included in its net.
   evidence.monthly+=lines.filter(l=>l.side==='credit'&&l.code==='02880').reduce((a,l)=>a+l.amount,0)
  }else{
   // 02880 (credit) in a vacation receipt is already included in its actual net.
   evidence.vacation+=lines.filter(l=>l.side==='credit'&&l.code==='02880').reduce((a,l)=>a+l.amount,0)
  }
 }
 const occurrences:ThirteenthOccurrence[]=[]
 const byYear=new Map<string,ThirteenthOccurrence>()
 const cashByMonth=new Map<string,number>()
 for(const s of statements.filter(x=>x.document_type==='thirteenth')
   .sort((a,b)=>a.period.localeCompare(b.period)||a.id.localeCompare(b.id))){
  const year=s.payment_date?.slice(0,4)||s.period.slice(0,4)
  if(s.credits===null||s.net===null||s.thirteenth_gross===null)continue
  // A duplicate / additional receipt for the same year must not inflate annual cash.
  if(byYear.has(year))continue
  const evidence=yearlyEvidence.get(year)||{monthly:0,vacation:0}
  const observed=roundMoney(Math.max(evidence.monthly,evidence.vacation))
  const advance=roundMoney(s.thirteenth_advance||0)
  const matchedAdvance=roundMoney(Math.min(advance,observed))
  const unmatchedAdvance=roundMoney(Math.max(0,advance-matchedAdvance))
  const delta=roundMoney(observed-advance)
  let state:ThirteenthOccurrence['state']
  if(Math.abs(delta)<=.02)state='reconciled'
  else if(observed===0)state='estimated'
  else if(observed>advance+.02)state='difference'
  else state='partial'
  const note=state==='reconciled'?
    'Adiantamento identificado na folha mensal e/ou recibo de férias; não contabilizado novamente.':
    state==='estimated'?
    'Adiantamento consta como desconto no 13º, mas não há comprovante anterior; valor incluído como estimativa no ano de pagamento.':
    state==='partial'?
    'Parte do adiantamento já foi contabilizada antes; somente o saldo ainda não identificado foi incluído.':
    'Adiantamentos anteriores excedem o desconto do recibo de 13º; revisar documentos.'
  const cashAdditional=roundMoney(s.net+unmatchedAdvance)
  const occurrence:ThirteenthOccurrence={
   year,period:s.period,statementId:s.id,paymentDate:s.payment_date,
   gross:s.thirteenth_gross,closingNet:s.net,advance,
   matchedAdvance,unmatchedAdvance,cashAdditional,
   inss:s.thirteenth_inss||0,irrf:s.thirteenth_irrf||0,pension:s.thirteenth_pension||0,
   state,note
  }
  occurrences.push(occurrence);byYear.set(year,occurrence)
  const month=s.period
  cashByMonth.set(month,roundMoney((cashByMonth.get(month)||0)+cashAdditional))
 }
 return {occurrences:occurrences.sort((a,b)=>b.year.localeCompare(a.year)),byYear,cashByMonth}
}
