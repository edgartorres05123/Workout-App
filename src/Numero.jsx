// Um número grande com um rótulo por baixo (duração, volume, ...). destaque = número a verde
export default function Numero({ valor, rotulo, destaque = false }) {
  return (
    <div className="numero">
      <span className={destaque ? 'numero-valor verde' : 'numero-valor'}>{valor}</span>
      <span className="numero-rotulo">{rotulo}</span>
    </div>
  )
}
