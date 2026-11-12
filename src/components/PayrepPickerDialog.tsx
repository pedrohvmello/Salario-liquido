import {useEffect,useId,useRef,type ReactNode} from 'react'
import {createPortal} from 'react-dom'
import {X} from 'lucide-react'

type Props={
 title:string
 children:ReactNode
 onClose:()=>void
 className?:string
 description?:string
}
export function PayrepPickerDialog({title,children,onClose,className='',description}:Props){
 const titleId=useId()
 const descriptionId=useId()
 const dialogRef=useRef<HTMLDivElement>(null)
 const closeRef=useRef(onClose)
 closeRef.current=onClose

 useEffect(()=>{
  const previous=document.activeElement instanceof HTMLElement?document.activeElement:null
  const oldOverflow=document.body.style.overflow
  document.body.style.overflow='hidden'
  dialogRef.current?.querySelector<HTMLElement>('[data-picker-focus],button:not(:disabled),input:not(:disabled)')?.focus()
  const onKey=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){event.preventDefault();closeRef.current();return}
   if(event.key!=='Tab'||!dialogRef.current)return
   const focusable=Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])'))
   if(!focusable.length)return
   const first=focusable[0],last=focusable[focusable.length-1]
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
   if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
  }
  document.addEventListener('keydown',onKey)
  return ()=>{
   document.removeEventListener('keydown',onKey)
   document.body.style.overflow=oldOverflow
   previous?.focus()
  }
 },[])

 return createPortal(
  <div className="payrep-picker-backdrop" onPointerDown={e=>{if(e.target===e.currentTarget)onClose()}}>
   <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId}
    aria-describedby={description?descriptionId:undefined}
    className={'payrep-picker-dialog '+className}>
    <header className="payrep-picker-header">
     <h3 id={titleId}>{title}</h3>
     <button type="button" className="payrep-picker-close" aria-label="Fechar" onClick={onClose}><X size={19}/></button>
    </header>
    {description&&<p id={descriptionId} className="payrep-picker-description">{description}</p>}
    {children}
   </div>
  </div>,
  document.body
 )
}
