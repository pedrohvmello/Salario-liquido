import {useEffect,useState} from 'react'
import {PayrepSelect} from './PayrepSelect'
import {type BaseLocation,baseLabel,UF_LIST} from '../lib/base'
import {Info,MapPin,Save} from 'lucide-react'

type Municipality={id:number;nome:string}
export function BasePicker({current,onSave,busy}:{current:BaseLocation|null;onSave:(b:BaseLocation)=>void;busy:boolean}){
 const [uf,setUf]=useState(current?.uf||'SP')
 const [selected,setSelected]=useState(current?.ibge||'')
 const [municipalities,setMunicipalities]=useState<Municipality[]>([])
 const [status,setStatus]=useState<'loading'|'ready'|'failed'>('loading')
 useEffect(()=>{setUf(current?.uf||'SP');setSelected(current?.ibge||'')},[current?.uf,current?.ibge])
 useEffect(()=>{
  const abort=new AbortController()
  setStatus('loading')
  void fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados/'+uf+'/municipios?orderBy=nome',{signal:abort.signal})
   .then(r=>{if(!r.ok)throw Error('IBGE indisponível');return r.json() as Promise<unknown>})
   .then(data=>{
    if(!Array.isArray(data))throw Error('Lista inválida')
    const cities=(data as Municipality[]).filter(x=>Number.isInteger(x.id)&&typeof x.nome==='string')
    if(!cities.length)throw Error('Lista vazia')
    setMunicipalities(cities)
    setStatus('ready')
   }).catch(()=>{if(!abort.signal.aborted){setMunicipalities([]);setStatus('failed')}})
  return ()=>abort.abort()
 },[uf])
 const city=municipalities.find(c=>String(c.id)===selected)
 return <form className="form" onSubmit={e=>{e.preventDefault();if(city)onSave({city:city.nome,uf,ibge:String(city.id)})}}>
   <div className="detail-hint"><MapPin size={16}/>Base atual: <strong>{current?baseLabel(current):'Não configurada'}</strong>. Essa cidade define o calendário de feriados usado no controle de horas.</div>
   <div className="form-grid">
    <label>UF<PayrepSelect value={uf} onChange={next=>{setUf(next);setSelected('')}} title="Unidade federativa">{UF_LIST.map(x=><option key={x} value={x}>{x}</option>)}</PayrepSelect></label>
    <label>Base (cidade)<PayrepSelect required disabled={status!=='ready'} value={selected} onChange={setSelected} title="Base (cidade)">
      <option value="">{status==='loading'?'Carregando municípios...':status==='failed'?'Municípios indisponíveis':'Selecione sua cidade'}</option>
      {municipalities.map(x=><option key={x.id} value={x.id}>{x.nome}</option>)}
    </PayrepSelect></label>
   </div>
   {status==='failed'&&<p className="error" role="alert">Não foi possível consultar os municípios do IBGE. Tente novamente mais tarde. A Base atual foi preservada.</p>}
   <div className="detail-hint"><Info size={16}/>O catálogo considera feriados nacionais e estaduais. Feriados municipais são obtidos de dados locais quando disponíveis ou consultados externamente. Em caso de cobertura incompleta, haverá aviso e você poderá ajustar cada dia no ponto.</div>
   <button type="submit" className="primary" disabled={busy||status!=='ready'||!city}><Save size={17}/>Salvar Base</button>
  </form>
}
