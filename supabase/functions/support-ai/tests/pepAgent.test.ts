import {runPepAgent} from '../pepAgentRuntime.ts'
import {AGENT_TOOL_NAMES,calculateNumbers,parseAgentToolArguments} from '../pepAgentTools.ts'
import {parseAgentPlan} from '../pepAgentRecovery.ts'

Deno.test('tool allowlist never exposes mutation or arbitrary SQL',()=>{
 for(const banned of ['query_sql','delete_user','update_event','execute_sql','read_file']){
  if(AGENT_TOOL_NAMES.has(banned))throw Error('Unsafe tool '+banned)
 }
 if(!AGENT_TOOL_NAMES.has('get_financial_profile'))throw Error('Missing profile tool')
})
Deno.test('arithmetic tool validates operation and does not evaluate arbitrary code',()=>{
 const result=calculateNumbers({operation:'sum',values:[15340.57,179]})
 if(!('result' in result)||result.result!==15519.57)throw Error('Sum mismatch')
 const bad=calculateNumbers({operation:'eval',values:[1,2]})
 if(!('error' in bad))throw Error('Unapproved operation accepted')
 let denied=false
 try{parseAgentToolArguments('{no-json:1}')}catch{denied=true}
 if(!denied)throw Error('Malformed JSON accepted')
})
Deno.test('agent chooses financial tool dynamically and receives only owner-scoped data',async()=>{
 const seen:Array<{table:string;filter:string;value:unknown}>=[]
 function query(table:string){
  const builder={
   select(_fields:string){return this},
   eq(k:string,v:unknown){seen.push({table,filter:k,value:v});return this},
   lte(_k:string,_v:string){return this},
   order(_field:string,_opts:unknown){return this},
   async limit(_n:number){
    if(table==='salary_events')return {data:[{kind:'salary',effective_date:'2026-01-01',value:15340.57,notes:'',source_statement_id:null},
     {kind:'trienio',effective_date:'2026-01-01',value:179,notes:'',source_statement_id:null}],error:null}
    return {data:[],error:null}
   },
   async maybeSingle(){
    return {data:{parameters:{salary:15000,advancePercent:40}},error:null}
   }
  }
  return builder
 }
 let rounds=0
 let toolResult:Record<string,unknown>|null=null
 const output=await runPepAgent({
  db:{from:query} as never,userId:'user-verified-123',plan:'basic',
  now:'2026-11-19',question:'Com base no meu salário atual, quanto devo receber neste ano, bruto e líquido?',
  history:[],firstName:'Ana',token:'fake',account:'fake',
  recoverPlan:async()=>({calls:[{name:'get_financial_profile',arguments:{}}],answer:null}),
  infer:async payload=>{
   rounds++
   if(payload.toolChoice!=='auto')throw Error('Extra tools should be optional')
   const received=payload.messages.filter(x=>x.role==='tool').at(-1)
   if(!received?.content)throw Error('No tool result passed to assistant')
   toolResult=JSON.parse(received.content)
   return {role:'assistant',content:''}
  },
  synthesize:async ({observations})=>{
   const profile=observations.find(o=>o.name==='get_financial_profile')
   if(!profile)throw Error('Missing model-selected profile result')
   return 'Ana, a anualização com salário vigente é estimada, não um valor efetivamente pago.'
  }
 })
 if(!output.answer.includes('anualização'))throw Error('No final answer')
 if(!toolResult||!('annualization_if_salary_constant' in (toolResult as {annualization_if_salary_constant?:unknown})))
  throw Error('Agent did not read payroll data')
 if(!seen.some(x=>x.table==='user_settings'&&x.filter==='user_id'&&x.value==='user-verified-123')||
  !seen.some(x=>x.table==='salary_events'&&x.filter==='user_id'&&x.value==='user-verified-123'))
  throw Error('Query not scoped to authenticated user')
 if(output.agentTools!==1)throw Error('Unexpected tool count')
})

Deno.test('empty provider completion after successful tools does not lose answer',async()=>{
 let calls=0
 let usedData=false
 const response=await runPepAgent({
  db:{} as never,userId:'owner',plan:'basic',now:'2026-11-19',
  question:'Com base no meu salário atual, quanto devo receber esse ano, bruto e líquido?',
  history:[],firstName:'Ana',token:'fake',account:'fake',
  recoverPlan:async()=>({calls:[{name:'calculate_numbers',arguments:{operation:'sum',values:[15340.57,179]}}],answer:null}),
  infer:async ()=>{
   calls++
   return {role:'assistant',content:'',tool_calls:[]}
  },
  synthesize:async ({observations})=>{
   const record=observations.find(o=>o.name==='calculate_numbers')
   if(JSON.stringify(record?.data)!==JSON.stringify({result:15519.57}))
    throw Error('Calculation result not available for final synthesis')
   usedData=true
   return 'Ana, confirmei a base mensal de R$ 15.519,57 para o cálculo.'
  }
 })
 if(!usedData||response.agentTools!==1||!response.answer.includes('15.519,57'))
  throw Error('Empty native completion was not recovered')
})
Deno.test('model-selected text plan recovers empty first native tool response',async()=>{
 let recovered=false
 const response=await runPepAgent({
  db:{} as never,userId:'owner',plan:'basic',now:'2026-11-19',
  question:'Qual a soma dos dois valores?',history:[],firstName:'',
  token:'fake',account:'fake',
  infer:async()=>({role:'assistant',content:'',tool_calls:[]}),
  recoverPlan:async()=>{
   recovered=true
   return {calls:[{name:'calculate_numbers',arguments:{operation:'sum',values:[8,13]}}],answer:null}
  },
  synthesize:async ({observations})=>{
   if(JSON.stringify(observations[0].data)!==JSON.stringify({result:21}))
    throw Error('Recovery planner did not execute selected tool')
   return 'A soma é 21.'
  }
 })
 if(!recovered||response.answer!=='A soma é 21.')throw Error('Text tool planner did not recover')
})
Deno.test('plain planner JSON rejects unlisted operations',()=>{
 const parsed=parseAgentPlan('{"calls":[{"name":"execute_sql","arguments":{"sql":"delete from users"}},{"name":"calculate_numbers","arguments":{"operation":"sum","values":[1,2]}}],"answer":null}')
 if(!parsed||parsed.calls.length!==1||parsed.calls[0].name!=='calculate_numbers')
  throw Error('Tool planner bypassed allowlist')
})

Deno.test('a simple greeting does not query a salary, even if earlier history discussed money',async()=>{
 let financialQueryCount=0
 let inferenceCount=0
 const history=[
  {role:'user' as const,content:'Com base no meu salário, quanto receberei em 2026?'},
  {role:'assistant' as const,content:'A estimativa anual é X'}
 ]
 const response=await runPepAgent({
  db:{from:()=>{financialQueryCount++;throw Error('The model must not query data for this turn')}} as never,
  userId:'verified-user',plan:'full',now:'2026-11-19',
  question:'Oi Pep',history,firstName:'Pedro',token:'fake',account:'fake',
  recoverPlan:async request=>{
   if(request.question!=='Oi Pep')throw Error('Incorrect current message')
   if(request.history.length!==2)throw Error('Lost explicit conversation context')
   return {calls:[],answer:'Oi, Pedro! Como posso ajudar?'}
  },
  infer:async()=>{inferenceCount++;throw Error('Greeting must not trigger native tool calls')},
  synthesize:async()=>{throw Error('Greeting must not synthesize financial results')}
 })
 if(response.answer!=='Oi, Pedro! Como posso ajudar?'||response.agentTools!==0||
    response.sources.length!==0||response.usedFinancialData||financialQueryCount!==0||inferenceCount!==0)
  throw Error('Greeting incorrectly triggered a financial request')
})
Deno.test('a financial question still requests financial tools instead of guessing',async()=>{
 let queries=0
 const response=await runPepAgent({
  db:{} as never,userId:'verified-user',plan:'basic',now:'2026-11-19',
  question:'Quanto vou receber neste ano?',history:[],firstName:'Pedro',token:'fake',account:'fake',
  recoverPlan:async()=>({calls:[{name:'calculate_numbers',arguments:{operation:'sum',values:[12,13]}}],answer:null}),
  infer:async()=>({role:'assistant',content:null,tool_calls:[]}),
  synthesize:async ({observations})=>{
   queries=observations.length
   return 'O cálculo solicitado foi realizado com os dados disponíveis.'
  }
 })
 if(queries!==1||response.agentTools!==1||!response.usedFinancialData)
  throw Error('Data question did not use a tool')
})
