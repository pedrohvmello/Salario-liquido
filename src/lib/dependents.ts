/** Extract distinct totals and IRRF tax dependents from Brazilian payslip headers.
 * Missing evidence remains null. Zero is used only when printed explicitly.
 */
export type DependentHeaderRow={
 text:string;y:number;items:Array<{text:string;x:number}>
}
export type DependentCounts={irrf:number|null;total:number|null}
const irLabel=/(?:\bdep\.\s*i\.?\s*r\.?(?:\s*r\.?\s*f\.?)?|\bdependentes?\s*(?:do?\s*|para\s*)?(?:i\.?\s*r\.?\s*r\.?\s*f\.?|imposto\s+de\s+renda))/i
const totalLabel=/(?:\bdep\.(?!\s*i\.?\s*r)|\bdependentes?(?!\s*(?:do?\s*|para\s*)?(?:i\.?\s*r|imposto\s+de\s+renda)))/i
const taxValue=/(?:\bdep\.\s*i\.?\s*r\.?(?:\s*r\.?\s*f\.?)?|\bdependentes?\s*(?:do?\s*|para\s*)?(?:i\.?\s*r\.?\s*r\.?\s*f\.?|imposto\s+de\s+renda))\s*[:=\-]?\s*(\d{1,2})(?!\d)/i
const totalValue=/(?:\bdep\.(?!\s*i\.?\s*r)|\bdependentes?(?!\s*(?:do?\s*|para\s*)?(?:i\.?\s*r|imposto\s+de\s+renda)))\s*[:=\-]?\s*(\d{1,2})(?!\d)/i
const valid=(v:string|undefined):number|null=>{
 if(v===undefined||!/^\d{1,2}$/.test(v))return null
 const n=Number(v)
 return n<=30?n:null
}
function adjacentValue(rows:DependentHeaderRow[],header:DependentHeaderRow,x:number):number|null{
 const found:Array<{number:number;distance:number}>=[]
 for(const row of rows){
  const dy=header.y-row.y
  if(dy < -2||dy>38)continue
  for(const item of row.items){
   const value=valid(item.text.trim())
   const dx=item.x-x
   if(value===null||dx < -12||dx>78)continue
   found.push({number:value,distance:Math.abs(dx)+Math.abs(dy)*1.2})
  }
 }
 found.sort((a,b)=>a.distance-b.distance)
 return found[0]?.number??null
}
export function readDependentCounts(rows:DependentHeaderRow[]):DependentCounts{
 const result:DependentCounts={irrf:null,total:null}
 for(const row of rows){
  if(result.irrf===null)result.irrf=valid(row.text.match(taxValue)?.[1])
  if(result.total===null)result.total=valid(row.text.match(totalValue)?.[1])
 }
 // Most modern statements print "Dep.IR" and "Dep." as separate columns,
 // with numbers on a separate row directly beneath the column header.
 for(const row of rows){
  for(const item of row.items){
   const label=item.text.trim()
   if(result.irrf===null&&irLabel.test(label))
    result.irrf=adjacentValue(rows,row,item.x)
   if(result.total===null&&totalLabel.test(label)&&!irLabel.test(label))
    result.total=adjacentValue(rows,row,item.x)
  }
 }
 // Some PDFs combine the final two labels into one text chunk while keeping
 // both values as separate chunks in the row below. This fallback is only
 // allowed when exactly two isolated counts appear to their right.
 if(result.irrf===null||result.total===null){
  const header=rows.find(r=>irLabel.test(r.text)&&totalLabel.test(r.text))
  if(header){
   const numeric=rows.filter(r=>header.y-r.y>1&&header.y-r.y<=38)
    .flatMap(r=>r.items.filter(i=>valid(i.text.trim())!==null))
    .sort((a,b)=>a.x-b.x)
   if(numeric.length===2&&numeric[1].x>numeric[0].x+12){
    if(result.irrf===null)result.irrf=valid(numeric[0].text.trim())
    if(result.total===null)result.total=valid(numeric[1].text.trim())
   }
  }
 }
 return result
}
