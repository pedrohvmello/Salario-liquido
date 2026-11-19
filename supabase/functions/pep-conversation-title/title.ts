export type PepTurn={role:'user'|'assistant';content:string}
const maxTitle=60
const maxWords=5
const greeting=/^(?:oi(?:\s+pep)?|ol[aá](?:\s+pep)?|bom dia(?:\s+pep)?|boa tarde(?:\s+pep)?|boa noite(?:\s+pep)?|obrigad[oa](?:\s+pep)?|valeu(?:\s+pep)?)[!. ]*$/i
const generic=/^(?:conversa com (?:o )?pep|conversa|sem t[ií]tulo|t[ií]tulo|resumo da conversa)$/i

/** Supports Workers AI result and OpenAI-style response envelopes. */
export function extractModelText(raw:unknown):string|null{
 if(!raw||typeof raw!=='object')return null
 const data=raw as Record<string,unknown>
 if(data.success===false)return null
 const result=data.result&&typeof data.result==='object'?data.result as Record<string,unknown>:data
 const choices=Array.isArray(result.choices)?result.choices:[]
 const first=choices[0]&&typeof choices[0]==='object'?choices[0] as Record<string,unknown>:{}
 const message=first.message&&typeof first.message==='object'?first.message as Record<string,unknown>:{}
 const values=[result.response,message.content,result.output_text,result.text]
 for(const value of values){
  if(typeof value==='string'&&value.trim())return value
  if(Array.isArray(value)){
   const text=value.filter(entry=>typeof entry==='object'&&entry!==null)
    .map(entry=>{const obj=entry as Record<string,unknown>;return typeof obj.text==='string'?obj.text:''})
    .filter(Boolean).join('\n')
   if(text.trim())return text
  }
 }
 return null
}
export function cleanAiTitle(raw:unknown):string|null{
 if(typeof raw!=='string')return null
 let text=raw
  .replace(/<think>[\s\S]*?<\/think>/gi,' ')
  .replace(/<\|(?:im_start|im_end|eot_id)\|>/gi,' ')
  .replace(/<\/?final>/gi,' ')
  .replace(/\x60{3}(?:text|markdown)?/gi,' ')
  .trim()
 if(!text)return null
 const lines=text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean)
 const named=lines.find(x=>/^(?:\*\*)?(?:título|titulo|assunto)\s*:/i.test(x))
 text=(named||lines[0]||text)
  .replace(/^(?:\*\*)?(?:título|titulo|assunto|sugestão de título)\s*:\s*/i,'')
  .replace(/^\s*(?:#{1,4}|\*{1,2}|[-•])\s*/,'')
  .replace(/\*{1,2}/g,'')
  .replace(/^["'“”«»]+|["'“”«»]+$/g,'')
  .replace(/[<>\r\n\t]+/g,' ')
  .replace(/\s+/g,' ')
  .replace(/[.!?,;:]+$/g,'')
  .trim()
 // Keep both AI and fallback titles compact enough for one-line history rows.
 const words=text.split(/\s+/u).filter(Boolean)
 if(words.length>maxWords)text=words.slice(0,maxWords).join(' ')
 if(text.length>maxTitle){
  const boundary=text.lastIndexOf(' ',maxTitle)
  text=text.slice(0,boundary>=24?boundary:maxTitle).trim()
 }
 if(text.length<5||generic.test(text)||greeting.test(text))return null
 return text
}
const stopWords=new Set([
 'agora','ainda','ano','anos','aqui','assim','base','bem','certo','como','com','considerando','consegue',
 'conseguiria','conseguimos','depois','deveria','disso','entao','então','esse','essa','esses','essas',
 'este','esta','estes','estas','fazer','feito','favor','gostaria','gostou','hoje','isso','isto','mais',
 'mes','mês','meses','mesmo','minha','minhas','meu','meus','muito','neste','nessa','nesse','nossa',
 'onde','outro','outros','para','pelo','pela','pelos','pelas','pode','poderia','pois','porque',
 'qual','quais','quando','quanto','quantos','queria','receber','recebo','receberei','referente','resposta',
 'responder','sobre','sera','será','seria','sua','suas','seu','seus','tambem','também','tenho','tinha',
 'todas','todos','tudo','valor','valores','voce','você','vocês','vamos','veja','preciso','precisa',
 'estou','estava','serem','sendo','acordo','apenas','cada','ate','até','após','antes','entre','sem',
 'tem','tenha','possivel','possível','sim','não','nao','ola','olá','obrigado','obrigada','pep',
 'data','datas','atual','atuais','nesse','esse','isso','quer','queria','deve','devo','pago','pagar',
 'de','da','do','das','dos','em','no','na','nos','nas','ou','e','um','uma','uns','umas','o','a','os','as',
 'por','se','eu','ele','ela','eles','elas','que','me','te','lhe','ao','à','às','pra','pro'
])
const canonical=new Map([
 ['salario','salário'],['salarios','salário'],['salarial','salário'],['salariais','salário'],
 ['projecao','projeção'],['projecoes','projeção'],['projetado','projeção'],['projetar','projeção'],
 ['estimativa','estimativa'],['estimar','estimativa'],
 ['pensao','pensão'],['pensoes','pensão'],
 ['aumento','aumento'],['aumentar','aumento'],['reajuste','aumento'],
 ['descontos','descontos'],['desconto','descontos'],
 ['liquido','líquido'],['liquida','líquido'],['bruto','bruto'],['bruta','bruto'],
 ['ferias','férias'],['tributacao','tributação'],
 ['anual','anual'],['anuais','anual'],['irrf','IRRF'],['inss','INSS'],
 ['espp','ESPP'],['ppr','PPR'],['plr','PLR'],['fgts','FGTS']
])
function key(text:string){return text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR')}
// Promote substantive topics above generic attributes in the emergency fallback.
const topicWeight=new Map([
 ['salário',3],['pensão',2.2],['aumento',2],['projeção',2],['férias',2],
 ['PPR',2],['PLR',2],['ESPP',2],['FGTS',2],['INSS',2],['IRRF',2]
])
/** Last-resort topic extraction, not a hardcoded question router. */
export function conversationTopicFallback(turns:PepTurn[]):string{
 const substantive=turns.filter(t=>t.role==='user'&&!greeting.test(t.content.trim()))
 if(substantive.length===0)return 'Primeira conversa com o Pep'
 const scores=new Map<string,{label:string;score:number;first:number}>()
 let order=0
 substantive.forEach((turn,index)=>{
  const words=turn.content.match(/[\p{L}]+/gu)||[]
  const seen=new Set<string>()
  for(const word of words){
   const normalized=key(word)
   if(normalized.length<4||stopWords.has(normalized)||seen.has(normalized))continue
   seen.add(normalized)
   const label=canonical.get(normalized)||word.toLocaleLowerCase('pt-BR')
   const existing=scores.get(label)
   const weight=(1+index/Math.max(1,substantive.length-1))*(topicWeight.get(label)||1)
   if(existing)existing.score+=weight
   else scores.set(label,{label,score:weight,first:order++})
  }
 })
 const ranked=[...scores.values()].sort((a,b)=>b.score-a.score||a.first-b.first)
  .map(x=>x.label).filter(x=>x.length>2)
 const topics=ranked.slice(0,3)
 if(!topics.length)return 'Assuntos tratados com o Pep'
 const phrase=topics.length===1?topics[0]:
  topics.length===2?topics.join(' e '):topics.slice(0,2).join(', ')+' e '+topics[2]
 return cleanAiTitle('Sobre '+phrase)||'Assuntos tratados com o Pep'
}
