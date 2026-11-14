import {useEffect,useRef,useState} from 'react'

type PepMascotVariant = 'help'|'header'|'avatar'|'thinking'

/**
 * Replace only the edge-connected, nearly-white studio background.
 * This keeps white parts of Pep's outfit and face intact.
 */
function removeStudioBackground(frame:ImageData){
 const {data,width:w,height:h}=frame
 const seen=new Uint8Array(w*h)
 const queue=new Int32Array(w*h)
 let head=0,tail=0
 const enqueue=(pixel:number)=>{
  if(seen[pixel])return
  const i=pixel*4
  const r=data[i],g=data[i+1],b=data[i+2]
  const lo=Math.min(r,g,b),hi=Math.max(r,g,b)
  if(lo<220||hi-lo>40)return
  seen[pixel]=1
  queue[tail++]=pixel
 }
 for(let x=0;x<w;x++){enqueue(x);enqueue((h-1)*w+x)}
 for(let y=0;y<h;y++){enqueue(y*w);enqueue(y*w+w-1)}
 while(head<tail){
  const p=queue[head++],x=p%w
  if(x>0)enqueue(p-1)
  if(x<w-1)enqueue(p+1)
  if(p>=w)enqueue(p-w)
  if(p<(h-1)*w)enqueue(p+w)
 }
 for(let i=0;i<tail;i++)data[queue[i]*4+3]=0
 return frame
}

/**
 * Local-only HML test: uses the visitor's chosen MP4/WebM as a source
 * without uploading it. The character is composited onto the page.
 */
export function PepMascot({variant='header',videoUrl,videoLoading=false}:{variant?:PepMascotVariant;videoUrl?:string|null;videoLoading?:boolean}){
 const decorative=variant==='avatar'
 const videoRef=useRef<HTMLVideoElement|null>(null)
 const canvasRef=useRef<HTMLCanvasElement|null>(null)
 const [ready,setReady]=useState(false)
 const [failed,setFailed]=useState(false)
 const supportsVideo=variant==='help'||variant==='header'
 const videoPreview=Boolean(videoUrl&&supportsVideo&&!failed)
 // Do not show a differently scaled still image before the video's first frame.
 // The container already has fixed dimensions, so it stays stable during loading.
 const hideStill=supportsVideo&&(videoLoading||videoPreview)

 useEffect(()=>{
  setReady(false)
  setFailed(false)
  if(!videoUrl||(variant!=='help'&&variant!=='header'))return
  const video=videoRef.current,canvas=canvasRef.current
  if(!video||!canvas)return
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){
   video.pause()
   return
  }
  const ctx=canvas.getContext('2d',{willReadFrequently:true})
  if(!ctx)return
  const scale=Math.max(1.5,Math.min(2,window.devicePixelRatio||1.5))
  const w=Math.max(1,Math.round(canvas.clientWidth*scale))
  const h=Math.max(1,Math.round(canvas.clientHeight*scale))
  canvas.width=w
  canvas.height=h
  let raf=0,lastDraw=-Infinity,painted=false,stopped=false
  const draw=(now:number)=>{
   if(stopped)return
   if(now-lastDraw>=50&&!document.hidden&&video.readyState>=2&&video.videoWidth>0){
    lastDraw=now
    try{
     const cropWidth=Math.min(video.videoWidth,video.videoHeight*w/h)
     const cropX=(video.videoWidth-cropWidth)/2
     ctx.clearRect(0,0,w,h)
     ctx.drawImage(video,cropX,0,cropWidth,video.videoHeight,0,0,w,h)
     ctx.putImageData(removeStudioBackground(ctx.getImageData(0,0,w,h)),0,0)
     if(!painted){painted=true;setReady(true)}
    }catch{setFailed(true);stopped=true;return}
   }
   raf=requestAnimationFrame(draw)
  }
  raf=requestAnimationFrame(draw)
  void video.play().catch(()=>{})
  return ()=>{stopped=true;cancelAnimationFrame(raf);video.pause()}
 },[videoUrl,variant])

 return <span className={`pep-mascot pep-mascot-${variant}`} aria-hidden={decorative?'true':undefined} style={videoPreview?{overflow:'hidden'}:undefined}>
  <img
   src="/brand/pep-mascot.avif"
   alt={decorative?'':'Pep, mascote do Payrep'}
   width={144}
   height={144}
   loading={variant==='help'?'lazy':'eager'}
   decoding="async"
   style={hideStill?{visibility:'hidden'}:undefined}
  />
  {videoPreview&&<>
   <video crossOrigin="anonymous" ref={videoRef} src={videoUrl||undefined} autoPlay loop muted playsInline preload="auto" aria-hidden="true"
    onError={()=>setFailed(true)}
    style={{position:'absolute',width:1,height:1,opacity:0,pointerEvents:'none'}}/>
   <canvas ref={canvasRef} role="img" aria-label="Pep animado"
    style={{position:'absolute',inset:0,width:'100%',height:'100%',opacity:ready?1:0,transition:'opacity 150ms ease-out',pointerEvents:'none'}}/>
  </>}
 </span>
}
