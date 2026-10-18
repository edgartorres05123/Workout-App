import { useEffect, useId, useRef, useState } from 'react'
import { ChevronRight, X } from 'lucide-react'
import { DURACAO_SAIDA_MS, abrirNaPilha, estaNoTopo, reduzirMovimento } from './movimento'

// Menu que desliza da direita, com o fundo a escurecer. Fecha ao tocar fora, no × ou com Esc.
// entradas: [{ id, nome, icone, perigo?, desativada?, onEscolher }] — a lista vem de quem abre o
// menu, para ser fácil acrescentar entradas novas.
export default function MenuLateral({ nome, email, entradas, versao, onFechar }) {
  const id = useId()
  const [aFechar, setAFechar] = useState(false)
  const refOnFechar = useRef(onFechar)
  const refPainel = useRef(null)

  useEffect(() => {
    refOnFechar.current = onFechar
  }, [onFechar])

  // Fecha com a animação de saída e, no fim, corre a ação escolhida (se houver)
  function fechar(depois) {
    if (aFechar) return
    setAFechar(true)
    setTimeout(() => {
      refOnFechar.current()
      depois?.()
    }, reduzirMovimento() ? 0 : DURACAO_SAIDA_MS)
  }

  const refFechar = useRef(fechar)
  useEffect(() => {
    refFechar.current = fechar
  })

  useEffect(() => {
    refPainel.current?.focus()
    const sair = abrirNaPilha(id)
    function teclaPremida(e) {
      if (e.key === 'Escape' && estaNoTopo(id)) refFechar.current()
    }
    window.addEventListener('keydown', teclaPremida)
    return () => {
      sair()
      window.removeEventListener('keydown', teclaPremida)
    }
  }, [id])

  const inicial = (nome || email || '?').trim().charAt(0).toUpperCase()

  return (
    <div className={aFechar ? 'menu-fundo a-fechar' : 'menu-fundo'} onClick={() => fechar()}>
      <nav
        ref={refPainel}
        className="menu"
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="menu-topo">
          <span className="menu-avatar" aria-hidden="true">
            {inicial}
          </span>
          <span className="menu-conta">
            {nome && <span className="menu-nome">{nome}</span>}
            <span className="menu-email">{email}</span>
          </span>
          <button className="botao-fechar" onClick={() => fechar()} aria-label="Fechar o menu">
            <X size={22} />
          </button>
        </div>

        <ul className="menu-entradas">
          {entradas.map(({ id: chave, nome: rotulo, icone: Icone, perigo, desativada, onEscolher }) => (
            <li key={chave}>
              <button
                className={perigo ? 'menu-entrada perigo' : 'menu-entrada'}
                onClick={() => fechar(onEscolher)}
                disabled={desativada}
              >
                <span className="menu-entrada-icone" aria-hidden="true">
                  <Icone size={20} />
                </span>
                <span className="menu-entrada-nome">{rotulo}</span>
                {!perigo && <ChevronRight size={18} className="seta" aria-hidden="true" />}
              </button>
            </li>
          ))}
        </ul>

        <p className="menu-versao">Workout App · versão {versao}</p>
      </nav>
    </div>
  )
}
