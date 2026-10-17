// Pílulas para escolher uma opção (métrica, período, ...). opcoes: [{ id, nome }]
export default function Pilulas({ opcoes, valor, onMudar, pequenas = false, rotulo }) {
  return (
    <div className={pequenas ? 'pilulas pequenas' : 'pilulas'} role="tablist" aria-label={rotulo}>
      {opcoes.map((opcao) => (
        <button
          key={opcao.id}
          role="tab"
          aria-selected={opcao.id === valor}
          className={opcao.id === valor ? 'pilula ativa' : 'pilula'}
          onClick={() => onMudar(opcao.id)}
        >
          {opcao.nome}
        </button>
      ))}
    </div>
  )
}
