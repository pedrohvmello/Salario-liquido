import {readFileSync} from 'node:fs'
import {describe,expect,it} from 'vitest'

function page(name:string){return readFileSync('public/'+name+'.html','utf8')}

describe('Payrep public OAuth pages',()=>{
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
