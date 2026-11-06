import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { History, Pencil, Plus } from 'lucide-react'
import { apiFuncoes, apiOpcoes, apiPrestadores, type Prestador } from '../api'
import Modal from '../components/Modal'
import { SituacaoPill } from '../components/StatusPill'
import { useToast } from '../components/Toast'
import { useAuth } from '../context/AuthContext'
import { brl, dataHora, erroMsg, FORMA_LABEL } from '../utils/format'

const VAZIO: Partial<Prestador> = { nome: '', tipo_vinculo: 'Diarista', forma_custo: 'diaria', valor_custo: 0, status: 'Ativo' }

function PrestadorModal({ prestador, onClose, onSalvo }: { prestador?: Prestador; onClose: () => void; onSalvo: () => void }) {
  const { data: opcoes } = useQuery({ queryKey: ['opcoes'], queryFn: apiOpcoes, staleTime: Infinity })
  const { data: funcoes = [] } = useQuery({ queryKey: ['funcoes'], queryFn: apiFuncoes.listar })
  const [f, setF] = useState<Partial<Prestador>>(prestador ?? VAZIO)
  const [valor, setValor] = useState(String(prestador?.valor_custo ?? ''))
  const [erro, setErro] = useState('')
  const set = (k: keyof Prestador) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value || null }))

  function mudarFuncao(id: string) {
    const fn = funcoes.find((x) => x.id === id)
    setF((x) => ({ ...x, funcao_id: id || null }))
    if (fn && (!valor || valor === '0') && f.forma_custo === 'diaria') setValor(String(fn.valor_diaria_ref))
  }

  async function salvar() {
    if (!f.nome?.trim()) return setErro('Informe o nome.')
    const body = { ...f, valor_custo: Number(valor.replace(',', '.') || 0) }
    delete body.funcao_nome
    delete body.alocado_agora
    delete body.id
    try {
      if (prestador) await apiPrestadores.atualizar(prestador.id, body)
      else await apiPrestadores.criar(body)
      onSalvo()
    } catch (e) {
      setErro(erroMsg(e))
    }
  }

  return (
    <Modal wide titulo={prestador ? `Editar · ${prestador.nome}` : 'Novo prestador'} onClose={onClose} footer={<>
      {erro && <span className="err grow">{erro}</span>}
      <button className="btn" onClick={onClose}>Cancelar</button>
      <button className="btn pri" onClick={salvar}>Salvar</button>
    </>}>
      <div className="form">
        <label className="lbl full">Nome completo *<input className="inp" value={f.nome ?? ''} onChange={set('nome')} autoFocus /></label>
        <label className="lbl">Vínculo
          <select className="inp" value={f.tipo_vinculo} onChange={set('tipo_vinculo')}>{opcoes?.tipos_vinculo.map((t) => <option key={t}>{t}</option>)}</select>
        </label>
        <label className="lbl">CPF / CNPJ<input className="inp num" value={f.documento ?? ''} onChange={set('documento')} /></label>
        {(f.tipo_vinculo === 'Terceirizado' || f.tipo_vinculo === 'PJ') && (
          <label className="lbl">Empresa<input className="inp" value={f.empresa ?? ''} onChange={set('empresa')} /></label>
        )}
        <label className="lbl">Função principal
          <select className="inp" value={f.funcao_id ?? ''} onChange={(e) => mudarFuncao(e.target.value)}>
            <option value="">—</option>
            {funcoes.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
          </select>
        </label>
        <label className="lbl">Forma de custo
          <select className="inp" value={f.forma_custo} onChange={set('forma_custo')}>
            <option value="diaria">Por diária</option>
            <option value="hora">Por hora</option>
          </select>
        </label>
        <label className="lbl">Valor {f.forma_custo === 'hora' ? 'da hora' : 'da diária'} (R$)<input className="inp num" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} /></label>
        <label className="lbl">Telefone<input className="inp" value={f.telefone ?? ''} onChange={set('telefone')} /></label>
        <label className="lbl">E-mail<input className="inp" type="email" value={f.email ?? ''} onChange={set('email')} /></label>
        <label className="lbl">Cidade<input className="inp" value={f.cidade ?? ''} onChange={set('cidade')} /></label>
        <label className="lbl">UF<input className="inp" maxLength={2} value={f.uf ?? ''} onChange={set('uf')} /></label>
        <label className="lbl">Status
          <select className="inp" value={f.status} onChange={set('status')}><option>Ativo</option><option>Inativo</option></select>
        </label>
        <label className="lbl full">Observações<textarea className="inp" value={f.observacoes ?? ''} onChange={set('observacoes')} /></label>
      </div>
    </Modal>
  )
}

function HistoricoModal({ prestador, onClose }: { prestador: Prestador; onClose: () => void }) {
  const { isEscritorio } = useAuth()
  const { data: hist = [], isLoading } = useQuery({ queryKey: ['historico', prestador.id], queryFn: () => apiPrestadores.historico(prestador.id) })
  const total = hist.reduce((s, a) => s + a.custo, 0)
  return (
    <Modal wide titulo={`Histórico · ${prestador.nome}`} onClose={onClose}>
      {isLoading ? <div className="spinner" /> : hist.length === 0 ? <div className="empty">Nenhuma alocação registrada.</div> : (
        <div className="scroll">
          <table className="tbl">
            <thead><tr><th>Evento / equipe</th><th>Período</th><th>Situação</th>{isEscritorio && <th className="r">Custo</th>}</tr></thead>
            <tbody>
              {hist.map((a) => (
                <tr key={a.id}>
                  <td>
                    <Link to={`/eventos/${a.evento_id}`} onClick={onClose} style={{ fontWeight: 600 }}>{a.evento_nome}</Link>
                    <div className="small muted">{a.equipe_nome}{a.origem_descricao ? ` · veio de ${a.origem_descricao}` : ''}</div>
                    {a.motivo_encerramento && <div className="small" style={{ color: '#7A4A00' }}>{a.motivo_encerramento}</div>}
                  </td>
                  <td className="num small" style={{ whiteSpace: 'nowrap' }}>{dataHora(a.inicio)} → {dataHora(a.fim)}</td>
                  <td><SituacaoPill situacao={a.situacao} /></td>
                  {isEscritorio && <td className="r num">{brl(a.custo)}</td>}
                </tr>
              ))}
              {isEscritorio && <tr className="tot"><td colSpan={3}>Total</td><td className="r num">{brl(total)}</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  )
}

export default function Prestadores() {
  const { isEscritorio } = useAuth()
  const toast = useToast()
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('Ativo')
  const [vinculo, setVinculo] = useState('')
  const [modal, setModal] = useState<{ p?: Prestador } | null>(null)
  const [hist, setHist] = useState<Prestador | null>(null)
  const { data: lista = [], isLoading } = useQuery({ queryKey: ['prestadores', 'todos'], queryFn: () => apiPrestadores.listar() })

  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase()
    return lista.filter((p) =>
      (!status || p.status === status) && (!vinculo || p.tipo_vinculo === vinculo) &&
      (!t || p.nome.toLowerCase().includes(t) || (p.funcao_nome ?? '').toLowerCase().includes(t) || (p.empresa ?? '').toLowerCase().includes(t)))
  }, [lista, q, status, vinculo])
  const emCampo = lista.filter((p) => p.alocado_agora).length

  return (
    <>
      <div className="pagehead">
        <div>
          <h1>Prestadores</h1>
          <p className="sub">{lista.filter((p) => p.status === 'Ativo').length} ativos · {emCampo} em campo agora</p>
        </div>
        {isEscritorio && <button className="btn pri" onClick={() => setModal({})}><Plus size={16} />Novo prestador</button>}
      </div>
      <div className="card row">
        <input className="inp grow" style={{ flex: '1 1 260px' }} placeholder="Buscar por nome, função ou empresa" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="inp" style={{ width: 160 }} value={vinculo} onChange={(e) => setVinculo(e.target.value)}>
          <option value="">Todos os vínculos</option>
          {['CLT', 'PJ', 'MEI', 'Diarista', 'Terceirizado'].map((v) => <option key={v}>{v}</option>)}
        </select>
        <select className="inp" style={{ width: 140 }} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todos</option><option>Ativo</option><option>Inativo</option>
        </select>
      </div>
      {isLoading ? <div className="spinner" /> : (
        <div className="card flush scroll">
          <table className="tbl">
            <thead>
              <tr><th>Nome</th><th>Função</th><th>Vínculo</th>{isEscritorio && <th className="r">Custo</th>}<th>Onde está agora</th><th /></tr>
            </thead>
            <tbody>
              {filtrados.map((p) => (
                <tr key={p.id} className={p.status === 'Inativo' ? 'off' : ''}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{p.nome}</div>
                    <div className="small muted">{[p.telefone, p.cidade && `${p.cidade}${p.uf ? '/' + p.uf : ''}`].filter(Boolean).join(' · ')}</div>
                  </td>
                  <td className="small">{p.funcao_nome ?? '—'}</td>
                  <td className="small">{p.tipo_vinculo}{p.empresa && <div className="muted">{p.empresa}</div>}</td>
                  {isEscritorio && <td className="r num small">{brl(p.valor_custo)} <span className="muted">{FORMA_LABEL[p.forma_custo]}</span></td>}
                  <td className="small">{p.alocado_agora ? <span className="pill ok">{p.alocado_agora}</span> : <span className="muted">Disponível</span>}</td>
                  <td className="r" style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn ghost icon" title="Histórico de alocações" onClick={() => setHist(p)}><History size={15} /></button>
                    {isEscritorio && <button className="btn ghost icon" title="Editar" onClick={() => setModal({ p })}><Pencil size={15} /></button>}
                  </td>
                </tr>
              ))}
              {filtrados.length === 0 && <tr><td colSpan={6} className="muted" style={{ padding: 20 }}>Nenhum prestador encontrado.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {modal && (
        <PrestadorModal prestador={modal.p} onClose={() => setModal(null)} onSalvo={() => {
          setModal(null)
          qc.invalidateQueries({ queryKey: ['prestadores'] })
          toast(modal.p ? 'Prestador atualizado.' : 'Prestador cadastrado.')
        }} />
      )}
      {hist && <HistoricoModal prestador={hist} onClose={() => setHist(null)} />}
    </>
  )
}
