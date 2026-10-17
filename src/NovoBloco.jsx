import { useEffect, useState } from 'react'
import EscolherExercicio from './EscolherExercicio'
import { MINIMO_EXERCICIOS, NOME_TIPO, TIPOS_BLOCO, letraExercicio } from './blocos'

// Janela para criar um bloco: primeiro o tipo, depois os exercícios.
// onCriar(tipo, exercicios) devolve uma mensagem de erro, ou null se correu bem.
export default function NovoBloco({ onCriar, onFechar }) {
  const [tipo, setTipo] = useState(null)
  const [exercicios, setExercicios] = useState([])
  const [aEscolher, setAEscolher] = useState(false)
  const [aCriar, setACriar] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    function teclaPremida(e) {
      if (e.key === 'Escape' && !aEscolher) onFechar()
    }
    window.addEventListener('keydown', teclaPremida)
    return () => window.removeEventListener('keydown', teclaPremida)
  }, [onFechar, aEscolher])

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

  const podeCriar = tipo && exercicios.length >= MINIMO_EXERCICIOS[tipo]

  return (
    <>
      <div className="sheet-fundo" onClick={onFechar}>
        <div
          className="sheet sheet-baixa"
          role="dialog"
          aria-modal="true"
          aria-label="Novo bloco"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="sheet-topo">
            <h2>{tipo ? `Novo bloco · ${NOME_TIPO[tipo]}` : 'Novo bloco'}</h2>
            <button className="botao-fechar" onClick={onFechar} aria-label="Fechar">
              ×
            </button>
          </div>

          <div className="sheet-lista">
            {!tipo ? (
              <div className="tipos-bloco">
                {TIPOS_BLOCO.map((t) => (
                  <button key={t.id} className="tipo-opcao" onClick={() => escolherTipo(t.id)}>
                    <span className="tipo-opcao-nome">{t.nome}</span>
                    <span className="tipo-opcao-descricao">{t.descricao}</span>
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
                          className="botao-apagar"
                          onClick={() => setExercicios(exercicios.filter((x) => x.id !== e.id))}
                          aria-label={`Tirar ${e.nome}`}
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {tipo !== 'serie' || exercicios.length === 0 ? (
                  <button className="botao-secundario" onClick={() => setAEscolher(true)}>
                    {exercicios.length === 0 ? '+ Escolher exercício' : '+ Outro exercício'}
                  </button>
                ) : null}

                {tipo === 'superserie' && exercicios.length < 2 && (
                  <p className="nota">Uma super série tem 2 ou mais exercícios.</p>
                )}

                {tipo !== 'serie' && (
                  <button className="botao-criar-bloco" onClick={() => criar(exercicios)} disabled={!podeCriar || aCriar}>
                    {aCriar ? 'A criar...' : 'Criar bloco'}
                  </button>
                )}

                <button className="botao-link botao-voltar-tipo" onClick={() => setTipo(null)}>
                  ‹ Mudar o tipo
                </button>
              </>
            )}
            {erro && <p className="erro">{erro}</p>}
          </div>
        </div>
      </div>

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
