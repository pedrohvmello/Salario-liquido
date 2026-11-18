import {classifyHours,type DayEntry,type Overtime} from './calendar'

export type TimeBankPolicy={
 id:string;user_id:string;title:string;source_reference:string;
 valid_from:string;valid_until:string;
 weekday_factor:number;saturday_factor:number;sunday_factor:number; 
 holiday_factor:number;daily_target_minutes:number;
 settlement_interval_months:number;settlement_months:number[];settlement_half:number
}
export type BankRecord=DayEntry&{bankDeltaMinutes?:number|null;bankWeightedMinutes?:number|null}
export type BankMovement={date:string;deltaMinutes:number;balanceMinutes:number;paid:Overtime|null}
export type BankLedger={
 balanceMinutes:number
 firstInsufficientDate:string|null
 firstMissingPolicyDate:string|null
 movements:Map<string,BankMovement>
}

const COMPLETE=/^([01]\d|2[0-3]):[0-5]\d$/
const toMinutes=(value:string)=>Number(value.slice(0,2))*60+Number(value.slice(3,5))
const additionalMinutes=(value:string|undefined)=>value?toMinutes(value):0

export function isCompleteWorkday(entry:DayEntry):boolean{
 return [entry.start,entry.lunchStart,entry.lunchEnd,entry.end].every(v=>COMPLETE.test(v))
}

export function effectiveHoliday(entry:DayEntry,dates:ReadonlySet<string>|null):boolean{
 return entry.holidayOverride??(dates?dates.has(entry.date):(entry.effectiveHoliday??false))
}

export function workedMinutes(entry:DayEntry):number{
 if(!isCompleteWorkday(entry))throw new Error('Jornada incompleta')
 if(entry.additionalHours&&!COMPLETE.test(entry.additionalHours))throw new Error('Horas adicionais inválidas')
 const start=toMinutes(entry.start)
 const lunchStart=toMinutes(entry.lunchStart)
 const lunchEnd=toMinutes(entry.lunchEnd)
 const end=toMinutes(entry.end)
 const total=(lunchStart-start)+(end-lunchEnd)+additionalMinutes(entry.additionalHours)
 if(!(start<=lunchStart&&lunchStart<=lunchEnd&&lunchEnd<=end)||total>1440||total<0)
  throw new Error('Jornada inválida')
 return total
}

export function policyForDate(policies:TimeBankPolicy[],date:string):TimeBankPolicy|undefined{
 return policies.find(policy=>policy.valid_from<=date&&policy.valid_until>=date)
}
export function movementForDay(entry:DayEntry,dates:ReadonlySet<string>|null,policies:TimeBankPolicy[]):number{
 if(!entry.bankHours||!isCompleteWorkday(entry))return 0
 const policy=policyForDate(policies,entry.date)
 if(!policy)throw new Error('Política de Banco de Horas sem vigência para '+entry.date)
 const total=workedMinutes(entry)
 const dow=new Date(entry.date+'T12:00:00Z').getUTCDay()
 const holiday=effectiveHoliday(entry,dates)
 const threshold=holiday||dow===0||dow===6?0:policy.daily_target_minutes
 const raw=total-threshold
 const factor=holiday?policy.holiday_factor:
  dow===0?policy.sunday_factor:
  dow===6?policy.saturday_factor:policy.weekday_factor
 return raw>=0?Math.round(raw*factor):raw
}

export function paidOvertime(entry:DayEntry,dates:ReadonlySet<string>):Overtime{
 const calc=classifyHours(entry,dates)
 return entry.bankHours?{...calc,h60:0,h80:0,h100:0}:calc
}

/** Balance is chronological across ALL recorded periods, not the selected fortnight.
 * Saved rows can use the database's generated minute value. Draft edits
 * deliberately remove that field and are recalculated with the current calendar.
 */
export function calculateBankLedger(entries:BankRecord[],dates:ReadonlySet<string>|null,policies:TimeBankPolicy[]):BankLedger{
 const byDate=new Map(entries.map(entry=>[entry.date,entry]))
 let balanceMinutes=0
 let firstInsufficientDate:string|null=null
 let firstMissingPolicyDate:string|null=null
 const movements=new Map<string,BankMovement>()
 for(const entry of [...byDate.values()].sort((a,b)=>a.date.localeCompare(b.date))){
  let paid:Overtime|null=null
  let deltaMinutes=0
  try{
   if(isCompleteWorkday(entry)){
    paid=dates?paidOvertime(entry,dates):null
    deltaMinutes=typeof entry.bankWeightedMinutes==='number'
     ?entry.bankWeightedMinutes:movementForDay(entry,dates,policies)
   }
  }catch{
   if(entry.bankHours && typeof entry.bankWeightedMinutes!=='number'&&!firstMissingPolicyDate){
    firstMissingPolicyDate=entry.date
   }
   paid=null;deltaMinutes=0
  }
  balanceMinutes+=deltaMinutes
  if(balanceMinutes<0&&!firstInsufficientDate)firstInsufficientDate=entry.date
  movements.set(entry.date,{date:entry.date,deltaMinutes,balanceMinutes,paid})
 }
 return {balanceMinutes,firstInsufficientDate,firstMissingPolicyDate,movements}
}

export function formatBankMinutes(value:number):string{
 const negative=value<0?'-':''
 const abs=Math.abs(value)
 return negative+String(Math.floor(abs/60)).padStart(2,'0')+':'+String(abs%60).padStart(2,'0')
}
