import {useEffect,useState} from 'react'
import {ArrowLeft,Bot,LockKeyhole} from 'lucide-react'
import {SupportAiChat} from './SupportAiChat'
import {fetchMyPepUsage,type MyPepUsage} from '../lib/supportAiLimits'
import {db} from '../lib/data'
import {pepAssistantEnabled} from '../lib/environment'
export function PersonalPepPage({onBack,onSubscribe}:{onBack:()=>void;onSubscribe:()=>void}){
 const [usage,setUsage]=useState<MyPepUsage|null>(null)
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')
 const [pepVideoUrl,setPepVideoUrl]=useState<string|null>(null)
 const [pepVideoLoading,setPepVideoLoading]=useState(true)
 useEffect(()=>{
  // Match Pep Ajuda: both assistants use the published, shared MP4.
  let active=true
  if(!db||!pepAssistantEnabled){
   setPepVideoLoading(false)
   return
  }
  const url=db.storage.from('payrep-mascot').getPublicUrl('pep-chat-loop.mp4').data.publicUrl
  void fetch(url,{method:'HEAD',cache:'no-store'})
   .then(response=>{
    if(!active)return
    if(response.ok&&response.headers.get('content-type')?.toLowerCase().startsWith('video/'))
     setPepVideoUrl(url)
   })
   .catch(()=>{})
   .finally(()=>{if(active)setPepVideoLoading(false)})
  return ()=>{active=false}
 },[])
 useEffect(()=>{
  let active=true
  setLoading(true)
  void fetchMyPepUsage().then(value=>{if(active)setUsage(value)})
   .catch(e=>{if(active)setError(e instanceof Error?e.message:'Não foi possível verificar seu plano.')})
   .finally(()=>{if(active)setLoading(false)})
  return ()=>{active=false}
 },[])
 if(loading)return <div className="panel" role="status">Verificando seu plano para consultas com o Pep...</div>
 if(error)return <section className="panel"><h2>Pergunte ao Pep</h2><p className="error" role="alert">{error}</p>
  <button className="secondary" type="button" onClick={onBack}><ArrowLeft size={16}/> Voltar</button></section>
 if(!usage?.unlimited&&usage?.effectivePlan==='free')return <section className="panel">
  <div className="panel-heading"><h2><LockKeyhole size={18}/> Pergunte ao Pep</h2></div>
  <p>Consultas sobre seus dados salariais estão disponíveis nos planos Basic e Full. O Pep Ajuda continua gratuito para dúvidas sobre como usar o Payrep.</p>
  <div className="row"><button className="primary" type="button" onClick={onSubscribe}>
   <Bot size={16}/> Conhecer os planos</button>
   <button className="secondary" type="button" onClick={onBack}><ArrowLeft size={16}/> Voltar</button></div>
 </section>
 return <SupportAiChat mode="personal" onBack={onBack} pepPreviewUrl={pepVideoUrl} pepVideoLoading={pepVideoLoading}/>
}
