import {useEffect,useRef,useState} from 'react'
import {ArrowLeft,Bot,CheckCircle2,FileText,LockKeyhole,Sparkles,Volume2,VolumeX} from 'lucide-react'
import {SupportAiChat} from './SupportAiChat'
import {PepBannerAnimation} from './PepBannerAnimation'
import {fetchMyPepUsage,type MyPepUsage} from '../lib/supportAiLimits'
import {db} from '../lib/data'
import {pepAssistantEnabled} from '../lib/environment'
export function PersonalPepPage({onBack,onSubscribe}:{onBack:()=>void;onSubscribe:()=>void}){
 const [usage,setUsage]=useState<MyPepUsage|null>(null)
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')
 const [pepVideoUrl,setPepVideoUrl]=useState<string|null>(null)
 const [pepVideoLoading,setPepVideoLoading]=useState(true)
 const marketingVideoRef=useRef<HTMLVideoElement|null>(null)
 const [marketingMuted,setMarketingMuted]=useState(true)
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
 if(!usage?.unlimited&&usage?.effectivePlan==='free')return <section className="panel pep-upgrade" aria-labelledby="pep-upgrade-title">
  <div className="pep-upgrade-hero">
   <div className="pep-upgrade-copy">
    <span className="pep-upgrade-eyebrow"><LockKeyhole size={15}/> Recurso dos planos pagos</span>
    <h2 id="pep-upgrade-title">Seu salário tem perguntas. O Pep pode ajudar nas respostas.</h2>
    <p>Vá além da projeção: consulte os dados cadastrados na sua conta, explore cenários e entenda melhor os componentes da sua remuneração, conforme o plano contratado.</p>
   </div>
   <div className="pep-upgrade-mascot-animated"><PepBannerAnimation/></div>
  </div>
  <div className="pep-upgrade-plans">
   <article className="pep-upgrade-plan">
    <div className="pep-upgrade-plan-head"><Sparkles size={21}/><div><h3>Basic</h3><p>Mais clareza para suas decisões</p></div></div>
    <ul>
     <li><CheckCircle2 size={17}/> Pergunte ao Pep sobre eventos e parâmetros salariais da sua conta</li>
     <li><CheckCircle2 size={17}/> Explore simulações de salário e descontos</li>
     <li><CheckCircle2 size={17}/> Salve e consulte suas conversas com o Pep</li>
    </ul>
   </article>
   <article className="pep-upgrade-plan pep-upgrade-plan-full">
    <div className="pep-upgrade-plan-head"><FileText size={21}/><div><h3>Full</h3><p>Seus holerites também entram na conversa</p></div></div>
    <ul>
     <li><CheckCircle2 size={17}/> Tudo o que está disponível no Basic</li>
     <li><CheckCircle2 size={17}/> Importação inteligente de holerites em PDF</li>
     <li><CheckCircle2 size={17}/> Perguntas ao Pep sobre os dados extraídos dos holerites</li>
    </ul>
   </article>
  </div>
  <section className="pep-upgrade-video-showcase" aria-labelledby="pep-upgrade-video-title">
   <div className="pep-upgrade-video-text"><span className="pep-upgrade-video-kicker">CONHEÇA O ASSISTENTE</span>
    <h3 id="pep-upgrade-video-title">Um minuto de atenção ao seu salário começa com 10 segundos de Pep.</h3>
    <p>Veja uma breve apresentação do assistente. As consultas aos seus dados pessoais dependem do plano e das informações disponíveis na sua conta.</p>
   </div>
   <div className="pep-upgrade-video-frame" aria-label="Vídeo de apresentação do Pep">
    <video ref={marketingVideoRef} src="/media/pep-apresentacao.mp4" poster="/media/pep-apresentacao-poster.webp"
     autoPlay loop muted playsInline preload="auto" disablePictureInPicture disableRemotePlayback
     controlsList="nodownload noplaybackrate noremoteplayback"
     onContextMenu={event=>event.preventDefault()}
     aria-label="Apresentação do Pep em reprodução automática" width={960} height={540}
     tabIndex={-1}>
     Seu navegador não suporta reprodução de vídeo.
    </video>
    <button type="button" className="pep-upgrade-audio-button" aria-label={marketingMuted?'Ativar áudio da apresentação':'Desativar áudio da apresentação'}
     aria-pressed={!marketingMuted} title={marketingMuted?'Ativar áudio':'Desativar áudio'} onClick={()=>{
      const player=marketingVideoRef.current
      if(!player)return
      player.muted=!player.muted
      setMarketingMuted(player.muted)
     }}>
     {marketingMuted?<VolumeX size={19}/>:<Volume2 size={19}/>}
    </button>
   </div>
  </section>
  <div className="pep-upgrade-footer">
   <div><strong>Escolha o nível de análise ideal para você.</strong><p>Confira preços, condições e disponibilidade atual dos planos antes de contratar.</p></div>
   <button className="primary pep-upgrade-cta" type="button" onClick={onSubscribe}><Bot size={18}/> Ver planos e preços</button>
  </div>
  <p className="pep-upgrade-note">O Pep Ajuda continua gratuito na Central de Ajuda para dúvidas de uso. As respostas pessoais do Pep são auxiliares e devem ser conferidas com seus documentos.</p>
 </section>
 return <SupportAiChat mode="personal" onBack={onBack} pepPreviewUrl={pepVideoUrl} pepVideoLoading={pepVideoLoading}/>
}
