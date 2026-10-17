import { useEffect, useState } from 'react'
import { supabase } from './supabase'

// Minúsculas e sem acentos, para pesquisar "supino" e encontrar "Supino" ou "Supíno"
function normalizar(texto) {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

export default function EscolherExercicio({ jaEscolhidos = [], onEscolher, onFechar }) {
  const [exercicios, setExercicios] = useState(null) // null = a carregar
  const [pesquisa, setPesquisa] = useState('')
  const [erro, setErro] = useState('')
  const [aCriar, setACriar] = useState(false)

  useEffect(() => {
    let ativo = true
    supabase
      .from('exercicios')
      .select('id, nome')
      .then(({ data, error }) => {
        if (!ativo) return
        if (error) {
          setErro(error.message)
          setExercicios([])
        } else {
          setExercicios([...data].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-PT')))
        }
      })
    return () => {
      ativo = false
    }
  }, [])

  useEffect(() => {
    function teclaPremida(e) {
      if (e.key === 'Escape') onFechar()
    }
    window.addEventListener('keydown', teclaPremida)
    return () => window.removeEventListener('keydown', teclaPremida)
  }, [onFechar])

  const nomeNovo = pesquisa.trim().replace(/\s+/g, ' ')
  const lista = exercicios ?? []
  const filtrados = lista.filter((e) => normalizar(e.nome).includes(normalizar(nomeNovo)))
  const existeIgual = lista.some((e) => e.nome.toLowerCase() === nomeNovo.toLowerCase())
  const podeCriar = nomeNovo !== '' && !existeIgual && exercicios !== null

  async function criar() {
    setACriar(true)
    setErro('')
    const { data, error } = await supabase
      .from('exercicios')
      .insert({ nome: nomeNovo })
      .select('id, nome')
      .single()
    setACriar(false)
    if (error) return setErro(error.message)
    onEscolher(data)
  }

  // Enter no teclado: escolhe o único resultado ou cria o exercício
  function submeter(e) {
    e.preventDefault()
    if (filtrados.length === 1 && nomeNovo !== '') onEscolher(filtrados[0])
    else if (podeCriar && !aCriar) criar()
  }

  return (
    <div className="sheet-fundo" onClick={onFechar}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Escolher exercício"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-topo">
          <h2>Escolher exercício</h2>
          <button className="botao-fechar" onClick={onFechar} aria-label="Fechar">
            ×
          </button>
        </div>

        <form onSubmit={submeter}>
          <input
            type="search"
            placeholder="Pesquisar ou criar exercício"
            value={pesquisa}
            onChange={(e) => setPesquisa(e.target.value)}
            autoFocus
            enterKeyHint="go"
          />
        </form>

        {erro && <p className="erro">{erro}</p>}

        {podeCriar && (
          <button className="botao-criar" onClick={criar} disabled={aCriar}>
            {aCriar ? 'A criar...' : `+ Criar «${nomeNovo}»`}
          </button>
        )}

        <div className="sheet-lista">
          {exercicios === null && <p className="subtitulo">A carregar...</p>}

          {exercicios !== null && exercicios.length === 0 && !nomeNovo && (
            <p className="subtitulo">
              Ainda não tens exercícios. Escreve o nome de um (por exemplo, «Supino plano») para o
              criar.
            </p>
          )}

          {exercicios !== null && exercicios.length > 0 && filtrados.length === 0 && (
            <p className="subtitulo">Nenhum exercício encontrado.</p>
          )}

          <ul className="lista">
            {filtrados.map((exercicio) => (
              <li key={exercicio.id}>
                <button className="opcao-exercicio" onClick={() => onEscolher(exercicio)}>
                  {exercicio.nome}
                  {jaEscolhidos.includes(exercicio.id) && <span className="ja-escolhido">✓</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
