import type {PayrepSupportQuestion} from '../../supabase/functions/support-ai/knowledge'

/** Browser-local search over published FAQ text. Does not send search input to a service. */
export function normalizeFaqText(value:string):string{
 return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ')
}
export function searchPayrepFaq(items:readonly PayrepSupportQuestion[],query:string):PayrepSupportQuestion[]{
 const terms=[...new Set(normalizeFaqText(query).split(' ').filter(Boolean))]
 if(terms.length===0)return []
 return items.map((item,index)=>{
  const title=normalizeFaqText(item.question),category=normalizeFaqText(item.category),body=normalizeFaqText(item.answer)
  return {item,index,match:terms.every(term=>title.includes(term)||category.includes(term)||body.includes(term)),
   score:terms.reduce((n,term)=>n+(title.includes(term)?4:0)+(category.includes(term)?2:0)+(body.includes(term)?1:0),0)}
 }).filter(x=>x.match).sort((a,b)=>b.score-a.score||a.index-b.index).map(x=>x.item)
}
