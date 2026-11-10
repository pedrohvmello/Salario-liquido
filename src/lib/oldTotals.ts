/** Extract printed totals from legacy multi-page payslips.
 * Their amounts are often in different PDF text baselines from the captions,
 * despite appearing in the same visual line. Never reconstruct missing totals.
 */
export type OldPdfItem = {text:string;x:number;y:number}
export type OldPdfRow = {text:string;items:OldPdfItem[];y:number}
export type PrintedTotals={credits:number|null;debits:number|null;net:number|null}
const tokens=(s:string)=>s.match(/\d{1,3}(?:\.\d{3})*,\d{2}/g)||[]
const parse=(value:string)=>Number(value.replace(/\./g,'').replace(',','.'))
export function extractOldTotals(rows:OldPdfRow[]):PrintedTotals {
 const missing:PrintedTotals={credits:null,debits:null,net:null}
 const anchor=rows.find(row=>row.text.includes('Total de proventos:'))
 if(!anchor)return missing
 // First prefer a complete text row, as found in some PDF generators.
 const inRow=tokens(anchor.text)
 if(inRow.length===3){
  const [credits,debits,net]=inRow.map(parse)
  return {credits,debits,net}
 }
 // A different font size can move amounts several PDF units away vertically.
 // Collect only actual printed currency tokens near the caption and sort by X.
 const candidates=rows.flatMap(row=>row.items.flatMap(item=>
  Math.abs(item.y-anchor.y)<=9
   ?tokens(item.text).map(raw=>({x:item.x,value:parse(raw)}))
   :[]
 )).sort((a,b)=>a.x-b.x)
 if(candidates.length!==3)return missing
 return {credits:candidates[0].value,debits:candidates[1].value,net:candidates[2].value}
}
