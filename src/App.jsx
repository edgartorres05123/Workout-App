import { lazy, Suspense, useEffect, useState } from 'react'
import { CalendarDays, ChartColumn, Download, House, ListChecks, LogOut, User, WifiOff } from 'lucide-react'
import { version as versaoApp } from '../package.json'
import { supabase } from './supabase'
import { useAvisos } from './avisos'
import Cabecalho from './Cabecalho'
import Confirmar from './Confirmar'
import Esqueleto from './Esqueleto'
import Login from './Login'
import ProvedorAvisos from './ProvedorAvisos'
import Treino from './Treino'

// Só o separador Início (com o editor de treino) vai no ficheiro principal, para abrir depressa no
// ginásio; os outros ecrãs (e o Chart.js) são descarregados quando são abertos. Sem rede também
// abrem, porque o service worker guarda todos estes ficheiros.
const Historico = lazy(() => import('./Historico'))
const Exercicios = lazy(() => import('./Exercicios'))
const PaginaEstatisticas = lazy(() => import('./PaginaEstatisticas'))
const Perfil = lazy(() => import('./Perfil'))
// O menu só é descarregado quando se toca no ☰ pela primeira vez
const MenuLateral = lazy(() => import('./MenuLateral'))

export default function App() {
  const [session, setSession] = useState(null)
  const [aCarregar, setACarregar] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setACarregar(false)
    })

    // Também é chamado quando o nome muda no Perfil (USER_UPDATED), para a saudação se atualizar
    const { data } = supabase.auth.onAuthStateChange((_evento, novaSessao) => {
      setSession(novaSessao)
    })

    return () => data.subscription.unsubscribe()
  }, [])

  return (
    <ProvedorAvisos>
      {aCarregar ? (
        <div className="sem-cabecalho">
          <Esqueleto titulo numeros={3} cartoes={2} />
        </div>
      ) : !session ? (
        <>
          <AvisoSemLigacao />
          <Login />
        </>
      ) : (
        <Principal
          email={session.user.email}
          nome={session.user.user_metadata?.nome ?? null}
          utilizadorId={session.user.id}
        />
      )}
    </ProvedorAvisos>
  )
}

// Faixa enquanto o telemóvel estiver sem rede. A interface continua a abrir (o service worker
// guarda o esqueleto da app) e os pedidos que falham mostram a mesma mensagem.
function AvisoSemLigacao() {
  const [ligado, setLigado] = useState(() => navigator.onLine)

  useEffect(() => {
    const aoLigar = () => setLigado(true)
    const aoDesligar = () => setLigado(false)
    window.addEventListener('online', aoLigar)
    window.addEventListener('offline', aoDesligar)
    return () => {
      window.removeEventListener('online', aoLigar)
      window.removeEventListener('offline', aoDesligar)
    }
  }, [])

  if (ligado) return null
  return (
    <div className="aviso-sem-ligacao" role="status">
      <WifiOff size={18} aria-hidden="true" />
      Sem ligação à internet. Os dados aparecem quando voltares a estar online.
    </div>
  )
}

// Separadores da barra de baixo (o Perfil está no menu)
const SEPARADORES = [
  { id: 'treino', nome: 'Início', icone: House },
  { id: 'historico', nome: 'Histórico', icone: CalendarDays },
  { id: 'estatisticas', nome: 'Estatísticas', icone: ChartColumn },
  { id: 'exercicios', nome: 'Exercícios', icone: ListChecks },
]
const TITULOS = Object.fromEntries(SEPARADORES.map((s) => [s.id, s.nome]))

function Principal({ email, nome, utilizadorId }) {
  const [separador, setSeparador] = useState('treino')
  // Opções para o separador aberto (por exemplo, { soSemMusculos: true } nos Exercícios)
  const [opcoes, setOpcoes] = useState({})
  // Página aberta a partir do menu (por cima dos separadores): null | 'perfil'
  const [pagina, setPagina] = useState(null)
  const [menuAberto, setMenuAberto] = useState(false)
  const [confirmarSair, setConfirmarSair] = useState(false)
  const [aExportar, setAExportar] = useState(false)
  // O separador Início diz ao cabeçalho o título, se tem a imagem por baixo e se há treino ao vivo
  const [cabecalhoInicio, setCabecalhoInicio] = useState({ titulo: 'Início', hero: false, emCurso: false })
  const avisar = useAvisos()

  function irPara(id, novasOpcoes = {}) {
    setPagina(null)
    setSeparador(id)
    setOpcoes(novasOpcoes)
    window.scrollTo(0, 0)
  }

  function abrirPagina(id) {
    setPagina(id)
    window.scrollTo(0, 0)
  }

  async function exportar() {
    setAExportar(true)
    const { exportarParaFicheiro } = await import('./exportar')
    const resultado = await exportarParaFicheiro()
    setAExportar(false)
    if (resultado.erro) return avisar(resultado.erro, 'erro')
    avisar('Exportado')
  }

  // Entradas do menu. Para acrescentar uma (por exemplo, "Treinos favoritos"), basta pôr aqui
  // mais um objeto com o nome, o ícone e a ação. Nada aqui descarta o treino em curso.
  const entradasMenu = [
    { id: 'perfil', nome: 'Perfil e medições', icone: User, onEscolher: () => abrirPagina('perfil') },
    {
      id: 'exportar',
      nome: aExportar ? 'A exportar...' : 'Exportar dados',
      icone: Download,
      desativada: aExportar,
      onEscolher: exportar,
    },
    { id: 'sair', nome: 'Sair', icone: LogOut, perigo: true, onEscolher: () => setConfirmarSair(true) },
  ]

  const noInicio = !pagina && separador === 'treino'
  const titulo = pagina === 'perfil' ? 'Perfil e medições' : noInicio ? cabecalhoInicio.titulo : TITULOS[separador]

  return (
    <div className="com-navegacao">
      <Cabecalho titulo={titulo} sobreImagem={noInicio && cabecalhoInicio.hero} onMenu={() => setMenuAberto(true)} />
      <AvisoSemLigacao />

      {/* O Início fica sempre montado: o treino em curso nunca se perde ao mudar de ecrã */}
      <div hidden={!noInicio}>
        <Treino nome={nome} ativo={noInicio} onCabecalho={setCabecalhoInicio} />
      </div>

      {/* Os outros ecrãs são montados de novo sempre que se abrem, para recarregar os dados */}
      <Suspense fallback={<Esqueleto cartoes={3} />}>
        <div className="vista-separador" key={pagina ?? separador} hidden={noInicio}>
          {pagina === 'perfil' ? (
            <Perfil
              email={email}
              nome={nome}
              utilizadorId={utilizadorId}
              onVoltar={() => {
                setPagina(null)
                window.scrollTo(0, 0)
              }}
            />
          ) : (
            <>
              {separador === 'historico' && <Historico />}
              {separador === 'estatisticas' && <PaginaEstatisticas onIrPara={irPara} />}
              {separador === 'exercicios' && (
                <Exercicios soSemMusculosInicial={Boolean(opcoes.soSemMusculos)} />
              )}
            </>
          )}
        </div>
      </Suspense>

      <nav className="navegacao" aria-label="Separadores">
        {SEPARADORES.map(({ id, nome: rotulo, icone: Icone }) => {
          const ativo = !pagina && separador === id
          return (
            <button
              key={id}
              className={ativo ? 'ativo' : ''}
              onClick={() => irPara(id)}
              aria-current={ativo ? 'page' : undefined}
            >
              <Icone size={24} strokeWidth={ativo ? 2.4 : 2} aria-hidden="true" />
              <span>{rotulo}</span>
            </button>
          )
        })}
      </nav>

      {menuAberto && (
        <Suspense fallback={null}>
          <MenuLateral
            nome={nome}
            email={email}
            entradas={entradasMenu}
            versao={versaoApp}
            onFechar={() => setMenuAberto(false)}
          />
        </Suspense>
      )}

      {confirmarSair && (
        <Confirmar
          titulo="Sair da conta?"
          textoConfirmar="Sair"
          onConfirmar={() => supabase.auth.signOut()}
          onCancelar={() => setConfirmarSair(false)}
        >
          <p>
            {cabecalhoInicio.emCurso
              ? 'O treino em curso fica guardado e continua quando voltares a entrar.'
              : 'Para voltares a entrar, vais precisar do email e da palavra-passe.'}
          </p>
        </Confirmar>
      )}
    </div>
  )
}
