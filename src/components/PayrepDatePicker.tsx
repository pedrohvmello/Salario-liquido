import {useId,useState} from 'react'
import {CalendarDays,ChevronDown,ChevronLeft,ChevronRight,ChevronsLeft,ChevronsRight} from 'lucide-react'
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

type Props={
 value:string
 onChange:(next:string)=>void
 title?:string
 id?:string
 required?:boolean
 disabled?:boolean
 iconOnly?:boolean
 // Opt in for birth dates without changing other Payrep calendar instances.
 yearSelection?:boolean
 minYear?:number
 maxYear?:number
}
export function selectableYears(minYear:number,maxYear:number,query=''){
 if(!Number.isInteger(minYear)||!Number.isInteger(maxYear)||maxYear<minYear)return []
 return Array.from({length:maxYear-minYear+1},(_,i)=>maxYear-i)
  .filter(year=>String(year).includes(query))
}
const weekdays=['D','S','T','Q','Q','S','S']
export function PayrepDatePicker({
 value,onChange,title='Selecionar data',id,disabled=false,iconOnly=false,
 yearSelection=false,minYear=1900,maxYear=new Date().getFullYear()
}:Props){
 const initial=parseDate(value)||new Date()
 const [shown,setShown]=useState(false)
 const [selectingYear,setSelectingYear]=useState(false)
 const [yearQuery,setYearQuery]=useState('')
 const yearListId=useId()
 const yearSearchId=useId()
 const [year,setYear]=useState(initial.getFullYear())
 const [month,setMonth]=useState(initial.getMonth())
 const date=parseDate(value)
 const today=new Date()
 const firstDay=new Date(year,month,1).getDay()
 const days=new Date(year,month+1,0).getDate()
 const count=Math.ceil((firstDay+days)/7)*7
 const monthLabel=new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric'}).format(new Date(year,month,1))
 const monthName=new Intl.DateTimeFormat('pt-BR',{month:'long'}).format(new Date(year,month,1))
 const yearOptions=yearSelection&&selectingYear?selectableYears(minYear,maxYear,yearQuery):[]
 const previousMonthDisabled=yearSelection&&(year<minYear||(year===minYear&&month===0))
 const nextMonthDisabled=yearSelection&&(year>maxYear||(year===maxYear&&month>=today.getMonth()))
 const olderYearDisabled=yearSelection&&year<=minYear
 const newerYearDisabled=yearSelection&&year>=maxYear
 const move=(delta:number)=>{const dt=new Date(year,month+delta,1);setMonth(dt.getMonth());setYear(dt.getFullYear())}
 const choose=(day:number)=>{
  const chosen=new Date(year,month,day)
  if(yearSelection&&(chosen.getFullYear()<minYear||chosen.getFullYear()>maxYear||chosen>today))return
  onChange(toIso(chosen))
  setShown(false)
 }
 return <>
  <button id={id} type="button" disabled={disabled} className={'payrep-select-trigger payrep-date-trigger'+(iconOnly?' payrep-date-trigger--icon':'')}
    aria-haspopup="dialog" aria-expanded={shown} aria-label={iconOnly?title:undefined} title={iconOnly?title:undefined}
   onClick={()=>{const chosen=parseDate(value)||new Date();setYear(chosen.getFullYear());setMonth(chosen.getMonth());setSelectingYear(false);setYearQuery('');setShown(true)}}>
   {!iconOnly&&<span className={!date?'payrep-select-placeholder':''}>{display(value)}</span>}
    <CalendarDays size={17} aria-hidden="true"/>
  </button>
  {shown&&<PayrepPickerDialog title={title} onClose={()=>setShown(false)} className="payrep-date-modal">
   <div className="payrep-calendar-controls">
    {!selectingYear&&<>
     <button type="button" title="Ano anterior" aria-label="Ano anterior" disabled={olderYearDisabled}
      onClick={()=>setYear(y=>y-1)}><ChevronsLeft size={18}/></button>
     <button type="button" title="Mês anterior" aria-label="Mês anterior" disabled={previousMonthDisabled}
      onClick={()=>move(-1)}><ChevronLeft size={18}/></button>
    </>}
    {yearSelection?
     <div className="payrep-calendar-heading" aria-live="polite">
      {!selectingYear&&<span>{monthName} de </span>}
      <button type="button" className="payrep-calendar-year-trigger"
       aria-label={selectingYear?'Voltar ao calendário':'Selecionar ano: '+year}
       aria-expanded={selectingYear} aria-controls={yearListId}
       onClick={()=>{setSelectingYear(current=>!current);setYearQuery('')}}>
       {selectingYear?'Selecionar ano':year}<ChevronDown size={15} aria-hidden="true"/>
      </button>
     </div>
     :<strong aria-live="polite">{monthLabel}</strong>}
    {!selectingYear&&<>
     <button type="button" title="Próximo mês" aria-label="Próximo mês" disabled={nextMonthDisabled}
      onClick={()=>move(1)}><ChevronRight size={18}/></button>
     <button type="button" title="Próximo ano" aria-label="Próximo ano" disabled={newerYearDisabled}
      onClick={()=>setYear(y=>y+1)}><ChevronsRight size={18}/></button>
    </>}
   </div>
   {selectingYear?
    <div id={yearListId} className="payrep-calendar-year-panel">
     <label htmlFor={yearSearchId}>Buscar ano</label>
     <input id={yearSearchId} type="text" inputMode="numeric" maxLength={4}
      autoComplete="off" placeholder="Ex.: 1987" value={yearQuery}
      onChange={event=>setYearQuery(event.target.value.replace(/\D/g,'').slice(0,4))}/>
     <div className="payrep-calendar-year-grid" role="group" aria-label="Anos disponíveis">
      {yearOptions.map(option=><button type="button" key={option}
       aria-pressed={option===year}
       className={'payrep-calendar-year-option'+(option===year?' selected':'')}
       onClick={()=>{setYear(option);setSelectingYear(false);setYearQuery('')}}>{option}</button>)}
      {yearOptions.length===0&&<span className="payrep-calendar-year-empty">Ano não disponível.</span>}
     </div>
    </div>
   :<div className="payrep-calendar-grid" role="grid" aria-label={monthLabel}>
    {weekdays.map((day,i)=><span className="payrep-calendar-weekday" key={i}>{day}</span>)}
    {Array.from({length:count},(_,i)=>{
     const day=i-firstDay+1
     if(day<1||day>days)return <span key={i} aria-hidden="true"/>
     const chosen=date?.getFullYear()===year&&date.getMonth()===month&&date.getDate()===day
     const isToday=today.getFullYear()===year&&today.getMonth()===month&&today.getDate()===day
     const invalidBirthDate=yearSelection&&
      (year<minYear||year>maxYear||new Date(year,month,day)>today)
     return <button key={i} type="button" role="gridcell" aria-selected={chosen}
      disabled={invalidBirthDate}
      className={'payrep-calendar-day'+(chosen?' selected':'')+(isToday?' today':'')}
      onClick={()=>choose(day)} aria-label={new Intl.DateTimeFormat('pt-BR',{dateStyle:'full'}).format(new Date(year,month,day))}>{day}</button>
    })}
   </div>}
   <div className="payrep-picker-footer">
    <button type="button" className="secondary" onClick={()=>setShown(false)}>Cancelar</button>
    <button type="button" className="secondary" onClick={()=>{const now=new Date();setYear(now.getFullYear());setMonth(now.getMonth());chooseToday(now,onChange,setShown)}}>Hoje</button>
   </div>
  </PayrepPickerDialog>}
 </>
}
function chooseToday(date:Date,onChange:(v:string)=>void,setShown:(v:boolean)=>void){onChange(toIso(date));setShown(false)}
