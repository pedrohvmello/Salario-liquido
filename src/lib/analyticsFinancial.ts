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
export type CompositionOption='espp'|'privatePension'
export type ChartSegment={key:string;name:string;value:number;fill:string}
export type FinancialComposition={
 gross:number|null;cashNet:number|null;netAndInvestments:number|null;unclassified:number|null;
 inner:ChartSegment[];outer:ChartSegment[];
 categories:ChartSegment[];coveredMonths:number;officialYears:string[];
 warnings:string[];
 extras:{espp:number|null;privatePension:number|null};
 included:{espp:number;privatePension:number}
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
   year,
   payrollGross:p?sumAvailable(p.gross):null,
   net:p?sumAvailable(p.net):null,
   taxableOfficial:officialValue(o,'taxable_salary'),
   pension:officialValue(o,'alimony')??m?.pension??null,
   inss:officialValue(o,'inss')??m?.inss??null,
   irrf:officialValue(o,'salary_irrf')??sumAvailable([m?.irrfSalary??null,m?.irrfVacation??null]),
   espp:m?.espp??null,privatePension:m?.privatePension??null,
   trienio:m?.trienio??null,months:m?.monthlyStatements??0,officialFields
  }
 })
}
const segment=(key:string,name:string,value:number,fill:string):ChartSegment=>({
 key,name,value:money(value),fill
})
/** All concentric rings use one denominator: observed monthly payroll gross.
 * The receipt total is factual cash received. ESPP and private retirement
 * contributions are NOT cash received; the overview groups the cash +
 * contributions under "Líquido e aplicações" and the checkboxes ONLY
 * highlight portions of that constant group, never create new income.
 * No speculative residual or forced balancing is allowed.
 */
export function financialComposition(
 rows:readonly AnnualFinancialRow[],show:Readonly<Record<CompositionOption,boolean>>
):FinancialComposition{
 const eligible=rows.filter(r=>valid(r.payrollGross)&&r.payrollGross>0&&valid(r.net))
 const omitted=rows.filter(r=>!eligible.includes(r)&&(r.taxableOfficial!==null||r.months>0))
 const gross=sumAvailable(eligible.map(r=>r.payrollGross))
 const cashNet=sumAvailable(eligible.map(r=>r.net))
 const pension=sumAvailable(eligible.map(r=>r.pension))
 const irrf=sumAvailable(eligible.map(r=>r.irrf))
 const inss=sumAvailable(eligible.map(r=>r.inss))
 const espp=sumAvailable(eligible.map(r=>r.espp))
 const privatePension=sumAvailable(eligible.map(r=>r.privatePension))
 const officialYears=eligible.filter(r=>r.officialFields.length>0).map(r=>r.year)
 const coveredMonths=eligible.reduce((n,r)=>n+r.months,0)
 const warnings:string[]=[]
 const extras={espp,privatePension}
 const included={espp:0,privatePension:0}
 const empty=(netAndInvestments:number|null=null,unclassified:number|null=null):FinancialComposition=>
  ({gross,cashNet,netAndInvestments,unclassified,inner:[],outer:[],categories:[],
    coveredMonths,officialYears,warnings,extras,included})
 if(omitted.length)warnings.push('Os anos '+omitted.map(r=>r.year).join(', ')+
  ' não entraram na composição porque faltam proventos brutos ou líquido mensal.')
 if(gross===null||gross<=0){
  warnings.push('Sem proventos brutos mensais comprovados para compor o gráfico.')
  return empty()
 }
 if(cashNet===null){
  warnings.push('Líquido não encontrado nos documentos mensais.')
  return empty()
 }
 const grossBalance=money(gross-cashNet-(pension??0)-(irrf??0)-(inss??0))
 if(grossBalance < -0.01){
  warnings.push('Os valores identificados ultrapassam o bruto da folha. Verifique adiantamentos, férias e competências ausentes. O gráfico não será normalizado artificialmente.')
  return empty()
 }
 let available=Math.max(0,grossBalance)
 for(const [key,amount,title] of [
  ['espp',espp,'ESPP'],['privatePension',privatePension,'Previdência privada']
 ] as const){
  if(amount===null||amount<=0)continue
  if(amount>available+0.01){
   warnings.push(title+' não cabe na conciliação do bruto. O valor foi preservado nos indicadores, mas não incorporado à composição.')
   continue
  }
  included[key]=money(amount)
  available=money(Math.max(0,available-amount))
 }
 const netAndInvestments=money(cashNet+included.espp+included.privatePension)
 const visibleESPP=show.espp?included.espp:0
 const visiblePension=show.privatePension?included.privatePension:0
 const unhighlightedNet=money(netAndInvestments-visibleESPP-visiblePension)
 const inner=[
  segment('net','Líquido e aplicações',unhighlightedNet,financialColors.net),
  ...(visibleESPP>0?[segment('espp','ESPP destacado',visibleESPP,financialColors.espp)]:[]),
  ...(visiblePension>0?[segment('privatePension','Previdência destacada',visiblePension,financialColors.privatePension)]:[]),
  segment('pension','Pensão',pension??0,financialColors.pension),
  segment('irrf','IRRF',irrf??0,financialColors.irrf),
  segment('inss','INSS',inss??0,financialColors.inss)
 ]
 if(available>0.01)inner.push(segment('others','Saldo não classificado',available,financialColors.others))
 const outer=[
  segment('outerNet','Líquido, aplicações e pensão',netAndInvestments+(pension??0),financialColors.outerNet),
  segment('outerTaxes','IRRF + INSS',(irrf??0)+(inss??0),financialColors.outerTax)
 ]
 if(available>0.01)outer.push(segment('outerOther','Saldo não classificado',available,financialColors.outerOther))
 if(eligible.some(r=>r.months>0&&(
   r.net===null||r.inss===null||r.irrf===null||r.pension===null)))
  warnings.push('Uma ou mais rubricas estão ausentes em parte dos anos. O saldo residual não substitui esses dados.')
 if(officialYears.length)warnings.push('Os Informes IR conferidos fornecem IRRF, INSS e pensão anuais quando presentes. O bruto da folha continua separado do tributável.')
 const result=empty(netAndInvestments,available)
 return {...result,inner:inner.filter(s=>s.value>0),outer:outer.filter(s=>s.value>0),
  categories:[segment('gross','Proventos brutos',gross,financialColors.gross),...inner.filter(s=>s.value>0)]}
}
export function percentOfGross(value:number,gross:number|null):string{
 if(!gross||gross<=0)return '—'
 return new Intl.NumberFormat('pt-BR',{style:'percent',minimumFractionDigits:1,maximumFractionDigits:1}).format(value/gross)
}
