import { useEffect, useId, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { DURACAO_SAIDA_MS, abrirNaPilha, estaNoTopo, reduzirMovimento } from './movimento'

// Janela que sobe do fundo do ecrã (bottom sheet), com o fundo escuro a aparecer em fade.
// Fecha ao tocar fora, no × ou com Esc, com uma animação de saída antes de chamar onFechar.
// baixa = altura conforme o conteúdo (em vez de 85% do ecrã).
export default function Janela({ titulo, onFechar, baixa = false, children }) {
  const id = useId()
  const [aFechar, setAFechar] = useState(false)
  const refOnFechar = useRef(onFechar)

  useEffect(() => {
    refOnFechar.current = onFechar
  }, [onFechar])

  function fechar() {
    if (aFechar) return
    setAFechar(true)
    setTimeout(() => refOnFechar.current(), reduzirMovimento() ? 0 : DURACAO_SAIDA_MS)
  }

  // A função de fechar muda a cada desenho; o Esc usa sempre a mais recente
  const refFechar = useRef(fechar)
  useEffect(() => {
    refFechar.current = fechar
  })

  useEffect(() => {
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

  return (
    <div className={aFechar ? 'sheet-fundo a-fechar' : 'sheet-fundo'} onClick={fechar}>
      <div
        className={baixa ? 'sheet sheet-baixa' : 'sheet'}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-pega" aria-hidden="true" />
        <div className="sheet-topo">
          <h2>{titulo}</h2>
          <button className="botao-fechar" onClick={fechar} aria-label="Fechar">
            <X size={22} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
