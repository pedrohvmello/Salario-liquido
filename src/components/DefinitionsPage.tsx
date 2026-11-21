import {useState} from 'react'
import {ArrowLeft,Clock3,MapPin,Settings2} from 'lucide-react'
import {BasePicker} from './BasePicker'
import type {BaseLocation} from '../lib/base'
import {baseLabel} from '../lib/base'
import type {WorkRegime} from '../lib/workRegime'

type DefinitionScreen='base'|'regime'|null

type Props={
 base:BaseLocation|null
 busy:boolean
 workRegime:WorkRegime
 onSaveBase:(base:BaseLocation)=>void
 onSaveRegime:(regime:WorkRegime)=>void
}

/** Same navigation pattern as AdminSettingsPage. No accordion / fieldset-wide CSS inheritance. */
export function DefinitionsPage({base,busy,workRegime,onSaveBase,onSaveRegime}:Props){
 const [activeScreen,setActiveScreen]=useState<DefinitionScreen>(null)
 if(activeScreen!==null)return <div className="stack payrep-definitions">
  <div><button type="button" className="secondary" onClick={()=>setActiveScreen(null)}>
   <ArrowLeft size={16}/> Voltar para Definições
  </button></div>
  {activeScreen==='base'&&<section className="panel">
   <div className="panel-heading"><h2><MapPin size={18}/> Configure sua Base</h2></div>
   <p>Selecione seu estado e município para definir o calendário utilizado na identificação de feriados e nos cálculos de jornada aplicáveis.</p>
   <BasePicker current={base} busy={busy} onSave={onSaveBase}/>
  </section>}
  {activeScreen==='regime'&&<section className="panel">
   <div className="panel-heading"><h2><Clock3 size={18}/> Regime de Jornada</h2></div>
   <p className="payrep-regime-intro">Escolha como o Payrep deve acompanhar suas horas. A opção padrão é Jornada regular.</p>
   <div className="payrep-regime-choices" role="radiogroup" aria-label="Selecione o Regime de Jornada">
    <label className={'payrep-regime-choice'+(workRegime==='regular'?' is-selected':'')}>
     <input type="radio" name="work-regime" value="regular" checked={workRegime==='regular'} disabled={busy}
      onChange={()=>{if(workRegime!=='regular')onSaveRegime('regular')}}/>
     <span className="payrep-regime-choice-copy">
      <strong>Jornada regular (com controle de horas)</strong>
      <small>Horas extras, banco de horas e seus saldos seguem as regras aplicáveis.</small>
     </span>
    </label>
    <label className={'payrep-regime-choice'+(workRegime==='trust'?' is-selected':'')}>
     <input type="radio" name="work-regime" value="trust" checked={workRegime==='trust'} disabled={busy}
      onChange={()=>{if(workRegime!=='trust')onSaveRegime('trust')}}/>
     <span className="payrep-regime-choice-copy">
      <strong>Cargo de confiança (sem controle de jornada)</strong>
      <small>Desativa horas extras e novos cálculos do banco, mas mantém os horários e o saldo informativo.</small>
     </span>
    </label>
   </div>
   <p className="payrep-regime-footnote">A seleção é salva automaticamente. Os registros históricos permanecem armazenados e o Saldo de Horas continua disponível. No modo Cargo de confiança, ele é informativo e não representa saldo do banco de horas.</p>
   <p className="subtle">Essa configuração não determina o enquadramento jurídico do seu vínculo de trabalho.</p>
  </section>}
 </div>
 return <div className="stack payrep-definitions">
  <div className="page-intro"><div><h2>Definições</h2><p>Personalize sua Base e as regras de acompanhamento de jornada.</p></div></div>
  <section className="panel">
   <div className="panel-heading"><h2><MapPin size={18}/> Configure sua Base</h2></div>
   <p>Defina a cidade usada para consultar feriados e calcular as horas trabalhadas. {base?'Base atual: '+baseLabel(base)+'.':'A Base ainda não foi configurada.'}</p>
   <button type="button" className="primary" onClick={()=>setActiveScreen('base')}><MapPin size={17}/> Configurar Base</button>
  </section>
  <section className="panel">
   <div className="panel-heading"><h2><Clock3 size={18}/> Regime de Jornada</h2></div>
   <p>Escolha entre jornada regular e cargo de confiança. O ajuste controla as horas extras e o banco de horas sem apagar seus registros.</p>
   <p className="subtle payrep-regime-current"><Settings2 size={15}/> Regime atual: {workRegime==='regular'?'Jornada regular':'Cargo de confiança'}</p>
   <button type="button" className="primary" onClick={()=>setActiveScreen('regime')}><Clock3 size={17}/> Configurar Regime de Jornada</button>
  </section>
 </div>
}
