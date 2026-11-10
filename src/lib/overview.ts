import {roundMoney} from './money'
export const overviewCardDefinitions=[
 ['gross','Remuneração bruta'],
 ['deductions','Descontos totais'],
 ['fgts','FGTS informativo'],
 ['pensionPercent','Pensão (%)'],
 ['pensionAmount','Valor pensão'],
 ['mealBenefit','Vale-refeição'],
 ['fixedBenefit','Vale-benefício'],
 ['privatePension','Previdência'],
 ['childcareBenefit','Auxílio-creche'],
 ['espp','ESPP']
] as const
export type OverviewCardId=typeof overviewCardDefinitions[number][0]
export const defaultOverviewCards=overviewCardDefinitions.map(([id])=>id)
const validCards=new Set<string>(defaultOverviewCards)
export function normalizeOverviewCards(value:unknown):OverviewCardId[] {
 if(!Array.isArray(value))return [...defaultOverviewCards]
 const unique=new Set<string>()
 for(const item of value)if(typeof item==='string'&&validCards.has(item))unique.add(item)
 return [...unique] as OverviewCardId[]
}
export function changeCardVisibility(current:OverviewCardId[],id:OverviewCardId,show:boolean):OverviewCardId[]{
 const items=normalizeOverviewCards(current)
 if(show)return items.includes(id)?items:[...items,id]
 return items.filter(x=>x!==id)
}
export function moveOverviewCard(current:OverviewCardId[],id:OverviewCardId,direction:-1|1):OverviewCardId[]{
 const items=normalizeOverviewCards(current),from=items.indexOf(id),to=from+direction
 if(from<0||to<0||to>=items.length)return items
 const out=[...items];[out[from],out[to]]=[out[to],out[from]]
 return out
}
export function followingMonth(month:string):string{
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw Error('Competência inválida')
 const [year,index]=month.split('-').map(Number)
 const next=new Date(Date.UTC(year,index,1))
 return next.toISOString().slice(0,7)
}
export function workingDays(month:string,holidays:ReadonlySet<string>):number {
 const [year,index]=month.split('-').map(Number)
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw Error('Competência inválida')
 const last=new Date(Date.UTC(year,index,0)).getUTCDate()
 let count=0
 for(let d=1;d<=last;d++){
  const date=new Date(Date.UTC(year,index-1,d)),day=date.getUTCDay()
  if(day===0||day===6)continue
  if(!holidays.has(date.toISOString().slice(0,10)))count++
 }
 return count
}
export function projectedMealBenefit(daily:number,selectedMonth:string,holidays:ReadonlySet<string>){
 const ref=followingMonth(selectedMonth)
 const days=workingDays(ref,holidays)
 return {referenceMonth:ref,days,total:roundMoney(Math.max(0,daily)*days)}
}
