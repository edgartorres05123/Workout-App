import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { buscarExercicios, buscarTudo, SELECT_EXERCICIO } from './consultas'
import DetalheExercicio from './DetalheExercicio'
import { estatisticasPorExercicio } from './estatisticas'
import { formatarDataCurta, limparNome, nomesIguais, normalizarTexto } from './formatar'
import { nomeMusculo, ordenarMusculos } from './musculos'

function ordenarPorNome(exercicios) {
  return [...exercicios].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-PT'))
}

// Exercícios com os músculos, e as estatísticas de cada um (só treinos terminados, sem aquecimento)
async function buscarDados() {
  const [exercicios, treinos] = await Promise.all([
    buscarExercicios(),
    buscarTudo(() =>
      supabase
        .from('treinos')
        .select('id, data, series(exercicio_id, aquecimento)')
        .not('duracao_min', 'is', null)
        .order('id')
    ),
  ])
  if (exercicios.erro || treinos.erro) return { erro: exercicios.erro ?? treinos.erro }
  return {
    exercicios: ordenarPorNome(exercicios.linhas),
    estatisticas: estatisticasPorExercicio(treinos.linhas),
  }
}

// Montado de novo sempre que o separador é aberto, por isso recarrega sozinho.
// soSemMusculosInicial: abre já com o filtro "Sem músculos" (atalho das Estatísticas).
export default function Exercicios({ soSemMusculosInicial = false }) {
  const [exercicios, setExercicios] = useState(null) // null = a carregar
  const [estatisticas, setEstatisticas] = useState(() => new Map())
  const [erro, setErro] = useState('')
  const [pesquisa, setPesquisa] = useState('')
  const [soSemMusculos, setSoSemMusculos] = useState(soSemMusculosInicial)
  const [aCriar, setACriar] = useState(false)
  const [abertoId, setAbertoId] = useState(null)
  const ultimoPedido = useRef(0)
  const scrollDaLista = useRef(0)

  function carregar() {
    const id = ++ultimoPedido.current
    return buscarDados().then((resultado) => {
      if (id !== ultimoPedido.current) return
      if (resultado.erro) {
        setErro(resultado.erro)
        setExercicios((atuais) => atuais ?? [])
        return
      }
      setErro('')
      setExercicios(resultado.exercicios)
      setEstatisticas(resultado.estatisticas)
    })
  }

  useEffect(() => {
    carregar()
  }, [])

  function abrir(id) {
    scrollDaLista.current = window.scrollY
    setAbertoId(id)
    window.scrollTo(0, 0)
  }

  function voltar() {
    setAbertoId(null)
    carregar() // as estatísticas podem ter mudado (treinos editados no detalhe)
    requestAnimationFrame(() => window.scrollTo(0, scrollDaLista.current))
  }

  function alterarExercicio(id, atualizar) {
    setExercicios((atuais) => ordenarPorNome(atuais.map((e) => (e.id === id ? atualizar(e) : e))))
  }

  function exercicioApagado(id) {
    setExercicios((atuais) => atuais.filter((e) => e.id !== id))
    voltar()
  }

  // Depois de juntar, o exercício de origem já não existe: abre o de destino
  function exercicioJuntado(destinoId) {
    setAbertoId(destinoId)
    window.scrollTo(0, 0)
    carregar()
  }

  function exercicioCriado(exercicio) {
    setExercicios((atuais) => ordenarPorNome([...atuais, exercicio]))
    setACriar(false)
    abrir(exercicio.id)
  }

  const lista = exercicios ?? []
  const semMusculos = lista.filter((e) => e.exercicio_musculos.length === 0)
  const termo = normalizarTexto(limparNome(pesquisa))
  const filtrados = (soSemMusculos ? semMusculos : lista).filter((e) =>
    normalizarTexto(e.nome).includes(termo)
  )
  const aberto = lista.find((e) => e.id === abertoId)

  return (
    <div>
      {/* A lista fica escondida (e não desmontada) enquanto o detalhe está aberto */}
      <div hidden={Boolean(aberto)}>
        <h1>Exercícios</h1>

        {aCriar ? (
          <NovoExercicio
            exercicios={lista}
            onCriado={exercicioCriado}
            onAbrir={abrir}
            onCancelar={() => setACriar(false)}
          />
        ) : (
          <button className="botao-secundario botao-novo" onClick={() => setACriar(true)}>
            + Novo exercício
          </button>
        )}

        <input
          type="search"
          placeholder="Pesquisar exercício"
          value={pesquisa}
          onChange={(e) => setPesquisa(e.target.value)}
        />

        <div className="filtros">
          <button
            className={soSemMusculos ? 'filtro' : 'filtro ativo'}
            onClick={() => setSoSemMusculos(false)}
          >
            Todos ({lista.length})
          </button>
          <button
            className={soSemMusculos ? 'filtro ativo' : 'filtro'}
            onClick={() => setSoSemMusculos(true)}
          >
            Sem músculos ({semMusculos.length})
          </button>
        </div>

        {erro && <p className="erro">{erro}</p>}

        {exercicios === null ? (
          <p className="subtitulo">A carregar...</p>
        ) : lista.length === 0 ? (
          <p className="subtitulo">
            Ainda não tens exercícios. Cria o primeiro aqui ou durante um treino.
          </p>
        ) : filtrados.length === 0 ? (
          <p className="subtitulo">
            {soSemMusculos && !termo
              ? 'Todos os exercícios têm músculos associados. 👌'
              : 'Nenhum exercício encontrado.'}
          </p>
        ) : (
          <div className="cartao lista-exercicios">
            {filtrados.map((exercicio) => (
              <LinhaExercicio
                key={exercicio.id}
                exercicio={exercicio}
                estatisticas={estatisticas.get(exercicio.id)}
                onAbrir={() => abrir(exercicio.id)}
              />
            ))}
          </div>
        )}
      </div>

      {aberto && (
        <DetalheExercicio
          key={aberto.id}
          exercicio={aberto}
          todos={lista}
          onVoltar={voltar}
          onAlterar={(atualizar) => alterarExercicio(aberto.id, atualizar)}
          onApagado={() => exercicioApagado(aberto.id)}
          onJuntado={exercicioJuntado}
        />
      )}
    </div>
  )
}

function LinhaExercicio({ exercicio, estatisticas, onAbrir }) {
  return (
    <button className="linha-exercicio" onClick={onAbrir}>
      <span className="linha-exercicio-nome">{exercicio.nome}</span>
      <EtiquetasMusculos musculos={exercicio.exercicio_musculos} />
      <span className="linha-exercicio-info">
        {estatisticas
          ? `${estatisticas.numTreinos} ${estatisticas.numTreinos === 1 ? 'treino' : 'treinos'} · última vez a ${formatarDataCurta(estatisticas.ultima)}`
          : 'Ainda não foi feito'}
      </span>
    </button>
  )
}

function EtiquetasMusculos({ musculos }) {
  if (musculos.length === 0) {
    return (
      <span className="etiquetas">
        <span className="etiqueta etiqueta-aviso">Sem músculos</span>
      </span>
    )
  }
  return (
    <span className="etiquetas">
      {ordenarMusculos(musculos).map((m) => (
        <span
          key={m.musculo}
          className={m.principal ? 'etiqueta etiqueta-principal' : 'etiqueta etiqueta-secundario'}
        >
          {nomeMusculo(m.musculo)}
        </span>
      ))}
    </span>
  )
}

function NovoExercicio({ exercicios, onCriado, onAbrir, onCancelar }) {
  const [nome, setNome] = useState('')
  const [aGravar, setAGravar] = useState(false)
  const [erro, setErro] = useState('')
  const [duplicado, setDuplicado] = useState(null)

  async function criar(e) {
    e.preventDefault()
    const limpo = limparNome(nome)
    setErro('')
    setDuplicado(null)
    if (!limpo) return setErro('Escreve o nome do exercício.')

    const igual = exercicios.find((ex) => nomesIguais(ex.nome, limpo))
    if (igual) return setDuplicado(igual)

    setAGravar(true)
    const { data, error } = await supabase
      .from('exercicios')
      .insert({ nome: limpo })
      .select(SELECT_EXERCICIO)
      .single()
    setAGravar(false)
    if (error) {
      return setErro(
        error.code === '23505' ? `Já existe um exercício chamado «${limpo}».` : error.message
      )
    }
    onCriado(data)
  }

  return (
    <form className="cartao novo-exercicio" onSubmit={criar}>
      <h2>Novo exercício</h2>
      <input
        placeholder="Ex: Supino inclinado"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        autoFocus
      />
      {erro && <p className="erro">{erro}</p>}
      {duplicado && (
        <p className="aviso">
          Já existe o exercício «{duplicado.nome}».{' '}
          <button type="button" className="botao-link" onClick={() => onAbrir(duplicado.id)}>
            Abrir
          </button>
        </p>
      )}
      <button type="submit" disabled={aGravar}>
        {aGravar ? 'A criar...' : 'Criar'}
      </button>
      <button type="button" className="botao-secundario" onClick={onCancelar}>
        Cancelar
      </button>
    </form>
  )
}
