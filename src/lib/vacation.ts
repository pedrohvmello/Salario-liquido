/**
 * Vacation cash reconciliation. Monthly payroll is the primary evidence.
 * 07200/07210 are deductions reversing advances already paid; therefore
 * their absolute amounts can estimate advance cash, but are NEVER income/tax bases.
 * A separately imported vacation receipt replaces the inferred cash, not adds to it.
 * Accounting month = first month of vacation or, without receipt, payroll month.
 */
import {roundMoney} from './money'
import type {PayrollLine} from './parse'
export type VacationStatement = {
 id:string;period:string;document_type:'monthly'|'ppr'|'vacation'|'thirteenth';
 vacation_start?:string|null;vacation_end?:string|null;payment_date?:string|null;
 net:number|null;salary_advance:number|null;net_received:number|null;
 credits:number|null;debits:number|null;warnings?:string[]
}
export type StatementRubric = PayrollLine & {statement_id:string}
export type ReconciliationState='estimated'|'reconciled'|'difference'|'partial'|'receipt_only'
export type VacationOccurrence={
 key:string;month:string;vacationStart:string|null;vacationEnd:string|null;
 receiptId:string|null;monthlyIds:string[];inferred:number;receiptNet:number|null;
 booked:number;difference:number|null;state:ReconciliationState;note:string
}
export type CashMonth={
 period:string;closing:number|null;salaryAdvance:number|null;
 vacation:number;total:number|null;vacationState:ReconciliationState|null;
 vacationNote:string;monthlyIds:string[];receiptIds:string[]
}
export type VacationLedger={occurrences:VacationOccurrence[];months:CashMonth[];byMonth:Map<string,CashMonth>}
const round=roundMoney
const vacationCodes=new Set(['07200','07210'])
const vacationText=/\badiantamento\s+(?:(?:de|das?)\s*)?(?:f[eé]rias|13[ºo°]?\s*(?:sal[aá]rio)?\s*(?:f[eé]rias)?)/i
export function vacationAdvanceFromLines(lines:readonly PayrollLine[]):number{
 return round(lines.filter(l=>l.side==='debit'&&
  (vacationCodes.has(l.code)||vacationText.test(l.description)))
  .reduce((v,l)=>v+l.amount,0))
}
const validMonth=(value:string)=>/^\d{4}-(0[1-9]|1[0-2])$/.test(value)
const monthRange=(month:string):[string,string]=>{
 const [year,m]=month.split('-').map(Number)
 return [month+'-01',month+'-'+String(new Date(Date.UTC(year,m,0)).getUTCDate()).padStart(2,'0')]
}
const intersects=(month:string,start:string,end:string)=>{
 if(!validMonth(month))return false
 const [a,b]=monthRange(month)
 return a<=end&&start<=b
}
const monthFrom=(date:string)=>date.slice(0,7)
export function reconcileVacations(statements:readonly VacationStatement[],lines:readonly StatementRubric[]):VacationLedger{
 const monthly=statements.filter(s=>s.document_type==='monthly'&&validMonth(s.period))
 const receipts=statements.filter(s=>s.document_type==='vacation'&&s.vacation_start&&s.vacation_end&&s.net!==null)
 const rubrics=new Map<string,PayrollLine[]>()
 for(const l of lines){const a=rubrics.get(l.statement_id)||[];a.push(l);rubrics.set(l.statement_id,a)}
 const advances=new Map(monthly.map(s=>[s.id,vacationAdvanceFromLines(rubrics.get(s.id)||[])]))
 const owned=new Set<string>()
 const occurrences:VacationOccurrence[]=[]
 const receiptsByDates=new Map<string,VacationStatement[]>()
 for(const receipt of receipts){
  const key=receipt.vacation_start+'|'+receipt.vacation_end
  const group=receiptsByDates.get(key)||[];group.push(receipt);receiptsByDates.set(key,group)
 }
 for(const [key,duplicates] of receiptsByDates){
  const r=duplicates[0],start=r.vacation_start!,end=r.vacation_end!
  if(end<start)continue
  const linked=monthly.filter(m=>(advances.get(m.id)||0)>0&&!owned.has(m.id)&&intersects(m.period,start,end))
  // If one monthly payroll is linked to overlapping vacation receipts, do not guess its split.
  for(const m of linked)owned.add(m.id)
  const inferred=round(linked.reduce((n,m)=>n+(advances.get(m.id)||0),0))
  const actual=r.net!
  const diff=round(inferred-actual)
  const same=duplicates.every(x=>x.net===actual)
  const startMonth=monthFrom(start),endMonth=monthFrom(end)
  const monthsExpected:string[]=[];let cursor=startMonth
  for(let i=0;i<13;i++){monthsExpected.push(cursor);if(cursor===endMonth)break;const [y,m]=cursor.split('-').map(Number);cursor=(m===12?y+1:y)+'-'+String(m===12?1:m+1).padStart(2,'0')}
  const allCovered=monthsExpected.every(m=>monthly.some(x=>x.period===m))
  let state:ReconciliationState
  if(!linked.length)state='receipt_only'
  else if(!same||inferred>actual+.02)state='difference'
  else if(Math.abs(diff)<=.02)state='reconciled'
  else state=allCovered?'difference':'partial'
  const note=!same?'Há recibos de férias diferentes para o mesmo período. Revisar.':
   state==='reconciled'?'Valores da folha e do recibo coincidem.':
   state==='difference'?'Diferença entre valores da folha e recibo; recibo prevalece no fluxo de recebimentos.':
   state==='partial'?'Adiantamentos identificados são parciais; faltam rubricas ou competências para conciliação total.':
   'Recibo de férias registrado; não há adiantamento correspondente nas folhas carregadas.'
  occurrences.push({key,month:startMonth,vacationStart:start,vacationEnd:end,receiptId:r.id,
    monthlyIds:linked.map(x=>x.id),inferred,receiptNet:actual,booked:actual,
    difference:linked.length?diff:null,state,note})
 }
 // When no receipt exists, estimate cash from monthly reversal deductions.
 for(const m of monthly){
  const amount=advances.get(m.id)||0
  if(!amount||owned.has(m.id))continue
  occurrences.push({key:'monthly:'+m.id,month:m.period,vacationStart:null,vacationEnd:null,
    receiptId:null,monthlyIds:[m.id],inferred:amount,receiptNet:null,booked:amount,
    difference:null,state:'estimated',note:'Estimado pelas rubricas de adiantamento da folha mensal. Recibo de férias opcional para conciliação.'})
 }
 const months=new Map<string,CashMonth>()
 function ensure(period:string){
  let v=months.get(period)
  if(!v){v={period,closing:null,salaryAdvance:null,vacation:0,total:null,
    vacationState:null,vacationNote:'',monthlyIds:[],receiptIds:[]};months.set(period,v)}
  return v
 }
 for(const m of monthly){
  const v=ensure(m.period)
  v.monthlyIds.push(m.id)
  // More than one monthly payslip for the same competence is a data-quality issue;
  // do not aggregate potentially duplicated payrolls.
  if(v.monthlyIds.length===1){
   v.closing=m.net
   v.salaryAdvance=m.salary_advance
  }else{v.closing=null;v.salaryAdvance=null;v.vacationNote='Mais de uma folha mensal na mesma competência. Concilie os documentos.'}
 }
 for(const o of occurrences){
  const v=ensure(o.month)
  v.vacation=round(v.vacation+o.booked)
  v.vacationState=o.state
  v.vacationNote=[v.vacationNote,o.note].filter(Boolean).join(' ')
  if(o.receiptId)v.receiptIds.push(o.receiptId)
 }
 for(const v of months.values()){
  if(v.monthlyIds.length===0)v.total=v.vacation // receipt-only month
  else if(v.monthlyIds.length===1&&v.closing!==null&&v.salaryAdvance!==null)
   v.total=round(v.closing+v.salaryAdvance+v.vacation)
 }
 return {occurrences:occurrences.sort((a,b)=>b.month.localeCompare(a.month)),months:[...months.values()].sort((a,b)=>b.period.localeCompare(a.period)),byMonth:months}
}
export function vacationStateLabel(state:ReconciliationState|null):string{
 switch(state){
  case 'estimated':return 'Estimado pela folha'
  case 'reconciled':return 'Conciliado com recibo'
  case 'difference':return 'Diferença a conferir'
  case 'partial':return 'Conciliação parcial'
  case 'receipt_only':return 'Somente recibo'
  default:return 'Sem férias'
 }
}
