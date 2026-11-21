import {Component,type ErrorInfo,type ReactNode} from 'react'

type Props={children:ReactNode;onReturn:()=>void}
type State={failed:boolean}
export class AppPageBoundary extends Component<Props,State>{
 state:State={failed:false}
 static getDerivedStateFromError():State{return {failed:true}}
 componentDidCatch(error:Error,info:ErrorInfo){
  // The fallback displays no salary data or internal error details.
  if(import.meta.env.DEV)console.error('Page render failed',error,info.componentStack)
 }
 render(){
  if(!this.state.failed)return this.props.children
  return <div className="page-body"><section className="panel" role="alert">
   <h2>Não foi possível exibir esta tela</h2>
   <p>Os dados da sua conta permanecem salvos. Atualize a página ou volte à Visão geral.</p>
   <div className="row"><button type="button" className="primary" onClick={()=>window.location.reload()}>Recarregar</button>
    <button type="button" className="secondary" onClick={()=>{this.setState({failed:false});this.props.onReturn()}}>Visão geral</button></div>
  </section></div>
 }
}
