import {describe,expect,it} from 'vitest'
import {supportCategories,supportCategoryLabel,supportStatuses,supportTicketCode,filterSupportTickets,filterMySupportTickets,supportPendingReply,type SupportTicket} from './support'

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
 it('identifies pending replies only when a user has the latest activity in an active conversation',()=>{
  const common={status:'in_progress' as const,last_user_activity_at:'2026-11-12T10:00:00Z',last_admin_activity_at:null}
  expect(supportPendingReply(common)).toBe(true)
  expect(supportPendingReply({...common,last_admin_activity_at:'2026-11-12T11:00:00Z'})).toBe(false)
  expect(supportPendingReply({...common,last_admin_activity_at:'2026-11-12T09:00:00Z'})).toBe(true)
  expect(supportPendingReply({...common,status:'resolved'})).toBe(false)
  expect(supportPendingReply({...common,status:'open'})).toBe(false)
 })
 it('combines status and year filters',()=>{
  const t=(year:number,status:SupportTicket['status'],userAt:string,adminAt:string|null)=>({
    ticket_year:year,status,category:'acesso',last_user_activity_at:userAt,last_admin_activity_at:adminAt
  }) as SupportTicket
  const tickets=[
   t(2026,'in_progress','2026-11-12T12:00:00Z',null),
   t(2026,'in_progress','2026-11-12T12:00:00Z','2026-11-12T13:00:00Z'),
   t(2025,'in_progress','2025-03-03T12:00:00Z',null),
   t(2026,'resolved','2026-11-12T12:00:00Z',null)
  ]
  expect(filterSupportTickets(tickets,'pending','2026')).toHaveLength(1)
  expect(filterSupportTickets(tickets,'in_progress','2026')).toHaveLength(2)
  expect(filterSupportTickets(tickets,'all','2025')).toHaveLength(1)
  expect(filterSupportTickets(tickets,'resolved','all')).toHaveLength(1)
  expect(filterSupportTickets(tickets,'all','all','acesso')).toHaveLength(4)
  expect(filterSupportTickets(tickets,'all','all','holerites')).toHaveLength(0)
  expect(filterSupportTickets([{...tickets[0],category:'holerites'},...tickets.slice(1)],'pending','2026','holerites')).toHaveLength(1)
 })
 it('groups Aberto and Em atendimento as open tickets for the user while combining year',()=>{
  const data=[
   {status:'open',ticket_year:2026},
   {status:'in_progress',ticket_year:2026},
   {status:'resolved',ticket_year:2026},
   {status:'open',ticket_year:2025}
  ] as SupportTicket[]
  expect(filterMySupportTickets(data,'open','2026')).toHaveLength(2)
  expect(filterMySupportTickets(data,'resolved','2026')).toHaveLength(1)
  expect(filterMySupportTickets(data,'open','2025')).toHaveLength(1)
  expect(filterMySupportTickets(data,'all','all')).toHaveLength(4)
 })
})
