import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, Ruler } from 'lucide-react'
import { supabase } from './supabase'
import { useAvisos } from './avisos'
import { buscarMedicoes } from './consultas'
import Esqueleto from './Esqueleto'
import EstadoVazio from './EstadoVazio'
import FormMedicao from './FormMedicao'
import Pilulas from './Pilulas'
import {
  calcularIdade,
  calcularIMC,
  classificarIMC,
  compararValores,
  diferencaCampo,
  ordenarMedicoes,
  validarAltura,
  validarNascimento,
} from './corpo'
import { dataDeChave } from './estatisticas'
import {
  chaveDia,
  formatarDataCurta,
  formatarDataExtenso,
  formatarPeso,
  limparNome,
  pesoParaInput,
} from './formatar'

// O gráfico (Chart.js) só é descarregado quando há medições para mostrar
const GraficoMedicoes = lazy(() => import('./GraficoMedicoes'))

const SEXOS = [
  { id: 'masculino', nome: 'Masculino' },
  { id: 'feminino', nome: 'Feminino' },
]

async function buscarDados() {
  const [perfil, medicoes] = await Promise.all([
    supabase.from('perfil').select('data_nascimento, altura_cm, sexo').maybeSingle(),
    buscarMedicoes(),
  ])
  if (perfil.error) return { erro: perfil.error.message }
  if (medicoes.erro) return { erro: medicoes.erro }
  return {
    perfil: perfil.data ?? { data_nascimento: null, altura_cm: null, sexo: null },
    medicoes: ordenarMedicoes(medicoes.linhas),
  }
}

// Página "Perfil e medições", aberta a partir do menu (com ‹ Voltar)
export default function Perfil({ email, nome, utilizadorId, onVoltar }) {
  const [dados, setDados] = useState(null) // null = a carregar
  const [erro, setErro] = useState('')
  // undefined = fechado; null = nova medição; objeto = editar essa medição
  const [medicaoAberta, setMedicaoAberta] = useState(undefined)

  useEffect(() => {
    let ativo = true
    buscarDados().then((resultado) => {
      if (!ativo) return
      if (resultado.erro) setErro(resultado.erro)
      else setDados(resultado)
    })
    return () => {
      ativo = false
    }
  }, [])

  function perfilGuardado(campos) {
    setDados((atuais) => ({ ...atuais, perfil: { ...atuais.perfil, ...campos } }))
  }

  function medicaoGuardada(medicao) {
    setDados((atuais) => ({
      ...atuais,
      medicoes: ordenarMedicoes([...atuais.medicoes.filter((m) => m.id !== medicao.id), medicao]),
    }))
    setMedicaoAberta(undefined)
  }

  function medicaoApagada(id) {
    setDados((atuais) => ({ ...atuais, medicoes: atuais.medicoes.filter((m) => m.id !== id) }))
    setMedicaoAberta(undefined)
  }

  function indicarAltura() {
    const campo = document.getElementById('campo-altura')
    campo?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    campo?.focus({ preventScroll: true })
  }

  return (
    <div className="vista-detalhe">
      <div className="detalhe-topo">
        <button className="botao-voltar com-icone" onClick={onVoltar}>
          <ChevronLeft size={20} />
          Voltar
        </button>
      </div>
      {erro && <p className="erro">{erro}</p>}

      {dados === null ? (
        !erro && <Esqueleto cartoes={3} linhas={3} />
      ) : (
        <>
          <DadosPessoais
            email={email}
            nome={nome}
            perfil={dados.perfil}
            utilizadorId={utilizadorId}
            onGuardado={perfilGuardado}
          />

          <div className="cabecalho-seccao">
            <h2 className="titulo-seccao">Medições corporais</h2>
            <button className="botao-pequeno com-icone" onClick={() => setMedicaoAberta(null)}>
              <Plus size={16} />
              Nova medição
            </button>
          </div>

          {dados.medicoes.length === 0 ? (
            <EstadoVazio
              icone={Ruler}
              titulo="Ainda não tens medições"
              texto="Regista os valores do relatório InBody da nutricionista para acompanhares a evolução."
            />
          ) : (
            <>
              <UltimaMedicao
                medicoes={dados.medicoes}
                alturaCm={dados.perfil.altura_cm}
                onIndicarAltura={indicarAltura}
              />
              <Suspense fallback={<Esqueleto cartoes={1} linhas={4} />}>
                <GraficoMedicoes medicoes={dados.medicoes} alturaCm={dados.perfil.altura_cm} />
              </Suspense>
              <ListaMedicoes medicoes={dados.medicoes} onAbrir={setMedicaoAberta} />
            </>
          )}
        </>
      )}

      {medicaoAberta !== undefined && (
        <FormMedicao
          key={medicaoAberta?.id ?? 'nova'}
          medicao={medicaoAberta}
          onGuardada={medicaoGuardada}
          onApagada={medicaoApagada}
          onFechar={() => setMedicaoAberta(undefined)}
        />
      )}
    </div>
  )
}

// ---------- Dados pessoais ----------

function DadosPessoais({ email, nome, perfil, utilizadorId, onGuardado }) {
  const [hoje] = useState(() => new Date())
  const [textoNome, setTextoNome] = useState(nome ?? '')
  const [nascimento, setNascimento] = useState(perfil.data_nascimento ?? '')
  const [altura, setAltura] = useState(perfil.altura_cm ? pesoParaInput(perfil.altura_cm) : '')
  const [aGravar, setAGravar] = useState(false)
  const [erro, setErro] = useState('')
  const pedidos = useRef(0)
  const avisar = useAvisos()

  // Grava só os campos indicados; o upsert cria a linha do perfil se ainda não existir
  async function guardar(campos) {
    const id = ++pedidos.current
    setErro('')
    setAGravar(true)
    const { error } = await supabase
      .from('perfil')
      .upsert({ user_id: utilizadorId, ...campos }, { onConflict: 'user_id' })
    if (id !== pedidos.current) return
    setAGravar(false)
    if (error) {
      setErro(error.message)
      return
    }
    avisar('Gravado')
    onGuardado(campos)
  }

  // O nome fica nos dados da conta (user_metadata), não numa tabela: serve para a saudação do início
  async function guardarNome() {
    const valor = limparNome(textoNome)
    setTextoNome(valor)
    if (valor === (nome ?? '')) return
    setErro('')
    setAGravar(true)
    const { error } = await supabase.auth.updateUser({ data: { nome: valor || null } })
    setAGravar(false)
    if (error) return setErro(error.message)
    avisar('Gravado')
  }

  function guardarNascimento() {
    const { valor, erro: mensagem } = validarNascimento(nascimento, hoje)
    if (mensagem) {
      setErro(mensagem)
      setNascimento(perfil.data_nascimento ?? '')
      return
    }
    if (valor !== (perfil.data_nascimento ?? null)) guardar({ data_nascimento: valor })
  }

  function guardarAltura() {
    const { valor, erro: mensagem } = validarAltura(altura)
    if (mensagem) {
      setErro(mensagem)
      setAltura(perfil.altura_cm ? pesoParaInput(perfil.altura_cm) : '')
      return
    }
    setAltura(valor === null ? '' : pesoParaInput(valor))
    const atual = perfil.altura_cm === null || perfil.altura_cm === undefined ? null : Number(perfil.altura_cm)
    if (valor !== atual) guardar({ altura_cm: valor })
  }

  // A idade acompanha o que está escrito, mesmo antes de gravar
  const idade = calcularIdade(validarNascimento(nascimento, hoje).valor, hoje)

  return (
    <div className="cartao dados-pessoais">
      <div className="notas-topo">
        <h2>Dados pessoais</h2>
        {aGravar && <span className="notas-estado">A gravar...</span>}
      </div>

      <p className="subtitulo perfil-rotulo">Email</p>
      <p className="perfil-valor">{email}</p>

      <label className="campo">
        <span className="campo-rotulo">Nome</span>
        <input
          type="text"
          autoComplete="given-name"
          placeholder="Como queres ser tratado no início"
          maxLength={40}
          value={textoNome}
          onChange={(e) => setTextoNome(e.target.value)}
          onBlur={guardarNome}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        />
      </label>

      <div className="campos-perfil">
        <label className="campo">
          <span className="campo-rotulo">
            Data de nascimento
            {idade !== null && <span className="idade"> · {idade} anos</span>}
          </span>
          <input
            type="date"
            value={nascimento}
            max={chaveDia(hoje)}
            onChange={(e) => setNascimento(e.target.value)}
            onBlur={guardarNascimento}
          />
        </label>

        <label className="campo">
          <span className="campo-rotulo">Altura (cm)</span>
          <input
            id="campo-altura"
            type="text"
            inputMode="decimal"
            placeholder="Ex: 175"
            value={altura}
            onChange={(e) => setAltura(e.target.value)}
            onBlur={guardarAltura}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          />
        </label>
      </div>

      <span className="campo-rotulo">Sexo</span>
      <Pilulas
        opcoes={SEXOS}
        valor={perfil.sexo}
        onMudar={(sexo) => sexo !== perfil.sexo && guardar({ sexo })}
        rotulo="Sexo"
      />

      {erro && <p className="erro">{erro}</p>}
    </div>
  )
}

// ---------- Última medição ----------

function Diferenca({ comparacao, unidade = '' }) {
  if (!comparacao) return null
  const { diferenca, sentido, tom, data } = comparacao
  const seta = sentido === 'subiu' ? '▲' : sentido === 'desceu' ? '▼' : '='
  return (
    <span className={`diferenca diferenca-${tom}`} title={`Desde ${formatarDataCurta(dataDeChave(data))}`}>
      {seta}
      {sentido !== 'igual' && ` ${formatarPeso(Math.abs(diferenca))}${unidade}`}
    </span>
  )
}

function UltimaMedicao({ medicoes, alturaCm, onIndicarAltura }) {
  const ultima = medicoes[0]
  const diferenca = (campo) => diferencaCampo(medicoes, 0, campo)

  const imc = calcularIMC(ultima.peso_kg, alturaCm)
  const classificacao = classificarIMC(imc)
  // O IMC compara com a medição anterior (o peso é obrigatório, por isso existe sempre); é neutro
  const anterior = medicoes[1]
  const imcAnterior = anterior ? calcularIMC(anterior.peso_kg, alturaCm) : null
  const comparacaoIMC =
    imc !== null && imcAnterior !== null
      ? {
          ...compararValores(Math.round(imc * 10) / 10, Math.round(imcAnterior * 10) / 10, null),
          data: anterior.data,
        }
      : null

  // Só os campos preenchidos
  const valores = [
    { id: 'gordura_pct', rotulo: '% gordura', unidade: '%' },
    { id: 'massa_muscular_kg', rotulo: 'Massa muscular esquelética', unidade: ' kg' },
    { id: 'massa_gorda_kg', rotulo: 'Massa gorda', unidade: ' kg' },
    { id: 'gordura_visceral', rotulo: 'Gordura visceral', unidade: '', prefixo: 'Nível ' },
    { id: 'pontuacao', rotulo: 'Pontuação InBody', unidade: '' },
  ].filter((v) => ultima[v.id] !== null && ultima[v.id] !== undefined)

  return (
    <div className="cartao ultima-medicao">
      <h2>Última medição</h2>
      <p className="treino-data">{formatarDataExtenso(dataDeChave(ultima.data))}</p>

      <div className="valores-medicao">
        <div className="valor-medicao">
          <span className="valor-medicao-rotulo">Peso</span>
          <span className="valor-medicao-numero">{formatarPeso(ultima.peso_kg)} kg</span>
          <Diferenca comparacao={diferenca('peso_kg')} unidade=" kg" />
        </div>

        <div className="valor-medicao">
          <span className="valor-medicao-rotulo">IMC</span>
          {imc === null ? (
            <button className="botao-link com-icone" onClick={onIndicarAltura}>
              Indicar a altura
              <ChevronRight size={16} />
            </button>
          ) : (
            <>
              <span className="valor-medicao-numero">{formatarPeso(Math.round(imc * 10) / 10)}</span>
              <span className={`etiqueta imc-${classificacao.id}`}>{classificacao.nome}</span>
              <Diferenca comparacao={comparacaoIMC} />
            </>
          )}
        </div>

        {valores.map((v) => (
          <div key={v.id} className="valor-medicao">
            <span className="valor-medicao-rotulo">{v.rotulo}</span>
            <span className="valor-medicao-numero">
              {v.prefixo ?? ''}
              {formatarPeso(ultima[v.id])}
              {v.unidade}
            </span>
            <Diferenca comparacao={diferenca(v.id)} unidade={v.unidade} />
          </div>
        ))}
      </div>

      {medicoes.length > 1 && (
        <p className="nota">
          As setas comparam com a medição anterior que tem esse valor. Verde: mudança favorável;
          vermelho: desfavorável. O peso fica neutro, porque depende do objetivo.
        </p>
      )}
      {imc !== null && (
        <p className="nota">
          O IMC não distingue músculo de gordura: com muita massa muscular pode indicar excesso de
          peso sem haver excesso de gordura.
        </p>
      )}
    </div>
  )
}

// ---------- Lista de medições ----------

function ListaMedicoes({ medicoes, onAbrir }) {
  return (
    <div className="cartao lista-exercicios">
      {medicoes.map((m) => (
        <button key={m.id} className="linha-exercicio linha-medicao" onClick={() => onAbrir(m)}>
          <span className="linha-exercicio-nome">{formatarDataCurta(dataDeChave(m.data))}</span>
          <span className="linha-exercicio-info">
            {[
              `${formatarPeso(m.peso_kg)} kg`,
              m.gordura_pct !== null && `${formatarPeso(m.gordura_pct)}% gordura`,
              m.massa_muscular_kg !== null && `${formatarPeso(m.massa_muscular_kg)} kg músculo`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
          <ChevronRight size={20} className="seta" aria-hidden="true" />
        </button>
      ))}
    </div>
  )
}
