import { STATUS_COR } from '../utils/format'

export default function StatusPill({ status }: { status: string }) {
  return (
    <span className="pill" style={{ background: '#fff', border: '1px solid var(--line)' }}>
      <span className="dot" style={{ background: STATUS_COR[status] ?? '#999' }} />
      {status}
    </span>
  )
}

export function SituacaoPill({ situacao }: { situacao: string }) {
  if (situacao === 'ativa') return <span className="pill ok">Em campo</span>
  if (situacao === 'futura') return <span className="pill blue">Programado</span>
  return <span className="pill">Encerrado</span>
}
