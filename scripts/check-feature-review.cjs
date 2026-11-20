const {readFileSync}=require('node:fs')
const {execFileSync}=require('node:child_process')
const manifest=JSON.parse(readFileSync('docs/feature-review.json','utf8'))
const scopes=['src','supabase/functions','supabase/migrations']
if(manifest.version!==1||!manifest.review||!manifest.sourceTrees)throw Error('Revisão de funcionalidades ausente')
const mandatory=['sobre','privacidade','termos','faq','pepAjuda']
for(const area of mandatory){
 if(typeof manifest.review[area]!=='string'||manifest.review[area].trim().length<18)throw Error('Revisão incompleta: '+area)
}
for(const scope of scopes){
 const sha=execFileSync('git',['rev-parse','HEAD:'+scope],{encoding:'utf8'}).trim()
 if(manifest.sourceTrees[scope]!==sha){
  console.error('O código de '+scope+' mudou sem registrar revisão de Sobre, Privacidade, Termos, FAQ e Pep Ajuda.')
  console.error('Atualize docs/feature-review.json após verificar os cinco itens. Hash esperado: '+sha)
  process.exitCode=1
 }
}
if(!process.exitCode)console.log('Payrep: revisão dos cinco pontos documentada para o código publicado.')
