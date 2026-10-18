import { useState } from 'react'
import { ChevronLeft, Plus, X } from 'lucide-react'
import ConfigBloco from './ConfigBloco'
import EscolherExercicio from './EscolherExercicio'
import IconeBloco from './IconeBloco'
import Janela from './Janela'
import { GRUPOS_BLOCO, MINIMO_EXERCICIOS, NOME_TIPO, TIPOS_BLOCO, camposIniciais, letraExercicio } from './blocos'
import { SEGUNDOS_ALVO_INICIAIS, ehCondicionamento } from './condicionamento'

// Janela para criar um bloco: primeiro o tipo (Força ou Condicionamento), depois os exercícios (cada um
// por reps ou por tempo) e, nos de condicionamento, a configuração (tempo limite, intervalos...).
// onCriar(tipo, exercicios, config) devolve uma mensagem de erro, ou null se correu bem; cada exercício
// leva segundos_alvo (null = por reps). config: { voltas, duracao_seg, intervalo_seg }.
// onMudarPesoCorporal(exercicio, valor): liga ou desliga o peso corporal (em todos os treinos).
export default function NovoBloco({ onCriar, onMudarPesoCorporal, onFechar }) {
  const [tipo, setTipo] = useState(null)
  const [exercicios, setExercicios] = useState([]) // [{ ...exercicio, porTempo }]
  const [config, setConfig] = useState(null)
  const [aEscolher, setAEscolher] = useState(false)
  const [aCriar, setACriar] = useState(false)
  const [erro, setErro] = useState('')

  async function criar(lista) {
    setACriar(true)
    setErro('')
    const comAlvos = lista.map((e) => ({ ...e, segundos_alvo: e.porTempo ? SEGUNDOS_ALVO_INICIAIS : null }))
    const mensagem = await onCriar(tipo, comAlvos, config ?? camposIniciais(tipo))
    setACriar(false)
    if (mensagem) setErro(mensagem)
  }

  function escolherTipo(id) {
    setTipo(id)
    setConfig(camposIniciais(id))
    setAEscolher(true)
  }

  function escolherExercicio(exercicio) {
    setAEscolher(false)
    if (exercicios.some((e) => e.id === exercicio.id)) return
    const lista = [...exercicios, { ...exercicio, porTempo: false }]
    setExercicios(lista)
    // Uma série tem um só exercício: cria logo o bloco (dá para passar a "por tempo" nas opções)
    if (tipo === 'serie') criar(lista)
  }

  async function alternarPesoCorporal(exercicio) {
    if (!onMudarPesoCorporal) return
    setErro('')
    const valor = !exercicio.peso_corporal
    const mensagem = await onMudarPesoCorporal(exercicio, valor)
    if (mensagem) return setErro(mensagem)
    setExercicios((atuais) => atuais.map((e) => (e.id === exercicio.id ? { ...e, peso_corporal: valor } : e)))
  }

  function alternarTempo(exercicio) {
    setExercicios((atuais) => atuais.map((e) => (e.id === exercicio.id ? { ...e, porTempo: !e.porTempo } : e)))
  }

  const podeCriar = tipo && exercicios.length >= MINIMO_EXERCICIOS[tipo]

  return (
    <>
      <Janela titulo={tipo ? `Novo bloco · ${NOME_TIPO[tipo]}` : 'Novo bloco'} onFechar={onFechar} baixa>
        <div className={`sheet-lista${tipo ? ` tipo-${tipo}` : ''}`}>
          {!tipo ? (
            GRUPOS_BLOCO.map((grupo) => (
              <section key={grupo.id} className="grupo-tipos" aria-label={grupo.nome}>
                <h3 className="opcoes-titulo">{grupo.nome}</h3>
                <div className="tipos-bloco">
                  {TIPOS_BLOCO.filter((t) => t.grupo === grupo.id).map((t) => (
                    <button key={t.id} className={`tipo-opcao tipo-${t.id}`} onClick={() => escolherTipo(t.id)}>
                      <span className="tipo-opcao-icone">
                        <IconeBloco tipo={t.id} size={20} />
                      </span>
                      <span className="tipo-opcao-textos">
                        <span className="tipo-opcao-nome">{t.nome}</span>
                        <span className="tipo-opcao-descricao">{t.descricao}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            ))
          ) : (
            <>
              {ehCondicionamento(tipo) && (
                <ConfigBloco
                  key={tipo}
                  tipo={tipo}
                  valores={config}
                  mostrarIntervalos
                  onMudar={async (campos) => {
                    setConfig((atual) => ({ ...atual, ...campos }))
                    return null
                  }}
                />
              )}

              {exercicios.length > 0 && (
                <ul className="lista">
                  {exercicios.map((e, i) => (
                    <li key={e.id} className="linha-escolhida">
                      <span className="letra">{letraExercicio(i)}</span>
                      <span className="linha-escolhida-nome">{e.nome}</span>
                      <button
                        type="button"
                        className={e.porTempo ? 'botao-pc ativo' : 'botao-pc'}
                        onClick={() => alternarTempo(e)}
                        aria-pressed={e.porTempo}
                        aria-label={`${e.nome} por tempo (em segundos, em vez de reps)`}
                      >
                        {e.porTempo ? 'Tempo' : 'Reps'}
                      </button>
                      <button
                        type="button"
                        className={e.peso_corporal ? 'botao-pc ativo' : 'botao-pc'}
                        onClick={() => alternarPesoCorporal(e)}
                        aria-pressed={Boolean(e.peso_corporal)}
                        aria-label={`Peso corporal em ${e.nome} (vale em todos os treinos)`}
                      >
                        PC
                      </button>
                      <button
                        className="botao-apagar"
                        onClick={() => setExercicios(exercicios.filter((x) => x.id !== e.id))}
                        aria-label={`Tirar ${e.nome}`}
                      >
                        <X size={20} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {tipo !== 'serie' || exercicios.length === 0 ? (
                <button className="botao-secundario com-icone" onClick={() => setAEscolher(true)}>
                  <Plus size={18} />
                  {exercicios.length === 0 ? 'Escolher exercício' : 'Outro exercício'}
                </button>
              ) : null}

              {tipo === 'emom' && exercicios.length > 1 && (
                <p className="nota">
                  EMOM alternado: {exercicios.map((_, i) => `${i + 1} → ${letraExercicio(i)}`).join(', ')},{' '}
                  {exercicios.length + 1} → A…
                </p>
              )}

              {exercicios.length > 0 && (
                <p className="nota">
                  Reps / Tempo: cada exercício conta reps ou segundos (dá para mudar depois nas opções do bloco).
                  {onMudarPesoCorporal &&
                    ' PC = peso corporal (o peso de cada série é o extra); vale para o exercício em todos os treinos.'}
                </p>
              )}

              {tipo === 'superserie' && exercicios.length < 2 && (
                <p className="nota">Uma super série tem 2 ou mais exercícios.</p>
              )}

              {tipo !== 'serie' && (
                <button className="botao-criar-bloco" onClick={() => criar(exercicios)} disabled={!podeCriar || aCriar}>
                  {aCriar ? 'A criar...' : 'Criar bloco'}
                </button>
              )}

              <button
                className="botao-link botao-voltar-tipo com-icone"
                onClick={() => {
                  setTipo(null)
                  setConfig(null)
                }}
              >
                <ChevronLeft size={16} />
                Mudar o tipo
              </button>
            </>
          )}
          {erro && <p className="erro">{erro}</p>}
        </div>
      </Janela>

      {aEscolher && (
        <EscolherExercicio
          titulo={exercicios.length === 0 ? 'Escolher exercício' : 'Outro exercício'}
          jaEscolhidos={exercicios.map((e) => e.id)}
          onEscolher={escolherExercicio}
          onFechar={() => setAEscolher(false)}
        />
      )}
    </>
  )
}
