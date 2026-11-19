import {runPepAgent} from '../pepAgentRuntime.ts'
import {AGENT_TOOL_NAMES,calculateNumbers,parseAgentToolArguments} from '../pepAgentTools.ts'

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
  infer:async payload=>{
   rounds++
   if(rounds===1){
    if(payload.toolChoice!=='required')throw Error('First model turn must use tools')
    return {role:'assistant',content:null,tool_calls:[{
     id:'call-1',type:'function',function:{name:'get_financial_profile',arguments:'{}'}
    }]}
   }
   const received=payload.messages.filter(x=>x.role==='tool').at(-1)
   if(!received?.content)throw Error('No tool result passed to assistant')
   toolResult=JSON.parse(received.content)
   return {role:'assistant',content:'Ana, a anualização com salário vigente é estimada, não um valor efetivamente pago.'}
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
