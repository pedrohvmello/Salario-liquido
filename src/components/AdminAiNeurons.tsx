import {useCallback,useEffect,useState} from 'react'
import {Activity,RefreshCw} from 'lucide-react'
import {fetchCloudflareNeurons,type CloudflareNeuronUsage} from '../lib/supportAiNeurons'

const fmt=(value:number)=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2}).format(value)
export function AdminAiNeurons(){
 const [usage,setUsage]=useState<CloudflareNeuronUsage|null>(null)
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')
 const refresh=useCallback(async()=>{
  setLoading(true);setError('')
  try{setUsage(await fetchCloudflareNeurons())}
  catch(e){setError(e instanceof Error?e.message:'Falha ao carregar Neurons.')}
  finally{setLoading(false)}
 },[])
 useEffect(()=>{void refresh()},[refresh])
 const used=usage?.status==='available'?usage.neuronsUsed:undefined
 const remaining=usage?.status==='available'?usage.neuronsRemaining:undefined
 return <section className="panel">
  <div className="panel-heading">
   <h2><Activity size={18}/> Consumo de Neurons (Cloudflare)</h2>
   <button type="button" className="secondary" onClick={()=>void refresh()} disabled={loading}>
    <RefreshCw size={15}/> {loading?'Consultando...':'Atualizar'}
   </button>
  </div>
  <p>Uso real informado pela Cloudflare para a conta inteira, incluindo outros aplicativos que utilizem esta conta. Período: hoje (UTC), reinício às 00:00 UTC.</p>
  {usage?.status==='available'&&typeof used==='number'&&typeof remaining==='number'&&<>
   <div className="payrep-neurons-kpis">
    <div><small>Neurons consumidos hoje</small><strong>{fmt(used)}</strong></div>
    <div><small>Franquia gratuita diária</small><strong>{fmt(usage.limit)}</strong></div>
    <div><small>Neurons restantes</small><strong>{fmt(remaining)}</strong></div>
   </div>
   <progress className="payrep-neurons-progress" aria-label="Consumo da franquia de Neurons"
    value={Math.min(used,usage.limit)} max={usage.limit}/>
   {usage.models&&usage.models.length>0&&<div className="payrep-neurons-models">
    <strong>Consumo por modelo</strong>
    {usage.models.map((item,index)=><div className="payrep-neurons-model" key={item.model+'-'+index}>
      <span>{item.model}</span><strong>{fmt(item.neurons)} Neurons</strong>
    </div>)}
   </div>}
   <p className="subtle">Última consulta: {usage.refreshedAt?new Date(usage.refreshedAt).toLocaleString('pt-BR'):'não disponível'}.
    Os dados do provedor podem apresentar atraso ou amostragem. Atualização em cache por até 10 minutos.</p>
  </>}
  {usage?.status==='not_configured'&&<div className="notice">
   <strong>Leitura de Neurons não configurada.</strong>
   <p>Adicione um token Cloudflare com permissão <strong>Account Analytics: Read</strong> no secret <code>CLOUDFLARE_AI_USAGE_API_TOKEN</code> do Supabase PRD.</p>
  </div>}
  {usage?.status==='unavailable'&&<div className="notice">
   <strong>Consumo da Cloudflare indisponível.</strong>
   <p>Confirme a permissão Account Analytics: Read do token e tente novamente. Nenhum valor é estimado.</p>
  </div>}
  {error&&<p className="error" role="alert">{error}</p>}
  <p className="subtle">Esta medição de Neurons é independente dos limites de mensagens definidos acima. No Workers Free, a Cloudflare não cobra excedentes: as chamadas são recusadas após a franquia gratuita.</p>
 </section>
}
