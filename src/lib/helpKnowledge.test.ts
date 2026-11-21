import {describe,it,expect} from 'vitest'
import {PAYREP_SUPPORT_FAQ,PAYREP_SUPPORT_KNOWLEDGE,buildPepHelpContext} from '../../supabase/functions/support-ai/knowledge'
import {readFileSync} from 'node:fs'

describe('Shared FAQ and Pep Ajuda knowledge',()=>{
 it('covers support, security, reports, subscriptions, AI, payroll and administrator operations',()=>{
  const categories=new Set(PAYREP_SUPPORT_FAQ.map(item=>item.category))
  expect(PAYREP_SUPPORT_FAQ.length).toBeGreaterThanOrEqual(65)
  expect(categories.size).toBeGreaterThanOrEqual(10)
  expect(new Set(PAYREP_SUPPORT_FAQ.map(item=>item.question)).size).toBe(PAYREP_SUPPORT_FAQ.length)
  expect(PAYREP_SUPPORT_FAQ.some(item=>item.question==='Como encontrar respostas no FAQ por palavras-chave?')).toBe(true)
  expect(PAYREP_SUPPORT_FAQ.length).toBeGreaterThanOrEqual(85)
  expect(PAYREP_SUPPORT_FAQ.some(item=>item.question==='Como alterar manualmente o plano de um usuário?')).toBe(true)
  for(const phrase of ['Asaas','PEP AJUDA','CPF','Controlador'.toLowerCase()]){
   const full=(PAYREP_SUPPORT_KNOWLEDGE+' '+PAYREP_SUPPORT_FAQ.map(x=>x.answer).join(' ')).toLowerCase()
   expect(full).toContain(phrase.toLowerCase())
  }
 })
 it('selects relevant entries instead of sending all answers to the model',()=>{
  const output=buildPepHelpContext('Como cancelo a renovação da assinatura?')
  expect(output).toContain('Como cancelar a renovação automática?')
  expect(output).not.toContain('Como registrar entrada, almoço e saída?')
  expect(output.length).toBeLessThan(PAYREP_SUPPORT_KNOWLEDGE.length+8000)
 })
 it('keeps help counter invisible while preserving server-side quota enforcement',()=>{
  const chat=readFileSync('src/components/SupportAiChat.tsx','utf8')
  const api=readFileSync('supabase/functions/support-ai/index.ts','utf8')
  expect(chat).toContain("mode==='personal'&&!usage?.unlimited")
  expect(chat).not.toContain('Pep Ajuda: ')
  expect(api).toContain('reserve_pep_request')
  expect(api).toContain("if(mode==='personal')")
  expect(api).toContain('buildPepHelpContext')
 })
})
