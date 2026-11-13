type PepMascotVariant = 'help'|'header'|'avatar'|'thinking'
/**
 * Pep: approved accountant mascot. Motion is deliberately subtle and entirely
 * presentational; CSS disables it for prefers-reduced-motion users.
 */
export function PepMascot({variant='header'}:{variant?:PepMascotVariant}){
 const decorative=variant==='avatar'
 return <span className={`pep-mascot pep-mascot-${variant}`} aria-hidden={decorative?'true':undefined}>
  <img
   src="/brand/pep-mascot.avif"
   alt={decorative?'':'Pep, mascote do Payrep'}
   width={144}
   height={144}
   loading={variant==='help'?'lazy':'eager'}
   decoding="async"
  />
 </span>
}
