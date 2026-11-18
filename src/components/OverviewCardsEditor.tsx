import {useEffect,useLayoutEffect,useRef,useState,type PointerEvent as ReactPointerEvent,type KeyboardEvent as ReactKeyboardEvent,type ReactNode} from 'react'
import {Check,Grip,Palette,RotateCcw,X} from 'lucide-react'
import {normalizeOverviewCards,normalizeOverviewCardColors,reorderOverviewCardTo,isOverviewWideSection,setOverviewCardColor,overviewCardPalette,type OverviewCardId,type OverviewCardColor,type OverviewCardColors} from '../lib/overview'

type CardDetails=Record<OverviewCardId,{value:string;note:string}>
type DragGhost={id:OverviewCardId;left:number;top:number;width:number;height:number}
type Props={
 cards:OverviewCardId[]
 colors:OverviewCardColors
 details:CardDetails
 labels:Record<OverviewCardId,string>
 sections?:Partial<Record<OverviewCardId,ReactNode>>
 onCommit:(cards:OverviewCardId[],colors:OverviewCardColors)=>Promise<void>
 onSaved?:()=>void
}
const ACTIVATION_MS=1000
const DRAG_MS=280
const MOVE_TOLERANCE=12

export function OverviewCardsEditor({cards,colors,details,labels,sections,onCommit,onSaved}:Props){
 const [editing,setEditing]=useState(false)
 const [draft,setDraft]=useState<OverviewCardId[]>(cards)
 const [draftColors,setDraftColors]=useState<OverviewCardColors>(()=>normalizeOverviewCardColors(colors))
 const [openPalette,setOpenPalette]=useState<OverviewCardId|null>(null)
 const [dragging,setDragging]=useState<OverviewCardId|null>(null)
 const [ghost,setGhost]=useState<DragGhost|null>(null)
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const root=useRef<HTMLDivElement>(null)
 const ghostRef=useRef<HTMLDivElement>(null)
 const previousRects=useRef<Map<OverviewCardId,DOMRect>|null>(null)
 const positionAnimations=useRef<Map<OverviewCardId,Animation>>(new Map())
 const holdTimer=useRef<ReturnType<typeof setTimeout>|null>(null)
 const pointer=useRef<{id:number;x:number;y:number;card:OverviewCardId}|null>(null)
 const draftRef=useRef<OverviewCardId[]>(cards)
 const colorRef=useRef<OverviewCardColors>(normalizeOverviewCardColors(colors))
 const editingRef=useRef(false)
 const dragRef=useRef<OverviewCardId|null>(null)
 const busyRef=useRef(false)
 const finishRef=useRef<()=>void>(()=>{})
 const chooseColor=(id:OverviewCardId,color:OverviewCardColor)=>{
  const next=setOverviewCardColor(colorRef.current,id,color)
  colorRef.current=next
  setDraftColors(next)
  setOpenPalette(null)
 }
 const setCards=(next:OverviewCardId[])=>{
  if(editingRef.current&&root.current){
   const rects=new Map<OverviewCardId,DOMRect>()
   root.current.querySelectorAll<HTMLElement>('[data-overview-card]').forEach(element=>{
    const id=element.dataset.overviewCard as OverviewCardId
    rects.set(id,element.getBoundingClientRect())
   })
   previousRects.current=rects
  }
  draftRef.current=next
  setDraft(next)
 }
 // FLIP animation: capture old positions before reordering, then animate cards
 // from their visual locations to the new grid cells (including row changes).
 useLayoutEffect(()=>{
  const before=previousRects.current
  previousRects.current=null
  if(!before)return
  for(const active of positionAnimations.current.values())active.cancel()
  positionAnimations.current.clear()
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return
  root.current?.querySelectorAll<HTMLElement>('[data-overview-card]').forEach(element=>{
   const id=element.dataset.overviewCard as OverviewCardId
   if(id===dragRef.current)return
   const old=before.get(id)
   if(!old)return
   const current=element.getBoundingClientRect()
   const dx=old.left-current.left,dy=old.top-current.top
   if(Math.abs(dx)<1&&Math.abs(dy)<1)return
   const animation=element.animate([
    {translate:`${dx}px ${dy}px`},
    {translate:'0px 0px'}
   ],{duration:280,easing:'cubic-bezier(.2,.8,.2,1)'})
   positionAnimations.current.set(id,animation)
   animation.onfinish=()=>{if(positionAnimations.current.get(id)===animation)positionAnimations.current.delete(id)}
  })
 },[draft])
 const setEditor=(next:boolean)=>{editingRef.current=next;setEditing(next)}
 const stopTimer=()=>{
  if(holdTimer.current!==null){clearTimeout(holdTimer.current);holdTimer.current=null}
 }
 const endDrag=()=>{
  stopTimer()
  pointer.current=null
  dragRef.current=null
  setDragging(null)
  setGhost(null)
 }
 const finish=()=>{
  if(!editingRef.current||busyRef.current)return
  endDrag()
  setEditor(false)
  setOpenPalette(null)
  const next=normalizeOverviewCards(draftRef.current)
  const chosen=normalizeOverviewCardColors(colorRef.current)
  if(JSON.stringify(next)===JSON.stringify(cards)&&
   JSON.stringify(chosen)===JSON.stringify(normalizeOverviewCardColors(colors)))return
  busyRef.current=true;setBusy(true);setError('')
  void onCommit(next,chosen).then(()=>{onSaved?.()}).catch(e=>{
   setCards(cards)
   colorRef.current=normalizeOverviewCardColors(colors)
   setDraftColors(colorRef.current)
   setError('Não foi possível salvar a ordem dos cartões: '+(e instanceof Error?e.message:'erro inesperado'))
   setEditor(true)
  }).finally(()=>{busyRef.current=false;setBusy(false)})
 }
 finishRef.current=finish
 useEffect(()=>{if(!editingRef.current){draftRef.current=cards;setDraft(cards)}},[cards])
 useEffect(()=>{if(!editingRef.current){
  colorRef.current=normalizeOverviewCardColors(colors)
  setDraftColors(colorRef.current)
 }},[colors])
 useEffect(()=>{
  if(!editing)return
  const outside=(event:PointerEvent)=>{
   const target=event.target
   if(!(target instanceof Element))return
   const card=target.closest('[data-overview-card]')
   const done=target.closest('.overview-edit-done')
   // A tap in the empty grid space, toolbar, or page exits edit mode.
   if(!card&&!done)finishRef.current()
  }
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')finishRef.current()}
  document.addEventListener('pointerdown',outside,true)
  document.addEventListener('keydown',escape)
  return ()=>{document.removeEventListener('pointerdown',outside,true);document.removeEventListener('keydown',escape)}
 },[editing])
 useEffect(()=>()=>{stopTimer();for(const animation of positionAnimations.current.values())animation.cancel()},[])
 const cardDown=(event:ReactPointerEvent<HTMLDivElement>,id:OverviewCardId)=>{
  if(busyRef.current||event.button!==0)return
  if(event.target instanceof Element&&event.target.closest('button'))return
  stopTimer()
  pointer.current={id:event.pointerId,x:event.clientX,y:event.clientY,card:id}
  const cardElement=event.currentTarget
  if(editingRef.current){
   holdTimer.current=setTimeout(()=>{
    if(pointer.current?.id!==event.pointerId)return
    dragRef.current=id;setDragging(id)
    const rect=cardElement.getBoundingClientRect()
    setGhost({id,left:rect.left,top:rect.top,width:rect.width,height:rect.height})
    // Capture only after dragging starts, allowing the first short tap to remain inert.
    try{cardElement.setPointerCapture(event.pointerId)}catch{}
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
  const dx=event.clientX-pointer.current.x,dy=event.clientY-pointer.current.y
  if(ghostRef.current)ghostRef.current.style.translate=`${dx}px ${dy}px`
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
  if(event.target!==event.currentTarget)return
  if(event.key==='Enter'&&!editingRef.current){event.preventDefault();setCards([...cards]);setEditor(true)}
  if(!editingRef.current)return
  if((event.key==='Delete'||event.key==='Backspace')&&!isOverviewWideSection(id)){event.preventDefault();setCards(draftRef.current.filter(x=>x!==id))}
  const arrow:{[key:string]:number}={ArrowLeft:-1,ArrowUp:-1,ArrowRight:1,ArrowDown:1}
  if(arrow[event.key]){event.preventDefault();const index=draftRef.current.indexOf(id);const target=index+arrow[event.key];setCards(reorderOverviewCardTo(draftRef.current,id,target))}
 }
 const list=editing?draft:cards
 return <div className={'overview-editor'+(editing?' is-editing':'')} ref={root}>
  {editing&&<div className="overview-edit-toolbar" aria-live="polite">
   <span><Grip size={16}/> Segure para arrastar. Use a paleta para escolher a cor ou X para ocultar.</span>
   <button type="button" className="overview-edit-done" disabled={busy} onClick={finish}><Check size={16}/> Concluir</button>
  </div>}
  {error&&<div className="overview-edit-error" role="alert">{error}<button type="button" onClick={()=>setError('')} aria-label="Dispensar aviso"><X size={15}/></button></div>}
  <div className="stats-grid overview-stats" aria-label="Cartões de visão geral">
   {list.map(id=><div key={id}
    className={(isOverviewWideSection(id)?'overview-wide-card ':'stat ')+'overview-card'+(editing?' overview-card-editing':'')+(dragging===id?' overview-card-dragging':'')}
    data-overview-card={id}
    data-overview-color={editing?(draftColors[id]||'default'):(colors[id]||'default')}
    tabIndex={0}
    role="button"
    aria-label={editing?'Reordenar '+labels[id]+'. Segure e arraste, use as setas, ou exclua com Delete.':'Cartão '+labels[id]+'. Segure por um segundo para editar.'}
    onPointerDown={e=>cardDown(e,id)}
    onPointerMove={cardMove}
    onPointerUp={cardUp}
    onPointerCancel={cardUp}
    onContextMenu={e=>e.preventDefault()}
    onKeyDown={e=>cardKey(e,id)}
   >
    {editing&&<div className="overview-card-actions" onPointerDown={e=>e.stopPropagation()}>
     <button type="button" className="overview-color-button" aria-label={'Escolher cor de '+labels[id]}
      aria-expanded={openPalette===id} aria-haspopup="true"
      onClick={e=>{e.stopPropagation();setOpenPalette(x=>x===id?null:id)}}>
      <Palette size={15}/>
     </button>
     {!isOverviewWideSection(id)&&<button type="button" className="overview-remove-card"
      aria-label={'Ocultar cartão '+labels[id]}
      onClick={e=>{e.stopPropagation();endDrag();setOpenPalette(null);setCards(draftRef.current.filter(x=>x!==id))}}>
      <X size={15}/>
     </button>}
    </div>}
    {editing&&openPalette===id&&<div className="overview-card-palette"
     role="group" aria-label={'Cores para '+labels[id]} onPointerDown={e=>e.stopPropagation()}
     onClick={e=>e.stopPropagation()}>
     <span className="overview-card-palette-title">Cor do card</span>
     <div className="overview-card-swatches">
      {overviewCardPalette.map(option=><button type="button" key={option.id}
       className={'overview-card-swatch'+((draftColors[id]||'default')===option.id?' selected':'')}
       data-palette-color={option.id}
       aria-label={option.label} aria-pressed={(draftColors[id]||'default')===option.id}
       title={option.label} onClick={()=>chooseColor(id,option.id)}>
       {(draftColors[id]||'default')===option.id&&<Check size={13}/>}
      </button>)}
     </div>
    </div>}
    {isOverviewWideSection(id)&&sections?.[id]?sections[id]:<>
     <span className="subtle">{labels[id]}</span>
     <strong>{details[id].value}</strong>
     {details[id].note&&<small>{details[id].note}</small>}
    </>}
   </div>)}
  </div>
  {ghost&&<div className="stat overview-drag-ghost" ref={ghostRef} aria-hidden="true" data-overview-color={draftColors[ghost.id]||'default'} style={{left:ghost.left,top:ghost.top,width:ghost.width,height:ghost.height}}>
   <span className="subtle">{labels[ghost.id]}</span>
   {!isOverviewWideSection(ghost.id)&&<><strong>{details[ghost.id].value}</strong>{details[ghost.id].note&&<small>{details[ghost.id].note}</small>}</>}
  </div>}
  {editing&&<div className="overview-edit-hint"><RotateCcw size={14}/> Os cartões ocultos podem ser restaurados em Definições. Ordem e cores são salvas em Concluir.</div>}
  {busy&&<div className="overview-edit-hint" role="status">Salvando disposição...</div>}
 </div>
}
