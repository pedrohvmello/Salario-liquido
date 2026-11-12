import {readFileSync} from 'node:fs'
import {describe,expect,it} from 'vitest'

function page(name:string){return readFileSync('public/'+name+'.html','utf8')}

describe('Payrep public OAuth pages',()=>{
 it('reuses the existing horizontal Payrep logo across all public headers',()=>{
  for(const name of ['sobre','privacidade','termos']){
   const html=page(name)
   expect(html).toContain('src="/brand/payrep-logo.svg"')
   expect(html).not.toContain('<span>Payrep</span>')
  }
  const logo=readFileSync('public/brand/payrep-logo.svg','utf8')
  expect(logo).toContain('aria-label="Payrep"')
  expect(logo).toContain('<svg')
 })

 it('shows only account access in the public header while keeping footer navigation',()=>{
  for(const name of ['sobre','privacidade','termos']){
   const html=page(name)
   const header=html.split('<header class="public-header">')[1]?.split('</header>')[0] ?? ''
   expect(header).toContain('class="nav-login" href="/"')
   expect(header).not.toContain('>Sobre</a>')
   expect(header).not.toContain('>Privacidade</a>')
   const footer=html.split('<footer class="public-footer">')[1]?.split('</footer>')[0] ?? ''
   expect(footer).toContain('href="/sobre"')
   expect(footer).toContain('href="/privacidade"')
   expect(footer).toContain('href="/termos"')
  }
 })
 it('labels both legal documents V1.0 and separates metadata from the first section',()=>{
  for(const name of ['privacidade','termos']){
   const html=page(name)
   expect(html).toContain('<strong>Versão:</strong> V1.0')
   expect(html).toContain('<strong>Data da versão:</strong> 12 de novembro de 2026')
   expect(html).toContain('<strong>Aplicação:</strong> Payrep')
   const metadataStart=html.indexOf('class="legal-document-info"')
   const metadataEnd=html.indexOf('</div>',metadataStart)
   const firstSection=html.indexOf('<section><h2>1.',metadataEnd)
   expect(metadataStart).toBeGreaterThan(-1)
   expect(metadataEnd).toBeGreaterThan(metadataStart)
   expect(firstSection).toBeGreaterThan(metadataEnd)
   expect(html).toContain('(minuta em HML)')
  }
  const css=readFileSync('public/public-pages.css','utf8')
  expect(css).toContain('.legal-document-info{margin-bottom:28px')
 })
 it('offers a public homepage that describes the app and links to privacy',()=>{
  const html=page('sobre')
  expect(html).toContain('Seu salário, com todos os detalhes.')
  expect(html).toContain('href="/privacidade"')
  expect(html).toContain('href="/"')
  expect(html).toContain('Como funciona o acesso com Google')
  expect(html).toContain('mailto:suporte@payrep.com.br')
  expect(html).not.toContain('id="root"')
 })
 it('explains Google account details and financial document handling',()=>{
  const html=page('privacidade')
  expect(html).toContain('Política de Privacidade')
  expect(html).toContain('Login com Google')
  expect(html).toContain('Supabase')
  expect(html).toContain('holerites')
  expect(html).toContain('exclusão')
  expect(html).toContain('Minuta para revisão em HML')
  expect(html).toContain('mailto:suporte@payrep.com.br')
  expect(html).toContain('Maileroo')
  expect(html).toContain('Google Gmail')
  expect(html).toContain('identificação formal do controlador')
 })
 it('provides linked terms while awaiting final legal contact',()=>{
  const html=page('termos')
  expect(html).toContain('Termos de Uso')
  expect(html).toContain('href="/privacidade"')
  expect(html).toContain('Minuta em revisão para HML.')
  expect(html).toContain('mailto:suporte@payrep.com.br')
 })
 it('routes all three pages directly without changing the existing root login',()=>{
  const config=JSON.parse(readFileSync('vercel.json','utf8')) as {rewrites:Array<{source:string;destination:string}>}
  expect(config.rewrites).toEqual([
   {source:'/sobre',destination:'/sobre.html'},
   {source:'/privacidade',destination:'/privacidade.html'},
   {source:'/termos',destination:'/termos.html'}
  ])
 })
})
