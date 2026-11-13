import {describe,expect,it} from 'vitest'
import {supportCategories,supportCategoryLabel,supportStatuses,supportTicketCode} from './support'

describe('support ticket presentation',()=>{
 it('uses readable year and sequence identifiers',()=>{
  expect(supportTicketCode({ticket_year:2026,ticket_sequence:1})).toBe('2026-0001')
  expect(supportTicketCode({ticket_year:2027,ticket_sequence:125})).toBe('2027-0125')
 })
 it('shows the category label instead of the internal code',()=>{
  expect(supportCategoryLabel('acesso')).toBe('Acesso e segurança')
  expect(supportCategoryLabel('calculos')).toBe('Cálculos e projeções')
  expect(supportCategories).toHaveLength(5)
 })
 it('treats resolution as final',()=>{
  expect(supportStatuses.resolved).toBe('Finalizado')
 })
})
