import { useEffect, useState } from 'react'
import EscolherExercicio from './EscolherExercicio'
import { TIPOS_BLOCO, letraExercicio, motivoTipoIndisponivel } from './blocos'
import { lerNumero, pesoParaInput } from './formatar'

// Opções de um bloco (bottom sheet). Todas as funções on* devolvem uma mensagem de erro, ou null.
export default function OpcoesBloco({
  bloco,
  titulo,
  series,
  primeiro,
  ultimo,
  onAtualizar,
  onMudarVoltas,
  onMover,
  onApagar,
  onAdicionarExercicio,
  onRemoverExercicio,
  onAtualizarExercicio,
  onMoverExercicio,
  onFechar,
}) {
  const [aEscolher, setAEscolher] = useState(false)
  const [confirmar, setConfirmar] = useState(null) // null | { tipo: 'bloco' } | { tipo: 'exercicio', be, total }
  const [notas, setNotas] = useState(bloco.notas ?? '')
  const [aGravar, setAGravar] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    function teclaPremida(e) {
      if (e.key === 'Escape' && !aEscolher) onFechar()
    }
    window.addEventListener('keydown', teclaPremida)
    return () => window.removeEventListener('keydown', teclaPremida)
  }, [onFechar, aEscolher])

  const exercicios = bloco.bloco_exercicios

  // Corre uma operação e mostra o erro, se houver
  async function executar(operacao) {
    setErro('')
    setAGravar(true)
    const mensagem = await operacao()
    setAGravar(false)
    if (mensagem) setErro(mensagem)
    return mensagem
  }

  function mudarTipo(tipo) {
    if (tipo === bloco.tipo) return
    const motivo = motivoTipoIndisponivel(tipo, exercicios.length)
    if (motivo) return setErro(motivo)
    executar(async () => {
      const mensagem = await onAtualizar({ tipo })
      // Uma super série precisa de pelo menos 2 exercícios: abre logo o seletor
      if (!mensagem && tipo === 'superserie' && exercicios.length < 2) setAEscolher(true)
      return mensagem
    })
  }

  function pedirRemover(be) {
    const total = series.filter((s) => s.exercicio_id === be.exercicio_id).length
    if (total > 0) return setConfirmar({ tipo: 'exercicio', be, total })
    executar(() => onRemoverExercicio(be))
  }

  function pedirApagar() {
    if (series.length > 0) return setConfirmar({ tipo: 'bloco' })
    executar(onApagar)
  }

  function guardarNotas() {
    const valor = notas.trim() === '' ? null : notas.trim()
    if (valor !== (bloco.notas ?? null)) executar(() => onAtualizar({ notas: valor }))
  }

  return (
    <>
      <div className="sheet-fundo" onClick={onFechar}>
        <div
          className="sheet"
          role="dialog"
          aria-modal="true"
          aria-label={`Opções: ${titulo}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="sheet-topo">
            <h2>{titulo}</h2>
            <button className="botao-fechar" onClick={onFechar} aria-label="Fechar">
              ×
            </button>
          </div>

          <div className="sheet-lista opcoes-bloco">
            {erro && <p className="erro">{erro}</p>}

            <h3 className="opcoes-titulo">Tipo</h3>
            <div className="tipos-bloco compacto">
              {TIPOS_BLOCO.map((t) => (
                <button
                  key={t.id}
                  className={t.id === bloco.tipo ? 'tipo-opcao ativo' : 'tipo-opcao'}
                  onClick={() => mudarTipo(t.id)}
                  disabled={aGravar}
                  aria-pressed={t.id === bloco.tipo}
                >
                  <span className="tipo-opcao-nome">{t.nome}</span>
                </button>
              ))}
            </div>

            <h3 className="opcoes-titulo">Voltas</h3>
            <div className="bloco-voltas esquerda">
              <button
                className="botao-redondo"
                onClick={() => executar(() => onMudarVoltas(-1))}
                disabled={bloco.voltas <= 1 || aGravar}
                aria-label="Menos uma volta"
              >
                −
              </button>
              <span>
                {bloco.voltas} {bloco.voltas === 1 ? 'volta' : 'voltas'}
              </span>
              <button
                className="botao-redondo"
                onClick={() => executar(() => onMudarVoltas(1))}
                disabled={aGravar}
                aria-label="Mais uma volta"
              >
                +
              </button>
            </div>

            <h3 className="opcoes-titulo">Exercícios</h3>
            {exercicios.length === 0 && <p className="nota sem-margem-topo">Ainda não há exercícios neste bloco.</p>}
            <ul className="lista opcoes-exercicios">
              {exercicios.map((be, i) => (
                <li key={be.id}>
                  <div className="opcoes-exercicio-topo">
                    {exercicios.length > 1 && <span className="letra">{letraExercicio(i)}</span>}
                    <span className="opcoes-exercicio-nome">{be.exercicios?.nome ?? '—'}</span>
                    <button
                      className="botao-icone"
                      onClick={() => executar(() => onMoverExercicio(i, -1))}
                      disabled={i === 0 || aGravar}
                      aria-label="Mover para cima"
                    >
                      ↑
                    </button>
                    <button
                      className="botao-icone"
                      onClick={() => executar(() => onMoverExercicio(i, 1))}
                      disabled={i === exercicios.length - 1 || aGravar}
                      aria-label="Mover para baixo"
                    >
                      ↓
                    </button>
                    <button
                      className="botao-icone perigo"
                      onClick={() => pedirRemover(be)}
                      disabled={aGravar}
                      aria-label={`Remover ${be.exercicios?.nome ?? 'exercício'}`}
                    >
                      ×
                    </button>
                  </div>
                  <Alvos
                    key={`${be.id}-${be.reps_alvo}-${be.peso_alvo}`}
                    blocoExercicio={be}
                    onGuardar={(campos) => executar(() => onAtualizarExercicio(be.id, campos))}
                  />
                  {confirmar?.tipo === 'exercicio' && confirmar.be.id === be.id && (
                    <div className="confirmacao-inline">
                      <p>
                        Remover {be.exercicios?.nome} do bloco apaga também{' '}
                        {confirmar.total === 1 ? 'a série feita' : `as ${confirmar.total} séries feitas`} neste
                        bloco.
                      </p>
                      <button
                        className="botao-perigo-cheio"
                        onClick={async () => {
                          if (!(await executar(() => onRemoverExercicio(be)))) setConfirmar(null)
                        }}
                        disabled={aGravar}
                      >
                        Remover e apagar
                      </button>
                      <button className="botao-secundario" onClick={() => setConfirmar(null)}>
                        Cancelar
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            <button className="botao-secundario sem-margem-topo" onClick={() => setAEscolher(true)} disabled={aGravar}>
              + Adicionar exercício
            </button>

            <h3 className="opcoes-titulo">Notas do bloco</h3>
            <textarea
              rows={2}
              placeholder="Ex: descanso de 90 s entre voltas"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              onBlur={guardarNotas}
            />

            <h3 className="opcoes-titulo">Posição no treino</h3>
            <div className="linha-botoes">
              <button className="botao-secundario" onClick={() => executar(() => onMover(-1))} disabled={primeiro || aGravar}>
                ↑ Para cima
              </button>
              <button className="botao-secundario" onClick={() => executar(() => onMover(1))} disabled={ultimo || aGravar}>
                ↓ Para baixo
              </button>
            </div>

            {confirmar?.tipo === 'bloco' ? (
              <div className="confirmacao-inline">
                <p>
                  Apagar este bloco e {series.length === 1 ? 'a série feita' : `as ${series.length} séries feitas`}?
                  Não é possível desfazer.
                </p>
                <button className="botao-perigo-cheio" onClick={() => executar(onApagar)} disabled={aGravar}>
                  Apagar bloco
                </button>
                <button className="botao-secundario" onClick={() => setConfirmar(null)}>
                  Cancelar
                </button>
              </div>
            ) : (
              <button className="botao-perigo" onClick={pedirApagar} disabled={aGravar}>
                Apagar bloco
              </button>
            )}
          </div>
        </div>
      </div>

      {aEscolher && (
        <EscolherExercicio
          titulo="Adicionar ao bloco"
          jaEscolhidos={exercicios.map((be) => be.exercicio_id)}
          onEscolher={(exercicio) => {
            setAEscolher(false)
            if (exercicios.some((be) => be.exercicio_id === exercicio.id)) {
              return setErro('Este exercício já está no bloco.')
            }
            executar(() => onAdicionarExercicio(exercicio))
          }}
          onFechar={() => setAEscolher(false)}
        />
      )}
    </>
  )
}

// Reps-alvo e peso-alvo de um exercício do bloco; gravam ao sair do campo
function Alvos({ blocoExercicio, onGuardar }) {
  const [reps, setReps] = useState(String(blocoExercicio.reps_alvo ?? ''))
  const [kg, setKg] = useState(
    blocoExercicio.peso_alvo === null || blocoExercicio.peso_alvo === undefined ? '' : pesoParaInput(blocoExercicio.peso_alvo)
  )
  const [erro, setErro] = useState('')

  function guardarReps() {
    const valor = Number(reps.trim())
    if (!Number.isInteger(valor) || valor <= 0 || valor > 1000) {
      setErro('As reps-alvo têm de ser um número inteiro maior do que 0.')
      setReps(String(blocoExercicio.reps_alvo ?? ''))
      return
    }
    setErro('')
    if (valor !== blocoExercicio.reps_alvo) onGuardar({ reps_alvo: valor })
  }

  function guardarKg() {
    const texto = kg.trim()
    const valor = texto === '' ? null : lerNumero(texto)
    if (texto !== '' && (valor === null || valor < 0 || valor > 9999.99)) {
      setErro('Indica um peso-alvo válido, ou deixa vazio.')
      setKg(blocoExercicio.peso_alvo === null ? '' : pesoParaInput(blocoExercicio.peso_alvo))
      return
    }
    setErro('')
    const arredondado = valor === null ? null : Math.round(valor * 100) / 100
    const atual = blocoExercicio.peso_alvo === null || blocoExercicio.peso_alvo === undefined ? null : Number(blocoExercicio.peso_alvo)
    if (arredondado !== atual) onGuardar({ peso_alvo: arredondado })
  }

  const sairComEnter = (e) => e.key === 'Enter' && e.currentTarget.blur()

  return (
    <>
      <div className="alvos">
        <label>
          <span>Reps-alvo</span>
          <input
            type="text"
            inputMode="numeric"
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            onBlur={guardarReps}
            onKeyDown={sairComEnter}
          />
        </label>
        <label>
          <span>Peso-alvo (kg, opcional)</span>
          <input
            type="text"
            inputMode="decimal"
            placeholder="—"
            value={kg}
            onChange={(e) => setKg(e.target.value)}
            onBlur={guardarKg}
            onKeyDown={sairComEnter}
          />
        </label>
      </div>
      {erro && <p className="erro">{erro}</p>}
    </>
  )
}
