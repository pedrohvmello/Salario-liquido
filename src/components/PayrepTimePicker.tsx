import {useState} from 'react'
import {Clock3} from 'lucide-react'
import {PayrepPickerDialog} from './PayrepPickerDialog'

const pad=(n:number)=>String(n).padStart(2,'0')
function parseTime(value:string){
 const match=/^([01]\d|2[0-3]):([0-5]\d)$/.exec(value)
 return match?{hour:Number(match[1]),minute:Number(match[2])}:{hour:9,minute:0}
}
type Props={value:string;onChange:(value:string)=>void;id?:string;title?:string;disabled?:boolean;required?:boolean}
export function PayrepTimePicker({value,onChange,id,title='Selecionar horário',disabled=false}:Props){
 const [opened,setOpened]=useState(false)
 const [hour,setHour]=useState(9)
 const [minute,setMinute]=useState(0)
 const [typed,setTyped]=useState('')
 const apply=()=>{
  const match=/^([01]\d|2[0-3]):([0-5]\d)$/.exec(typed)
  if(match)onChange(typed)
  else onChange(pad(hour)+':'+pad(minute))
  setOpened(false)
 }
 const selectHour=(n:number)=>{setHour(n);setTyped('')}
 const selectMinute=(n:number)=>{setMinute(n);setTyped('')}
 return <>
  <button id={id} type="button" className="payrep-select-trigger payrep-time-trigger" disabled={disabled}
   aria-haspopup="dialog" aria-expanded={opened}
   onClick={()=>{const t=parseTime(value);setHour(t.hour);setMinute(t.minute);setTyped('');setOpened(true)}}>
   <span>{value||'Selecionar horário'}</span><Clock3 size={17} aria-hidden="true"/>
  </button>
  {opened&&<PayrepPickerDialog title={title} onClose={()=>setOpened(false)} className="payrep-time-modal"
   description="Escolha a hora e o minuto. Você também pode digitar o horário exato.">
   <div className="payrep-time-columns">
    <div className="payrep-time-group"><strong>Hora</strong><div className="payrep-time-options" role="group" aria-label="Hora">
     {Array.from({length:24},(_,n)=><button key={n} type="button" aria-pressed={hour===n}
      className={hour===n?'selected':''} onClick={()=>selectHour(n)}>{pad(n)}</button>)}
    </div></div>
    <span className="payrep-time-colon" aria-hidden="true">:</span>
    <div className="payrep-time-group"><strong>Minuto</strong><div className="payrep-time-options" role="group" aria-label="Minuto">
     {Array.from({length:60},(_,n)=><button key={n} type="button" aria-pressed={minute===n}
      className={minute===n?'selected':''} onClick={()=>selectMinute(n)}>{pad(n)}</button>)}
    </div></div>
   </div>
   <label className="payrep-time-exact">Horário exato (opcional)
    <input type="text" inputMode="numeric" placeholder={pad(hour)+':'+pad(minute)} value={typed} maxLength={5}
     onChange={e=>setTyped(e.target.value)} pattern="([01][0-9]|2[0-3]):[0-5][0-9]" aria-label="Digitar horário exato"/>
   </label>
   {typed&&!/^([01]\d|2[0-3]):([0-5]\d)$/.test(typed)&&<small className="payrep-time-invalid">Use o formato HH:MM, de 00:00 a 23:59.</small>}
   <div className="payrep-picker-footer">
    <button className="secondary" type="button" onClick={()=>setOpened(false)}>Cancelar</button>
    <button className="primary" type="button" disabled={Boolean(typed&&!/^([01]\d|2[0-3]):([0-5]\d)$/.test(typed))} onClick={apply}>Aplicar</button>
   </div>
  </PayrepPickerDialog>}
 </>
}
