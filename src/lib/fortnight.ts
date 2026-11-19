export type Fortnight={start:string;end:string;label:string}

const isoDay=(date:Date)=>date.toISOString().slice(0,10)
const iso=(y:number,m:number,d:number)=>isoDay(new Date(Date.UTC(y,m-1,d,12)))

export function todayInSaoPaulo():string{
 const parts=new Intl.DateTimeFormat('en-US',{
  timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'
 }).formatToParts(new Date())
 const value=Object.fromEntries(parts.map(part=>[part.type,part.value]))
 return [value.year,value.month,value.day].join('-')
}

export function getFortnight(anchor:string):Fortnight{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(anchor))throw Error('Data inválida')
 const year=Number(anchor.slice(0,4)),month=Number(anchor.slice(5,7)),day=Number(anchor.slice(8,10))
 if(month<1||month>12||day<1||iso(year,month,day)!==anchor)throw Error('Data inválida')
 const last=new Date(Date.UTC(year,month,0)).getUTCDate()
 const firstHalf=day<=15
 const start=iso(year,month,firstHalf?1:16)
 const end=iso(year,month,firstHalf?15:last)
 return {
  start,end,
  label:(firstHalf?'1ª':'2ª')+' quinzena · '+start.slice(8,10)+'/'+start.slice(5,7)+' a '+
   end.slice(8,10)+'/'+end.slice(5,7)+'/'+end.slice(0,4)
 }
}

export function shiftFortnight(anchor:string,delta:-1|1):string{
 const period=getFortnight(anchor)
 const y=Number(period.start.slice(0,4)),m=Number(period.start.slice(5,7))
 const second=Number(period.start.slice(8,10))===16
 if(delta===1){
  if(!second)return iso(y,m,16)
  return isoDay(new Date(Date.UTC(y,m,1,12)))
 }
 if(second)return iso(y,m,1)
 return isoDay(new Date(Date.UTC(y,m-2,16,12)))
}

export function fortnightDays(anchor:string):string[]{
 const period=getFortnight(anchor)
 const start=Date.parse(period.start+'T12:00:00Z')
 const end=Date.parse(period.end+'T12:00:00Z')
 return Array.from({length:Math.round((end-start)/86400000)+1},(_,i)=>isoDay(new Date(start+i*86400000)))
}

/** Build a fortnight from explicitly selected year, month and half. */
export function selectedFortnight(year:number,month:number,half:1|2):string{
 if(!Number.isInteger(year)||year<1900||year>2100||
  !Number.isInteger(month)||month<1||month>12||(half!==1&&half!==2))
  throw new Error('Selecione ano, mês e quinzena válidos.')
 return iso(year,month,half===1?1:16)
}
export function fortnightDisplay(anchor:string):{dateRange:string;halfLabel:string}{
 const period=getFortnight(anchor)
 const br=(date:string)=>date.slice(8,10)+'/'+date.slice(5,7)+'/'+date.slice(0,4)
 return {dateRange:br(period.start)+' a '+br(period.end),
  halfLabel:Number(period.start.slice(8,10))===1?'1ª quinzena':'2ª quinzena'}
}
