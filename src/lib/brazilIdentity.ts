/** CPF input and date-of-birth validation shared by the Payrep profile form. */
export const cpfDigits=(value:string)=>value.replace(/\D/g,'').slice(0,11)
export function isValidCpf(value:string):boolean{
 const cpf=cpfDigits(value)
 if(cpf.length!==11||/^(\d)\1{10}$/.test(cpf))return false
 const check=(count:number)=>{
  let sum=0
  for(let i=0;i<count;i++)sum+=Number(cpf[i])*(count+1-i)
  const result=(sum*10)%11
  return result===10?0:result
 }
 return check(9)===Number(cpf[9])&&check(10)===Number(cpf[10])
}
export function formatCpf(value:string):string{
 const d=cpfDigits(value)
 if(d.length<=3)return d
 if(d.length<=6)return d.slice(0,3)+'.'+d.slice(3)
 if(d.length<=9)return d.slice(0,3)+'.'+d.slice(3,6)+'.'+d.slice(6)
 return d.slice(0,3)+'.'+d.slice(3,6)+'.'+d.slice(6,9)+'-'+d.slice(9)
}
export function validBirthDate(value:string):boolean{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false
 const date=new Date(value+'T12:00:00.000Z')
 if(Number.isNaN(date.getTime())||date.toISOString().slice(0,10)!==value)return false
 return value>='1900-01-01'&&value<=new Date().toISOString().slice(0,10)
}
