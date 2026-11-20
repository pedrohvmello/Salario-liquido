/**
 * Additional financial insights: no simulated months, no double entry for
 * payroll corrections, and no mixing of exclusive 13th/PPR taxation into
 * ordinary monthly payroll.
 */
import {roundMoney} from './money'
import {cashAdjustmentsByMonth,taxYearBridge} from './payrollAdjustments'
import type {SavedStatement} from './data'
import type {StatementRubric,VacationLedger} from './vacation'
import type {MonthlyMetrics} from './analytics'
import type {ConfirmedTaxFigure} from './incomeTaxReports'

const months=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const validMonth=(v:string)=>/^\d{4}-(0[1-9]|1[0-2])$/.test(v)
const valid=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=0
const money=(v:number)=>roundMoney(v)
const sum=(vs:readonly number[])=>money(vs.reduce((a,b)=>a+b,0))
const available=(vs:(number|null)[])=>{
 const present=vs.filter(valid)
 return present.length?sum(present):null
}
export type FinancialMonth={
 period:string;year:string;month:number;label:string;
 gross:number|null;net:number|null;espp:number|null;privatePension:number|null;
 pension:number|null;inss:number|null;irrf:number|null;
 statementCount:number;totalizerCount:number
}
export type FinancialTrend={
 label:string;period:string;gross:number|null;net:number|null;
 irrf:number|null;inss:number|null;pension:number|null;
 rateIrrf:number|null;rateInss:number|null;ratePension:number|null;
 rateTaxes:number|null;months:number
}
export type DestinationRow={
 label:string;period:string;cash:number|null;espp:number|null;privatePension:number|null;
 pension:number|null;inss:number|null;irrf:number|null;remainder:number|null;
 gross:number|null;classified:boolean
}
export type YearComparison={
 year:string;months:number;gross:number|null;net:number|null;
 commonMonths:number;grossChange:number|null;netChange:number|null
}
export type DocumentAudit={
 year:string;months:number;totalizers:number;rectifications:number;differences:number;
 officialTaxable:number|null;payrollTaxable:number|null;difference:number|null;
 state:'reconciled'|'divergent'|'partial'|'without-report'
}
const percentage=(num:number|null,den:number|null):number|null=>
 valid(num)&&valid(den)&&den>0?money(num/den*100):null
const ratio=(r:FinancialTrend)=>r.gross!==null?{
 rateIrrf:percentage(r.irrf,r.gross),
 rateInss:percentage(r.inss,r.gross),
 ratePension:percentage(r.pension,r.gross),
 rateTaxes:r.irrf!==null&&r.inss!==null?
   percentage(money(r.irrf+r.inss),r.gross):null
}: {rateIrrf:null,rateInss:null,ratePension:null,rateTaxes:null}
export function buildFinancialMonths(
 statements:readonly SavedStatement[],lines:readonly StatementRubric[],
 ledger:VacationLedger,metrics:readonly MonthlyMetrics[]
):FinancialMonth[]{
 const source=[...statements].filter(s=>s.document_type==='monthly'&&!s.duplicate_of&&validMonth(s.period))
  .sort((a,b)=>a.period.localeCompare(b.period)||a.id.localeCompare(b.id))
 const originals=new Map<string,SavedStatement>()
 for(const s of source)if(!originals.has(s.period))originals.set(s.period,s)
 const extraCash=cashAdjustmentsByMonth(statements,lines)
 const metricByPeriod=new Map(metrics.map(x=>[x.period,x]))
 const periods=[...new Set([...originals.keys(),...extraCash.keys()])].filter(validMonth).sort()
 return periods.map(period=>{
  const doc=originals.get(period),extra=extraCash.get(period),m=metricByPeriod.get(period)
  const cash=ledger.byMonth.get(period)?.total??null
  const gross=valid(doc?.credits)?money(doc.credits+(extra?.gross||0)):extra?money(extra.gross):null
  const net=valid(cash)?money(cash+(extra?.net||0)):extra?money(extra.net):null
  const irrf=available([m?.irrfSalary??null,m?.irrfVacation??null])
  const pension=m?.pension!==null&&m?.pension!==undefined?
   money(m.pension+(extra?.pension||0)):extra?money(extra.pension):null
  return {
   period,year:period.slice(0,4),month:Number(period.slice(5,7)),
   label:months[Number(period.slice(5,7))-1],
   gross,net,espp:m?.espp??null,privatePension:m?.privatePension??null,
   pension,inss:m?.inss??null,irrf,
   statementCount:doc?1:0,totalizerCount:extra?1:0
  }
 })
}
function aggregate(rows:readonly FinancialMonth[],period:string,label:string):FinancialTrend{
 const income=available(rows.map(r=>r.gross))
 const observed=rows.filter(r=>r.gross!==null)
 const full=(key:'irrf'|'inss'|'pension'):number|null=>
  observed.length&&observed.every(r=>r[key]!==null)?
   sum(observed.map(r=>r[key]!)):null
 const base:FinancialTrend={label,period,gross:income,net:available(rows.map(r=>r.net)),
  irrf:full('irrf'),inss:full('inss'),pension:full('pension'),
  rateIrrf:null,rateInss:null,ratePension:null,rateTaxes:null,
  months:rows.filter(r=>r.statementCount>0).length}
 return {...base,...ratio(base)}
}
export function financialTrends(rows:readonly FinancialMonth[],year:string):FinancialTrend[]{
 if(year!=='all'){
  return months.map((label,i)=>{
   const period=year+'-'+String(i+1).padStart(2,'0')
   return aggregate(rows.filter(r=>r.period===period),period,label)
  })
 }
 const years=[...new Set(rows.map(r=>r.year))].sort()
 return years.map(y=>aggregate(rows.filter(r=>r.year===y),y,y))
}
function destination(r:FinancialTrend,source:readonly FinancialMonth[]):DestinationRow{
 const rows=source.filter(x=>r.period.length===4?x.year===r.period:x.period===r.period)
 const espp=available(rows.map(x=>x.espp))
 const privatePension=available(rows.map(x=>x.privatePension))
 const known=[r.net,espp,privatePension,r.pension,r.inss,r.irrf]
 const allocated=sum(known.filter(valid))
 const remaining=r.gross===null?null:money(r.gross-allocated)
 const allCashKnown=rows.filter(x=>x.gross!==null).every(x=>x.net!==null)
 const classified=r.gross!==null&&r.net!==null&&allCashKnown&&remaining!==null&&remaining>=-0.02
 const value=(v:number|null):number|null=>classified?v??0:null
 return {
  label:r.label,period:r.period,gross:r.gross,classified,
  cash:value(r.net),espp:value(espp),privatePension:value(privatePension),
  pension:value(r.pension),inss:value(r.inss),irrf:value(r.irrf),
  remainder:classified?Math.max(0,remaining!):null
 }
}
export function financialDestinations(monthsData:readonly FinancialMonth[],year:string):DestinationRow[]{
 return financialTrends(monthsData,year).map(r=>destination(r,monthsData))
}
export function annualComparison(monthsData:readonly FinancialMonth[],year:string):YearComparison[]{
 const years=[...new Set(monthsData.map(r=>r.year))].sort()
 const index=new Map(monthsData.map(r=>[r.period,r]))
 const result=years.map(y=>{
  const docs=monthsData.filter(r=>r.year===y&&r.statementCount>0)
  const rows=monthsData.filter(r=>r.year===y)
  const previous=String(Number(y)-1)
  const shared=docs.filter(x=>index.get(previous+x.period.slice(4))?.statementCount)
   .filter(x=>valid(x.gross)&&valid(index.get(previous+x.period.slice(4))?.gross))
  const comparativeOld=shared.map(x=>index.get(previous+x.period.slice(4))!)
  const currentGross=sum(shared.map(x=>x.gross!))
  const previousGross=sum(comparativeOld.map(x=>x.gross!))
  const currentNet=shared.every(x=>valid(x.net))?sum(shared.map(x=>x.net!)):null
  const previousNet=comparativeOld.every(x=>valid(x.net))?sum(comparativeOld.map(x=>x.net!)):null
  return {
   year:y,months:docs.length,
   gross:available(rows.map(x=>x.gross)),net:available(rows.map(x=>x.net)),
   commonMonths:shared.length,
   grossChange:shared.length&&previousGross>0?
    money(100*(currentGross-previousGross)/previousGross):null,
   netChange:shared.length&&previousNet!==null&&previousNet>0&&currentNet!==null?
    money(100*(currentNet-previousNet)/previousNet):null
  }
 })
 return year==='all'?result:result.filter(x=>x.year===year||x.year===String(Number(year)-1))
}
export function documentsAudit(
 statements:readonly SavedStatement[],lines:readonly StatementRubric[],
 reports:readonly ConfirmedTaxFigure[],year:string
):DocumentAudit[]{
 const sources=statements.filter(s=>!s.duplicate_of&&validMonth(s.period))
 const years=[...new Set([...sources.map(x=>x.period.slice(0,4)),...reports.map(r=>String(r.calendar_year))])]
  .filter(y=>year==='all'||y===year).sort()
 const official=new Map(reports.filter(r=>Boolean(r.confirmed_at)).map(r=>[String(r.calendar_year),r]))
 return years.map(y=>{
  const originals=sources.filter(s=>s.document_type==='monthly'&&s.period.startsWith(y+'-'))
  const count=new Set(originals.map(s=>s.period)).size
  const bySubtype=(subtype:'totalizer'|'rectification'|'difference')=>
   sources.filter(s=>s.document_type==='adjustment'&&s.payroll_subtype===subtype&&
     (subtype==='totalizer'?s.payment_date?.slice(0,4)===y:s.period.slice(0,4)===y)).length
  const bridge=taxYearBridge(Number(y),statements,lines)
  const taxable=official.get(y)?.reviewed_values?.taxable_salary
  const taxableOfficial=valid(taxable)?taxable:null
  const delta=bridge.taxableReconciled!==null&&taxableOfficial!==null?
   money(bridge.taxableReconciled-taxableOfficial):null
  const state:DocumentAudit['state']=taxableOfficial===null?'without-report':
   count!==12||delta===null?'partial':Math.abs(delta)<=0.01?'reconciled':'divergent'
  return {
   year:y,months:count,totalizers:bySubtype('totalizer'),
   rectifications:bySubtype('rectification'),differences:bySubtype('difference'),
   officialTaxable:taxableOfficial,payrollTaxable:bridge.taxableReconciled,
   difference:delta,state
  }
 })
}
