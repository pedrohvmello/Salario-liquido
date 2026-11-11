import {useEffect,useRef,useState} from 'react'
import {ChevronLeft,ChevronRight} from 'lucide-react'
import {selectCompetence} from '../lib/overview'

const monthNames=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const lowerYear=1900,upperYear=2100

export function CompetencePicker({month,onChange}:{month:string;onChange:(month:string)=>void}){
 const [open,setOpen]=useState(false)
 const [year,setYear]=useState(Number(month.slice(0,4)))
 const rootRef=useRef<HTMLDivElement>(null)
 useEffect(()=>{if(!open)setYear(Number(month.slice(0,4)))},[month,open])
 useEffect(()=>{
  if(!open)return
  const outside=(event:PointerEvent)=>{
   if(rootRef.current&&!rootRef.current.contains(event.target as Node))setOpen(false)
  }
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')setOpen(false)}
  document.addEventListener('pointerdown',outside)
  document.addEventListener('keydown',escape)
  return ()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape)}
 },[open])
 const current=new Date()
 const nowYear=current.getFullYear(),nowMonth=String(current.getMonth()+1).padStart(2,'0')
 const label=new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'})
  .format(new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7))-1,1)))
 const select=(m:string)=>{
  onChange(selectCompetence(m,nowYear+'-'+nowMonth))
  setOpen(false)
 }
 return <div className="hero-competence" ref={rootRef}>
  <button type="button" className="hero-kicker hero-kicker-trigger" aria-haspopup="dialog" aria-expanded={open} aria-label={'Selecionar competência. Atual: '+label} onClick={()=>setOpen(v=>!v)}>
   PROJEÇÃO DE {label.toLocaleUpperCase('pt-BR')}
  </button>
  {open&&<div className="competence-popover" role="dialog" aria-label="Selecionar mês e ano da projeção">
   <div className="competence-year-row">
    <button type="button" className="competence-year-arrow" aria-label="Ano anterior" disabled={year<=lowerYear} onClick={()=>setYear(y=>Math.max(lowerYear,y-1))}><ChevronLeft size={19}/></button>
    <span aria-live="polite">{year}</span>
    <button type="button" className="competence-year-arrow" aria-label="Próximo ano" disabled={year>=upperYear} onClick={()=>setYear(y=>Math.min(upperYear,y+1))}><ChevronRight size={19}/></button>
   </div>
   <div className="competence-month-grid">{monthNames.map((name,i)=>{
    const value=year+'-'+String(i+1).padStart(2,'0')
    return <button key={value} type="button" className={month===value?'competence-month selected':'competence-month'} aria-pressed={month===value} onClick={()=>select(value)}>{name}</button>
   })}</div>
   <button className="competence-now" type="button" onClick={()=>select(nowYear+'-'+nowMonth)}>Mês atual</button>
  </div>}
 </div>
}
