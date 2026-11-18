import type {DayEntry} from './calendar'

const timePattern=/^([01]\d|2[0-3]):[0-5]\d$/
const additionalPattern=/^([01]\d|2[0-3]):([0-5]\d)$/
const isoPattern=/^\d{4}-\d{2}-\d{2}$/

/** Pure mapper for inserting complete or incomplete days into Supabase. */
export function timePayload(entry:DayEntry,user_id:string,id?:string){
 const date=new Date(entry.date+'T12:00:00Z')
 if(!isoPattern.test(entry.date)||!Number.isFinite(date.getTime())||
  date.toISOString().slice(0,10)!==entry.date)throw Error('Data inválida.')

 const time=(value:string,name:string)=>{
  if(!value)return null
  if(!timePattern.test(value))throw Error(name+': use 00:00 a 23:59.')
  return value
 }
 const extra=entry.additionalHours?.trim()||''
 const additional=extra?additionalPattern.exec(extra):null
 if(extra&&!additional)throw Error('Horas adicionais: use 00:00 a 23:59.')
 const comments=entry.comments?.trim()||null
 if(comments&&comments.length>500)throw Error('Comentários devem ter no máximo 500 caracteres.')
 return {
  ...(id?{id}:{}),user_id,date:entry.date,
  start_at:time(entry.start,'Entrada'),
  lunch_start:time(entry.lunchStart,'Início do almoço'),
  lunch_end:time(entry.lunchEnd,'Fim do almoço'),
  end_at:time(entry.end,'Saída'),
  additional_minutes:additional?Number(additional[1])*60+Number(additional[2]):0,
  holiday_override:entry.holidayOverride,
  bank_hours:entry.bankHours??false,
  effective_holiday:entry.holidayOverride??entry.effectiveHoliday??false,
  comments
 }
}
