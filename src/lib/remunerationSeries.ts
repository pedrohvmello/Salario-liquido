import {roundMoney} from './money'

export type RemunerationMonth={
 period:string
 bruto:number|null
 liquido:number|null
 ferias:number
}
export type RemunerationPoint={
 period:string
 bruto:number|null
 liquido:number|null
 ferias:number
}
const monthLabel=(period:string)=>period.slice(5,7)+'/'+period.slice(2,4)

/**
 * Every payroll month is counted at most once.
 * On the all-years view, monthly values are summed by calendar year.
 * 13th salary and PPR are excluded upstream and must never enter this series.
 * A year with no known gross/liquid data retains null instead of inventing zero.
 */
export function remunerationSeries(months:readonly RemunerationMonth[],year:string):RemunerationPoint[]{
 const ordered=[...months].sort((a,b)=>a.period.localeCompare(b.period))
 if(year!=='all')return ordered
   .filter(x=>x.period.startsWith(year))
   .map(x=>({period:monthLabel(x.period),bruto:x.bruto,liquido:x.liquido,ferias:x.ferias}))
 const annual=new Map<string, {period:string;bruto:number|null;liquido:number|null;ferias:number}>()
 for(const month of ordered){
  const y=month.period.slice(0,4)
  let row=annual.get(y)
  if(!row){row={period:y,bruto:null,liquido:null,ferias:0};annual.set(y,row)}
  if(month.bruto!==null)row.bruto=roundMoney((row.bruto??0)+month.bruto)
  if(month.liquido!==null)row.liquido=roundMoney((row.liquido??0)+month.liquido)
  row.ferias=roundMoney(row.ferias+month.ferias)
 }
 return [...annual.values()].sort((a,b)=>a.period.localeCompare(b.period))
}
