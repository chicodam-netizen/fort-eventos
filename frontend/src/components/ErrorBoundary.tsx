import { Component, type ErrorInfo, type ReactNode } from 'react'

export class ErrorBoundary extends Component<{ children: ReactNode }, { erro: Error | null }> {
  state = { erro: null as Error | null }

  static getDerivedStateFromError(erro: Error) {
    return { erro }
  }

  componentDidCatch(erro: Error, info: ErrorInfo) {
    console.error(erro, info)
  }

  render() {
    if (this.state.erro) {
      return (
        <div style={{ padding: 40, maxWidth: 640, margin: '0 auto' }}>
          <h1>Algo deu errado</h1>
          <p className="sub">Recarregue a página. Se o problema continuar, avise o suporte com a mensagem abaixo.</p>
          <pre className="card mono small" style={{ whiteSpace: 'pre-wrap', marginTop: 16 }}>{this.state.erro.message}</pre>
          <button className="btn pri" style={{ marginTop: 16 }} onClick={() => location.reload()}>Recarregar</button>
        </div>
      )
    }
    return this.props.children
  }
}
