import {useEffect,useRef,useState,type FormEvent, type KeyboardEvent} from 'react'
import {ArrowLeft,Info,LoaderCircle,Send,Sparkles,Trash2} from 'lucide-react'
import {db} from '../lib/data'
import {PepMascot} from './PepMascot'

type ChatMessage={role:'user'|'assistant';content:string;sources?:string[]}
const errors:Record<string,string>={
 authentication_required:'Sua sessão expirou. Faça login novamente.',
 account_not_authorized:'Este recurso está disponível apenas para contas aprovadas.',
 daily_limit:'O limite gratuito de perguntas foi atingido por hoje. Tente novamente amanhã.',
 ai_free_limit:'A cota gratuita do modelo foi esgotada. Tente novamente mais tarde.',
 ai_not_configured:'A integração com IA ainda não está pronta neste ambiente.',
 quota_unavailable:'Não foi possível validar o limite de uso. Tente novamente.',
 ai_unavailable:'A IA está temporariamente indisponível. Tente novamente.',
 ai_invalid_response:'Não foi possível interpretar a resposta. Tente novamente.',
 financial_data_unavailable:'Não foi possível consultar seus dados com segurança. Verifique sua sessão e tente novamente.',
}
export function SupportAiChat({onBack,pepPreviewUrl}:{onBack:()=>void;pepPreviewUrl?:string|null}){
 const [messages,setMessages]=useState<ChatMessage[]>([])
 const [draft,setDraft]=useState('')
 const [busy,setBusy]=useState(false)
 const [useFinancialData,setUseFinancialData]=useState(false)
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
    body:{question,history,useFinancialData}
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
  }catch(err){
   setMessages(prior)
   setDraft(question)
   setError(err instanceof Error?err.message:errors.ai_unavailable)
  }finally{setBusy(false)}
 }
 const handleKey=(e:KeyboardEvent<HTMLTextAreaElement>)=>{
  if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){
   e.preventDefault()
   e.currentTarget.form?.requestSubmit()
  }
 }
 return <div className="stack payrep-help-page">
  <div className="page-intro"><div><h2>Assistente Payrep</h2><p>Tire dúvidas sobre as funcionalidades e os processos do aplicativo.</p></div>
   <button type="button" className="secondary" onClick={onBack}><ArrowLeft size={16}/> Voltar à Ajuda</button>
  </div>
  <section className="panel payrep-ai-shell" aria-label="Conversa com o Assistente Payrep">
   <div className="payrep-ai-toolbar"><div className="payrep-ai-identity"><span className="payrep-ai-video-avatar"><PepMascot variant="header" videoUrl={pepPreviewUrl}/></span><div>
    <strong>Pep · Assistente Payrep</strong><small>Respostas curtas sobre o uso do aplicativo</small>
   </div></div>
   <div className="payrep-ai-header-actions">
    <button type="button" className="secondary" disabled={busy||messages.length===0}
     onClick={()=>{setMessages([]);setUseFinancialData(false);setError('')}}><Trash2 size={15}/> Nova conversa</button>
   </div>
  </div>
   <div className="payrep-ai-consent">
    <label className="payrep-ai-consent-label">
     <input type="checkbox" checked={useFinancialData} disabled={busy}
      onChange={e=>{setUseFinancialData(e.target.checked);setMessages([]);setError('')}}/>
     <span><strong>Permitir consultas aos meus dados salariais</strong>
      <small>Somente nesta conversa. A IA poderá consultar resumos de holerites, rubricas, eventos e configurações da sua conta.</small>
     </span>
    </label>
    <p>Seus PDFs completos, arquivos originais, nomes e dados de identificação não serão enviados ao modelo. Os valores relevantes e a pergunta serão processados pela Cloudflare. Desmarcar apaga a conversa da tela.</p>
   </div>
   <div className="payrep-ai-messages" role="log" aria-live="polite" aria-relevant="additions text">
    {messages.length===0&&<div className="payrep-ai-welcome"><Sparkles size={25}/><h3>Como posso ajudar?</h3>
      <p>Escreva sua pergunta livremente. Posso orientar sobre processos e, com sua autorização, explicar os valores importados no Payrep.</p>
    </div>}
    {messages.map((item,index)=><article key={index} className={'payrep-ai-bubble payrep-ai-bubble-'+item.role}>
      {item.role==='assistant'&&<span className="pep-chat-reply-avatar"><PepMascot variant="avatar"/></span>}
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
      placeholder="Digite sua dúvida sobre o Payrep..."/>
    <div className="payrep-ai-form-footer">
     <span>{useFinancialData?'Consulta autorizada apenas para esta conversa. Não envie documentos completos ou credenciais.':'Sem acesso aos seus valores até você autorizar acima. Não envie documentos completos ou credenciais.'}</span>
     <button className="primary" type="submit" disabled={busy||!db||draft.trim().length<3}>
      <Send size={16}/> Enviar
     </button>
    </div>
   </form>
  </section>
 </div>
}
