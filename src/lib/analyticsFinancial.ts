/**
 * Annual comparison deliberately keeps two different concepts separate:
 *  - payrollGross: monthly payslip credit total (NOT the taxable IR base)
 *  - taxableOfficial: employer statement's confirmed annual taxable earnings
 *
 * The concentric composition uses payroll gross as its denominator. Official
 * tax/pension figures override payslip estimates for the same calendar year;
 * no official PDF is used unless confirmed. Unknown data stays null.
 */
import {roundMoney} from './money'
import type {OfficialValues} from './annualTax'
import type {TimeMetrics} from './analytics'
export type PayrollGraphRow={period:string;bruto:number|null;liquido:number|null}
export type ConfirmedYear={calendar_year:number;reviewed_values:OfficialValues;confirmed_at:string}
export type AnnualFinancialRow={
 year:string;payrollGross:number|null;net:number|null;taxableOfficial:number|null;
 pension:number|null;inss:number|null;irrf:number|null;
 espp:number|null;privatePension:number|null;trienio:number|null;
 months:number;officialFields:string[]
}
export type CompositionOption='espp'|'privatePension'|'trienio'
export type ChartSegment={key:string;name:string;value:number;fill:string}
export type FinancialComposition={
 gross:number|null;
 inner:ChartSegment[];outer:ChartSegment[];origin:ChartSegment[];
 categories:ChartSegment[];coveredMonths:number;officialYears:string[];
 warnings:string[];extras:{trienio:number|null;espp:number|null;privatePension:number|null}
}
export const financialColors={
 gross:'#7436b8',net:'#059669',pension:'#e3a04b',irrf:'#e35755',inss:'#2563eb',
 others:'#9ca3af',espp:'#db2777',privatePension:'#0891b2',trienio:'#bc8c24',
 outerNet:'#21a68c',outerTax:'#f0776a',outerOther:'#a89db6',originOther:'#d9cde2'
} as const
const valid=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=0
export const money=(v:number)=>roundMoney(v)
export function sumAvailable(values:(number|null)[]):number|null{
 const present=values.filter(valid)
 return present.length?roundMoney(present.reduce((a,b)=>a+b,0)):null
}
function officialValue(info:ConfirmedYear|undefined,key:keyof OfficialValues):number|null{
 const raw=info?.reviewed_values?.[key]
 return info?.confirmed_at&&valid(raw)?money(raw):null
}
/** Aggregates only observed payroll months, never extrapolates to 12 months. */
export function annualFinancialRows(
 graph:readonly PayrollGraphRow[],metrics:readonly TimeMetrics[],
 reports:readonly ConfirmedYear[],selectedYear:string
):AnnualFinancialRow[]{
 const grouped=new Map<string,{gross:number[];net:number[]}>()
 for(const row of graph){
  const y=selectedYear==='all'?row.period: selectedYear
  // On the all-years graph periods are years; on a specific year they are MM/YY.
  if(!/^\d{4}$/.test(y))continue
  const entry=grouped.get(y)||{gross:[],net:[]}
  if(valid(row.bruto))entry.gross.push(row.bruto)
  if(valid(row.liquido))entry.net.push(row.liquido)
  grouped.set(y,entry)
 }
 const byMetric=new Map(metrics.map(x=>[x.period,x]))
 const byReport=new Map(reports.filter(r=>Boolean(r.confirmed_at)).map(r=>[String(r.calendar_year),r]))
 const years=[...new Set([...grouped.keys(),...byMetric.keys(),...byReport.keys()])]
  .filter(y=>selectedYear==='all'||y===selectedYear)
  .sort((a,b)=>a.localeCompare(b))
 return years.map(year=>{
  const p=grouped.get(year),m=byMetric.get(year),o=byReport.get(year)
  const fields:(keyof OfficialValues)[]=['taxable_salary','inss','salary_irrf','alimony']
  const officialFields=fields.filter(k=>officialValue(o,k)!==null)
  return {
   year,monthlyCount:undefined,
   payrollGross:p?sumAvailable(p.gross):null,
   net:p?sumAvailable(p.net):null,
   taxableOfficial:officialValue(o,'taxable_salary'),
   pension:officialValue(o,'alimony')??m?.pension??null,
   inss:officialValue(o,'inss')??m?.inss??null,
   irrf:officialValue(o,'salary_irrf')??sumAvailable([m?.irrfSalary??null,m?.irrfVacation??null]),
   espp:m?.espp??null,privatePension:m?.privatePension??null,
   trienio:m?.trienio??null,months:m?.monthlyStatements??0,officialFields
  }
 }).map(({monthlyCount:_,...row})=>row)
}
const segment=(key:string,name:string,value:number,fill:string):ChartSegment=>({
 key,name,value:money(value),fill
})
/** Composition ratios use ONE denominator, payroll gross. No negative residual
 * is fabricated; if the cash movements don't reconcile, charts are disabled.
 * Triênio is an earning component, so an optional independent origin ring is
 * used rather than counting it a second time as a payroll deduction.
 */
export function financialComposition(
 rows:readonly AnnualFinancialRow[],show:Readonly<Record<CompositionOption,boolean>>
):FinancialComposition{
 const gross=sumAvailable(rows.map(r=>r.payrollGross))
 const net=sumAvailable(rows.map(r=>r.net))
 const pension=sumAvailable(rows.map(r=>r.pension))
 const irrf=sumAvailable(rows.map(r=>r.irrf))
 const inss=sumAvailable(rows.map(r=>r.inss))
 const espp=sumAvailable(rows.map(r=>r.espp))
 const privatePension=sumAvailable(rows.map(r=>r.privatePension))
 const trienio=sumAvailable(rows.map(r=>r.trienio))
 const officialYears=rows.filter(r=>r.officialFields.length>0).map(r=>r.year)
 const coveredMonths=rows.reduce((n,r)=>n+r.months,0)
 const warnings:string[]=[]
 const extras={trienio,espp,privatePension}
 const empty={gross,inner:[],outer:[],origin:[],categories:[],coveredMonths,officialYears,warnings,extras}
 if(gross===null||gross<=0){
  warnings.push('Sem proventos brutos mensais comprovados para compor o gráfico.')
  return empty
 }
 if(net===null){
  warnings.push('Líquido não encontrado nos documentos mensais.')
  return empty
 }
 const basic=(net??0)+(pension??0)+(irrf??0)+(inss??0)
 const balance=money(gross-basic)
 if(balance < -0.01){
  warnings.push('O líquido e as deduções ultrapassam o bruto dos holerites. Verifique adiantamentos, férias, competências ausentes e a conciliação com o Informe IR. O gráfico não será normalizado artificialmente.')
  return empty
 }
 let remaining=Math.max(0,balance)
 const inner:ChartSegment[]=[
  segment('net','Líquido recebido',net,financialColors.net),
  segment('pension','Pensão',pension??0,financialColors.pension),
  segment('irrf','IRRF',irrf??0,financialColors.irrf),
  segment('inss','INSS',inss??0,financialColors.inss)
 ]
 for(const {key,title,amount,fill} of [
  {key:'espp' as const,title:'ESPP',amount:espp,fill:financialColors.espp},
  {key:'privatePension' as const,title:'Previdência privada',amount:privatePension,fill:financialColors.privatePension}
 ]){
  if(!show[key]||amount===null||amount===0)continue
  if(amount>remaining+.01){
   warnings.push(title+' foi identificado, mas não cabe no valor residual dos proventos. Não foi incluído para evitar dupla contagem.')
   continue
  }
  inner.push(segment(key,title,amount,fill))
  remaining=money(Math.max(0,remaining-amount))
 }
 if(remaining>0.01)inner.push(segment('others','Demais descontos e ajustes',remaining,financialColors.others))
 const otherOuter=money(Math.max(0,balance))
 const outer=[
  segment('outerNet','Líquido + pensão',net+(pension??0),financialColors.outerNet),
  segment('outerTaxes','IRRF + INSS',(irrf??0)+(inss??0),financialColors.outerTax)
 ]
 if(otherOuter>0.01)outer.push(segment('outerOther','Demais descontos e ajustes',otherOuter,financialColors.outerOther))
 const origin:ChartSegment[]=[]
 if(show.trienio&&trienio!==null&&trienio>0){
  if(trienio>gross+.01)warnings.push('Triênio identificado maior do que o bruto, impedindo sua exibição como origem.')
  else{
   origin.push(segment('trienio','Triênio (provento)',trienio,financialColors.trienio))
   if(gross-trienio>0.01)origin.push(segment('originOther','Demais proventos',gross-trienio,financialColors.originOther))
  }
 }
 if(rows.some(r=>r.months>0&&(
   r.net===null||r.inss===null||r.irrf===null||r.pension===null)))
  warnings.push('Uma ou mais rubricas estão ausentes em parte dos anos. A parcela residual não substitui esses dados.')
 if(officialYears.length)warnings.push('Informe IR conferido fornece IRRF, INSS e pensão anuais quando esses campos estão presentes. O bruto da folha continua separado da base tributável.')
 return {...empty,inner:inner.filter(s=>s.value>0),outer:outer.filter(s=>s.value>0),
  origin:origin.filter(s=>s.value>0),
  categories:[segment('gross','Proventos brutos (folha)',gross,financialColors.gross),...inner.filter(s=>s.value>0)],
  warnings}
}
export function percentOfGross(value:number,gross:number|null):string{
 if(!gross||gross<=0)return '—'
 return new Intl.NumberFormat('pt-BR',{style:'percent',minimumFractionDigits:1,maximumFractionDigits:1}).format(value/gross)
}
