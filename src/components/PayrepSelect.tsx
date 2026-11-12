import {Children,Fragment,isValidElement,useMemo,useState,type ReactNode} from 'react'
import {Check,ChevronDown,Search} from 'lucide-react'
import {PayrepPickerDialog} from './PayrepPickerDialog'

type Option={value:string;label:string;disabled:boolean}
function readOptions(children:ReactNode):Option[]{
 const items:Option[]=[]
 Children.forEach(children,child=>{
  if(!isValidElement(child))return
  if(child.type===Fragment){
   items.push(...readOptions((child.props as {children?:ReactNode}).children))
  }else if(child.type==='option'){
   const p=child.props as {value?:string|number;children?:ReactNode;label?:string;disabled?:boolean}
   const label=String(p.label??p.children??p.value??'')
   items.push({value:String(p.value??label),label,disabled:Boolean(p.disabled)})
  }
 })
 return items
}
function normalize(value:string){
 return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()
}

type Props={
 children:ReactNode
 value?:string|number
 defaultValue?:string|number
 onChange?:(value:string)=>void
 id?:string
 name?:string
 title?:string
 className?:string
 disabled?:boolean
 required?:boolean
 'aria-label'?:string
}
export function PayrepSelect(props:Props){
 const {children,value,defaultValue,onChange,id,title,className='',disabled=false,required=false}=props
 const [initial,setInitial]=useState(()=>String(defaultValue??''))
 const [open,setOpen]=useState(false)
 const [query,setQuery]=useState('')
 const options=useMemo(()=>readOptions(children),[children])
 const selected=value!==undefined?String(value):initial
 const current=options.find(o=>o.value===selected)
 const currentLabel=current?.label||'Selecione'
 const visible=useMemo(()=>{
  const q=normalize(query)
  return q?options.filter(o=>normalize(o.label).includes(q)).slice(0,100):options.slice(0,100)
 },[options,query])
 const heading=title||props['aria-label']||'Selecionar opção'

 const choose=(option:Option)=>{
  if(option.disabled)return
  if(value===undefined)setInitial(option.value)
  onChange?.(option.value)
  setOpen(false)
  setQuery('')
 }

 return <>
  <button id={id} type="button" aria-label={props['aria-label']||heading}
   aria-haspopup="dialog" aria-expanded={open}
   className={'payrep-select-trigger '+className}
   disabled={disabled} onClick={()=>{setOpen(true);setQuery('')}}>
   <span className={selected===''?'payrep-select-placeholder':''}>{currentLabel}</span>
   <ChevronDown size={17} aria-hidden="true"/>
  </button>
  {props.name&&<input type="hidden" name={props.name} value={selected}/>}
  {open&&<PayrepPickerDialog title={heading} onClose={()=>setOpen(false)} className="payrep-select-modal"
   description={required?'Selecione uma opção para continuar.':undefined}>
    {options.length>12&&<label className="payrep-select-search">
      <Search size={16} aria-hidden="true"/>
      <input type="search" placeholder="Buscar opção" aria-label="Buscar opção" value={query} onChange={e=>setQuery(e.target.value)} data-picker-focus/>
     </label>}
    <div className="payrep-select-options" role="listbox" aria-label={heading}>
     {visible.map((option,i)=><button type="button" key={option.value+':'+i}
      className={'payrep-select-option'+(option.value===selected?' is-selected':'')}
      disabled={option.disabled}
      aria-selected={option.value===selected} role="option"
      data-picker-focus={option.value===selected&&options.length<=12?'':undefined}
      onClick={()=>choose(option)}>
       <span>{option.label}</span>
       {option.value===selected&&<Check size={19} aria-hidden="true"/>}
      </button>)}
     {visible.length===0&&<p className="payrep-select-empty">Nenhuma opção encontrada.</p>}
     {!query&&options.length>100&&<p className="payrep-select-hint">Mostrando as primeiras 100 opções. Use a busca para encontrar outras.</p>}
    </div>
    <div className="payrep-picker-footer"><button type="button" className="secondary" onClick={()=>setOpen(false)}>Cancelar</button></div>
   </PayrepPickerDialog>}
 </>
}
