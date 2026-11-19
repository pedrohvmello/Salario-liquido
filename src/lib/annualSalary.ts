import type {SavedStatement} from './data'
import type {StatementRubric,VacationLedger} from './vacation'
import type {ThirteenthLedger} from './thirteenthLedger'
import {pprReceiptKey} from './pprDuplicate'

export type AnnualSalarySummary={
 year:string;gross:number;netBeforeOtherDeductions:number;
 vacationGross:number;thirteenthGross:number;fgts:number;
 irrfTotal:number;trienio:number;pprGross:number;pension:number;
 privatePension:number;espp:number;inss:number;
 monthlyCount:number;partial:boolean
}
const money=(n:number)=>Math.round((n+Number.EPSILON)*100)/100
const normalize=(text:string)=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
const vacationCredit=(r:StatementRubric)=>r.side==='credit'&&
  (/^(02000|02005|02010|02015|02800|02805|02810|02815|02840|02845|02850|02855)$/.test(r.code)||
  (/feria/i.test(normalize(r.description))&&
   !/adiantamento\s*13|13.\s*salario/.test(normalize(r.description))))
const thirteenthCredit=(r:StatementRubric)=>r.side==='credit'&&
  (/^(02880|02080|03900|03905|03920|00405|00410|02450)$/.test(r.code)||
   /13[ºo°]?\s*salario/.test(normalize(r.description)))
const monthlyIrrf=(r:StatementRubric)=>r.side==='debit'&&
  (/(?:irrf|tributo\s*ir)/.test(normalize(r.description))||r.code==='/401')
const monthlyInss=(r:StatementRubric)=>r.side==='debit'&&
  /\binss\b/.test(normalize(r.description))
const pension=(r:StatementRubric)=>r.side==='debit'&&
  /pensao\s*(?:alim|pg|reg|alimenticia)/.test(normalize(r.description))
const retirement=(r:StatementRubric)=>r.side==='debit'&&
  /(vgbl|previdencia\s*privada|previdencia\s*individual)/.test(normalize(r.description))
const espp=(r:StatementRubric)=>r.side==='debit'&&/\bespp\b/.test(normalize(r.description))
const trienio=(r:StatementRubric)=>r.side==='credit'&&/trienio/.test(normalize(r.description))
const total=(rows:readonly StatementRubric[],fn:(r:StatementRubric)=>boolean)=>
  rows.filter(fn).reduce((sum,r)=>sum+Number(r.amount||0),0)
const empty=(year:string):AnnualSalarySummary=>({
 year,gross:0,netBeforeOtherDeductions:0,vacationGross:0,
 thirteenthGross:0,fgts:0,irrfTotal:0,trienio:0,pprGross:0,
 pension:0,privatePension:0,espp:0,inss:0,monthlyCount:0,partial:false
})
/** Annual earnings without adding salary advances or duplicate PDF receipts.
 * Monthly gross already includes its vacation and trienio credits.
 * 13th is counted once at its full annual gross (not advance + full gross).
 * Gross minus INSS and IRRF is a tax-only net, not the bank payment.
 */
export function annualSalarySummary(
 statements:readonly SavedStatement[],lines:readonly StatementRubric[],
 vacation:VacationLedger,thirteenth:ThirteenthLedger
):AnnualSalarySummary[]{
 const map=new Map<string,AnnualSalarySummary>()
 const ensure=(year:string)=>{
  if(!map.has(year))map.set(year,empty(year))
  return map.get(year)!
 }
 const byId=new Map<string,StatementRubric[]>()
 for(const r of lines){
  const arr=byId.get(r.statement_id)||[]
  arr.push(r);byId.set(r.statement_id,arr)
 }
 const seenPpr=new Set<string>()
 const receiptById=new Map(statements.map(s=>[s.id,s]))
 const monthlyVacationById=new Map<string,number>()
 const monthlyIrrfById=new Map<string,number>()
 const monthlyInssById=new Map<string,number>()
 const monthlyPensionById=new Map<string,number>()
 const yearsWithFullThirteenth=new Set(thirteenth.occurrences.map(x=>x.year))
 // Count monthly payroll as the source of record for salaries, vacation
 // earnings, trienio and their withholdings.
 const monthlyThirteenth=new Map<string,number>()
 for(const s of statements){
  const year=(s.document_type==='ppr'?s.payment_date:null)?.slice(0,4)||s.period.slice(0,4)
  const yearItem=ensure(year)
  const rows=byId.get(s.id)||[]
  if(s.document_type==='monthly'){
   yearItem.monthlyCount++
   if(s.credits===null)yearItem.partial=true
   yearItem.gross+=s.credits??0
   yearItem.fgts+=s.fgts??0
   yearItem.trienio+=s.trienio??total(rows,trienio)
   const vac=total(rows,vacationCredit)
   monthlyVacationById.set(s.id,vac)
   yearItem.vacationGross+=vac
   const irrf=total(rows,monthlyIrrf),inss=total(rows,monthlyInss),pens=total(rows,pension)
   monthlyIrrfById.set(s.id,irrf);monthlyInssById.set(s.id,inss)
   monthlyPensionById.set(s.id,pens)
   yearItem.irrfTotal+=irrf
   yearItem.inss+=inss
   yearItem.pension+=pens
   yearItem.privatePension+=total(rows,retirement)
   yearItem.espp+=total(rows,espp)
   const th=total(rows,thirteenthCredit)
   monthlyThirteenth.set(year,(monthlyThirteenth.get(year)||0)+th)
  }else if(s.document_type==='ppr'){
   const key=pprReceiptKey({period:s.period,paymentDate:s.payment_date,
    gross:s.gross_ppr,net:s.net,incomeTax:s.ppr_income_tax,
    unionContribution:s.ppr_union_contribution})
   if(seenPpr.has(key))continue
   seenPpr.add(key)
   if(s.gross_ppr===null)yearItem.partial=true
   yearItem.pprGross+=s.gross_ppr??0
   yearItem.gross+=s.gross_ppr??0
   yearItem.irrfTotal+=s.ppr_income_tax??0
  }
 }
 for(const occurrence of thirteenth.occurrences){
  const item=ensure(occurrence.year)
  item.thirteenthGross+=occurrence.gross
  item.gross+=occurrence.gross
  item.irrfTotal+=occurrence.irrf
  item.inss+=occurrence.inss
  item.pension+=occurrence.pension
 }
 // Monthly 13th advances/credits already appear in monthly gross. Remove
 // only when the final receipt replaces them with the full annual 13th.
 for(const [year,amount] of monthlyThirteenth){
  const item=ensure(year)
  if(yearsWithFullThirteenth.has(year))item.gross-=amount
  else item.thirteenthGross+=amount // provisional until final annual receipt
 }
 // A vacation receipt can complete missing months, but must not add again
 // amounts already printed in the linked monthly paychecks.
 for(const occurrence of vacation.occurrences){
  if(!occurrence.receiptId)continue
  const receipt=receiptById.get(occurrence.receiptId)
  if(!receipt)continue
  const year=(receipt.payment_date||occurrence.month).slice(0,4)
  const item=ensure(year)
  const rows=byId.get(receipt.id)||[]
  const receiptGross=total(rows,vacationCredit)
  const bookedMonthly=occurrence.monthlyIds.reduce((n,id)=>n+(monthlyVacationById.get(id)||0),0)
  const uncovered=Math.max(0,receiptGross-bookedMonthly)
  item.vacationGross+=uncovered
  item.gross+=uncovered
  // When the receipt is the sole evidence of a vacation, include its
  // withholdings. Otherwise the monthly payroll remains authoritative.
  if(occurrence.monthlyIds.length===0){
   item.irrfTotal+=total(rows,monthlyIrrf)
   item.inss+=total(rows,monthlyInss)
   item.pension+=total(rows,pension)
  }else{
   const irrfAlready=occurrence.monthlyIds.reduce((n,id)=>n+(monthlyIrrfById.get(id)||0),0)
   const inssAlready=occurrence.monthlyIds.reduce((n,id)=>n+(monthlyInssById.get(id)||0),0)
   const pensionAlready=occurrence.monthlyIds.reduce((n,id)=>n+(monthlyPensionById.get(id)||0),0)
   // Never add a second tax deduction for the same underlying vacation.
   // Fallback is appropriate only where the linked monthly records have no
   // withholding evidence at all.
   if(irrfAlready===0)item.irrfTotal+=total(rows,monthlyIrrf)
   if(inssAlready===0)item.inss+=total(rows,monthlyInss)
   if(pensionAlready===0)item.pension+=total(rows,pension)
  }
 }
 for(const item of map.values()){
  for(const key of ['gross','vacationGross','thirteenthGross','fgts','irrfTotal','trienio',
   'pprGross','pension','privatePension','espp','inss'] as const)item[key]=money(item[key])
  item.netBeforeOtherDeductions=money(item.gross-item.inss-item.irrfTotal)
 }
 return [...map.values()].sort((a,b)=>a.year.localeCompare(b.year))
}
