export type TicketMailKind='ticket_opened'|'user_message'|'admin_message'|'ticket_closed'
export type TicketMailStatus='open'|'in_progress'|'resolved'
export type TicketMailProps={
 kind:TicketMailKind; status:TicketMailStatus; ticketCode:string; subject:string
 category:string; requesterName:string; requesterEmail:string
 message:string; appUrl:string; allowEmailReply:boolean
}
const labels:Record<TicketMailKind,{title:string;eyebrow:string;msg:string}>={
 ticket_opened:{title:'Novo chamado recebido',eyebrow:'NOVO ATENDIMENTO',msg:'Solicitação inicial'},
 user_message:{title:'Nova mensagem no chamado',eyebrow:'ATUALIZAÇÃO',msg:'Mensagem do usuário'},
 admin_message:{title:'Resposta do suporte',eyebrow:'ATENDIMENTO',msg:'Mensagem do suporte'},
 ticket_closed:{title:'Chamado finalizado',eyebrow:'ATENDIMENTO CONCLUÍDO',msg:'Encerramento'}
}
const statuses:Record<TicketMailStatus,{label:string,bg:string,fg:string,border:string}>={
 open:{label:'Aberto',bg:'#FFF6D8',fg:'#805900',border:'#EDD9A0'},
 in_progress:{label:'Em atendimento',bg:'#FFF0DE',fg:'#A45413',border:'#F0D0AD'},
 resolved:{label:'Finalizado',bg:'#E9F7EB',fg:'#28764A',border:'#BFE1C9'}
}
const categories:Record<string,string>={
 acesso:'Acesso e segurança',holerites:'Holerites e importação',
 calculos:'Cálculos e projeções',conta:'Cadastro e conta',outro:'Outro assunto'
}
export const escapeEmailHtml=(s:string):string=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;')
 .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')
const safeOrigin=(value:string):string=>{
 const u=new URL(value)
 if(u.protocol!=='https:'||u.username||u.password)throw Error('Invalid support app URL')
 return u.origin
}
export function renderSupportEmail(p:TicketMailProps):{html:string;plain:string}{
 const site=safeOrigin(p.appUrl)
 const meta=labels[p.kind]
 const current=statuses[p.kind==='ticket_closed'?'resolved':p.status]
 const category=categories[p.category]||p.category
 const canReply=p.kind==='admin_message'&&p.allowEmailReply
 const text=p.kind==='ticket_closed'?'O atendimento foi finalizado pelo suporte.':p.message
 const row=(heading:string,value:string)=>`<tr><td style="padding:5px 0;font-size:12px;line-height:20px;color:#8B75A0;width:96px;vertical-align:top;">${heading}</td><td style="padding:5px 0;font-size:13px;line-height:20px;color:#402254;font-weight:600;word-break:break-word;">${escapeEmailHtml(value)}</td></tr>`
 const replyHint='Você pode responder diretamente a este e-mail para continuar a conversa no chamado. Não altere o assunto nem o destinatário da mensagem.'
 const plain=[
  'Payrep | Controle salarial',
  meta.title+' · Protocolo #'+p.ticketCode,
  'Assunto: '+p.subject,
  'Categoria: '+category,
  'Solicitante: '+p.requesterName,
  'Contato: '+p.requesterEmail,
  'Status: '+current.label,
  '',
  text,
  ...(canReply?['',replyHint]:[]),
  '',
  'Acompanhar chamado no Payrep: '+site,
  'Por segurança, não inclua senhas, códigos de autenticação ou holerites completos por e-mail.',
  '© 2026 Payrep'
 ].join('\n')
 const header=`<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;"><tr>
  <td width="61" style="width:61px;vertical-align:middle;"><img alt="Payrep" src="${site}/icon-192.png" width="49" height="49" style="display:block;border:0;border-radius:12px;background:#F9F5FF;width:49px;height:49px;"></td>
  <td style="vertical-align:middle;"><span style="display:block;font-size:26px;font-weight:700;color:#FFFFFF;line-height:29px;">Payrep</span><span style="font-size:12px;color:#D6B8ED;line-height:19px;">Controle salarial</span></td>
  </tr></table>`
 const statusBadge=`<span style="display:inline-block;padding:5px 11px;background:${current.bg};color:${current.fg};border:1px solid ${current.border};border-radius:18px;font-size:11px;line-height:16px;font-weight:700;">${current.label}</span>`
 const replyBlock=canReply?`<tr><td style="padding:0 27px 22px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #DFC9F4;background:#F5ECFF;border-radius:10px;"><tr><td style="padding:15px 18px;color:#502575;font-size:13px;line-height:21px;">
 <strong style="display:block;margin-bottom:5px;">Você pode responder a este e-mail</strong>
 Basta clicar em <strong>Responder</strong> para continuar a conversa no Payrep.<br><strong>Não altere o assunto nem o destinatário</strong> do e-mail.
 </td></tr></table></td></tr>`:''
 const html=`<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeEmailHtml(meta.title)} | Payrep</title></head>
 <body style="margin:0;padding:0;background:#F6F1FA;font-family:Arial,Helvetica,sans-serif;color:#351651;">
 <div style="display:none;overflow:hidden;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;">${escapeEmailHtml(meta.title)} · Chamado #${escapeEmailHtml(p.ticketCode)} · ${escapeEmailHtml(p.subject)}</div>
 <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;background:#F6F1FA;"><tr><td align="center" style="padding:28px 12px 36px;">
 <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="width:100%;max-width:600px;border:1px solid #E5D8F1;border-radius:15px;border-spacing:0;background:#FFFFFF;overflow:hidden;">
 <tr><td style="padding:25px 27px;background:#29064C;">${header}</td></tr>
 <tr><td style="padding:29px 27px 13px;">
  <div style="font-size:11px;font-weight:700;color:#8A41BE;letter-spacing:1.4px;">${meta.eyebrow}</div>
  <h1 style="font-size:23px;line-height:31px;margin:10px 0;color:#351651;">${escapeEmailHtml(meta.title)}</h1>
  <p style="font-size:13px;line-height:21px;color:#806D93;margin:0 0 19px;">Atualização do chamado <strong style="color:#4E276A;">#${escapeEmailHtml(p.ticketCode)}</strong></p>
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border:1px solid #E9DAF3;background:#FAF7FD;border-radius:10px;border-spacing:0;">
   <tr><td style="padding:17px 18px 8px;">
    <div style="font-size:11px;color:#8C76A2;line-height:18px;">Assunto</div>
    <div style="font-size:15px;line-height:23px;font-weight:700;color:#351651;word-break:break-word;">${escapeEmailHtml(p.subject)}</div>
   </td></tr>
   <tr><td style="padding:0 18px 15px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td width="55%" style="vertical-align:top;padding:8px 0;">
     <div style="font-size:11px;color:#8C76A2;margin-bottom:6px;">Categoria</div><div style="font-size:12px;color:#4D3261;">${escapeEmailHtml(category)}</div>
    </td><td style="vertical-align:top;padding:8px 0;">
     <div style="font-size:11px;color:#8C76A2;margin-bottom:6px;">Status</div>${statusBadge}
    </td></tr></table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${row('Solicitante',p.requesterName)}</table>
   </td></tr>
  </table>
 </td></tr>
 <tr><td style="padding:12px 27px 23px;">
  <div style="font-size:12px;font-weight:700;color:#71548C;margin-bottom:10px;">${meta.msg}</div>
  <div style="border-left:4px solid #8B1CD2;border-top:1px solid #E5D8F0;border-right:1px solid #E5D8F0;border-bottom:1px solid #E5D8F0;border-radius:5px;padding:18px 17px;color:#3A2850;font-size:14px;line-height:23px;word-break:break-word;">${escapeEmailHtml(text).replace(/\r\n|\r|\n/g,'<br>')}</div>
 </td></tr>
 ${replyBlock}
 <tr><td align="center" style="padding:2px 27px 30px;">
 <a href="${site}" style="display:inline-block;background:#7900D6;color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:700;padding:14px 22px;border-radius:9px;line-height:20px;" target="_blank">Acompanhar chamado no Payrep</a></td></tr>
 <tr><td style="border-top:1px solid #E9DAF4;background:#FCFAFE;padding:19px 27px 23px;">
  <p style="font-size:11px;line-height:18px;margin:0 0 9px;color:#79688B;">Por segurança, não envie senhas, códigos de autenticação ou holerites completos por e-mail.</p>
  <p style="font-size:11px;line-height:18px;margin:0;color:#9B8CAB;">Mensagem automática do Payrep · © 2026 Payrep</p>
 </td></tr>
 </table>
 </td></tr></table></body></html>`
 return {html,plain}
}
