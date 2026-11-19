import {useEffect,useState} from 'react'
import {PayrepSelect} from './PayrepSelect'
import {PayrepPickerDialog} from './PayrepPickerDialog'
import {getFortnight,selectedFortnight} from '../lib/fortnight'

type Props={anchor:string;onClose:()=>void;onConfirm:(anchor:string)=>void}
const monthNames=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto',
 'setembro','outubro','novembro','dezembro']
export function FortnightPeriodPicker({anchor,onClose,onConfirm}:Props){
 const current=getFortnight(anchor)
 const [year,setYear]=useState(String(current.start.slice(0,4)))
 const [month,setMonth]=useState(String(Number(current.start.slice(5,7))))
 const [half,setHalf]=useState<1|2>(current.start.endsWith('-01')?1:2)
 const [error,setError]=useState('')
 useEffect(()=>setError(''),[year,month,half])
 const confirm=()=>{
  try{onConfirm(selectedFortnight(Number(year),Number(month),half))}
  catch(e){setError(e instanceof Error?e.message:'Período inválido')}
 }
 return <PayrepPickerDialog title="Selecionar quinzena"
  description="Escolha a quinzena, o mês e o ano para visualizar os registros de ponto."
  onClose={onClose} className="fortnight-picker">
  <div className="fortnight-picker-body">
   <fieldset className="fortnight-picker-half">
    <legend>Quinzena</legend>
    <div className="fortnight-picker-half-options">
     {([1,2] as const).map(v=><button type="button" key={v}
      className={half===v?'fortnight-picker-selected':'secondary'}
      aria-pressed={half===v} onClick={()=>setHalf(v)}>{v}ª quinzena</button>)}
    </div>
   </fieldset>
   <div className="fortnight-picker-fields">
    <label>Mês<PayrepSelect title="Escolher mês" value={month} onChange={setMonth}>
     {monthNames.map((name,i)=><option key={name} value={i+1}>{name}</option>)}
    </PayrepSelect></label>
    <label>Ano<input type="number" min={1900} max={2100} step={1} inputMode="numeric"
     value={year} onChange={event=>setYear(event.target.value)} aria-label="Ano da quinzena"/></label>
   </div>
   {error&&<p className="error" role="alert">{error}</p>}
  </div>
  <div className="payrep-picker-footer">
   <button type="button" className="secondary" onClick={onClose}>Cancelar</button>
   <button type="button" className="primary" onClick={confirm}>Confirmar</button>
  </div>
 </PayrepPickerDialog>
}
