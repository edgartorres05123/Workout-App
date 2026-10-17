import { useEffect, useState } from 'react'
import { Check, Plus, Search } from 'lucide-react'
import { supabase } from './supabase'
import Esqueleto from './Esqueleto'
import Janela from './Janela'
import { normalizarTexto } from './formatar'
import { nomeMusculo, ordenarMusculos } from './musculos'

// Seletor de exercícios (bottom sheet). Criar um exercício aqui não pede os músculos,
// para não interromper o treino: fica "Sem músculos" e completa-se no separador Exercícios.
export default function EscolherExercicio({
  jaEscolhidos = [],
  excluir = [],
  permitirCriar = true,
  titulo = 'Escolher exercício',
  onEscolher,
  onFechar,
}) {
  const [exercicios, setExercicios] = useState(null) // null = a carregar
  const [pesquisa, setPesquisa] = useState('')
  const [erro, setErro] = useState('')
  const [aCriar, setACriar] = useState(false)

  useEffect(() => {
    let ativo = true
    supabase
      .from('exercicios')
      .select('id, nome, exercicio_musculos(musculo, principal)')
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

  const nomeNovo = pesquisa.trim().replace(/\s+/g, ' ')
  const lista = (exercicios ?? []).filter((e) => !excluir.includes(e.id))
  const filtrados = lista.filter((e) => normalizarTexto(e.nome).includes(normalizarTexto(nomeNovo)))
  const existeIgual = (exercicios ?? []).some((e) => e.nome.toLowerCase() === nomeNovo.toLowerCase())
  const podeCriar = permitirCriar && nomeNovo !== '' && !existeIgual && exercicios !== null

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
    <Janela titulo={titulo} onFechar={onFechar}>
        <form onSubmit={submeter} className="pesquisa">
          <Search size={18} className="pesquisa-icone" aria-hidden="true" />
          <input
            type="search"
            placeholder={permitirCriar ? 'Pesquisar ou criar exercício' : 'Pesquisar exercício'}
            value={pesquisa}
            onChange={(e) => setPesquisa(e.target.value)}
            autoFocus
            enterKeyHint="go"
          />
        </form>

        {erro && <p className="erro">{erro}</p>}

        {podeCriar && (
          <button className="botao-criar com-icone" onClick={criar} disabled={aCriar}>
            <Plus size={18} />
            {aCriar ? 'A criar...' : `Criar «${nomeNovo}»`}
          </button>
        )}

        <div className="sheet-lista">
          {exercicios === null && <Esqueleto cartoes={4} linhas={1} />}

          {exercicios !== null && lista.length === 0 && !nomeNovo && (
            <p className="subtitulo">
              {permitirCriar
                ? 'Ainda não tens exercícios. Escreve o nome de um (por exemplo, «Supino plano») para o criar.'
                : 'Não há outros exercícios.'}
            </p>
          )}

          {exercicios !== null && lista.length > 0 && filtrados.length === 0 && (
            <p className="subtitulo">Nenhum exercício encontrado.</p>
          )}

          <ul className="lista">
            {filtrados.map((exercicio) => {
              const principais = ordenarMusculos(exercicio.exercicio_musculos).filter(
                (m) => m.principal
              )
              return (
                <li key={exercicio.id}>
                  <button className="opcao-exercicio" onClick={() => onEscolher(exercicio)}>
                    <span className="opcao-texto">
                      {exercicio.nome}
                      {principais.length > 0 && (
                        <span className="opcao-musculos">
                          {principais.map((m) => nomeMusculo(m.musculo)).join(' · ')}
                        </span>
                      )}
                    </span>
                    {jaEscolhidos.includes(exercicio.id) && (
                      <span className="ja-escolhido" aria-label="Já escolhido">
                        <Check size={18} />
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
    </Janela>
  )
}
