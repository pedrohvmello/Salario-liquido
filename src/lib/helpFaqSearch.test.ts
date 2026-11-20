import {describe,expect,it} from 'vitest'
import {PAYREP_SUPPORT_FAQ} from '../../supabase/functions/support-ai/knowledge'
import {normalizeFaqText,searchPayrepFaq} from './helpFaqSearch'
describe('FAQ local search',()=>{
 it('normalizes accents and case',()=>expect(normalizeFaqText(' PENSÃO, Alimentícia! ')).toBe('pensao alimenticia'))
 it('handles empty and unmatched input',()=>{
  expect(searchPayrepFaq(PAYREP_SUPPORT_FAQ,'  ')).toEqual([])
  expect(searchPayrepFaq(PAYREP_SUPPORT_FAQ,'termoabsolutamenteinexistente')).toEqual([])
 })
 it('matches combined partial words against all FAQ fields',()=>{
  expect(searchPayrepFaq(PAYREP_SUPPORT_FAQ,'cancel renov').some(x=>x.question==='Como cancelar a renovação automática?')).toBe(true)
  expect(searchPayrepFaq(PAYREP_SUPPORT_FAQ,'asaas').length).toBeGreaterThan(0)
  expect(searchPayrepFaq(PAYREP_SUPPORT_FAQ,'banco de horas').length).toBeGreaterThan(0)
 })
 it('matches unaccented text',()=>{
  expect(searchPayrepFaq(PAYREP_SUPPORT_FAQ,'pensao').length).toBeGreaterThan(0)
  expect(searchPayrepFaq(PAYREP_SUPPORT_FAQ,'ferias').length).toBeGreaterThan(0)
 })
})
