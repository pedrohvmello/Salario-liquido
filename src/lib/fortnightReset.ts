import type {DayEntry} from './calendar'

/** Reset point times and bank allocation while preserving day annotations,
 * the manually selected holiday and other non-time historical evidence.
 */
export function clearedFortnightHours(entry:DayEntry):DayEntry{
 return {
  ...entry,start:'',lunchStart:'',lunchEnd:'',end:'',
  additionalHours:'',bankHours:false,
  bankDeltaMinutes:null,bankWeightedMinutes:null
 }
}
