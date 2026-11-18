import {useEffect,useLayoutEffect,useRef,useState,type PointerEvent as ReactPointerEvent,type KeyboardEvent as ReactKeyboardEvent} from 'react'
import {Check,Grip,Palette,RotateCcw,X,type LucideIcon} from 'lucide-react'
import {db} from '../lib/data'
import {overviewCardPalette,type OverviewCardColor} from '../lib/overview'
import {
 adminKpiIds,normalizeAdminKpiOrder,normalizeAdminKpiColors,
 reorderAdminKpi,chooseAdminKpiColor,
 type AdminKpiId,type AdminKpiColors
} from '../lib/adminKpiLayout'

export type AdminKpiData={label:string;value:number|string;note:string;icon:LucideIcon}
type Props={cards:Record<AdminKpiId,AdminKpiData>}
type Ghost={id:AdminKpiId;left:number;top:number;width:number;height:number}
const ACTIVATION_MS=1000
const DRAG_MS=280
const TOLERANCE=12

export function AdminKpiCardsEditor({cards}:Props){
 const [order,setOrder]=useState<AdminKpiId[]>([...adminKpiIds])
 const [colors,setColors]=useState<AdminKpiColors>({})
 const [draft,setDraft]=useState<AdminKpiId[]>([...adminKpiIds])
 const [draftColors,setDraftColors]=useState<AdminKpiColors>({})
 const [editing,setEditing]=useState(false)
 const [openPalette,setOpenPalette]=useState<AdminKpiId|null>(null)
 const [dragging,setDragging]=useState<AdminKpiId|null>(null)
 const [ghost,setGhost]=useState<Ghost|null>(null)
 const [userId,setUserId]=useState('')
 const [loading,setLoading]=useState(true)
 const [saving,setSaving]=useState(false)
 const [error,setError]=useState('')
 const root=useRef<HTMLDivElement>(null)
 const ghostRef=useRef<HTMLDivElement>(null)
 const pointer=useRef<{pointerId:number;x:number;y:number;id:AdminKpiId}|null>(null)
 const timer=useRef<ReturnType<typeof setTimeout>|null>(null)
 const previousRects=useRef<Map<AdminKpiId,DOMRect>|null>(null)
 const animations=useRef<Animation[]>([])
 const orderRef=useRef<AdminKpiId[]>([...adminKpiIds])
 const colorsRef=useRef<AdminKpiColors>({})
 const draggingRef=useRef<AdminKpiId|null>(null)
 const editingRef=useRef(false)
 const savingRef=useRef(false)
 const finishRef=useRef<()=>void>(()=>{})
 useEffect(()=>{
  let active=true
  async function load(){
   if(!db)throw Error('Banco indisponível.')
   const {data:auth,error:authError}=await db.auth.getUser()
   if(authError||!auth.user)throw Error('Sessão administrativa não encontrada.')
   const {data,error:readError}=await db.from('admin_dashboard_preferences')
    .select('card_order,card_colors').eq('user_id',auth.user.id).maybeSingle()
   if(readError)throw Error(readError.message)
   if(!active)return
   const savedOrder=normalizeAdminKpiOrder(data?.card_order)
   const savedColors=normalizeAdminKpiColors(data?.card_colors)
   setUserId(auth.user.id)
   setOrder(savedOrder);setColors(savedColors)
   orderRef.current=savedOrder;colorsRef.current=savedColors
   setDraft(savedOrder);setDraftColors(savedColors)
  }
  void load().catch(e=>{if(active)setError('Não foi possível carregar a configuração dos cards: '+String(e))})
   .finally(()=>{if(active)setLoading(false)})
  return ()=>{active=false}
 },[])
 const setEdit=(next:boolean)=>{editingRef.current=next;setEditing(next)}
 const stopTimer=()=>{if(timer.current!==null){clearTimeout(timer.current);timer.current=null}}
 const endDrag=()=>{
  stopTimer();pointer.current=null;draggingRef.current=null
  setDragging(null);setGhost(null)
 }
 const setCards=(next:AdminKpiId[])=>{
  if(editingRef.current&&root.current){
   const rects=new Map<AdminKpiId,DOMRect>()
   root.current.querySelectorAll<HTMLElement>('[data-admin-kpi]').forEach(element=>{
    const id=element.dataset.adminKpi as AdminKpiId
    rects.set(id,element.getBoundingClientRect())
   })
   previousRects.current=rects
  }
  orderRef.current=next
  setDraft(next)
 }
 useLayoutEffect(()=>{
  const prev=previousRects.current
  previousRects.current=null
  if(!prev)return
  for(const animation of animations.current)animation.cancel()
  animations.current=[]
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return
  root.current?.querySelectorAll<HTMLElement>('[data-admin-kpi]').forEach(el=>{
   const id=el.dataset.adminKpi as AdminKpiId
   if(id===draggingRef.current)return
   const before=prev.get(id)
   if(!before)return
   const after=el.getBoundingClientRect()
   const dx=before.left-after.left,dy=before.top-after.top
   if(Math.abs(dx)<1&&Math.abs(dy)<1)return
   animations.current.push(el.animate([{translate:dx+'px '+dy+'px'},{translate:'0px 0px'}],{
    duration:280,easing:'cubic-bezier(.2,.8,.2,1)'
   }))
  })
 },[draft])
 useEffect(()=>()=>{stopTimer();for(const a of animations.current)a.cancel()},[])
 const choose=(id:AdminKpiId,color:OverviewCardColor)=>{
  const next=chooseAdminKpiColor(colorsRef.current,id,color)
  colorsRef.current=next;setDraftColors(next);setOpenPalette(null)
 }
 const finish=()=>{
  if(!editingRef.current||savingRef.current)return
  endDrag();setOpenPalette(null);setEdit(false)
  const next=normalizeAdminKpiOrder(orderRef.current)
  const nextColors=normalizeAdminKpiColors(colorsRef.current)
  if(JSON.stringify(next)===JSON.stringify(order)&&
   JSON.stringify(nextColors)===JSON.stringify(colors))return
  if(!db||!userId){setError('Não foi possível identificar o administrador.');setEdit(true);return}
  savingRef.current=true;setSaving(true);setError('')
  void db.from('admin_dashboard_preferences').upsert({
   user_id:userId,card_order:next,card_colors:nextColors,updated_at:new Date().toISOString()
  },{onConflict:'user_id'}).then(({error:saveError})=>{
   if(saveError)throw Error(saveError.message)
   setOrder(next);setColors(nextColors)
  }).catch(e=>{
   orderRef.current=next;colorsRef.current=nextColors
   setError('Não foi possível salvar os cards: '+(e instanceof Error?e.message:'erro inesperado'))
   setEdit(true)
  }).finally(()=>{savingRef.current=false;setSaving(false)})
 }
 finishRef.current=finish
 useEffect(()=>{
  if(!editing)return
  const outside=(event:PointerEvent)=>{
   const target=event.target
   if(!(target instanceof Element))return
   if(target.closest('[data-admin-kpi]')||target.closest('.admin-kpi-editor-toolbar'))return
   finishRef.current()
  }
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')finishRef.current()}
  document.addEventListener('pointerdown',outside,true)
  document.addEventListener('keydown',escape)
  return ()=>{document.removeEventListener('pointerdown',outside,true);document.removeEventListener('keydown',escape)}
 },[editing])
 const down=(event:ReactPointerEvent<HTMLDivElement>,id:AdminKpiId)=>{
  if(loading||savingRef.current||event.button!==0)return
  if(event.target instanceof Element&&event.target.closest('button'))return
  stopTimer()
  pointer.current={pointerId:event.pointerId,x:event.clientX,y:event.clientY,id}
  const element=event.currentTarget
  if(editingRef.current){
   timer.current=setTimeout(()=>{
    if(pointer.current?.pointerId!==event.pointerId)return
    draggingRef.current=id;setDragging(id)
    const r=element.getBoundingClientRect()
    setGhost({id,left:r.left,top:r.top,width:r.width,height:r.height})
    try{element.setPointerCapture(event.pointerId)}catch{}
   },DRAG_MS)
  }else{
   timer.current=setTimeout(()=>{
    if(pointer.current?.pointerId!==event.pointerId)return
    setCards([...orderRef.current])
    setEdit(true)
   },ACTIVATION_MS)
  }
 }
 const move=(event:ReactPointerEvent<HTMLDivElement>)=>{
  const p=pointer.current
  if(!p||p.pointerId!==event.pointerId)return
  if(!draggingRef.current){
   if(Math.hypot(event.clientX-p.x,event.clientY-p.y)>TOLERANCE)stopTimer()
   return
  }
  event.preventDefault()
  if(ghostRef.current)ghostRef.current.style.translate=(event.clientX-p.x)+'px '+(event.clientY-p.y)+'px'
  const target=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-admin-kpi]')
  const id=target?.getAttribute('data-admin-kpi') as AdminKpiId|null
  if(!id||id===draggingRef.current||!orderRef.current.includes(id))return
  setCards(reorderAdminKpi(orderRef.current,draggingRef.current,orderRef.current.indexOf(id)))
 }
 const up=(event:ReactPointerEvent<HTMLDivElement>)=>{
  if(pointer.current?.pointerId===event.pointerId)endDrag()
  if(event.currentTarget.hasPointerCapture?.(event.pointerId)){
   try{event.currentTarget.releasePointerCapture(event.pointerId)}catch{}
  }
 }
 const key=(event:ReactKeyboardEvent<HTMLDivElement>,id:AdminKpiId)=>{
  if(event.target!==event.currentTarget||loading)return
  if(event.key==='Enter'&&!editingRef.current){
   event.preventDefault();setCards([...orderRef.current]);setEdit(true);return
  }
  if(!editingRef.current)return
  if(event.key==='Delete'||event.key==='Backspace'){
   event.preventDefault();setCards(orderRef.current.filter(v=>v!==id));return
  }
  const directions:Record<string,number>={ArrowLeft:-1,ArrowUp:-1,ArrowRight:1,ArrowDown:1}
  if(directions[event.key]){
   event.preventDefault()
   setCards(reorderAdminKpi(orderRef.current,id,orderRef.current.indexOf(id)+directions[event.key]))
  }
 }
 const restore=()=>{
  const missing=adminKpiIds.filter(id=>!orderRef.current.includes(id))
  setCards([...orderRef.current,...missing])
 }
 const list=editing?draft:order
 const hiddenCount=adminKpiIds.length-draft.length
 return <div className={'overview-editor admin-kpi-editor'+(editing?' is-editing':'')} ref={root}>
  {editing&&<div className="overview-edit-toolbar admin-kpi-editor-toolbar">
   <span><Grip size={16}/> Segure e arraste para mover; paleta para colorir e X para ocultar.</span>
   <div className="admin-kpi-toolbar-actions">
    {hiddenCount>0&&<button type="button" className="secondary" onClick={restore}>
     <RotateCcw size={14}/> Restaurar {hiddenCount} card(s)
    </button>}
    <button type="button" className="overview-edit-done" disabled={saving} onClick={finish}>
     <Check size={16}/> Concluir
    </button>
   </div>
  </div>}
  {error&&<div className="overview-edit-error" role="alert">{error}
   <button type="button" aria-label="Fechar erro" onClick={()=>setError('')}><X size={15}/></button>
  </div>}
  {list.length===0&&<div className="panel admin-kpi-empty">
   Nenhum card visível.
   <button type="button" className="secondary" onClick={restore}>Restaurar todos os cards</button>
  </div>}
  <div className="admin-kpis" aria-label="Indicadores de Gestão de usuários">
   {list.map(id=>{
    const item=cards[id],Icon=item.icon
    return <div key={id} className={'stat overview-card'+(editing?' overview-card-editing':'')+(dragging===id?' overview-card-dragging':'')}
     data-admin-kpi={id}
     data-overview-color={editing?(draftColors[id]||'default'):(colors[id]||'default')}
     tabIndex={0} role="button"
     aria-label={editing?'Reordenar '+item.label+'. Segure e arraste, ou use setas.':'Card '+item.label+'. Segure para editar.'}
     onPointerDown={e=>down(e,id)} onPointerMove={move} onPointerUp={up}
     onPointerCancel={up} onContextMenu={e=>e.preventDefault()}
     onKeyDown={e=>key(e,id)}>
     {editing&&<div className="overview-card-actions" onPointerDown={e=>e.stopPropagation()}>
      <button type="button" className="overview-color-button"
       aria-label={'Escolher cor de '+item.label} aria-expanded={openPalette===id}
       onClick={e=>{e.stopPropagation();setOpenPalette(x=>x===id?null:id)}}>
       <Palette size={15}/>
      </button>
      <button type="button" className="overview-remove-card" aria-label={'Ocultar card '+item.label}
       onClick={e=>{e.stopPropagation();endDrag();setOpenPalette(null);setCards(orderRef.current.filter(x=>x!==id))}}>
       <X size={15}/>
      </button>
     </div>}
     {editing&&openPalette===id&&<div className="overview-card-palette" role="group"
      aria-label={'Cores para '+item.label} onPointerDown={e=>e.stopPropagation()}
      onClick={e=>e.stopPropagation()}>
      <span className="overview-card-palette-title">Cor do card</span>
      <div className="overview-card-swatches">
       {overviewCardPalette.map(option=><button type="button" key={option.id}
        className={'overview-card-swatch'+((draftColors[id]||'default')===option.id?' selected':'')}
        data-palette-color={option.id}
        aria-label={option.label} title={option.label}
        aria-pressed={(draftColors[id]||'default')===option.id}
        onClick={()=>choose(id,option.id)}>
        {(draftColors[id]||'default')===option.id&&<Check size={13}/>}
       </button>)}
      </div>
     </div>}
     <div className="admin-kpi-label"><Icon size={15}/><span>{item.label}</span></div>
     <strong>{item.value}</strong><small>{item.note}</small>
    </div>
   })}
  </div>
  {ghost&&<div className="stat overview-drag-ghost admin-kpi-ghost" ref={ghostRef} aria-hidden="true"
   data-overview-color={draftColors[ghost.id]||'default'}
   style={{left:ghost.left,top:ghost.top,width:ghost.width,height:ghost.height}}>
   <div className="admin-kpi-label"><Grip size={15}/><span>{cards[ghost.id].label}</span></div>
   <strong>{cards[ghost.id].value}</strong><small>{cards[ghost.id].note}</small>
  </div>}
  {editing&&<div className="overview-edit-hint">
   <RotateCcw size={14}/> Ordem, cores e visibilidade são salvas ao tocar em Concluir.
  </div>}
  {saving&&<div role="status" className="overview-edit-hint">Salvando disposição...</div>}
 </div>
}
