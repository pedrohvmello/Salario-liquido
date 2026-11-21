import {useEffect,useState} from 'react'

/**
 * Native VP9/WebM with real alpha, not the legacy pixel-keying canvas.
 * The static Pep image remains visible until actual video playback starts.
 */
export function PepBannerAnimation(){
 const [playing,setPlaying]=useState(false)
 const [failed,setFailed]=useState(false)
 const [reducedMotion,setReducedMotion]=useState(
  ()=>typeof window!=='undefined'&&Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
 )
 useEffect(()=>{
  const media=window.matchMedia?.('(prefers-reduced-motion: reduce)')
  if(!media)return
  const update=()=>{setReducedMotion(media.matches);setPlaying(false)}
  media.addEventListener('change',update)
  return ()=>media.removeEventListener('change',update)
 },[])
 const renderVideo=!reducedMotion&&!failed
 return <span className="pep-banner-animation">
  <img className={'pep-banner-animation-still'+(renderVideo&&playing?' is-video-playing':'')}
   src="/brand/pep-mascot.avif" alt="Pep, mascote do Payrep"
   width={166} height={174} loading="eager" decoding="async"/>
  {renderVideo&&<video
   className={'pep-banner-animation-video'+(playing?' is-playing':'')}
   src="/media/pep-banner-v2-transparente.webm" autoPlay loop muted playsInline
   preload="auto" disablePictureInPicture disableRemotePlayback
   aria-hidden="true" tabIndex={-1}
   onPlaying={()=>setPlaying(true)} onPause={()=>setPlaying(false)}
   onError={()=>{setFailed(true);setPlaying(false)}}/>}
 </span>
}
