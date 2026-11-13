export type SupportStatus='open'|'in_progress'|'resolved'
export type SupportTicket={
 id:string
 user_id:string
 category:string
 subject:string
 description:string
 status:SupportStatus
 ticket_year:number
 ticket_sequence:number
 created_at:string
 updated_at:string
}
export type SupportTicketMessage={
 id:string
 ticket_id:string
 sender_id:string
 sender_role:'user'|'admin'
 body:string
 created_at:string
}
export const supportTicketFields='id,user_id,category,subject,description,status,ticket_year,ticket_sequence,created_at,updated_at'
export const supportStatuses:Record<SupportStatus,string>={
 open:'Aberto',in_progress:'Em atendimento',resolved:'Finalizado'
}
export const supportCategories=[
 {value:'acesso',label:'Acesso e segurança'},
 {value:'holerites',label:'Holerites e importação'},
 {value:'calculos',label:'Cálculos e projeções'},
 {value:'conta',label:'Cadastro e conta'},
 {value:'outro',label:'Outro assunto'}
] as const
export function supportCategoryLabel(category:string):string{
 return supportCategories.find(item=>item.value===category)?.label||category
}
export function supportTicketCode(ticket:Pick<SupportTicket,'ticket_year'|'ticket_sequence'>):string{
 return String(ticket.ticket_year)+'-'+String(ticket.ticket_sequence).padStart(4,'0')
}
export function supportDate(value:string):string{
 return new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(new Date(value))
}
export function supportError(message:string):string{
 return /support_ticket|schema cache|relation .* does not exist/i.test(message)
  ?'Chamados indisponíveis neste ambiente. Contate o suporte por e-mail.':message
}
