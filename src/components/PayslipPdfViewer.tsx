import {useEffect,useRef,useState} from 'react'
import {ChevronLeft,ChevronRight,Download,Minus,Plus} from 'lucide-react'
import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

// The PDF stays in memory and is rendered by PDF.js, rather than relying
// on the Android browser's unreliable embedded PDF/Blob iframe viewer.
pdfjs.GlobalWorkerOptions.workerSrc=workerUrl

export function PayslipPdfViewer({blob,initialPage,filename}:{blob:Blob;initialPage:number;filename:string}){
 const [pdf,setPdf]=useState<pdfjs.PDFDocumentProxy|null>(null)
 const [page,setPage]=useState(Math.max(1,initialPage))
 const [zoom,setZoom]=useState(1)
 const [width,setWidth]=useState(0)
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')
 const containerRef=useRef<HTMLDivElement|null>(null)
 const canvasRef=useRef<HTMLCanvasElement|null>(null)
 const pageCount=pdf?.numPages||0

 useEffect(()=>{
  let active=true
  setPdf(null);setPage(Math.max(1,initialPage));setZoom(1);setError('');setLoading(true)
  let task:ReturnType<typeof pdfjs.getDocument>|null=null
  const load=async()=>{
   try{
    const bytes=await blob.arrayBuffer()
    if(!active)return
    task=pdfjs.getDocument({data:new Uint8Array(bytes)})
    const doc=await task.promise
    if(!active){void doc.destroy();return}
    setPdf(doc)
    setPage(Math.min(doc.numPages,Math.max(1,initialPage)))
   }catch(err){
    if(active){setError('Não foi possível processar o PDF. Tente baixar o arquivo.');setLoading(false);console.error('PDF viewer:',err)}
   }
  }
  void load()
  return ()=>{
   active=false
   void task?.destroy()
  }
 },[blob,initialPage])

 useEffect(()=>{
  const target=containerRef.current
  if(!target)return
  const measure=()=>setWidth(Math.max(0,target.clientWidth-24))
  measure()
  const obs=new ResizeObserver(measure)
  obs.observe(target)
  return ()=>obs.disconnect()
 },[])

 useEffect(()=>{
  if(!pdf||!canvasRef.current||!width)return
  let cancelled=false
  let renderer:ReturnType<pdfjs.PDFPageProxy['render']>|null=null
  setLoading(true)
  setError('')
  const paint=async()=>{
   try{
    const pdfPage=await pdf.getPage(page)
    if(cancelled)return
    const base=pdfPage.getViewport({scale:1})
    // A single page at a time, fitted to its container, keeps mobile memory low.
    const fit=Math.min(2.5,width/base.width)
    const viewport=pdfPage.getViewport({scale:Math.max(.2,fit*zoom)})
    const canvas=canvasRef.current
    if(!canvas)return
    const ctx=canvas.getContext('2d',{alpha:false})
    if(!ctx)throw new Error('Canvas indisponível')
    const maxPixelCount=8_000_000
    const ratio=Math.max(1,Math.min(window.devicePixelRatio||1,2,Math.sqrt(maxPixelCount/(viewport.width*viewport.height))))
    canvas.width=Math.max(1,Math.floor(viewport.width*ratio))
    canvas.height=Math.max(1,Math.floor(viewport.height*ratio))
    canvas.style.width=Math.floor(viewport.width)+'px'
    canvas.style.height=Math.floor(viewport.height)+'px'
    renderer=pdfPage.render({canvasContext:ctx,viewport,transform:ratio===1?undefined:[ratio,0,0,ratio,0,0]})
    await renderer.promise
    if(!cancelled)setLoading(false)
   }catch(err){
    if(cancelled||((err as Error).name==='RenderingCancelledException'))return
    setLoading(false)
    setError('Não foi possível mostrar esta página. Tente baixar o PDF.')
    console.error('PDF render:',err)
   }
  }
  void paint()
  return ()=>{cancelled=true;renderer?.cancel()}
 },[pdf,page,zoom,width])

 const download=()=>{
  const url=URL.createObjectURL(blob)
  const a=document.createElement('a')
  a.href=url;a.download=filename
  document.body.append(a);a.click();a.remove()
  window.setTimeout(()=>URL.revokeObjectURL(url),10000)
 }
 return <div className="payslip-canvas-viewer">
  <div className="payslip-canvas-toolbar" aria-label="Controles do documento">
   <div className="payslip-canvas-pages">
    <button type="button" className="secondary" disabled={!pdf||page<=1} onClick={()=>setPage(v=>Math.max(1,v-1))} aria-label="Página anterior" title="Página anterior"><ChevronLeft size={18}/></button>
    <span aria-live="polite">Página {pageCount?page:'…'} de {pageCount||'…'}</span>
    <button type="button" className="secondary" disabled={!pdf||page>=pageCount} onClick={()=>setPage(v=>Math.min(pageCount,v+1))} aria-label="Próxima página" title="Próxima página"><ChevronRight size={18}/></button>
   </div>
   <div className="payslip-canvas-actions">
    <button type="button" className="secondary" disabled={!pdf||zoom<=.8} onClick={()=>setZoom(v=>Math.max(.8,Math.round((v-.25)*100)/100))} aria-label="Diminuir zoom" title="Diminuir zoom"><Minus size={17}/></button>
    <button type="button" className="secondary" disabled={!pdf||zoom>=2} onClick={()=>setZoom(v=>Math.min(2,Math.round((v+.25)*100)/100))} aria-label="Aumentar zoom" title="Aumentar zoom"><Plus size={17}/></button>
    <button type="button" className="secondary payslip-pdf-download" onClick={download} aria-label="Baixar PDF" title="Baixar PDF"><Download size={17}/><span>Baixar</span></button>
   </div>
  </div>
  <div className="payslip-canvas-scroll" ref={containerRef}>
   {error&&<div className="payslip-canvas-error" role="alert">{error}</div>}
   {loading&&!error&&<div className="payslip-canvas-loading" role="status">Carregando página...</div>}
   <canvas ref={canvasRef} className="payslip-canvas-page" aria-label={'Página '+page+' do documento'} style={{visibility:loading||!!error?'hidden':'visible'}}/>
  </div>
 </div>
}
