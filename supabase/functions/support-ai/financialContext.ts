// Privacy-minimizing, deterministic facts for Payrep's HML AI support.
// Never pass raw PDFs, names, filenames, storage keys, user IDs, notes or arbitrary rubric descriptions to an LLM.
export type FinancialStatement={
 id:string;period:string;document_type:string;credits:number|null;debits:number|null;net:number|null;
 net_received:number|null;salary_advance:number|null;ir_base:number|null;fgts:number|null;
 salary_contract:number|null;trienio:number|null;gross_ppr:number|null;ppr_income_tax:number|null;
 thirteenth_gross:number|null;thirteenth_irrf:number|null;thirteenth_inss:number|null;
 thirteenth_pension:number|null;thirteenth_advance:number|null;payment_date:string|null;
};
export type Rubric={statement_id:string;side:string;description:string;code:string;amount:number};
export type FinancialEvent={kind:string;effective_date:string;value:number};
export type FinancialContext={facts:string;sourceLabels:string[]};
export const round2=(v:number)=>Math.round((v+Number.EPSILON)*100)/100;
const monthAliases:Record<string,number>={jan:1,janeiro:1,fev:2,fevereiro:2,mar:3,marco:3,março:3,abr:4,abril:4,mai:5,maio:5,jun:6,junho:6,jul:7,julho:7,ago:8,agosto:8,set:9,setembro:9,out:10,outubro:10,nov:11,novembro:11,dez:12,dezembro:12};
const money=(v:unknown):number|null=>typeof v==='number'&&Number.isFinite(v)?round2(v):null;
export function financialTopic(question:string,history:readonly {role:string;content:string}[]=[]):boolean{
 const q=question.toLowerCase();
 const procedural=/\bcomo\s+(?:faço|faco|posso|devo|funciona|importo|importar|carrego|cadastrar|cadastro|configuro|configurar|acessar|abro|abrir|usar)\b/.test(q);
 const personal=/\b(meu|minha|meus|minhas|recebi|recebido|paguei|descontaram|descontado|diferença|diferenca|comparar|comparação|comparacao|valor|valores|quanto|quantos|qual foi|por que|porque|mês passado|mes passado|último|ultimo|anterior|acumulado|histórico de|historico de)\b/.test(q);
 const numeric=/\b(20\d{2}[-/](?:0?[1-9]|1[0-2])|(?:0?[1-9]|1[0-2])\/20\d{2})\b/.test(q);
 const specific=/\b(inss|irrf|fgts|pens[aã]o|previd[êe]ncia|descontos|sal[aá]rio|l[ií]quido|bruto|rubrica|holerites?|contracheque|ppr|plr|f[eé]rias|13[ºo]?|eventos|tri[êe]nio|imposto|base de c[aá]lculo|informe)\b/.test(q);
 if(procedural&&!numeric&&!/(quanto|valor|diferen[cç]a|desconto|inss|irrf|compar)/.test(q))return false;
 if(specific&&(personal||numeric||/\b(inss|irrf|fgts)\b/.test(q)))return true;
 if(personal&&/(?:minha|meu|quanto|valor|recebi|diferença|desconto|último)/.test(q))return true;
 const last=history.slice(-2).some(h=>h.role==='user'&&/(meu|minha|inss|irrf|holerite|salário|salario|valor|ppr|férias|ferias)/i.test(h.content));
 return last&&(/^(e |nesse|neste|no |na |por que|porque|quanto|qual)/i.test(q));
}
export function requestedPeriod(question:string):string|null{
 const iso=/\b(20\d{2})[-/](0?[1-9]|1[0-2])\b/.exec(question);
 if(iso)return iso[1]+'-'+iso[2].padStart(2,'0');
 const br=/\b(0?[1-9]|1[0-2])\/(20\d{2})\b/.exec(question);
 if(br)return br[2]+'-'+br[1].padStart(2,'0');
 const word=/\b(jan(?:eiro)?|fev(?:ereiro)?|mar(?:ço|co)?|abr(?:il)?|mai(?:o)?|jun(?:ho)?|jul(?:ho)?|ago(?:sto)?|set(?:embro)?|out(?:ubro)?|nov(?:embro)?|dez(?:embro)?)\s+(?:de\s+)?(20\d{2})\b/i.exec(question);
 if(word){
  const index=monthAliases[word[1].toLowerCase()];
  return index?word[2]+'-'+String(index).padStart(2,'0'):null;
 }
 return null;
}
export function requestedYear(question:string):number|null{
 const m=/\b(20\d{2})\b/.exec(question);
 return m?Number(m[1]):null;
}
export function documentKind(question:string):string{
 const q=question.toLowerCase();
 if(/\b(ppr|plr|participa[cç][aã]o nos resultados)\b/.test(q))return 'ppr';
 if(/\b(13[ºo]?|d[eé]cimo terceiro)\b/.test(q))return 'thirteenth';
 if(/\bf[eé]rias\b/.test(q))return 'vacation';
 return 'monthly';
}
const sensitivePatterns=/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}|https?:\/\/|\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/i;
export function rubricCategory(description:string,code:string):string{
 const d=String(description||'').toLocaleLowerCase('pt-BR');
 const c=String(code||'').toLowerCase();
 // Never surface untrusted descriptions or codes, only a fixed classification.
 if(sensitivePatterns.test(d)||d.length>150)return 'Outras rubricas';
 if(/\b(inss|previd[êe]ncia oficial)\b/.test(d))return 'INSS';
 if(/\b(irrf|imp(?:osto)?\s+(?:de\s+)?renda|i\.r\.r\.f)\b/.test(d))return 'IRRF';
 if(/\bpens[aã]o\b/.test(d))return 'Pensão';
 if(/\bespp\b|\ba[cç][oõ]es\b/.test(d))return 'ESPP';
 if(/\bprevid[êe]ncia\b/.test(d))return 'Previdência privada';
 if(/\bfgts\b/.test(d))return 'FGTS';
 if(/\btri[êe]nio\b/.test(d))return 'Triênio';
 if(/\badiantamento\b|\bantecipac[aã]o\b/.test(d))return 'Adiantamento';
 if(/\bf[eé]rias\b/.test(d))return 'Férias';
 if(/\b13[ºo]\b|\bd[eé]cimo\b/.test(d))return '13º salário';
 if(/\bppr\b|\bplr\b/.test(d))return 'PPR/PLR';
 if(/\bhoras?\s+extras?\b|\bextra\s+\d+%/.test(d))return 'Horas extras';
 if(/\bval[ei]\s+(?:refei[cç][aã]o|alimentac[aã]o)\b/.test(d))return 'Vale-refeição/alimentação';
 if(/\bsal[aá]rio\b|\bvencimento\b/.test(d))return 'Salário';
 // Do not trust arbitrary user-provided descriptions as LLM instructions.
 void c;
 return 'Outras rubricas';
}
const allowedEventKinds=new Set(['salary','trienio','dependents','mealBenefit','fixedBenefit','childcareBenefit','esppPercent','privatePensionPercent','pensionPercent','fixedPension','advancePercent','vacation','ppr','thirteenth']);
export function sanitizeEvents(rows:FinancialEvent[],period:string):Array<{tipo:string;vigencia:string;valor:number}>{
 return rows.filter(x=>allowedEventKinds.has(x.kind)&&/^\d{4}-\d\d-\d\d$/.test(x.effective_date)&&x.effective_date.slice(0,7)<=period&&money(x.value)!==null)
  .sort((a,b)=>b.effective_date.localeCompare(a.effective_date))
  .slice(0,12).map(e=>({tipo:e.kind,vigencia:e.effective_date,valor:round2(e.value)}));
}
const configuredFields=new Set(['salary','trienio','dependents','mealBenefit','fixedBenefit','childcareBenefit','esppPercent','privatePensionPercent','pensionPercent','fixedPension','advancePercent']);
export function sanitizeSettings(raw:unknown):Record<string,number>{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return {};
 const data=raw as Record<string,unknown>,values:Record<string,number>={};
 for(const key of configuredFields){const n=money(data[key]);if(n!==null)values[key]=n}
 return values;
}
function compactStatement(s:FinancialStatement){
 return {
  competencia:s.period,tipo:s.document_type,
  bruto_creditos:money(s.credits),total_descontos:money(s.debits),
  liquido_fechamento:money(s.net),liquido_recebido_no_documento:money(s.net_received),
  adiantamento:money(s.salary_advance),base_ir:money(s.ir_base),fgts:money(s.fgts),
  salario_contratual:money(s.salary_contract),trienio:money(s.trienio),
  ppr_bruto:money(s.gross_ppr),ppr_irrf:money(s.ppr_income_tax),
  decimo_terceiro_bruto:money(s.thirteenth_gross),decimo_terceiro_irrf:money(s.thirteenth_irrf),
  decimo_terceiro_inss:money(s.thirteenth_inss),decimo_terceiro_pensao:money(s.thirteenth_pension),
  decimo_terceiro_adiantamento:money(s.thirteenth_advance)
 };
}
export function selectFinancialStatements(question:string,all:FinancialStatement[],history:readonly {role:string;content:string}[]=[]):FinancialStatement[]{
 const period=requestedPeriod(question)||requestedPeriod(history.filter(x=>x.role==='user').at(-1)?.content||'');
 const kind=documentKind(question);
 const matching=all.filter(s=>s.document_type===kind).sort((a,b)=>b.period.localeCompare(a.period));
 const yearOnly=!period?requestedYear(question):null;
 const first=period?matching.find(s=>s.period===period):
  yearOnly?matching.find(s=>s.period.startsWith(String(yearOnly))):matching[0];
 if(!first)return [];
 const comparison=/diferen[cç]a|compar|evolu[cç][aã]o|m[eê]s anterior/i.test(question);
 const previous=comparison?matching.find(s=>s.period<first.period):null;
 return [first,...(previous?[previous]:[])];
}
export function buildFinancialContext(args:{
 question:string;statements:FinancialStatement[];rubrics:Rubric[];
 events:FinancialEvent[];settings:unknown;history?:{role:string;content:string}[];
}):FinancialContext{
 const {question,history=[]}=args;
 const period=requestedPeriod(question)||requestedPeriod(history.filter(x=>x.role==='user').at(-1)?.content||'');
 const year=requestedYear(question);
 const kind=documentKind(question);
 const ordered=args.statements.filter(s=>/^\d{4}-(0[1-9]|1[0-2])$/.test(s.period))
  .sort((a,b)=>b.period.localeCompare(a.period));
 const kindRows=ordered.filter(s=>s.document_type===kind);
 const selected=selectFinancialStatements(question,ordered,history);
 const reference=selected[0];
 const previous=selected[1];
 const picked=reference?[reference]:[];
 const idSet=new Set(selected.map(s=>s.id));
 const categoryTotals=new Map<string,number>();
 const rubricRows=args.rubrics.filter(r=>idSet.has(r.statement_id));
 const breakdown=selected.map(s=>{
  categoryTotals.clear();
  for(const r of rubricRows.filter(r=>r.statement_id===s.id)){
   const category=rubricCategory(r.description,r.code);
   const label=category+' / '+(String(r.side||'').slice(0,24).replace(/[^a-z]/gi,'').toLowerCase()||'lado_desconhecido');
   const amount=money(r.amount);
   if(amount===null)continue;
   categoryTotals.set(label,round2((categoryTotals.get(label)||0)+amount));
  }
  return {competencia:s.period,rubricas:[...categoryTotals].map(([categoria_lado,valor])=>({categoria_lado,valor})).slice(0,28)};
 });
 const sourceLabels=selected.map(s=>'Holerite '+s.period+' ('+s.document_type+')');
 const annual=year&&/(anual|ano|informe|rendimentos|acumulado|total de 20\d{2})/i.test(question);
 const annualRows=annual?ordered.filter(s=>(s.document_type==='ppr'||s.document_type==='thirteenth')
  ?String(s.payment_date||'').startsWith(String(year)):s.period.startsWith(String(year))):[];
 const yearly=annual?{
  ano:year,documentos:annualRows.length,mensais:annualRows.filter(s=>s.document_type==='monthly').length,
  creditos_mensais_indicativos:round2(annualRows.filter(s=>s.document_type==='monthly').reduce((a,s)=>a+(money(s.credits)||0),0)),
  fechamento_liquido_mensal_indicativo:round2(annualRows.filter(s=>s.document_type==='monthly').reduce((a,s)=>a+(money(s.net)||0),0)),
  ppr_bruto:round2(annualRows.filter(s=>s.document_type==='ppr').reduce((a,s)=>a+(money(s.gross_ppr)||0),0)),
  ppr_irrf:round2(annualRows.filter(s=>s.document_type==='ppr').reduce((a,s)=>a+(money(s.ppr_income_tax)||0),0)),
  observacao:'Totais por competência, não representam necessariamente rendimentos tributáveis do informe oficial.'
 }:null;
 const latestPeriod=reference?.period||period||(ordered[0]?.period??'');
 const eventQuestion=/evento|vig[êe]ncia|proje[cç][aã]o|previs[aã]o|sal[aá]rio|pens[aã]o|previd[êe]ncia|espp|tri[êe]nio/i.test(question);
 const data={
  tipo:'resumo_financeiro_autorizado',
  cobertura:{total_documentos_consultaveis:ordered.length,documentos_limitados_a_120:ordered.length===120},
  criterio:{tipo_documento:kind,competencia_solicitada:period||null,competencia_utilizada:reference?.period||null,
   sem_documento_para_competencia:period!==null&&picked.length===0,sem_documentos_do_tipo:kindRows.length===0},
  documentos:selected.map(compactStatement),
  rubricas_agrupadas:breakdown,
  diferenca_mensal_comparada:previous&&reference?{
   referencia:reference.period,comparacao:previous.period,
   delta_liquido_fechamento:money(reference.net)!==null&&money(previous.net)!==null?round2(reference.net!-previous.net!):null,
   delta_creditos:money(reference.credits)!==null&&money(previous.credits)!==null?round2(reference.credits!-previous.credits!):null,
   delta_descontos:money(reference.debits)!==null&&money(previous.debits)!==null?round2(reference.debits!-previous.debits!):null
  }:null,
  resumo_anual_indicativo:yearly,
  eventos_relevantes:eventQuestion?sanitizeEvents(args.events,latestPeriod):[],
  parametros_configurados:eventQuestion?sanitizeSettings(args.settings):{}
 };
 return {facts:JSON.stringify(data),sourceLabels};
}
