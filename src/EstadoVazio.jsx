// Estado vazio com ícone e uma frase simpática; children = botões ou texto extra
export default function EstadoVazio({ icone: Icone, titulo, texto, children }) {
  return (
    <div className="cartao vazio">
      {Icone && (
        <span className="vazio-icone" aria-hidden="true">
          <Icone size={32} />
        </span>
      )}
      <p className="vazio-titulo">{titulo}</p>
      {texto && <p className="vazio-texto">{texto}</p>}
      {children}
    </div>
  )
}
