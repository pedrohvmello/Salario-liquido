type PepMascotVariant = 'help'|'header'|'avatar'|'thinking'
/**
 * Pep: approved accountant mascot. Motion is deliberately subtle and entirely
 * presentational; CSS disables it for prefers-reduced-motion users.
 */
export function PepMascot({variant='header',videoUrl}:{variant?:PepMascotVariant;videoUrl?:string|null}){
 const decorative=variant==='avatar'
 const videoPreview=Boolean(videoUrl&&(variant==='help'||variant==='header'))
 return <span className={`pep-mascot pep-mascot-${variant}`} aria-hidden={decorative?'true':undefined} style={videoPreview?{overflow:'hidden',background:'#fff'}:undefined}>
  {videoPreview?<video src={videoUrl||undefined} autoPlay loop muted playsInline preload="metadata" aria-label="Vídeo de apresentação do Pep" style={{display:'block',width:'100%',height:'100%',objectFit:'cover',objectPosition:'center',background:'#fff',transform:'scale(1.42)',transformOrigin:'center'}}/>:
  <img
   src="/brand/pep-mascot.avif"
   alt={decorative?'':'Pep, mascote do Payrep'}
   width={144}
   height={144}
   loading={variant==='help'?'lazy':'eager'}
   decoding="async"
  />}
 </span>
}
