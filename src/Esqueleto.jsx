// Esqueleto de carregamento a pulsar, no lugar de "A carregar...".
// cartoes: quantos cartões; linhas: linhas de texto em cada um; numeros: uma fila de cartões pequenos
export default function Esqueleto({ cartoes = 3, linhas = 2, numeros = 0, titulo = false }) {
  return (
    <div className="esqueleto" role="status" aria-label="A carregar">
      {titulo && <div className="esqueleto-bloco esqueleto-titulo" />}
      {numeros > 0 && (
        <div className="esqueleto-numeros">
          {Array.from({ length: numeros }, (_, i) => (
            <div key={i} className="esqueleto-bloco esqueleto-numero" />
          ))}
        </div>
      )}
      {Array.from({ length: cartoes }, (_, i) => (
        <div key={i} className="esqueleto-cartao">
          {Array.from({ length: linhas }, (_, j) => (
            <div key={j} className="esqueleto-bloco esqueleto-linha" style={{ width: `${j === 0 ? 55 : 85 - j * 10}%` }} />
          ))}
        </div>
      ))}
    </div>
  )
}
