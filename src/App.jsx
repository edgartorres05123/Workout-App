import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, ChartColumn, Download, House, Lightbulb, ListChecks, LogOut, Star, Target, User, WifiOff } from 'lucide-react'
import { version as versaoApp } from '../package.json'
import { supabase } from './supabase'
import { useAvisos } from './avisos'
import Cabecalho from './Cabecalho'
import { buscarPesosCorporais } from './consultas'
import { ContextoPesoCorporal } from './contextoPesoCorporal'
import { ContextoSemana } from './contextoSemana'
import Confirmar from './Confirmar'
import Esqueleto from './Esqueleto'
import Login from './Login'
import ProvedorAvisos from './ProvedorAvisos'
import { lerObjetivos, objetivosParaGravar } from './semana'
import Treino from './Treino'

// Só o separador Início (com o editor de treino) vai no ficheiro principal, para abrir depressa no
// ginásio; os outros ecrãs (e o Chart.js) são descarregados quando são abertos. Sem rede também
// abrem, porque o service worker guarda todos estes ficheiros.
const Historico = lazy(() => import('./Historico'))
const Exercicios = lazy(() => import('./Exercicios'))
const PaginaEstatisticas = lazy(() => import('./PaginaEstatisticas'))
const Perfil = lazy(() => import('./Perfil'))
const PaginaFavoritos = lazy(() => import('./PaginaFavoritos'))
const PaginaIdeias = lazy(() => import('./PaginaIdeias'))
const ObjetivosSemanais = lazy(() => import('./ObjetivosSemanais'))
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
          objetivosGuardados={session.user.user_metadata?.objetivos_musculos ?? null}
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

// objetivosGuardados: os objetivos semanais por músculo no user_metadata (só os diferentes do padrão)
function Principal({ email, nome, utilizadorId, objetivosGuardados }) {
  const [separador, setSeparador] = useState('treino')
  // Opções para o separador aberto (por exemplo, { soSemMusculos: true } nos Exercícios)
  const [opcoes, setOpcoes] = useState({})
  // Página aberta a partir do menu (por cima dos separadores):
  // null | 'perfil' | 'favoritos' | 'ideias' | 'objetivos'; e as opções dela (por exemplo, { musculos })
  const [pagina, setPagina] = useState(null)
  const [opcoesPagina, setOpcoesPagina] = useState({})
  const [menuAberto, setMenuAberto] = useState(false)
  const [confirmarSair, setConfirmarSair] = useState(false)
  const [aExportar, setAExportar] = useState(false)
  // O separador Início diz ao cabeçalho o título, se tem a imagem por baixo e se há treino ao vivo
  const [cabecalhoInicio, setCabecalhoInicio] = useState({ titulo: 'Início', hero: false, emCurso: false })
  const avisar = useAvisos()
  // Medições (data e peso), para o peso corporal numa data; partilhadas por todos os ecrãs
  const [medicoes, setMedicoes] = useState({ lista: [], carregadas: false })
  // Para começar um treino (ao vivo ou passado) a partir dos favoritos, no separador Início
  const refTreino = useRef(null)

  const recarregarMedicoes = useCallback(() => {
    return buscarPesosCorporais().then((resultado) => {
      // Se falhar (por exemplo, sem rede), as contas usam só o peso extra até à próxima vez
      if (!resultado.erro) setMedicoes({ lista: resultado.linhas, carregadas: true })
    })
  }, [])

  useEffect(() => {
    recarregarMedicoes()
  }, [recarregarMedicoes])

  function irPara(id, novasOpcoes = {}) {
    setPagina(null)
    setSeparador(id)
    setOpcoes(novasOpcoes)
    window.scrollTo(0, 0)
  }

  const abrirPagina = useCallback((id, novasOpcoes = {}) => {
    setPagina(id)
    setOpcoesPagina(novasOpcoes)
    window.scrollTo(0, 0)
  }, [])

  // Objetivos semanais e atalhos dos ecrãs da semana. Gravar os objetivos muda o user_metadata;
  // a sessão é atualizada (USER_UPDATED) e os objetivos novos chegam por objetivosGuardados.
  const semana = useMemo(
    () => ({
      objetivos: lerObjetivos(objetivosGuardados),
      guardarObjetivos: async (objetivos) => {
        const { error } = await supabase.auth.updateUser({
          data: { objetivos_musculos: objetivosParaGravar(objetivos) },
        })
        return error ? error.message : null
      },
      abrirIdeias: (opcoesIdeias = {}) => abrirPagina('ideias', opcoesIdeias),
      abrirSemMusculos: () => {
        setPagina(null)
        setSeparador('exercicios')
        setOpcoes({ soSemMusculos: true })
        window.scrollTo(0, 0)
      },
    }),
    [objetivosGuardados, abrirPagina]
  )

  const pesoCorporal = useMemo(
    () => ({
      medicoes: medicoes.lista,
      carregadas: medicoes.carregadas,
      recarregar: recarregarMedicoes,
      abrirPerfil: () => abrirPagina('perfil'),
    }),
    [medicoes, recarregarMedicoes, abrirPagina]
  )

  // "Começar" ou "Registar passado" a partir de um favorito: vai para o Início e pede ao separador
  // que comece o treino com a estrutura copiada (ou abra a janela do treino passado)
  function comecarFavorito(modo, favorito) {
    irPara('treino')
    refTreino.current?.comecarComFavorito(modo, favorito)
  }

  // Para as ideias de treino: mensagem se agora não der para começar um treino (há um em curso)
  function motivoParaNaoComecar() {
    return refTreino.current?.motivoParaNaoComecar() ?? 'Um momento: a app ainda está a abrir.'
  }

  async function exportar() {
    setAExportar(true)
    const { exportarParaFicheiro } = await import('./exportar')
    const resultado = await exportarParaFicheiro()
    setAExportar(false)
    if (resultado.erro) return avisar(resultado.erro, 'erro')
    avisar('Exportado')
  }

  // Entradas do menu. Para acrescentar uma (por exemplo, "Ideias de treino"), basta pôr aqui
  // mais um objeto com o nome, o ícone e a ação. Nada aqui descarta o treino em curso.
  const entradasMenu = [
    { id: 'ideias', nome: 'Ideias de treino', icone: Lightbulb, onEscolher: () => abrirPagina('ideias') },
    { id: 'favoritos', nome: 'Treinos favoritos', icone: Star, onEscolher: () => abrirPagina('favoritos') },
    { id: 'objetivos', nome: 'Objetivos semanais', icone: Target, onEscolher: () => abrirPagina('objetivos') },
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
  const TITULOS_PAGINAS = {
    perfil: 'Perfil e medições',
    favoritos: 'Treinos favoritos',
    ideias: 'Ideias de treino',
    objetivos: 'Objetivos semanais',
  }
  const titulo = pagina ? TITULOS_PAGINAS[pagina] : noInicio ? cabecalhoInicio.titulo : TITULOS[separador]
  const fecharPagina = () => {
    setPagina(null)
    window.scrollTo(0, 0)
  }

  return (
    <ContextoPesoCorporal.Provider value={pesoCorporal}>
    <ContextoSemana.Provider value={semana}>
    <div className="com-navegacao">
      <Cabecalho titulo={titulo} sobreImagem={noInicio && cabecalhoInicio.hero} onMenu={() => setMenuAberto(true)} />
      <AvisoSemLigacao />

      {/* O Início fica sempre montado: o treino em curso nunca se perde ao mudar de ecrã */}
      <div hidden={!noInicio}>
        <Treino
          ref={refTreino}
          nome={nome}
          ativo={noInicio}
          onCabecalho={setCabecalhoInicio}
          onVerFavoritos={() => abrirPagina('favoritos')}
        />
      </div>

      {/* Os outros ecrãs são montados de novo sempre que se abrem, para recarregar os dados */}
      <Suspense fallback={<Esqueleto cartoes={3} />}>
        <div className="vista-separador" key={pagina ?? separador} hidden={noInicio}>
          {pagina === 'perfil' ? (
            <Perfil email={email} nome={nome} utilizadorId={utilizadorId} onVoltar={fecharPagina} />
          ) : pagina === 'favoritos' ? (
            <PaginaFavoritos onVoltar={fecharPagina} onComecar={comecarFavorito} />
          ) : pagina === 'ideias' ? (
            <PaginaIdeias
              musculosIniciais={opcoesPagina.musculos ?? null}
              onVerificar={motivoParaNaoComecar}
              onComecar={comecarFavorito}
              onVoltar={fecharPagina}
            />
          ) : pagina === 'objetivos' ? (
            <ObjetivosSemanais onVoltar={fecharPagina} />
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
    </ContextoSemana.Provider>
    </ContextoPesoCorporal.Provider>
  )
}
