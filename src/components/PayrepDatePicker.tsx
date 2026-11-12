import {useState} from 'react'
import {CalendarDays,ChevronLeft,ChevronRight,ChevronsLeft,ChevronsRight} from 'lucide-react'
import {PayrepPickerDialog} from './PayrepPickerDialog'

function parseDate(value:string):Date|null{
 const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
 if(!match)return null
 const y=Number(match[1]),m=Number(match[2]),d=Number(match[3])
 const dt=new Date(y,m-1,d)
 return dt.getFullYear()===y&&dt.getMonth()===m-1&&dt.getDate()===d?dt:null
}
function toIso(date:Date){
 const p=(n:number)=>String(n).padStart(2,'0')
 return date.getFullYear()+'-'+p(date.getMonth()+1)+'-'+p(date.getDate())
}
function display(value:string){
 const d=parseDate(value)
 return d?new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'}).format(d):'Selecionar data'
}

type Props={value:string;onChange:(next:string)=>void;title?:string;id?:string;required?:boolean;disabled?:boolean}
const weekdays=['D','S','T','Q','Q','S','S']
export function PayrepDatePicker({value,onChange,title='Selecionar data',id,disabled=false}:Props){
 const initial=parseDate(value)||new Date()
 const [shown,setShown]=useState(false)
 const [year,setYear]=useState(initial.getFullYear())
 const [month,setMonth]=useState(initial.getMonth())
 const date=parseDate(value)
 const today=new Date()
 const firstDay=new Date(year,month,1).getDay()
 const days=new Date(year,month+1,0).getDate()
 const count=Math.ceil((firstDay+days)/7)*7
 const monthLabel=new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric'}).format(new Date(year,month,1))
 const move=(delta:number)=>{const dt=new Date(year,month+delta,1);setMonth(dt.getMonth());setYear(dt.getFullYear())}
 const choose=(day:number)=>{
  onChange(toIso(new Date(year,month,day)))
  setShown(false)
 }
 return <>
  <button id={id} type="button" disabled={disabled} className="payrep-select-trigger payrep-date-trigger" aria-haspopup="dialog" aria-expanded={shown}
   onClick={()=>{const chosen=parseDate(value)||new Date();setYear(chosen.getFullYear());setMonth(chosen.getMonth());setShown(true)}}>
   <span className={!date?'payrep-select-placeholder':''}>{display(value)}</span><CalendarDays size={17} aria-hidden="true"/>
  </button>
  {shown&&<PayrepPickerDialog title={title} onClose={()=>setShown(false)} className="payrep-date-modal">
   <div className="payrep-calendar-controls">
    <button type="button" title="Ano anterior" aria-label="Ano anterior" onClick={()=>setYear(y=>y-1)}><ChevronsLeft size={18}/></button>
    <button type="button" title="Mês anterior" aria-label="Mês anterior" onClick={()=>move(-1)}><ChevronLeft size={18}/></button>
    <strong aria-live="polite">{monthLabel}</strong>
    <button type="button" title="Próximo mês" aria-label="Próximo mês" onClick={()=>move(1)}><ChevronRight size={18}/></button>
    <button type="button" title="Próximo ano" aria-label="Próximo ano" onClick={()=>setYear(y=>y+1)}><ChevronsRight size={18}/></button>
   </div>
   <div className="payrep-calendar-grid" role="grid" aria-label={monthLabel}>
    {weekdays.map((day,i)=><span className="payrep-calendar-weekday" key={i}>{day}</span>)}
    {Array.from({length:count},(_,i)=>{
     const day=i-firstDay+1
     if(day<1||day>days)return <span key={i} aria-hidden="true"/>
     const chosen=date?.getFullYear()===year&&date.getMonth()===month&&date.getDate()===day
     const isToday=today.getFullYear()===year&&today.getMonth()===month&&today.getDate()===day
     return <button key={i} type="button" role="gridcell" aria-selected={chosen}
      className={'payrep-calendar-day'+(chosen?' selected':'')+(isToday?' today':'')}
      onClick={()=>choose(day)} aria-label={new Intl.DateTimeFormat('pt-BR',{dateStyle:'full'}).format(new Date(year,month,day))}>{day}</button>
    })}
   </div>
   <div className="payrep-picker-footer">
    <button type="button" className="secondary" onClick={()=>setShown(false)}>Cancelar</button>
    <button type="button" className="secondary" onClick={()=>{const now=new Date();setYear(now.getFullYear());setMonth(now.getMonth());chooseToday(now,onChange,setShown)}}>Hoje</button>
   </div>
  </PayrepPickerDialog>}
 </>
}
function chooseToday(date:Date,onChange:(v:string)=>void,setShown:(v:boolean)=>void){onChange(toIso(date));setShown(false)}
