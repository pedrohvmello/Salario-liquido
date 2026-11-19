import {cleanAiTitle,conversationTopicFallback,extractModelText} from '../title.ts'

Deno.test('parses Workers AI and OpenAI-compatible text envelopes',()=>{
 const workers={success:true,result:{response:'**Título: Projeção salarial anual e descontos**'}}
 const openai={choices:[{message:{content:'Projeção salarial anual e descontos'}}]}
 if(cleanAiTitle(extractModelText(workers))!=='Projeção salarial anual e descontos')
  throw Error('Workers AI title not parsed')
 if(cleanAiTitle(extractModelText(openai))!=='Projeção salarial anual e descontos')
  throw Error('Compatible title not parsed')
})
Deno.test('strips reasoning, markup and excessive length safely',()=>{
 if(cleanAiTitle('<think>pensamento</think>\n**Simulação de aumento salarial**')!=='Simulação de aumento salarial')
  throw Error('Title markup not sanitized')
 const many='Projeção e análise detalhada do histórico de remuneração mensal e anual com informações de descontos e outros ajustes'
 const shortened=cleanAiTitle(many)
 if(!shortened||shortened.length>80)throw Error('Title length validation failed')
 if(cleanAiTitle('Oi Pep')!==null)throw Error('Greeting was accepted as the subject')
})
Deno.test('fallback derives meaningful topic from multiple turns rather than greeting',()=>{
 const messages=[
  {role:'user' as const,content:'Oi Pep'},
  {role:'assistant' as const,content:'Oi, como posso ajudar?'},
  {role:'user' as const,content:'Com base no meu salário atual, quanto recebo bruto e líquido?'},
  {role:'assistant' as const,content:'Seu salário anual é uma estimativa.'},
  {role:'user' as const,content:'O líquido considera o desconto de pensão?'},
  {role:'assistant' as const,content:'Sim, desconto de pensão considerado.'},
  {role:'user' as const,content:'E para o ano que vem com aumento de 5%?'},
 ]
 const title=conversationTopicFallback(messages)
 if(title==='Oi Pep'||!title.toLocaleLowerCase('pt-BR').includes('aumento')||
   !title.toLocaleLowerCase('pt-BR').includes('pensão')||title.length>80)
  throw Error('Conversation topic not inferred from subsequent turns: '+title)
})
Deno.test('fallback is not simply the first user message',()=>{
 const title=conversationTopicFallback([
  {role:'user',content:'Bom dia'},
  {role:'assistant',content:'Bom dia, como posso ajudar?'},
  {role:'user',content:'Explique o banco de horas e as horas extras'},
 ])
 if(!title.includes('horas')||title==='Bom dia')throw Error('Incorrect first-message title')
})
