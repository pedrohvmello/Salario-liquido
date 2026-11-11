import {useEffect,useRef,useState,type PointerEvent as ReactPointerEvent,type KeyboardEvent as ReactKeyboardEvent} from 'react'
import {Check,Grip,RotateCcw,X} from 'lucide-react'
import {normalizeOverviewCards,reorderOverviewCardTo,type OverviewCardId} from '../lib/overview'

type CardDetails=Record<OverviewCardId,{value:string;note:string}>
type Props={
 cards:OverviewCardId[]
 details:CardDetails
 labels:Record<OverviewCardId,string>
 onCommit:(cards:OverviewCardId[])=>Promise<void>
 onSaved?:()=>void
}
const ACTIVATION_MS=1000
const DRAG_MS=280
const MOVE_TOLERANCE=12

export function OverviewCardsEditor({cards,details,labels,onCommit,onSaved}:Props){
 const [editing,setEditing]=useState(false)
 const [draft,setDraft]=useState<OverviewCardId[]>(cards)
 const [dragging,setDragging]=useState<OverviewCardId|null>(null)
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const root=useRef<HTMLDivElement>(null)
 const holdTimer=useRef<ReturnType<typeof setTimeout>|null>(null)
 const pointer=useRef<{id:number;x:number;y:number;card:OverviewCardId}|null>(null)
 const draftRef=useRef<OverviewCardId[]>(cards)
 const editingRef=useRef(false)
 const dragRef=useRef<OverviewCardId|null>(null)
 const busyRef=useRef(false)
 const finishRef=useRef<()=>void>(()=>{})
 const setCards=(next:OverviewCardId[])=>{draftRef.current=next;setDraft(next)}
 const setEditor=(next:boolean)=>{editingRef.current=next;setEditing(next)}
 const stopTimer=()=>{
  if(holdTimer.current!==null){clearTimeout(holdTimer.current);holdTimer.current=null}
 }
 const endDrag=()=>{
  stopTimer()
  pointer.current=null
  dragRef.current=null
  setDragging(null)
 }
 const finish=()=>{
  if(!editingRef.current||busyRef.current)return
  endDrag()
  setEditor(false)
  const next=normalizeOverviewCards(draftRef.current)
  if(JSON.stringify(next)===JSON.stringify(cards))return
  busyRef.current=true;setBusy(true);setError('')
  void onCommit(next).then(()=>{onSaved?.()}).catch(e=>{
   setCards(cards)
   setError('Não foi possível salvar a ordem dos cartões: '+(e instanceof Error?e.message:'erro inesperado'))
   setEditor(true)
  }).finally(()=>{busyRef.current=false;setBusy(false)})
 }
 finishRef.current=finish
 useEffect(()=>{if(!editingRef.current){draftRef.current=cards;setDraft(cards)}},[cards])
 useEffect(()=>{
  if(!editing)return
  const outside=(event:PointerEvent)=>{
   if(root.current&&!root.current.contains(event.target as Node))finishRef.current()
  }
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')finishRef.current()}
  document.addEventListener('pointerdown',outside,true)
  document.addEventListener('keydown',escape)
  return ()=>{document.removeEventListener('pointerdown',outside,true);document.removeEventListener('keydown',escape)}
 },[editing])
 useEffect(()=>()=>{stopTimer()},[])
 const cardDown=(event:ReactPointerEvent<HTMLDivElement>,id:OverviewCardId)=>{
  if(busyRef.current||event.button!==0)return
  if(event.target instanceof Element&&event.target.closest('button'))return
  stopTimer()
  pointer.current={id:event.pointerId,x:event.clientX,y:event.clientY,card:id}
  if(editingRef.current){
   holdTimer.current=setTimeout(()=>{
    if(pointer.current?.id!==event.pointerId)return
    dragRef.current=id;setDragging(id)
    // Capture only after dragging starts, allowing the first short tap to remain inert.
    try{event.currentTarget.setPointerCapture(event.pointerId)}catch{}
   },DRAG_MS)
  }else{
   holdTimer.current=setTimeout(()=>{
    if(pointer.current?.id!==event.pointerId)return
    setCards([...cards])
    setEditor(true)
   },ACTIVATION_MS)
  }
 }
 const cardMove=(event:ReactPointerEvent<HTMLDivElement>)=>{
  if(pointer.current?.id!==event.pointerId)return
  if(!dragRef.current){
   if(Math.hypot(event.clientX-pointer.current.x,event.clientY-pointer.current.y)>MOVE_TOLERANCE){
    stopTimer()
   }
   return
  }
  event.preventDefault()
  const found=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-overview-card]')
  const id=found?.getAttribute('data-overview-card') as OverviewCardId|null
  if(!id||!draftRef.current.includes(id)||id===dragRef.current)return
  const target=draftRef.current.indexOf(id)
  setCards(reorderOverviewCardTo(draftRef.current,dragRef.current,target))
 }
 const cardUp=(event:ReactPointerEvent<HTMLDivElement>)=>{
  if(pointer.current?.id===event.pointerId)endDrag()
  if(event.currentTarget.hasPointerCapture?.(event.pointerId)){try{event.currentTarget.releasePointerCapture(event.pointerId)}catch{}}
 }
 const cardKey=(event:ReactKeyboardEvent<HTMLDivElement>,id:OverviewCardId)=>{
  if(event.key==='Enter'&&!editingRef.current){event.preventDefault();setCards([...cards]);setEditor(true)}
  if(!editingRef.current)return
  if(event.key==='Delete'||event.key==='Backspace'){event.preventDefault();setCards(draftRef.current.filter(x=>x!==id))}
  const arrow:{[key:string]:number}={ArrowLeft:-1,ArrowUp:-1,ArrowRight:1,ArrowDown:1}
  if(arrow[event.key]){event.preventDefault();const index=draftRef.current.indexOf(id);const target=index+arrow[event.key];setCards(reorderOverviewCardTo(draftRef.current,id,target))}
 }
 const list=editing?draft:cards
 return <div className={'overview-editor'+(editing?' is-editing':'')} ref={root}>
  {editing&&<div className="overview-edit-toolbar" aria-live="polite">
   <span><Grip size={16}/> Arraste um cartão após segurar. Toque no X para ocultar.</span>
   <button type="button" className="overview-edit-done" disabled={busy} onClick={finish}><Check size={16}/> Concluir</button>
  </div>}
  {error&&<div className="overview-edit-error" role="alert">{error}<button type="button" onClick={()=>setError('')} aria-label="Dispensar aviso"><X size={15}/></button></div>}
  <div className="stats-grid overview-stats" aria-label="Cartões de visão geral">
   {list.map(id=><div key={id}
    className={'stat overview-card'+(editing?' overview-card-editing':'')+(dragging===id?' overview-card-dragging':'')}
    data-overview-card={id}
    tabIndex={0}
    role="button"
    aria-label={editing?'Reordenar '+labels[id]+'. Segure e arraste, use as setas, ou exclua com Delete.':'Cartão '+labels[id]+'. Segure por um segundo para editar.'}
    onPointerDown={e=>cardDown(e,id)}
    onPointerMove={cardMove}
    onPointerUp={cardUp}
    onPointerCancel={cardUp}
    onKeyDown={e=>cardKey(e,id)}
   >
    {editing&&<button type="button" className="overview-remove-card" aria-label={'Ocultar cartão '+labels[id]} onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();endDrag();setCards(draftRef.current.filter(x=>x!==id))}}><X size={15}/></button>}
    <span className="subtle">{labels[id]}</span>
    <strong>{details[id].value}</strong>
    {details[id].note&&<small>{details[id].note}</small>}
   </div>)}
  </div>
  {editing&&<div className="overview-edit-hint"><RotateCcw size={14}/> Os cartões ocultos podem ser restaurados em Configurações. Toque fora ou em Concluir para salvar.</div>}
  {busy&&<div className="overview-edit-hint" role="status">Salvando disposição...</div>}
  {!editing&&list.length>0&&<span className="sr-only">Pressione e segure um cartão por um segundo para reorganizar ou ocultar.</span>}
 </div>
}
