import {ArrowRight,CalendarDays,CheckCircle2,FileCheck2,FileText,FolderLock,ScanText,ShieldCheck} from 'lucide-react'

/** Promotional view only when a Free user has no previously uploaded annual tax documents. */
export function IncomeTaxUpgrade({onSubscribe}:{onSubscribe:()=>void}){
 return <div className="ir-upgrade">
  <section className="ir-upgrade-hero" aria-labelledby="ir-upgrade-title">
   <div className="ir-upgrade-copy">
    <span className="ir-upgrade-eyebrow"><FileCheck2 size={17}/> Informe IR no Payrep</span>
    <h2 id="ir-upgrade-title">Seus informes de rendimentos, organizados em um só lugar.</h2>
    <p>Chega de procurar o PDF de cada ano. Importe o informe fornecido pela empresa, guarde seus documentos de forma privada e consulte os valores com mais facilidade.</p>
    <button type="button" className="primary ir-upgrade-cta" onClick={onSubscribe}>
     Conhecer os planos Basic e Full <ArrowRight size={18}/>
    </button>
    <small>Importação disponível nos planos Basic e Full. Consulte os preços e condições antes da contratação.</small>
   </div>
   <div className="ir-upgrade-art" aria-hidden="true">
    <div className="ir-upgrade-visual-document">
     <div className="ir-upgrade-visual-head"><FileText size={27}/><span>Informe de Rendimentos</span></div>
     <div className="ir-upgrade-visual-year">Ano-calendário <strong>2025</strong></div>
     <i/><i/><i/><i className="short"/>
     <div className="ir-upgrade-visual-foot"><CheckCircle2 size={16}/> Organizado por ano</div>
    </div>
    <span className="ir-upgrade-floating-icon"><FolderLock size={28}/></span>
   </div>
  </section>
  <section className="ir-upgrade-benefits" aria-label="Benefícios do Informe IR">
   <div><span className="ir-upgrade-benefit-icon"><FolderLock size={22}/></span>
    <h3>Documentos centralizados</h3><p>Seus informes anuais ficam reunidos na conta, com acesso por ano-calendário e opções para visualizar ou baixar o PDF.</p></div>
   <div><span className="ir-upgrade-benefit-icon"><ScanText size={22}/></span>
    <h3>Leitura inteligente do PDF</h3><p>O Payrep tenta identificar o ano e os valores do documento. Você confere e confirma os dados antes de utilizá-los como referência.</p></div>
   <div><span className="ir-upgrade-benefit-icon"><CalendarDays size={22}/></span>
    <h3>Histórico de vários anos</h3><p>Organize informes de diferentes exercícios e consulte seus rendimentos, deduções e imposto retido quando precisar.</p></div>
   <div><span className="ir-upgrade-benefit-icon"><ShieldCheck size={22}/></span>
    <h3>Conferência e privacidade</h3><p>PDFs armazenados em área privada, com comparação opcional aos holerites existentes. Os dados extraídos exigem conferência.</p></div>
  </section>
  <div className="ir-upgrade-footer">
   <div><strong>Comece seu arquivo anual de rendimentos.</strong>
    <p>O informe enviado pela empresa continua sendo a fonte que deve ser conferida. O Payrep organiza e facilita a consulta.</p></div>
   <button type="button" className="secondary" onClick={onSubscribe}>Ver planos e preços <ArrowRight size={16}/></button>
  </div>
 </div>
}
