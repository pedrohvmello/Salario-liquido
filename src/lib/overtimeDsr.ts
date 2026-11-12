import {roundMoney} from './money'
import type {Overtime} from './calendar'

type Hours=Pick<Overtime,'h60'|'h80'|'h100'>
export type OvertimeComponents={p60:number;p80:number;p100:number;total:number}
export type DsrCalculation={amount:number;workingDays:number;restDays:number;periodStart:string;periodEnd:string}

/** Income split by rate. Rounding per item keeps displayed lines reconcilable with the payroll. */
export function overtimeComponents(hours:Hours,baseSalary:number,divisor=220):OvertimeComponents{
 if(!Number.isFinite(divisor)||divisor<=0)throw Error('Divisor mensal inválido')
 const rate=Math.max(0,baseSalary)/divisor
 const p60=roundMoney(Math.max(0,hours.h60)*rate*1.6)
 const p80=roundMoney(Math.max(0,hours.h80)*rate*1.8)
 const p100=roundMoney(Math.max(0,hours.h100)*rate*2)
 return {p60,p80,p100,total:roundMoney(p60+p80+p100)}
}

/** Payrep's payroll period runs from the 16th of the previous month through the 15th.
 * Estimate: DSR = overtime pay / non-rest days × Sundays and public holidays.
 * Monday through Saturday count as non-rest days, except public holidays. An
 * explicit holiday override on a saved record wins over the public calendar.
 * Company collective agreements may apply a different denominator or period.
 */
export function overtimeDsr(payMonth:string,overtimePay:number,holidayDates:ReadonlySet<string>,overrides:ReadonlyMap<string,boolean>=new Map()):DsrCalculation{
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(payMonth))throw Error('Competência inválida')
 const [year,month]=payMonth.split('-').map(Number)
 const start=Date.UTC(year,month-2,16)
 const end=Date.UTC(year,month-1,15)
 let workingDays=0,restDays=0
 for(let day=start;day<=end;day+=86400000){
  const dt=new Date(day),date=dt.toISOString().slice(0,10)
  const manual=overrides.get(date)
  const publicHoliday=manual===true||(manual!==false&&holidayDates.has(date))
  const rest=dt.getUTCDay()===0||publicHoliday
  if(rest)restDays++
  else workingDays++
 }
 const amount=workingDays>0?roundMoney(Math.max(0,overtimePay)*restDays/workingDays):0
 return {amount,workingDays,restDays,periodStart:new Date(start).toISOString().slice(0,10),periodEnd:new Date(end).toISOString().slice(0,10)}
}
