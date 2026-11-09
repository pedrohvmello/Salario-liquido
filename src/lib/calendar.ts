import { roundMoney } from './money'
export type DayEntry = { date:string; start:string; lunchStart:string; lunchEnd:string; end:string; holidayOverride: boolean | null }
export type Overtime = { h60:number; h80:number; h100:number; total:number; payMonth:string }
function easter(y:number) {
  const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3)
  const h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k+7)%7,m=Math.floor((a+11*h+22*l)/451)
  const month=Math.floor((h+l-7*m+114)/31),day=(h+l-7*m+114)%31+1
  return new Date(Date.UTC(y,month-1,day))
}
const ymd=(d:Date)=>d.toISOString().slice(0,10)
const add=(d:Date,days:number)=>new Date(d.getTime()+days*86400000)
export function saoPauloHoliday(date:string):boolean {
  const y=Number(date.slice(0,4))
  const fixed=['01-01','01-25','04-21','05-01','07-09','09-07','10-12','11-02','11-15','11-20','12-25']
  if (fixed.includes(date.slice(5))) return true
  const pascoa=easter(y)
  return date===ymd(add(pascoa,-2)) || date===ymd(add(pascoa,60)) // Sexta Santa / Corpus Christi
}
const mins=(v:string) => { const [h,m]=v.split(':').map(Number);return Number.isFinite(h)&&Number.isFinite(m)?h*60+m:NaN }
export function paidMonth(date:string) {
  const y=Number(date.slice(0,4)),m=Number(date.slice(5,7)),d=Number(date.slice(8,10))
  const value = new Date(Date.UTC(y,m-1+(d>=16?1:0),1))
  return value.toISOString().slice(0,7)
}
export function classifyHours(entry:DayEntry):Overtime {
  const a=mins(entry.start),b=mins(entry.lunchStart),c=mins(entry.lunchEnd),d=mins(entry.end)
  if (![a,b,c,d].every(Number.isFinite) || !(a<=b&&b<=c&&c<=d)) throw new Error('Horários inválidos: entrada, almoço e saída devem estar em ordem')
  const total = roundMoney(((b-a)+(d-c))/60)
  if (total>24) throw new Error('Jornada superior a 24 horas')
  const dow=new Date(entry.date+'T12:00:00Z').getUTCDay()
  const holiday=entry.holidayOverride??saoPauloHoliday(entry.date)
  const paid = paidMonth(entry.date)
  if (holiday||dow===0) return {h60:0,h80:0,h100:total,total,payMonth:paid}
  const extra=dow===6 ? total : Math.max(0,total-8)
  return {h60:roundMoney(Math.min(2,extra)),h80:roundMoney(Math.max(0,extra-2)),h100:0,total,payMonth:paid}
}
export function overtimeValue(h:Pick<Overtime,'h60'|'h80'|'h100'>,gross:number,divisor=220){
  if (divisor<=0) throw new Error('Divisor deve ser positivo')
  const hour=gross/divisor
  return roundMoney(hour*(h.h60*1.6+h.h80*1.8+h.h100*2))
}
