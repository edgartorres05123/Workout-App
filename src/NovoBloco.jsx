import { useState } from 'react'
import { ChevronLeft, Plus, X } from 'lucide-react'
import EscolherExercicio from './EscolherExercicio'
import IconeBloco from './IconeBloco'
import Janela from './Janela'
import { MINIMO_EXERCICIOS, NOME_TIPO, TIPOS_BLOCO, letraExercicio } from './blocos'

// Janela para criar um bloco: primeiro o tipo, depois os exercícios.
// onCriar(tipo, exercicios) devolve uma mensagem de erro, ou null se correu bem.
// onMudarPesoCorporal(exercicio, valor): liga ou desliga o peso corporal (em todos os treinos).
export default function NovoBloco({ onCriar, onMudarPesoCorporal, onFechar }) {
  const [tipo, setTipo] = useState(null)
  const [exercicios, setExercicios] = useState([])
  const [aEscolher, setAEscolher] = useState(false)
  const [aCriar, setACriar] = useState(false)
  const [erro, setErro] = useState('')

  async function criar(lista) {
    setACriar(true)
    setErro('')
    const mensagem = await onCriar(tipo, lista)
    setACriar(false)
    if (mensagem) setErro(mensagem)
  }

  function escolherTipo(id) {
    setTipo(id)
    setAEscolher(true)
  }

  function escolherExercicio(exercicio) {
    setAEscolher(false)
    if (exercicios.some((e) => e.id === exercicio.id)) return
    const lista = [...exercicios, exercicio]
    setExercicios(lista)
    // Uma série tem um só exercício: cria logo o bloco
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

  const podeCriar = tipo && exercicios.length >= MINIMO_EXERCICIOS[tipo]

  return (
    <>
      <Janela titulo={tipo ? `Novo bloco · ${NOME_TIPO[tipo]}` : 'Novo bloco'} onFechar={onFechar} baixa>
        <div className={`sheet-lista${tipo ? ` tipo-${tipo}` : ''}`}>
          {!tipo ? (
            <div className="tipos-bloco">
              {TIPOS_BLOCO.map((t) => (
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
          ) : (
            <>
              {exercicios.length > 0 && (
                <ul className="lista">
                  {exercicios.map((e, i) => (
                    <li key={e.id} className="linha-escolhida">
                      <span className="letra">{letraExercicio(i)}</span>
                      <span className="linha-escolhida-nome">{e.nome}</span>
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

              {exercicios.length > 0 && onMudarPesoCorporal && (
                <p className="nota">
                  PC = peso corporal (o peso de cada série é o extra). Toca em PC para ligar ou desligar: vale
                  para o exercício em todos os treinos.
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

              <button className="botao-link botao-voltar-tipo com-icone" onClick={() => setTipo(null)}>
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
