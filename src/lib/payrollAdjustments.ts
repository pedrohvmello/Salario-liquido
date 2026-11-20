/**
 * Supplemental payroll reconciliation.
 *
 * RETIFICADORA: replacement reference, never an extra receipt.
 * DIFERENÇA: explains rubrics for the original competence, never an extra receipt.
 * TOTALIZADORA: one supplementary payment, counted only once, by actual payment
 * year. If matching DIFERENÇA documents exist, link them by exact rubrics and cents.
 *
 * Never infer taxable amounts from tax-base or FGTS fields; these are derived
 * fiscal comparisons, not replacements for the employer-issued Informe IR.
 */
import {roundMoney} from './money'
import type {PayrollLine} from './parse'
export type SupplementalSubtype='difference'|'rectification'|'totalizer'
export type SupplementalStatement={
 id:string;period:string;document_type:string;payroll_subtype?:SupplementalSubtype|null;
 payment_date:string|null;duplicate_of?:string|null;
 credits:number|null;debits:number|null;net:number|null
}
export type SupplementalLine=PayrollLine&{statement_id:string}
export type Settlement={
 id:string;period:string;paymentDate:string;gross:number;deductions:number;net:number;
 originPeriods:string[];matchedByRubrics:boolean;notes:string[]
}
export type TaxYearBridge={
 year:number;monthlyGross:number|null;totalizerGross:number;excludedThirteenthAdvance:number;
 excludedThirteenthComplement:number;excludedBalanceAdvance:number;
 taxableReconciled:number|null;pensionFromMonthly:number|null;
 pensionFromTotalizers:number;pensionReconciled:number|null;
 settlements:Settlement[];warnings:string[]
}
const amount=(n:number)=>roundMoney(n)
const sum=(a:number[])=>amount(a.reduce((n,x)=>n+x,0))
function known(m:SupplementalStatement){return m.duplicate_of==null}
function isMonth(value:string){return /^\d{4}-(0[1-9]|1[0-2])$/.test(value)}
function annualOf(s:SupplementalStatement){
 if(s.payroll_subtype==='totalizer'&&s.payment_date)return Number(s.payment_date.slice(0,4))
 return Number(s.period.slice(0,4))
}
function byId(lines:readonly SupplementalLine[]){
 const map=new Map<string,SupplementalLine[]>()
 for(const l of lines){const a=map.get(l.statement_id)||[];a.push(l);map.set(l.statement_id,a)}
 return map
}
const rubrics=(lines:SupplementalLine[])=>{
 const r=new Map<string,{side:string;sum:number}>()
 for(const l of lines){
  if(l.side!=='credit'&&l.side!=='debit')continue
  const key=l.side+'|'+l.code
  const prior=r.get(key)
  r.set(key,{side:l.side,sum:amount((prior?.sum||0)+l.amount)})
 }
 return r
}
const rubricsMatch=(a:SupplementalLine[],b:SupplementalLine[])=>{
 const left=rubrics(a),right=rubrics(b)
 if(!left.size||left.size!==right.size)return false
 return [...left].every(([k,v])=>right.has(k)&&Math.abs(right.get(k)!.sum-v.sum)<=.01)
}
export function supplementalSettlements(
 statements:readonly SupplementalStatement[],lines:readonly SupplementalLine[]
):Settlement[]{
 const saved=statements.filter(known),lineMap=byId(lines)
 const diff=saved.filter(s=>s.document_type==='adjustment'&&s.payroll_subtype==='difference'&&isMonth(s.period))
 return saved.filter(s=>s.document_type==='adjustment'&&s.payroll_subtype==='totalizer'&&isMonth(s.period))
  .map(s=>{
   const notes:string[]=[]
   if(!s.payment_date||s.credits===null||s.debits===null||s.net===null||
    s.credits<=0||Math.abs(s.credits-s.debits-s.net)>.02){
    notes.push('Totalizadora sem data de pagamento ou valores conciliados; não contabilizada.')
    return null
   }
   const candidates=diff.filter(d=>d.period<s.period&&d.period.slice(0,4)===s.period.slice(0,4))
   const values=candidates.flatMap(d=>lineMap.get(d.id)||[])
   const actual=lineMap.get(s.id)||[]
   const matchedByRubrics=!!candidates.length&&rubricsMatch(values,actual)
   const originPeriods=matchedByRubrics?[...new Set(candidates.map(d=>d.period))].sort():[]
   if(!matchedByRubrics)notes.push('Competências de origem não verificadas por rubricas; conferir documentos de diferença.')
   return {
    id:s.id,period:s.period,paymentDate:s.payment_date,gross:amount(s.credits),
    deductions:amount(s.debits),net:amount(s.net),originPeriods,matchedByRubrics,notes
   }
  }).filter((x):x is Settlement=>x!==null)
  .sort((a,b)=>a.paymentDate.localeCompare(b.paymentDate)||a.id.localeCompare(b.id))
}
const isCredit=(l:SupplementalLine)=>l.side==='credit'
const isDebit=(l:SupplementalLine)=>l.side==='debit'
/** Only explicitly identified rubrics are excluded from annual taxable
 * reconciliation; all other amounts remain and residuals are disclosed.
 */
export function taxYearBridge(
 year:number,statements:readonly SupplementalStatement[],lines:readonly SupplementalLine[]
):TaxYearBridge{
 const originals=statements.filter(s=>known(s)&&s.document_type==='monthly'&&Number(s.period.slice(0,4))===year)
 const lineMap=byId(lines)
 const settlements=supplementalSettlements(statements,lines).filter(s=>Number(s.paymentDate.slice(0,4))===year)
 const totals=statements.filter(s=>s.document_type==='adjustment'&&s.payroll_subtype==='totalizer'&&known(s)&&annualOf(s)===year)
 const warning:string[]=[]
 if(totals.length!==settlements.length)
  warning.push('Há totalizadoras incompletas ou sem pagamento identificado que não foram contabilizadas.')
 const monthlyGross=originals.length&&originals.every(s=>s.credits!==null)
  ?sum(originals.map(s=>s.credits!)):null
 if(monthlyGross===null)warning.push('Proventos mensais incompletos: não é possível conciliar a base anual.')
 if(originals.length!==12)warning.push('Há '+originals.length+' folha(s) mensal(is) no ano; o resultado pode ser parcial.')
 const relevant=originals.flatMap(s=>lineMap.get(s.id)||[])
 const excludedThirteenthAdvance=sum(relevant.filter(l=>isCredit(l)&&l.code==='02080').map(l=>l.amount))
 const excludedThirteenthComplement=sum(relevant.filter(l=>isCredit(l)&&l.code==='03920').map(l=>l.amount))
 const excludedBalanceAdvance=sum(relevant.filter(l=>isCredit(l)&&l.code==='02690').map(l=>l.amount))
 const totalizerGross=sum(settlements.map(s=>s.gross))
 const taxableReconciled=monthlyGross===null?null:amount(monthlyGross+totalizerGross-
  excludedThirteenthAdvance-excludedThirteenthComplement-excludedBalanceAdvance)
 const pensionRubrics=relevant.filter(l=>isDebit(l)&&['07145','07150'].includes(l.code))
 const pensionFromMonthly=originals.length?sum(pensionRubrics.map(l=>l.amount)):null
 const pensionFromTotalizers=sum(totals.filter(s=>settlements.some(t=>t.id===s.id))
  .flatMap(s=>lineMap.get(s.id)||[]).filter(l=>isDebit(l)&&l.code==='07151').map(l=>l.amount))
 const pensionReconciled=pensionFromMonthly===null?null:amount(pensionFromMonthly+pensionFromTotalizers)
 for(const settlement of settlements)warning.push(...settlement.notes)
 return {year,monthlyGross,totalizerGross,excludedThirteenthAdvance,
  excludedThirteenthComplement,excludedBalanceAdvance,taxableReconciled,
  pensionFromMonthly,pensionFromTotalizers,pensionReconciled,
  settlements,warnings:warning}
}
export function cashAdjustmentsByMonth(
 statements:readonly SupplementalStatement[],lines:readonly SupplementalLine[]
):Map<string,{gross:number;net:number;pension:number}>{
 const map=new Map<string,{gross:number;net:number;pension:number}>(),byStatement=byId(lines)
 for(const s of supplementalSettlements(statements,lines)){
  const month=s.paymentDate.slice(0,7)
  const prev=map.get(month)||{gross:0,net:0,pension:0}
  map.set(month,{gross:amount(prev.gross+s.gross),net:amount(prev.net+s.net),
   pension:amount(prev.pension+sum((byStatement.get(s.id)||[]).filter(l=>isDebit(l)&&l.code==='07151').map(l=>l.amount)))})
 }
 return map
}
