import {useEffect,useRef,useState,type PointerEvent as ReactPointerEvent,type WheelEvent as ReactWheelEvent} from 'react'
import {Camera,Check,Move,RotateCcw,X,ZoomIn,ZoomOut} from 'lucide-react'
import {cropOffsetClamp,cropScale,type Offset} from '../lib/avatarCrop'

const PREVIEW=268,OUTPUT=512
export function PhotoCropDialog({file,onCancel,onConfirm}:{file:File;onCancel:()=>void;onConfirm:(blob:Blob)=>Promise<void>}){
 const [src,setSrc]=useState('')
 const [dimension,setDimension]=useState<{width:number;height:number}|null>(null)
 const [zoom,setZoom]=useState(1)
 const [offset,setOffset]=useState<Offset>({x:0,y:0})
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const imageRef=useRef<HTMLImageElement>(null)
 const dragRef=useRef<{x:number;y:number}|null>(null)
 const sliderRef=useRef<HTMLInputElement>(null)
 useEffect(()=>{
  const next=URL.createObjectURL(file)
  setSrc(next);setDimension(null);setOffset({x:0,y:0});setZoom(1)
  return ()=>URL.revokeObjectURL(next)
 },[file])
 useEffect(()=>{
  const closeEscape=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!busy)onCancel()}
  document.addEventListener('keydown',closeEscape)
  return ()=>document.removeEventListener('keydown',closeEscape)
 },[onCancel,busy])
 const scale=dimension?cropScale(PREVIEW,dimension.width,dimension.height,zoom):1
 const drawnWidth=dimension?dimension.width*scale:PREVIEW
 const drawnHeight=dimension?dimension.height*scale:PREVIEW
 const move=(next:Offset)=>setOffset(cropOffsetClamp(next,PREVIEW,drawnWidth,drawnHeight))
 const setMagnification=(v:number)=>{
  const z=Math.max(1,Math.min(3,v))
  setZoom(z)
  if(dimension){
   const factor=cropScale(PREVIEW,dimension.width,dimension.height,z)
   setOffset(old=>cropOffsetClamp(old,PREVIEW,dimension.width*factor,dimension.height*factor))
  }
 }
 const pointerDown=(e:ReactPointerEvent<HTMLDivElement>)=>{
  if(busy)return
  dragRef.current={x:e.clientX,y:e.clientY}
  e.currentTarget.setPointerCapture(e.pointerId)
 }
 const pointerMove=(e:ReactPointerEvent<HTMLDivElement>)=>{
  if(!dragRef.current||busy)return
  const dx=e.clientX-dragRef.current.x,dy=e.clientY-dragRef.current.y
  dragRef.current={x:e.clientX,y:e.clientY}
  setOffset(old=>cropOffsetClamp({x:old.x+dx,y:old.y+dy},PREVIEW,drawnWidth,drawnHeight))
 }
 const pointerUp=()=>{dragRef.current=null}
 const wheel=(e:ReactWheelEvent<HTMLDivElement>)=>{
  e.preventDefault()
  setMagnification(zoom+(e.deltaY>0?-0.08:0.08))
 }
 const confirm=async()=>{
  const img=imageRef.current
  if(!img||!dimension||busy)return
  setBusy(true);setError('')
  try{
   const canvas=document.createElement('canvas')
   canvas.width=OUTPUT;canvas.height=OUTPUT
   const ctx=canvas.getContext('2d')
   if(!ctx)throw Error('O navegador não permite recortar esta imagem.')
   ctx.clearRect(0,0,OUTPUT,OUTPUT)
   ctx.beginPath();ctx.arc(OUTPUT/2,OUTPUT/2,OUTPUT/2,0,2*Math.PI);ctx.clip()
   const outputRatio=OUTPUT/PREVIEW
   ctx.drawImage(img,(PREVIEW/2-drawnWidth/2+offset.x)*outputRatio,
    (PREVIEW/2-drawnHeight/2+offset.y)*outputRatio,drawnWidth*outputRatio,drawnHeight*outputRatio)
   const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Não foi possível exportar a foto.')),'image/webp',0.82))
   if(blob.size>1024*1024)throw Error('A foto excede o limite de armazenamento de 1 MB.')
   await onConfirm(blob)
  }catch(e){setError(e instanceof Error?e.message:'Falha ao salvar a foto.')}
  finally{setBusy(false)}
 }
 return <div className="avatar-crop-backdrop" onPointerDown={e=>e.stopPropagation()}>
  <section className="avatar-crop-dialog" role="dialog" aria-modal="true" aria-label="Ajustar foto de perfil">
   <header className="avatar-crop-heading"><div><strong><Camera size={19}/> Ajustar foto</strong><p>Arraste para reposicionar e use o zoom antes de confirmar.</p></div><button disabled={busy} type="button" className="profile-icon-button" onClick={onCancel} aria-label="Cancelar edição"><X size={20}/></button></header>
   <div className="avatar-crop-center">
    <div className="avatar-crop-stage" onWheel={wheel}
     onPointerDown={pointerDown} onPointerMove={pointerMove}
     onPointerUp={pointerUp} onPointerCancel={pointerUp}
     onKeyDown={e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();move({x:offset.x+(e.key==='ArrowLeft'?-5:e.key==='ArrowRight'?5:0),y:offset.y+(e.key==='ArrowUp'?-5:e.key==='ArrowDown'?5:0)})}}}
     tabIndex={0} aria-label="Recorte circular. Arraste ou use as setas para reposicionar."
    ><div className="avatar-crop-circle">
      {src&&<img ref={imageRef} src={src} draggable={false} alt="Prévia da foto selecionada" onLoad={e=>setDimension({width:e.currentTarget.naturalWidth,height:e.currentTarget.naturalHeight})}
       style={{width:drawnWidth,height:drawnHeight,transform:`translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px)`}}/>}
     </div><Move className="avatar-crop-move-icon" size={19}/></div>
    <p className="avatar-crop-instruction">Arraste a imagem ou use as setas para ajustar o enquadramento.</p>
   </div>
   <div className="avatar-crop-zoom"><ZoomOut size={19}/><input ref={sliderRef} type="range" min={1} max={3} step={0.01} value={zoom} onChange={e=>setMagnification(Number(e.target.value))} aria-label="Zoom da foto"/><ZoomIn size={19}/><button type="button" className="profile-icon-button" title="Restaurar posição" onClick={()=>{setZoom(1);setOffset({x:0,y:0})}}><RotateCcw size={18}/></button></div>
   {error&&<p className="profile-feedback danger" role="alert">{error}</p>}
   <footer className="avatar-crop-footer"><button disabled={busy} type="button" className="secondary" onClick={onCancel}>Cancelar</button><button disabled={busy||!dimension} type="button" className="primary" onClick={()=>void confirm()}><Check size={17}/>{busy?'Salvando...':'Confirmar foto'}</button></footer>
  </section>
 </div>
}
