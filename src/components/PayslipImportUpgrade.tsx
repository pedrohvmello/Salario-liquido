import {ArrowRight,CalendarClock,CheckCircle2,FileCheck2,FileText,FolderLock,ScanText,ShieldCheck} from 'lucide-react'

/** Marketing for plans without payslip import entitlement. The import action stays gated in App. */
export function PayslipImportUpgrade({onSubscribe}:{onSubscribe:()=>void}){
 return <div className="ir-upgrade payslip-import-upgrade">
  <section className="ir-upgrade-hero" aria-labelledby="payslip-upgrade-title">
   <div className="ir-upgrade-copy">
    <span className="ir-upgrade-eyebrow"><FileCheck2 size={17}/> Importação inteligente de holerites · Full</span>
    <h2 id="payslip-upgrade-title">Seus holerites organizados. Seus dados trabalhando por você.</h2>
    <p>Importe seus PDFs, mantenha o histórico salarial centralizado e transforme informações reconhecidas nos documentos em registros para acompanhar sua remuneração.</p>
    <button type="button" className="primary ir-upgrade-cta" onClick={onSubscribe}>
     Conhecer o plano Full <ArrowRight size={18}/>
    </button>
    <small>A importação de holerites é exclusiva do plano Full. Consulte as condições da assinatura antes de contratar.</small>
   </div>
   <div className="ir-upgrade-art" aria-hidden="true">
    <div className="ir-upgrade-visual-document">
     <div className="ir-upgrade-visual-head"><FileText size={27}/><span>Holerite mensal</span></div>
     <div className="ir-upgrade-visual-year">Competência <strong>06/2026</strong></div>
     <i/><i/><i/><i className="short"/>
     <div className="ir-upgrade-visual-foot"><CheckCircle2 size={16}/> Documento organizado</div>
    </div>
    <span className="ir-upgrade-floating-icon"><ScanText size={28}/></span>
   </div>
  </section>
  <section className="ir-upgrade-benefits" aria-label="Benefícios de importar holerites">
   <div>
    <span className="ir-upgrade-benefit-icon"><FolderLock size={22}/></span>
    <h3>Documentos centralizados</h3>
    <p>Guarde holerites mensais, férias, 13º, PPR e folhas complementares em armazenamento privado. Visualize e baixe os PDFs quando precisar.</p>
   </div>
   <div>
    <span className="ir-upgrade-benefit-icon"><ScanText size={22}/></span>
    <h3>Leitura inteligente de PDFs</h3>
    <p>O Payrep identifica competências, rubricas e valores nos formatos de holerite suportados. Você revisa os dados antes de confirmar a importação.</p>
   </div>
   <div>
    <span className="ir-upgrade-benefit-icon"><CalendarClock size={22}/></span>
    <h3>Eventos automáticos</h3>
    <p>Alterações de remuneração reconhecidas podem gerar eventos e vigências vinculados ao documento, evitando o lançamento manual de cada mudança.</p>
   </div>
   <div>
    <span className="ir-upgrade-benefit-icon"><ShieldCheck size={22}/></span>
    <h3>Conciliação financeira</h3>
    <p>Compare adiantamentos, férias, 13º e pagamentos identificados, com controles para evitar contabilização duplicada e sinalizar valores a conferir.</p>
   </div>
  </section>
  <div className="ir-upgrade-footer">
   <div>
    <strong>Um histórico salarial mais fácil de consultar e conferir.</strong>
    <p>Seus documentos já existentes continuam acessíveis em Meus documentos. Os dados extraídos dependem da qualidade dos PDFs e devem ser conferidos.</p>
   </div>
   <button type="button" className="secondary" onClick={onSubscribe}>Ver planos e preços <ArrowRight size={16}/></button>
  </div>
 </div>
}
