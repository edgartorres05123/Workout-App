import { useState } from 'react'
import { ChevronDown, ChevronUp, Minus, Plus, Trash2, X } from 'lucide-react'
import Confirmar from './Confirmar'
import EscolherExercicio from './EscolherExercicio'
import IconeBloco from './IconeBloco'
import Janela from './Janela'
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

  async function confirmarAcao() {
    const mensagem =
      confirmar.tipo === 'bloco' ? await executar(onApagar) : await executar(() => onRemoverExercicio(confirmar.be))
    if (!mensagem) setConfirmar(null)
  }

  function guardarNotas() {
    const valor = notas.trim() === '' ? null : notas.trim()
    if (valor !== (bloco.notas ?? null)) executar(() => onAtualizar({ notas: valor }))
  }

  return (
    <>
      <Janela titulo={titulo} onFechar={onFechar}>
        <div className={`sheet-lista opcoes-bloco tipo-${bloco.tipo}`}>
          {erro && <p className="erro">{erro}</p>}

          <h3 className="opcoes-titulo">Tipo</h3>
          <div className="tipos-bloco compacto">
            {TIPOS_BLOCO.map((t) => (
              <button
                key={t.id}
                className={t.id === bloco.tipo ? `tipo-opcao tipo-${t.id} ativo` : `tipo-opcao tipo-${t.id}`}
                onClick={() => mudarTipo(t.id)}
                disabled={aGravar}
                aria-pressed={t.id === bloco.tipo}
              >
                <IconeBloco tipo={t.id} size={18} />
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
              <Minus size={20} />
            </button>
            <span className="numero-voltas">
              {bloco.voltas} {bloco.voltas === 1 ? 'volta' : 'voltas'}
            </span>
            <button
              className="botao-redondo"
              onClick={() => executar(() => onMudarVoltas(1))}
              disabled={aGravar}
              aria-label="Mais uma volta"
            >
              <Plus size={20} />
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
                    <ChevronUp size={20} />
                  </button>
                  <button
                    className="botao-icone"
                    onClick={() => executar(() => onMoverExercicio(i, 1))}
                    disabled={i === exercicios.length - 1 || aGravar}
                    aria-label="Mover para baixo"
                  >
                    <ChevronDown size={20} />
                  </button>
                  <button
                    className="botao-icone perigo"
                    onClick={() => pedirRemover(be)}
                    disabled={aGravar}
                    aria-label={`Remover ${be.exercicios?.nome ?? 'exercício'}`}
                  >
                    <X size={20} />
                  </button>
                </div>
                <Alvos
                  key={`${be.id}-${be.reps_alvo}-${be.peso_alvo}`}
                  blocoExercicio={be}
                  onGuardar={(campos) => executar(() => onAtualizarExercicio(be.id, campos))}
                />
              </li>
            ))}
          </ul>
          <button className="botao-secundario com-icone sem-margem-topo" onClick={() => setAEscolher(true)} disabled={aGravar}>
            <Plus size={18} />
            Adicionar exercício
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
            <button className="botao-secundario com-icone" onClick={() => executar(() => onMover(-1))} disabled={primeiro || aGravar}>
              <ChevronUp size={18} />
              Para cima
            </button>
            <button className="botao-secundario com-icone" onClick={() => executar(() => onMover(1))} disabled={ultimo || aGravar}>
              <ChevronDown size={18} />
              Para baixo
            </button>
          </div>

          <button className="botao-perigo com-icone" onClick={pedirApagar} disabled={aGravar}>
            <Trash2 size={18} />
            Apagar bloco
          </button>
        </div>
      </Janela>

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

      {confirmar && (
        <Confirmar
          titulo={confirmar.tipo === 'bloco' ? 'Apagar bloco?' : `Remover ${confirmar.be.exercicios?.nome ?? 'exercício'}?`}
          textoConfirmar={confirmar.tipo === 'bloco' ? 'Apagar bloco' : 'Remover e apagar'}
          aProcessar={aGravar}
          onConfirmar={confirmarAcao}
          onCancelar={() => setConfirmar(null)}
        >
          {confirmar.tipo === 'bloco' ? (
            <p>
              O bloco e {series.length === 1 ? 'a série feita' : `as ${series.length} séries feitas`} serão apagados.
              Não é possível desfazer.
            </p>
          ) : (
            <p>
              Remover {confirmar.be.exercicios?.nome} do bloco apaga também{' '}
              {confirmar.total === 1 ? 'a série feita' : `as ${confirmar.total} séries feitas`} neste bloco.
            </p>
          )}
          {erro && <p className="erro">{erro}</p>}
        </Confirmar>
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
