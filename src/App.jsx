import { lazy, Suspense, useEffect, useState } from 'react'
import { CalendarDays, ChartColumn, Dumbbell, ListChecks, User, WifiOff } from 'lucide-react'
import { supabase } from './supabase'
import ProvedorAvisos from './ProvedorAvisos'
import Esqueleto from './Esqueleto'
import Login from './Login'
import Treino from './Treino'

// Só o ecrã de treino vai no ficheiro principal, para abrir depressa no ginásio; os outros
// separadores (e o Chart.js) são descarregados quando são abertos. Sem rede também abrem,
// porque o service worker guarda todos estes ficheiros.
const Historico = lazy(() => import('./Historico'))
const Exercicios = lazy(() => import('./Exercicios'))
const PaginaEstatisticas = lazy(() => import('./PaginaEstatisticas'))
const Perfil = lazy(() => import('./Perfil'))

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
      <AvisoSemLigacao />
      {aCarregar ? (
        <Esqueleto titulo numeros={3} cartoes={2} />
      ) : !session ? (
        <Login />
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

// Faixa no topo enquanto o telemóvel estiver sem rede. A interface continua a abrir (o service
// worker guarda o esqueleto da app) e os pedidos que falham mostram a mesma mensagem.
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

const SEPARADORES = [
  { id: 'treino', nome: 'Treino', icone: Dumbbell },
  { id: 'historico', nome: 'Histórico', icone: CalendarDays },
  { id: 'exercicios', nome: 'Exercícios', icone: ListChecks },
  { id: 'estatisticas', nome: 'Estatísticas', icone: ChartColumn },
  { id: 'perfil', nome: 'Perfil', icone: User },
]

function Principal({ email, nome, utilizadorId }) {
  const [separador, setSeparador] = useState('treino')
  // Opções para o separador aberto (por exemplo, { soSemMusculos: true } nos Exercícios)
  const [opcoes, setOpcoes] = useState({})

  function irPara(id, novasOpcoes = {}) {
    setSeparador(id)
    setOpcoes(novasOpcoes)
    window.scrollTo(0, 0)
  }

  return (
    <div className="com-navegacao">
      {/* O Treino fica sempre montado para não perder o que está no ecrã ao mudar de separador */}
      <div hidden={separador !== 'treino'}>
        <Treino nome={nome} ativo={separador === 'treino'} />
      </div>
      {/* Os outros separadores são montados de novo sempre que se abrem, para recarregar os dados */}
      <Suspense fallback={<Esqueleto titulo cartoes={3} />}>
        <div className="vista-separador" key={separador} hidden={separador === 'treino'}>
          {separador === 'historico' && <Historico />}
          {separador === 'exercicios' && (
            <Exercicios soSemMusculosInicial={Boolean(opcoes.soSemMusculos)} />
          )}
          {separador === 'estatisticas' && <PaginaEstatisticas onIrPara={irPara} />}
          {separador === 'perfil' && <Perfil email={email} nome={nome} utilizadorId={utilizadorId} />}
        </div>
      </Suspense>

      <nav className="navegacao" aria-label="Separadores">
        {SEPARADORES.map(({ id, nome: rotulo, icone: Icone }) => (
          <button
            key={id}
            className={separador === id ? 'ativo' : ''}
            onClick={() => irPara(id)}
            aria-current={separador === id ? 'page' : undefined}
          >
            <Icone size={24} strokeWidth={separador === id ? 2.4 : 2} aria-hidden="true" />
            <span>{rotulo}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
