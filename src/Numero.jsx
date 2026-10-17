// Um número grande com um rótulo por baixo (duração, volume, ...)
export default function Numero({ valor, rotulo }) {
  return (
    <div className="numero">
      <span className="numero-valor">{valor}</span>
      <span className="numero-rotulo">{rotulo}</span>
    </div>
  )
}
