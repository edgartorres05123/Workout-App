import { useEffect, useState } from 'react'
import { History, Search } from 'lucide-react'
import { agruparAtividades, procurarAtividades } from './atividades'
import { buscarUsosAtividades } from './consultas'

// Lista das atividades de cardio e desportos: uma pesquisa, as mais usadas por mim primeiro e depois
// todas, por categoria. onEscolher(id da atividade).
export default function ListaAtividades({ onEscolher, desativada = false }) {
  const [pesquisa, setPesquisa] = useState('')
  const [usos, setUsos] = useState(() => new Map())

  useEffect(() => {
    let ativo = true
    // Sem os usos (por exemplo, sem rede), a lista aparece na mesma, sem as "mais usadas"
    buscarUsosAtividades().then((resultado) => {
      if (ativo && !resultado.erro) setUsos(resultado.usos)
    })
    return () => {
      ativo = false
    }
  }, [])

  const encontradas = procurarAtividades(pesquisa)
  const { usadas, categorias } = agruparAtividades(encontradas, usos)

  return (
    <div className="lista-atividades">
      <div className="pesquisa">
        <Search size={18} className="pesquisa-icone" aria-hidden="true" />
        <input
          type="search"
          placeholder="Pesquisar atividade"
          value={pesquisa}
          onChange={(e) => setPesquisa(e.target.value)}
          aria-label="Pesquisar atividade"
        />
      </div>

      {encontradas.length === 0 && <p className="nota sem-margem-topo">Nenhuma atividade encontrada. Escolhe "Outra atividade".</p>}

      {usadas.length > 0 && (
        <GrupoAtividades
          titulo={
            <span className="com-icone">
              <History size={14} aria-hidden="true" />
              As mais usadas
            </span>
          }
          atividades={usadas}
          onEscolher={onEscolher}
          desativada={desativada}
        />
      )}
      {categorias.map((c) => (
        <GrupoAtividades key={c.id} titulo={c.nome} atividades={c.atividades} onEscolher={onEscolher} desativada={desativada} />
      ))}
    </div>
  )
}

function GrupoAtividades({ titulo, atividades, onEscolher, desativada }) {
  return (
    <section className="grupo-atividades">
      <h4 className="grupo-tipos-nome">{titulo}</h4>
      <div className="grelha-atividades">
        {atividades.map((a) => {
          const Icone = a.icone
          return (
            <button key={a.id} className="atividade-opcao" onClick={() => onEscolher(a.id)} disabled={desativada}>
              <Icone size={18} aria-hidden="true" />
              <span>{a.nome}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
