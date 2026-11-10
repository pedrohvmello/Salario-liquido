/** Extract date range from the legacy employer's dedicated "Folha: FERIAS" header. */
export type VacationPdfRow={text:string;items:Array<{text:string;x:number;y:number}>;y:number}
const dateBR=(input:string):string|null=>{
 const match=input.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
 if(!match)return null
 const value=match[3]+'-'+match[2]+'-'+match[1]
 const date=new Date(value+'T12:00:00Z')
 return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value?value:null
}
export function isVacationPayslip(rows:readonly VacationPdfRow[]):boolean{
 const index=rows.findIndex(row=>row.items.some(i=>i.text.trim()==='Folha:'&&i.x<120))
 return index>=0&&(rows[index+1]?.items||[]).some(i=>i.text.trim().toUpperCase()==='FERIAS'&&i.x<120)
}
export function vacationPeriodFromHeader(rows:readonly VacationPdfRow[]):{start:string|null;end:string|null}{
 if(!isVacationPayslip(rows))return {start:null,end:null}
 const text=rows.slice(0,14).map(x=>x.text).join(' ')
 const period=text.match(/(\d{2}\/\d{2}\/\d{4})\s+a\s+(\d{2}\/\d{2}\/\d{4})/)
 const start=period?dateBR(period[1]):null
 const end=period?dateBR(period[2]):null
 return {start,end}
}
