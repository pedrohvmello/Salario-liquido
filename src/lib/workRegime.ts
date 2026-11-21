import {effectiveHoliday,isCompleteWorkday,policyForDate,workedMinutes,type BankRecord,type TimeBankPolicy} from './timeBank'
export type WorkRegime='regular'|'trust'
export function normalizedWorkRegime(value:unknown):WorkRegime{return value==='trust'?'trust':'regular'}
/** Informational signed balance of entered workdays. No payroll or bank movement is created.
 * Only complete, actually registered shifts are counted. Missing dates are not assumed absences.
 * Expected hours come from the active policy, or 8h on weekdays when no policy exists.
 */
export function recordedHoursBalanceMinutes(
 entries:readonly BankRecord[],holidayDates:ReadonlySet<string>|null,policies:TimeBankPolicy[]
):number{
 const sorted=new Map(entries.map(entry=>[entry.date,entry]))
 let balance=0
 for(const entry of sorted.values()){
  if(!isCompleteWorkday(entry))continue
  try{
   const dow=new Date(entry.date+'T12:00:00Z').getUTCDay()
   const holiday=effectiveHoliday(entry,holidayDates)
   const target=dow===0||dow===6||holiday?0:(policyForDate(policies,entry.date)?.daily_target_minutes??480)
   balance+=workedMinutes(entry)-target
  }catch{/* Invalid historical days are left untouched and excluded. */}
 }
 return balance
}
