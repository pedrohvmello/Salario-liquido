import {useEffect,useRef,useState,type FormEvent, type KeyboardEvent} from 'react'
import {ArrowLeft,Info,LoaderCircle,Send,Sparkles,Trash2} from 'lucide-react'
import {db} from '../lib/data'
import {fetchMyPepUsage,type MyPepUsage} from '../lib/supportAiLimits'
import {PepMascot} from './PepMascot'

type ChatMessage={role:'user'|'assistant';content:string;sources?:string[]}
const errors:Record<string,string>={
 authentication_required:'Sua sessão expirou. Faça login novamente.',
 account_not_authorized:'Este recurso está disponível apenas para contas aprovadas.',
 daily_limit:'O limite de consultas deste Pep foi atingido hoje.',
 global_limit:'O limite global de consultas foi atingido hoje. Tente novamente amanhã.',
 plan_required:'Consultas pessoais estão disponíveis a partir do plano Basic.',
 ai_free_limit:'A cota gratuita do modelo foi esgotada. Tente novamente mais tarde.',
 ai_not_configured:'A integração com IA ainda não está pronta neste ambiente.',
 quota_unavailable:'Não foi possível validar o limite de uso. Tente novamente.',
 ai_unavailable:'A IA está temporariamente indisponível. Tente novamente.',
 ai_invalid_response:'Não foi possível interpretar a resposta. Tente novamente.',
 financial_data_unavailable:'Não foi possível consultar seus dados com segurança. Verifique sua sessão e tente novamente.',
}
export function SupportAiChat({onBack,pepPreviewUrl,pepVideoLoading=false,mode}:{onBack:()=>void;pepPreviewUrl?:string|null;pepVideoLoading?:boolean;mode:'help'|'personal'}){
 const [messages,setMessages]=useState<ChatMessage[]>([])
 const [draft,setDraft]=useState('')
 const [busy,setBusy]=useState(false)
 const [usage,setUsage]=useState<MyPepUsage|null>(null)
 const [usageLoading,setUsageLoading]=useState(true)
 useEffect(()=>{
  let active=true
  setUsageLoading(true)
  void fetchMyPepUsage().then(result=>{if(active)setUsage(result)})
   .catch(()=>{if(active)setUsage(null)})
   .finally(()=>{if(active)setUsageLoading(false)})
  return ()=>{active=false}
 },[mode])
 const [error,setError]=useState('')
 const bottom=useRef<HTMLDivElement|null>(null)
 useEffect(()=>{bottom.current?.scrollIntoView({block:'nearest'})},[messages,busy])
 const submit=async(e:FormEvent<HTMLFormElement>)=>{
  e.preventDefault()
  const question=draft.trim()
  if(!db||busy||question.length<3||question.length>500)return
  const prior=messages
  setDraft('');setBusy(true);setError('')
  setMessages([...prior,{role:'user',content:question}])
  try{
   const history=prior.slice(-6).map(item=>({role:item.role,content:item.content.slice(0,800)}))
   const {data, error:invokeError}=await db.functions.invoke('support-ai',{
    body:{question,history,mode}
   })
   if(invokeError){
    let code='ai_unavailable'
    const context=(invokeError as {context?:unknown}).context
    if(context instanceof Response){
     try{const value=await context.json();if(typeof value?.error==='string')code=value.error}catch{}
    }
    throw Error(errors[code]||errors.ai_unavailable)
   }
   if(!data||typeof data.answer!=='string'||!data.answer.trim())throw Error(errors.ai_invalid_response)
   setMessages([...prior,{role:'user',content:question},{role:'assistant',content:data.answer.slice(0,1300),sources:Array.isArray(data.sources)?data.sources.filter((x:unknown)=>typeof x==='string').slice(0,2):[]}])
   void fetchMyPepUsage().then(setUsage).catch(()=>{})
  }catch(err){
   setMessages(prior)
   setDraft(question)
   setError(err instanceof Error?err.message:errors.ai_unavailable)
   void fetchMyPepUsage().then(setUsage).catch(()=>{})
  }finally{setBusy(false)}
 }
 const handleKey=(e:KeyboardEvent<HTMLTextAreaElement>)=>{
  if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){
   e.preventDefault()
   e.currentTarget.form?.requestSubmit()
  }
 }
 return <div className="stack payrep-help-page">
  <div className="page-intro"><div><h2>{mode==='help'?'Pep Ajuda':'Pergunte ao Pep'}</h2>
   <p>{mode==='help'?'Tire dúvidas sobre as funcionalidades e processos do Payrep.':'Consulte seus registros salariais com o Pep, conforme seu plano.'}</p></div>
   <button type="button" className="secondary" onClick={onBack}><ArrowLeft size={16}/> Voltar</button>
  </div>
  <section className="panel payrep-ai-shell" aria-label="Conversa com o Assistente Payrep">
   <div className="payrep-ai-toolbar"><div className="payrep-ai-identity"><span className="payrep-ai-video-avatar"><PepMascot variant="header" videoUrl={pepPreviewUrl} videoLoading={pepVideoLoading}/></span><div>
    <strong>{mode==='help'?'Pep · Ajuda':'Pep · Consulta pessoal'}</strong>
   </div></div>
   <div className="payrep-ai-header-actions">
    <button type="button" className="secondary" disabled={busy||messages.length===0}
     onClick={()=>{setMessages([]);setError('')}}><Trash2 size={15}/> Nova conversa</button>
   </div>
  </div>
   <div className="pep-usage-counter" role="status" aria-live="polite">
    {usageLoading?'Consultando sua franquia...':usage?.unlimited?'Consultas ilimitadas para administradores':
     usage?(mode==='help'
      ?'Pep Ajuda: '+usage.helpUsed+' de '+usage.helpLimit+' consultas utilizadas hoje'
      :usage.effectivePlan==='free'?'Disponível nos planos Basic e Full':
       'Pep '+(usage.effectivePlan==='full'?'Full':'Basic')+': '+usage.personalUsed+' de '+usage.personalLimit+' consultas utilizadas hoje')
      :'Não foi possível consultar a franquia neste momento.'}
   </div>
   <div className="payrep-ai-messages" role="log" aria-live="polite" aria-relevant="additions text">
    {messages.length===0&&<div className="payrep-ai-welcome"><Sparkles size={25}/><h3>Como posso ajudar?</h3>
      <p>{mode==='help'?'Posso explicar como usar o Payrep. Não consulto seus dados pessoais nesta área.':
     usage?.effectivePlan==='full'?'Posso consultar seus registros e resumos dos holerites importados.':
     'Posso consultar os dados e eventos registrados na sua conta, mas não os documentos PDF.'}</p>
    </div>}
    {messages.map((item,index)=><article key={index} className={'payrep-ai-bubble payrep-ai-bubble-'+item.role}>
      {item.role==='assistant'&&<span className="pep-chat-reply-avatar"><img src="/brand/pep-reply-avatar.webp" alt="Pep" width={54} height={54} decoding="async"/></span>}
      <div className="payrep-ai-bubble-content">
       <strong>{item.role==='user'?'Você':'Pep'}</strong><p>{item.content}</p>
       {item.sources&&item.sources.length>0&&<small className="payrep-ai-sources">Fonte: {item.sources.join(' · ')}</small>}
      </div>
     </article>)}
    {busy&&<div className="payrep-ai-thinking" role="status"><PepMascot variant="thinking"/><LoaderCircle size={16} className="payrep-ai-spin"/> Pep está analisando...</div>}
    <div ref={bottom}/>
   </div>
   <form className="payrep-ai-form" onSubmit={e=>void submit(e)}>
    {error&&<div className="notice danger" role="alert"><Info size={17}/>{error}</div>}
    <label htmlFor="payrep-ai-question">Sua pergunta</label>
    <textarea id="payrep-ai-question" rows={2} maxLength={500} value={draft} disabled={busy}
      onChange={e=>setDraft(e.target.value)} onKeyDown={handleKey}
      placeholder={mode==='help'?'Pergunte como usar o Payrep...':'Pergunte sobre seus dados salariais...'}/>
    <div className="payrep-ai-form-footer">
     <span>{mode==='help'?'Sem acesso aos seus dados financeiros. Não envie documentos ou credenciais.':
      'Respostas baseadas nos registros disponíveis. Não envie documentos completos ou credenciais.'}</span>
     <button className="primary" type="submit" disabled={busy||!db||draft.trim().length<3}>
      <Send size={16}/> Enviar
     </button>
    </div>
   </form>
  </section>
 </div>
}
