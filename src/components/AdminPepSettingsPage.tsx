import {ArrowLeft,Bot} from 'lucide-react'
import {AdminSupportAiLimits} from './AdminSupportAiLimits'
import {AdminAiNeurons} from './AdminAiNeurons'

/** Administrative home for Pep quota policy and Cloudflare account usage. */
export function AdminPepSettingsPage({onBack}:{onBack:()=>void}){
 return <div className="stack">
  <div className="page-intro">
   <div>
    <h2>Configurações do Pep</h2>
    <p>Controle as franquias de consultas e acompanhe o consumo de IA.</p>
   </div>
   <button type="button" className="secondary" onClick={onBack}>
    <ArrowLeft size={16}/> Voltar às configurações
   </button>
  </div>
  <AdminSupportAiLimits/>
  <AdminAiNeurons/>
  <p className="subtle"><Bot size={14} aria-hidden="true"/> Os limites do Pep são aplicados no servidor, independentemente da tela utilizada pelo usuário.</p>
 </div>
}
