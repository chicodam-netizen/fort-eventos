import { useState, type DragEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRightLeft, CornerDownRight, LogOut, Pencil, Plus, Trash2, UserPlus, UsersRound } from 'lucide-react'
import {
  apiAlocacoes, apiEquipes, apiModelos, apiPrestadores, type Alocacao, type Equipe, type Evento,
} from '../../api'
import { useAuth } from '../../context/AuthContext'
import { brl, dataHora, erroMsg, iniciais, parse } from '../../utils/format'
import Modal from '../Modal'
import { SituacaoPill } from '../StatusPill'
import { useToast } from '../Toast'
import { AlocarModal, EditarAlocacaoModal, MoverModal, RetirarModal } from './AlocacaoModais'

type Visao = 'agora' | 'ativos' | 'tudo'

const CORES = ['#FF4700', '#2B6CB0', '#1E7F4F', '#6B46C1', '#C27C0E', '#3A3A3A', '#A23A24', '#0F766E']

function Timeline({ a, evento }: { a: Alocacao; evento: Evento }) {
  const ini = parse(evento.inicio).getTime(), fim = parse(evento.fim).getTime()
  const total = Math.max(fim - ini, 1)
  const pct = (t: number) => Math.min(Math.max(((t - ini) / total) * 100, 0), 100)
  const l = pct(parse(a.inicio).getTime()), r = pct(parse(a.fim).getTime())
  const agora = Date.now()
  const cor = a.situacao === 'ativa' ? 'var(--ok)' : a.situacao === 'futura' ? 'var(--st-confirmado)' : '#B8B4AF'
  return (
    <div className="timeline" title={`${dataHora(a.inicio)} → ${dataHora(a.fim)}`}>
      <span style={{ left: `${l}%`, width: `${Math.max(r - l, 1.5)}%`, background: cor }} />
      {agora > ini && agora < fim && <i style={{ left: `${pct(agora)}%` }} />}
    </div>
  )
}

function EquipeModal({ evento, equipe, onClose, onSalvo }: { evento: Evento; equipe?: Equipe; onClose: () => void; onSalvo: () => void }) {
  const { data: prestadores = [] } = useQuery({ queryKey: ['prestadores', 'Ativo'], queryFn: () => apiPrestadores.listar({ status: 'Ativo' }) })
  const [nome, setNome] = useState(equipe?.nome ?? '')
  const [descricao, setDescricao] = useState(equipe?.descricao ?? '')
  const [cor, setCor] = useState(equipe?.cor ?? CORES[0])
  const [lider, setLider] = useState(equipe?.lider_id ?? '')
  const [erro, setErro] = useState('')

  async function salvar() {
    if (!nome.trim()) return setErro('Informe o nome da equipe.')
    const body = { nome, descricao: descricao || null, cor, lider_id: lider || null }
    try {
      if (equipe) await apiEquipes.atualizar(equipe.id, body)
      else await apiEquipes.criar(evento.id, body)
      onSalvo()
    } catch (e) {
      setErro(erroMsg(e))
    }
  }

  return (
    <Modal titulo={equipe ? 'Editar equipe' : 'Nova equipe'} onClose={onClose} footer={<>
      {erro && <span className="err grow">{erro}</span>}
      <button className="btn" onClick={onClose}>Cancelar</button>
      <button className="btn pri" onClick={salvar}>Salvar</button>
    </>}>
      <label className="lbl">Nome<input className="inp" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus placeholder="Ex.: Elétrica — Palco 2" /></label>
      <label className="lbl">Descrição<input className="inp" value={descricao} onChange={(e) => setDescricao(e.target.value)} /></label>
      <label className="lbl">Líder da equipe
        <select className="inp" value={lider} onChange={(e) => setLider(e.target.value)}>
          <option value="">Sem líder definido</option>
          {prestadores.map((p) => <option key={p.id} value={p.id}>{p.nome}{p.funcao_nome ? ` · ${p.funcao_nome}` : ''}</option>)}
        </select>
        <span className="small muted">Usuários com perfil Líder vinculados a este prestador passam a ver e movimentar o evento.</span>
      </label>
      <div className="lbl">Cor
        <div className="row tight">
          {CORES.map((c) => (
            <button key={c} onClick={() => setCor(c)} aria-label={c}
              style={{ width: 28, height: 28, borderRadius: 6, background: c, border: cor === c ? '3px solid var(--ink)' : '1px solid var(--line)', cursor: 'pointer' }} />
          ))}
        </div>
      </div>
    </Modal>
  )
}

function DeModeloModal({ evento, onClose, onSalvo }: { evento: Evento; onClose: () => void; onSalvo: () => void }) {
  const { data: modelos = [] } = useQuery({ queryKey: ['modelos'], queryFn: apiModelos.listar })
  const [modelo, setModelo] = useState('')
  const [nome, setNome] = useState('')
  const [erro, setErro] = useState('')
  const sel = modelos.find((m) => m.id === modelo)

  async function salvar() {
    if (!modelo) return setErro('Escolha uma equipe modelo.')
    try {
      await apiEquipes.deModelo(evento.id, modelo, nome || undefined)
      onSalvo()
    } catch (e) {
      setErro(erroMsg(e))
    }
  }

  return (
    <Modal titulo="Criar equipe a partir de modelo" onClose={onClose} footer={<>
      {erro && <span className="err grow">{erro}</span>}
      <button className="btn" onClick={onClose}>Cancelar</button>
      <button className="btn pri" onClick={salvar}>Criar equipe</button>
    </>}>
      <label className="lbl">Equipe modelo
        <select className="inp" value={modelo} onChange={(e) => { setModelo(e.target.value); setNome(modelos.find((m) => m.id === e.target.value)?.nome ?? '') }} autoFocus>
          <option value="">Escolha…</option>
          {modelos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
        </select>
      </label>
      {sel && (
        <>
          <div className="composicao">
            {sel.itens.map((i) => <span key={i.funcao_id} className="pill">{i.quantidade}× {i.funcao_nome}</span>)}
          </div>
          <label className="lbl">Nome no evento<input className="inp" value={nome} onChange={(e) => setNome(e.target.value)} /></label>
          <span className="small muted">A composição serve de referência: o quadro mostra quantas vagas de cada função ainda faltam preencher.</span>
        </>
      )}
    </Modal>
  )
}

type Acao =
  | { tipo: 'alocar'; equipe: Equipe }
  | { tipo: 'mover'; a: Alocacao; destino?: string }
  | { tipo: 'retirar'; a: Alocacao }
  | { tipo: 'editar'; a: Alocacao }
  | { tipo: 'equipe'; equipe?: Equipe }
  | { tipo: 'modelo' }

export default function EquipesTab({ evento }: { evento: Evento }) {
  const { isEscritorio } = useAuth()
  const toast = useToast()
  const qc = useQueryClient()
  const [visao, setVisao] = useState<Visao>(() => {
    const agora = new Date()
    return agora > parse(evento.inicio) && agora < parse(evento.fim) ? 'agora' : 'ativos'
  })
  const [acao, setAcao] = useState<Acao | null>(null)
  const [arrastando, setArrastando] = useState<Alocacao | null>(null)
  const [alvo, setAlvo] = useState<string | null>(null)

  const { data: equipes = [], isLoading } = useQuery({ queryKey: ['equipes', evento.id], queryFn: () => apiEquipes.listar(evento.id) })
  const encerrado = evento.status === 'Concluído' || evento.status === 'Cancelado'

  function atualizar(msg?: string) {
    setAcao(null)
    qc.invalidateQueries({ queryKey: ['equipes'] })
    qc.invalidateQueries({ queryKey: ['evento'] })
    qc.invalidateQueries({ queryKey: ['eventos'] })
    qc.invalidateQueries({ queryKey: ['custos', evento.id] })
    qc.invalidateQueries({ queryKey: ['painel'] })
    qc.invalidateQueries({ queryKey: ['prestadores'] })
    if (msg) toast(msg)
  }

  async function excluirAlocacao(a: Alocacao) {
    if (!confirm(`Excluir o lançamento de ${a.prestador_nome} em ${a.equipe_nome}?\n\nUse só para corrigir um lançamento errado — o período some do histórico e do custo. Para tirar a pessoa da equipe, use Retirar.`)) return
    try {
      await apiAlocacoes.excluir(a.id)
      atualizar('Lançamento excluído.')
    } catch (e) {
      toast(erroMsg(e), 'error')
    }
  }

  async function excluirEquipe(e: Equipe) {
    if (!confirm(`Excluir a equipe "${e.nome}"?`)) return
    try {
      await apiEquipes.excluir(e.id)
      atualizar('Equipe excluída.')
    } catch (err) {
      toast(erroMsg(err), 'error')
    }
  }

  const visiveis = (e: Equipe) => e.alocacoes.filter((a) =>
    visao === 'tudo' ? true : visao === 'ativos' ? a.situacao !== 'encerrada' : a.situacao === 'ativa')

  function onDrop(ev: DragEvent, equipe: Equipe) {
    ev.preventDefault()
    setAlvo(null)
    if (arrastando && arrastando.equipe_id !== equipe.id) setAcao({ tipo: 'mover', a: arrastando, destino: equipe.id })
    setArrastando(null)
  }

  if (isLoading) return <div className="spinner" />

  const emCampo = new Set(equipes.flatMap((e) => e.alocacoes.filter((a) => a.situacao === 'ativa').map((a) => a.prestador_id))).size

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="row between">
        <div className="row tight">
          {([['agora', 'Em campo agora'], ['ativos', 'Atuais e programados'], ['tudo', 'Histórico completo']] as const).map(([v, l]) => (
            <button key={v} className={`btn sm${visao === v ? ' pri' : ''}`} onClick={() => setVisao(v)}>{l}</button>
          ))}
          <span className="small muted" style={{ marginLeft: 6 }}><b className="num">{emCampo}</b> pessoas em campo agora</span>
        </div>
        {isEscritorio && !encerrado && (
          <div className="row tight">
            <button className="btn sm" onClick={() => setAcao({ tipo: 'modelo' })}><UsersRound size={15} />Equipe de modelo</button>
            <button className="btn sm pri" onClick={() => setAcao({ tipo: 'equipe' })}><Plus size={15} />Nova equipe</button>
          </div>
        )}
      </div>
      {!encerrado && equipes.length > 1 && (
        <div className="small muted">Dica: arraste o card de um prestador para outra equipe para movê-lo.</div>
      )}

      {equipes.length === 0 ? (
        <div className="empty">Nenhuma equipe neste evento ainda. {isEscritorio && 'Crie uma do zero ou a partir de uma equipe modelo.'}</div>
      ) : (
        <div className="board">
          {equipes.map((e) => {
            const lista = visiveis(e)
            const vigentes = e.alocacoes.filter((a) => a.situacao !== 'encerrada')
            const porFuncao = new Map<string, number>()
            vigentes.forEach((a) => a.funcao_id && porFuncao.set(a.funcao_id, (porFuncao.get(a.funcao_id) ?? 0) + 1))
            return (
              <div
                key={e.id}
                className={`team${alvo === e.id ? ' drop' : ''}`}
                onDragOver={(ev) => { if (arrastando && arrastando.equipe_id !== e.id) { ev.preventDefault(); setAlvo(e.id) } }}
                onDragLeave={() => setAlvo((x) => (x === e.id ? null : x))}
                onDrop={(ev) => onDrop(ev, e)}
              >
                <div className="team-head" style={{ borderTopColor: e.cor ?? 'var(--line)' }}>
                  <div className="row between" style={{ flexWrap: 'nowrap' }}>
                    <h3>{e.nome}</h3>
                    {isEscritorio && (
                      <div className="row tight" style={{ flexWrap: 'nowrap' }}>
                        <button className="btn ghost icon" title="Editar equipe" onClick={() => setAcao({ tipo: 'equipe', equipe: e })}><Pencil size={14} /></button>
                        <button className="btn ghost icon" title="Excluir equipe" onClick={() => excluirEquipe(e)}><Trash2 size={14} /></button>
                      </div>
                    )}
                  </div>
                  <div className="small muted">
                    Líder: {e.lider_nome ?? '—'} · <b className="num">{e.alocacoes.filter((a) => a.situacao === 'ativa').length}</b> em campo
                  </div>
                  {e.composicao_modelo.length > 0 && (
                    <div className="composicao" style={{ marginTop: 4 }}>
                      {e.composicao_modelo.map((c) => {
                        const n = porFuncao.get(c.funcao_id) ?? 0
                        return (
                          <span key={c.funcao_id} className={`pill ${n >= c.quantidade ? 'ok' : 'warn'}`} title="Alocados (atuais e programados) / previsto no modelo">
                            {c.funcao_nome} <span className="num">{n}/{c.quantidade}</span>
                          </span>
                        )
                      })}
                    </div>
                  )}
                </div>
                <div className="team-body">
                  {lista.length === 0 && <div className="small muted" style={{ padding: '10px 6px' }}>Ninguém {visao === 'agora' ? 'em campo agora' : 'alocado'}.</div>}
                  {lista.map((a) => {
                    const podeArrastar = !encerrado && a.situacao !== 'encerrada'
                    return (
                      <div
                        key={a.id}
                        className={`person ${a.situacao}`}
                        draggable={podeArrastar}
                        onDragStart={() => setArrastando(a)}
                        onDragEnd={() => { setArrastando(null); setAlvo(null) }}
                      >
                        <span className="avatar" style={{ background: a.situacao === 'encerrada' ? '#9A9A9A' : 'var(--black)' }}>{iniciais(a.prestador_nome)}</span>
                        <div className="grow">
                          <div className="row between" style={{ flexWrap: 'nowrap', gap: 6 }}>
                            <span className="nm">{a.prestador_nome}</span>
                            <SituacaoPill situacao={a.situacao} />
                          </div>
                          <div className="meta">{a.funcao_nome ?? 'Sem função'} · {a.prestador_vinculo}</div>
                          <div className="meta num">{dataHora(a.inicio)} → {dataHora(a.fim)}{isEscritorio && a.custo > 0 && <> · {brl(a.custo)}</>}</div>
                          {a.origem_descricao && <div className="meta"><CornerDownRight size={11} /> veio de {a.origem_descricao}</div>}
                          {a.motivo_encerramento && <div className="meta" style={{ color: '#7A4A00' }}>{a.motivo_encerramento}</div>}
                          <Timeline a={a} evento={evento} />
                          {!encerrado && a.situacao !== 'encerrada' && (
                            <div className="row tight" style={{ marginTop: 6 }}>
                              <button className="btn sm" onClick={() => setAcao({ tipo: 'mover', a })}><ArrowRightLeft size={13} />Mover</button>
                              {a.situacao === 'ativa' && <button className="btn sm" onClick={() => setAcao({ tipo: 'retirar', a })}><LogOut size={13} />Retirar</button>}
                              <button className="btn sm ghost icon" title="Editar" onClick={() => setAcao({ tipo: 'editar', a })}><Pencil size={13} /></button>
                              {(isEscritorio || a.situacao === 'futura') && (
                                <button className="btn sm ghost icon" title="Excluir lançamento" onClick={() => excluirAlocacao(a)}><Trash2 size={13} /></button>
                              )}
                            </div>
                          )}
                          {isEscritorio && a.situacao === 'encerrada' && (
                            <div className="row tight" style={{ marginTop: 6 }}>
                              <button className="btn sm ghost" onClick={() => setAcao({ tipo: 'editar', a })}><Pencil size={13} />Corrigir</button>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  {!encerrado && (
                    <button className="btn sm ghost" style={{ alignSelf: 'flex-start' }} onClick={() => setAcao({ tipo: 'alocar', equipe: e })}>
                      <UserPlus size={15} />Adicionar prestador
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {acao?.tipo === 'alocar' && <AlocarModal evento={evento} equipe={acao.equipe} onClose={() => setAcao(null)} onSalvo={() => atualizar('Prestador alocado.')} />}
      {acao?.tipo === 'mover' && <MoverModal alocacao={acao.a} destinoInicial={acao.destino} onClose={() => setAcao(null)} onSalvo={atualizar} />}
      {acao?.tipo === 'retirar' && <RetirarModal alocacao={acao.a} onClose={() => setAcao(null)} onSalvo={() => atualizar('Prestador retirado da equipe.')} />}
      {acao?.tipo === 'editar' && <EditarAlocacaoModal alocacao={acao.a} onClose={() => setAcao(null)} onSalvo={() => atualizar('Alocação atualizada.')} />}
      {acao?.tipo === 'equipe' && <EquipeModal evento={evento} equipe={acao.equipe} onClose={() => setAcao(null)} onSalvo={() => atualizar(acao.equipe ? 'Equipe atualizada.' : 'Equipe criada.')} />}
      {acao?.tipo === 'modelo' && <DeModeloModal evento={evento} onClose={() => setAcao(null)} onSalvo={() => atualizar('Equipe criada a partir do modelo.')} />}
    </div>
  )
}
