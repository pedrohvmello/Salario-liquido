import {useEffect,useRef,useState} from 'react'
import {Check,ChevronDown,ShieldCheck,X} from 'lucide-react'
import {authenticatorApps} from '../lib/mfaLabels'

type Props={value:string;onChange:(value:string)=>void}

export function AuthenticatorAppPicker({value,onChange}:Props){
 const [open,setOpen]=useState(false)
 const opener=useRef<HTMLButtonElement>(null)
 const dialog=useRef<HTMLDivElement>(null)

 useEffect(()=>{
  if(!open)return
  const before=document.body.style.overflow
  document.body.style.overflow='hidden'
  dialog.current?.querySelector<HTMLInputElement>('input:checked, input')?.focus()

  const handleKeyDown=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){
    event.preventDefault()
    setOpen(false)
    return
   }
   if(event.key!=='Tab')return
   const buttons=Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])')||[])
   if(!buttons.length)return
   const first=buttons[0],last=buttons[buttons.length-1]
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
  }
  document.addEventListener('keydown',handleKeyDown)
  return ()=>{
   document.body.style.overflow=before
   document.removeEventListener('keydown',handleKeyDown)
   opener.current?.focus()
  }
 },[open])

 const select=(name:string)=>{
  onChange(name)
  setOpen(false)
 }

 return <>
  <div className="mfa-app-picker-field">
   <span className="mfa-app-picker-label">Aplicativo autenticador a cadastrar</span>
   <button type="button" className="mfa-app-picker-trigger" ref={opener}
    aria-haspopup="dialog" aria-expanded={open}
    onClick={()=>setOpen(true)}>
    <span>{value?(value==='Outro'?'Outro aplicativo':value):'Selecione o aplicativo'}</span>
    <ChevronDown size={19} aria-hidden="true"/>
   </button>
  </div>
  {open&&<div className="mfa-app-picker-overlay" onPointerDown={e=>{if(e.target===e.currentTarget)setOpen(false)}}>
   <div className="mfa-app-picker-dialog" role="dialog" aria-modal="true" aria-labelledby="mfa-app-picker-title" aria-describedby="mfa-app-picker-subtitle" ref={dialog}>
    <div className="mfa-app-picker-header">
     <div className="mfa-app-picker-title"><ShieldCheck size={23} aria-hidden="true"/><h3 id="mfa-app-picker-title">Selecionar aplicativo</h3></div>
     <button type="button" className="mfa-app-picker-close" onClick={()=>setOpen(false)} aria-label="Fechar lista"><X size={21}/></button>
    </div>
    <p id="mfa-app-picker-subtitle" className="mfa-app-picker-subtitle">Qual aplicativo você utilizará para gerar os códigos?</p>
    <div className="mfa-app-picker-options" role="radiogroup" aria-label="Aplicativo autenticador">
     {authenticatorApps.map(name=><label key={name} className={'mfa-app-picker-option'+(value===name?' is-selected':'')}>
      <input type="radio" name="payrep-authenticator-app" value={name} checked={value===name} onChange={()=>select(name)}/>
      <span>{name==='Outro'?'Outro aplicativo':name}</span>
      {value===name&&<Check size={18} aria-hidden="true"/>}
     </label>)}
    </div>
    <button type="button" className="mfa-app-picker-cancel" onClick={()=>setOpen(false)}>Cancelar</button>
   </div>
  </div>}
 </>
}
