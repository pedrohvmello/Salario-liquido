// Pure validation shared by Supabase Edge and Vitest tests.
export type AiTurn={role:'user'|'assistant';content:string};
export type AiInput={question:string;history:AiTurn[]};
export type ParseError='invalid_payload'|'invalid_question'|'invalid_history';
export function parseAiInput(raw:unknown):{value:AiInput;error:null}|{value:null;error:ParseError}{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return {value:null,error:'invalid_payload'};
 const obj=raw as Record<string,unknown>;
 if(typeof obj.question!=='string'||obj.question.trim().length<3||obj.question.trim().length>500)
  return {value:null,error:'invalid_question'};
 if(obj.history!==undefined&&!Array.isArray(obj.history))
  return {value:null,error:'invalid_history'};
 const hist=obj.history??[];
 if(!Array.isArray(hist)||hist.length>6)return {value:null,error:'invalid_history'};
 const cleaned:AiTurn[]=[];
 for(const h of hist){
  if(!h||typeof h!=='object'||Array.isArray(h))return {value:null,error:'invalid_history'};
  const turn=h as Record<string,unknown>;
  if((turn.role!=='assistant'&&turn.role!=='user')||typeof turn.content!=='string'||
    turn.content.trim().length<1||turn.content.length>800)return {value:null,error:'invalid_history'};
  cleaned.push({role:turn.role,content:turn.content.trim()});
 }
 return {value:{question:obj.question.trim(),history:cleaned},error:null};
}
export function parseCloudflareAnswer(raw:unknown):string|null{
 if(!raw||typeof raw!=='object')return null;
 const data=raw as Record<string,unknown>;
 const result=(data.result&&typeof data.result==='object')?data.result as Record<string,unknown>:null;
 if(data.success===false||!result)return null;
 let value:unknown=result.response;
 if(typeof value!=='string'&&Array.isArray(result.choices)){
  const choice=result.choices[0] as Record<string,unknown>|undefined;
  const message=choice?.message as Record<string,unknown>|undefined;
  value=message?.content;
 }
 if(typeof value!=='string')return null;
 const s=value.replace(/<think>[\s\S]*?<\/think>/g,'').trim();
 return s.length>0?s.slice(0,1300):null;
}
