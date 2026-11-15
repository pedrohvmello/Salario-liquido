/* Maintain the Payrep control visual contract in future frontend changes.
 * This scans shipped React source, not tests; dates/times/selects must use the
 * existing PayrepPicker components, and confirmations must use app dialogs.
 */
const fs=require('node:fs')
const path=require('node:path')
const root=path.join(__dirname,'..','src')
const errors=[]
function files(dir){
 for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  const abs=path.join(dir,entry.name)
  if(entry.isDirectory()){files(abs);continue}
  if(!/\.tsx$/.test(entry.name)||/\.test\.tsx$/.test(entry.name))continue
  const source=fs.readFileSync(abs,'utf8')
  const rel=path.relative(path.join(__dirname,'..'),abs)
  const patterns=[
   ['browser-native confirmation',/\b(?:window|globalThis)\.(?:confirm|alert|prompt)\s*\(/g],
   ['native select box',/<select\b/g],
   ['native date/time input',/type\s*=\s*["'](?:date|time|month|datetime-local)["']/g]
  ]
  if(!/\b(?:const|let|function)\s+confirm\b/.test(source)){
   patterns.push(['unscoped browser confirmation',/(?<![\w.])confirm\s*\(/g])
  }
  for(const [label,rx] of patterns){
   for(const m of source.matchAll(rx)){
    const line=source.slice(0,m.index).split('\n').length
    errors.push(rel+':'+line+' '+label)
   }
  }
 }
}
files(root)
if(errors.length){
 console.error('Payrep UI contract violations:\n'+errors.join('\n'))
 process.exitCode=1
}else{
 console.log('Payrep UI contract passed: no native select/date/time or blocking browser dialogs.')
}
