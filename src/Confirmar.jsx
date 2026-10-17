import { useEffect, useId, useRef } from 'react'
import { TriangleAlert } from 'lucide-react'
import { abrirNaPilha, estaNoTopo } from './movimento'

// Janela de confirmação no estilo da app (substitui o confirm() do browser).
// perigo = true para ações destrutivas: o botão de confirmar fica a vermelho.
// Se não houver onConfirmar, é só um aviso com um botão para fechar.
export default function Confirmar({
  titulo,
  children,
  textoConfirmar = 'Confirmar',
  textoCancelar = 'Cancelar',
  perigo = true,
  aProcessar = false,
  onConfirmar,
  onCancelar,
}) {
  const id = useId()
  const refBotao = useRef(null)
  const refCancelar = useRef(onCancelar)

  useEffect(() => {
    refCancelar.current = onCancelar
  }, [onCancelar])

  useEffect(() => {
    refBotao.current?.focus()
    const sair = abrirNaPilha(id)
    function teclaPremida(e) {
      if (e.key === 'Escape' && estaNoTopo(id)) refCancelar.current()
    }
    window.addEventListener('keydown', teclaPremida)
    return () => {
      sair()
      window.removeEventListener('keydown', teclaPremida)
    }
  }, [id])

  return (
    <div className="confirmar-fundo" onClick={aProcessar ? undefined : onCancelar}>
      <div
        className="confirmar"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${id}-titulo`}
        onClick={(e) => e.stopPropagation()}
      >
        {perigo && (
          <span className="confirmar-icone" aria-hidden="true">
            <TriangleAlert size={24} />
          </span>
        )}
        <h2 id={`${id}-titulo`}>{titulo}</h2>
        <div className="confirmar-texto">{children}</div>
        <div className="confirmar-botoes">
          {onConfirmar && (
            <button
              ref={refBotao}
              className={perigo ? 'botao-perigo-cheio' : undefined}
              onClick={onConfirmar}
              disabled={aProcessar}
            >
              {aProcessar ? 'Um momento...' : textoConfirmar}
            </button>
          )}
          <button
            ref={onConfirmar ? undefined : refBotao}
            className="botao-secundario"
            onClick={onCancelar}
            disabled={aProcessar}
          >
            {textoCancelar}
          </button>
        </div>
      </div>
    </div>
  )
}
