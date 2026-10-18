import { useEffect, useState } from 'react'
import { Menu } from 'lucide-react'

// Cabeçalho dos ecrãs principais: título à esquerda e botão do menu (☰) à direita.
// sobreImagem: o ecrã tem a imagem do início no topo. O cabeçalho fica transparente (e sem
// título, porque a saudação está na imagem) até a saudação chegar a ele com o scroll.
export default function Cabecalho({ titulo, sobreImagem = false, onMenu }) {
  const [passouImagem, setPassouImagem] = useState(false)

  useEffect(() => {
    if (!sobreImagem) return
    function verificar() {
      const saudacao = document.querySelector('.hero-texto')
      const cabecalho = document.querySelector('.cabecalho')
      if (!saudacao || !cabecalho) return setPassouImagem(true)
      setPassouImagem(saudacao.getBoundingClientRect().top <= cabecalho.offsetHeight)
    }
    const pedido = requestAnimationFrame(verificar)
    window.addEventListener('scroll', verificar, { passive: true })
    window.addEventListener('resize', verificar)
    return () => {
      cancelAnimationFrame(pedido)
      window.removeEventListener('scroll', verificar)
      window.removeEventListener('resize', verificar)
    }
  }, [sobreImagem])

  const transparente = sobreImagem && !passouImagem

  return (
    <header className={transparente ? 'cabecalho transparente' : 'cabecalho'}>
      <h1 className="cabecalho-titulo">{titulo}</h1>
      <button className="botao-menu" onClick={onMenu} aria-label="Abrir o menu" aria-haspopup="dialog">
        <Menu size={24} />
      </button>
    </header>
  )
}
