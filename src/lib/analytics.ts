/**
 * Financial indicators supported by imported payroll evidence.
 * Only monthly statements contribute to monthly benefits and ordinary taxes.
 * Separate 13th / PPR statements retain their exclusive taxes.
 * No retroactive history is fabricated from current configuration values.
 */
import {roundMoney} from './money'
import type {SavedStatement} from './data'
import type {StatementRubric} from './vacation'

export type MetricKey='trienio'|'privatePension'|'inss'|'espp'|'meal'|'pension'|'overtime'
export const METRICS=[
 {key:'privatePension',label:'Previdência privada',note:'Contribuição descontada na folha (VGBL/PGBL). A contrapartida patronal não é presumida.'},
 {key:'espp',label:'ESPP',note:'Descontos da compra de ações identificados na folha, não a valorização das ações.'},
 {key:'meal',label:'Vale-refeição',note:'Créditos identificados na folha. A configuração diária atual não comprova créditos históricos.'},
 {key:'trienio',label:'Triênio',note:'Valor pago na rubrica regular. Retroativos e reembolsos não alteram o valor recorrente.'},
 {key:'inss',label:'INSS',note:'Retenção em folhas mensais, incluindo férias contabilizadas; 13º é separado.'},
 {key:'pension',label:'Pensão alimentícia',note:'Retenções da folha mensal, incluindo rubricas de férias e adiantamentos.'},
 {key:'overtime',label:'Horas extras',note:'Proventos de horas extras na folha, sem somar DSR à mesma rubrica.'}
] as const satisfies readonly {key:MetricKey;label:string;note:string}[]
export type MonthlyMetrics={period:string;fgts:number|null;irrfSalary:number|null;irrfVacation:number|null}&Record<MetricKey,number|null>
export type TimeMetrics=MonthlyMetrics&{label:string;monthlyStatements:number}
export type TaxTime={label:string;salary:number|null;vacation:number|null;thirteenth:number|null;ppr:number|null;total:number|null}
export type ComparisonRow={label:string;gross:number;net:number;pension?:number;inss?:number;irrf:number;other:number}
export type IrrfStackKey='salary'|'vacation'|'thirteenth'|'ppr'
/** Returns the highest positive segment for each stacked IRRF bar.
 * Only this segment has rounded top corners; middle segments remain square.
 */
export function topIrrfStackSegment(row:Pick<TaxTime,IrrfStackKey>):IrrfStackKey|null{
 const order:IrrfStackKey[]=['ppr','thirteenth','vacation','salary']
 return order.find(key=>(row[key]??0)>0)??null
}
const keys=['trienio','privatePension','inss','espp','meal','pension','overtime','irrfSalary','irrfVacation'] as const
type Classified=typeof keys[number]
const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\s+/g,' ').trim()
const add=(a:number|null,b:number)=>roundMoney((a??0)+b)
export function classifyPayrollLine(line:Pick<StatementRubric,'code'|'description'|'side'>):Classified|null {
 const code=line.code.toUpperCase(), desc=normalize(line.description)
 if(line.side==='credit'){
  if(code==='00135'||code==='3301'||/^TRIENIO(?:\s+MES)?$/.test(desc))return 'trienio'
  if(/^VALE (?:REFEICAO|ALIMENTACAO)(?:\s|$)/.test(desc)&&
      !/DESCONTO|COPARTICIPACAO/.test(desc))return 'meal'
  if(['00050','00070','00090'].includes(code)||/HORAS? EXTRAS? (?:60|80|100)%?/.test(desc))return 'overtime'
  return null
 }
 if(line.side!=='debit')return null
 if(code==='07780'||/\b(?:VGBL|PGBL)\b|PREVIDENCIA (?:PRIVADA|COMPLEMENTAR)/.test(desc))
   return 'privatePension'
 if(/\bESPP\b|\bSTOCK PURCHASE\b|\bCOMPRA DE ACOES\b/.test(desc))
   return 'espp'
 if(['07020','07040'].includes(code)||/^INSS (?:MES|FERIAS|DESCONTADO FERIAS)\b/.test(desc))
   return 'inss'
 if(code==='07065'||/IRRF.*FERIAS|IMPOSTO.*FERIAS/.test(desc))return 'irrfVacation'
 if(code==='07050'||/^IRRF (?:MES|MENSAL)\b/.test(desc)||desc==='IRRF')return 'irrfSalary'
 if(['07150','07145','07550'].includes(code)||/PENSAO ALIMENTICIA|PENSAO ALIM|PENSAO ALIM/.test(desc))
   return 'pension'
 return null
}
export function payrollMetrics(statements:readonly SavedStatement[],lines:readonly StatementRubric[]):MonthlyMetrics[]{
 const eligible=new Map<string,SavedStatement>()
 // One monthly document per competence, preventing duplicate salary totals.
 for(const s of [...statements].sort((a,b)=>a.id.localeCompare(b.id))){
  if(s.document_type==='monthly'&&!eligible.has(s.period))eligible.set(s.period,s)
 }
 const byId=new Map<string,string>([...eligible.values()].map(s=>[s.id,s.period]))
 const rows=new Map<string,MonthlyMetrics>()
 for(const s of eligible.values()){
  rows.set(s.period,{period:s.period,fgts:s.fgts,
   trienio:null,privatePension:null,inss:null,espp:null,meal:null,pension:null,overtime:null,
   irrfSalary:null,irrfVacation:null})
 }
 for(const line of lines){
  const period=byId.get(line.statement_id)
  if(!period||!Number.isFinite(line.amount)||line.amount<0)continue
  const metric=classifyPayrollLine(line)
  if(!metric)continue
  const record=rows.get(period)!
  record[metric]=add(record[metric],line.amount)
 }
 return [...rows.values()].sort((a,b)=>a.period.localeCompare(b.period))
}
const months=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
export function timeMetrics(records:readonly MonthlyMetrics[],year:string):TimeMetrics[]{
 if(year!=='all'){
  return months.map((name,index)=>{
   const period=year+'-'+String(index+1).padStart(2,'0')
   const r=records.find(x=>x.period===period)
   return {label:name,period,fgts:r?.fgts??null,trienio:r?.trienio??null,
    privatePension:r?.privatePension??null,inss:r?.inss??null,espp:r?.espp??null,
    meal:r?.meal??null,pension:r?.pension??null,overtime:r?.overtime??null,
    irrfSalary:r?.irrfSalary??null,irrfVacation:r?.irrfVacation??null,
    monthlyStatements:r?1:0}
  })
 }
 const grouped=new Map<string,TimeMetrics>()
 for(const r of records){
  const y=r.period.slice(0,4)
  let v=grouped.get(y)
  if(!v){v={label:y,period:y,monthlyStatements:0,fgts:null,trienio:null,privatePension:null,
    inss:null,espp:null,meal:null,pension:null,overtime:null,irrfSalary:null,irrfVacation:null};grouped.set(y,v)}
  v.monthlyStatements++
  for(const key of ['fgts',...keys] as const)if(r[key]!==null)v[key]=add(v[key],r[key]!)
 }
 return [...grouped.values()].sort((a,b)=>a.period.localeCompare(b.period))
}
export function taxTimeSeries(
  ordinary:readonly MonthlyMetrics[],statements:readonly SavedStatement[],year:string
):TaxTime[]{
 const map=new Map<string,TaxTime>()
 const ensure=(ym:string)=>{
  const group=year==='all'?ym.slice(0,4):ym
  const label=year==='all'?group:months[Number(ym.slice(5,7))-1]||ym
  if(!map.has(group))map.set(group,{label,salary:null,vacation:null,thirteenth:null,ppr:null,total:null})
  return map.get(group)!
 }
 if(year!=='all')for(let m=1;m<=12;m++)ensure(year+'-'+String(m).padStart(2,'0'))
 for(const m of ordinary){
  if(year!=='all'&&!m.period.startsWith(year))continue
  const r=ensure(m.period)
  if(m.irrfSalary!==null)r.salary=add(r.salary,m.irrfSalary)
  if(m.irrfVacation!==null)r.vacation=add(r.vacation,m.irrfVacation)
 }
 for(const s of statements){
  if(s.document_type!=='ppr'&&s.document_type!=='thirteenth')continue
  const payment=s.payment_date?.slice(0,7)
  if(!payment|| (year!=='all'&&!payment.startsWith(year)))continue
  const r=ensure(payment)
  if(s.document_type==='ppr')r.ppr=add(r.ppr,s.ppr_income_tax||0)
  else r.thirteenth=add(r.thirteenth,s.thirteenth_irrf||0)
 }
 for(const r of map.values()){
  const amounts=[r.salary,r.vacation,r.thirteenth,r.ppr].filter((x):x is number=>x!==null)
  r.total=amounts.length?roundMoney(amounts.reduce((a,b)=>a+b,0)):null
 }
 return [...map.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([,r])=>r)
}
export function thirteenthComparison(rows:readonly {year:string;gross:number;closingNet:number;advance:number;pension:number;inss:number;irrf:number}[],year:string):ComparisonRow[]{
 return rows.filter(r=>year==='all'||r.year===year).sort((a,b)=>a.year.localeCompare(b.year)).map(r=>{
  const net=roundMoney(r.closingNet+r.advance)
  return {label:r.year,gross:r.gross,net,pension:r.pension,inss:r.inss,irrf:r.irrf,
   other:roundMoney(r.gross-net-r.pension-r.inss-r.irrf)}
 })
}
export function pprComparison(statements:readonly SavedStatement[],year:string):ComparisonRow[]{
 const map=new Map<string,ComparisonRow>()
 for(const s of statements){
  if(s.document_type!=='ppr'||!s.payment_date||s.gross_ppr===null||s.net===null)continue
  const y=s.payment_date.slice(0,4)
  if(year!=='all'&&y!==year)continue
  let r=map.get(y)
  if(!r){r={label:y,gross:0,net:0,irrf:0,other:0};map.set(y,r)}
  r.gross=add(r.gross,s.gross_ppr)
  r.net=add(r.net,s.net)
  r.irrf=add(r.irrf,s.ppr_income_tax)
  r.other=roundMoney(r.gross-r.net-r.irrf)
 }
 return [...map.values()].sort((a,b)=>a.label.localeCompare(b.label))
}
