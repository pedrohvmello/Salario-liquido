import type {SalaryEvent} from './data'

/** Latest confirmed parameter change that takes effect for a selected competence.
 * Matching the payroll projection, events become effective for their whole month.
 * Occasional payroll events (PPR, 13th, vacations) do not match parameter keys.
 */
export function latestEffectiveEvent(
 events:readonly SalaryEvent[],kind:string,competence:string
):SalaryEvent|null{
 const matches=events.filter(e=>e.kind===kind&&e.effective_date.slice(0,7)<=competence)
 matches.sort((a,b)=>a.effective_date.localeCompare(b.effective_date))
 return matches.at(-1)??null
}
