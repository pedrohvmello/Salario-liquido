import {type ReactNode} from 'react'
import {AlertTriangle} from 'lucide-react'
import {PayrepPickerDialog} from './PayrepPickerDialog'

type Props={
 title:string
 description:string
 confirmLabel:string
 onClose:()=>void
 onConfirm:()=>void
 busy?:boolean
 destructive?:boolean
 children?:ReactNode
}

/** Branded, keyboard-accessible confirmation without native blocking dialogs. */
export function PayrepConfirmDialog({title,description,confirmLabel,onClose,onConfirm,busy=false,destructive=false,children}:Props){
 const close=()=>{if(!busy)onClose()}
 return <PayrepPickerDialog title={title} description={description} onClose={close} className="payrep-confirm-dialog">
  {children}
  {destructive&&<div className="payrep-confirm-warning"><AlertTriangle size={18}/><span>Confira os dados antes de continuar.</span></div>}
  <footer className="payrep-picker-footer payrep-confirm-footer">
   <button type="button" className="secondary" disabled={busy} onClick={close}>Cancelar</button>
   <button type="button" className={destructive?'payrep-confirm-danger':'primary'} disabled={busy} onClick={onConfirm}>{busy?'Processando...':confirmLabel}</button>
  </footer>
 </PayrepPickerDialog>
}
