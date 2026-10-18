import { useEffect, useState } from 'react'
import { CalendarPlus, ChevronLeft, Info, Pencil, Play, Star, StarOff } from 'lucide-react'
import { supabase } from './supabase'
import { useAvisos } from './avisos'
import { buscarFavoritos } from './consultas'
import Esqueleto from './Esqueleto'
import EstadoVazio from './EstadoVazio'
import NomeFavorito from './NomeFavorito'
import { exerciciosDaEstrutura } from './blocos'
import { formatarDataExtenso } from './formatar'

// Página "Treinos favoritos" (aberta a partir do menu). Cada favorito é a estrutura de um treino real:
// começa-se um treino novo (ao vivo ou passado) com os blocos, os exercícios, as voltas e os alvos copiados.
// onComecar(modo, favorito): 'aoVivo' | 'passado'
export default function PaginaFavoritos({ onVoltar, onComecar }) {
  const [favoritos, setFavoritos] = useState(null) // null = a carregar
  const [erro, setErro] = useState('')
  const [aMudarNome, setAMudarNome] = useState(null) // favorito a que se está a mudar o nome
  const avisar = useAvisos()

  useEffect(() => {
    let ativo = true
    buscarFavoritos().then((resultado) => {
      if (!ativo) return
      if (resultado.erro) {
        setErro(resultado.erro)
        setFavoritos([])
      } else {
        setFavoritos(resultado.favoritos)
      }
    })
    return () => {
      ativo = false
    }
  }, [])

  async function mudarNome(favorito, nome) {
    const { error } = await supabase.from('treinos').update({ nome_favorito: nome }).eq('id', favorito.id)
    if (error) return error.message
    setFavoritos((atuais) => atuais.map((f) => (f.id === favorito.id ? { ...f, nome_favorito: nome } : f)))
    setAMudarNome(null)
    avisar('Nome gravado')
    return null
  }

  async function remover(favorito) {
    const { error } = await supabase
      .from('treinos')
      .update({ favorito: false, nome_favorito: null })
      .eq('id', favorito.id)
    if (error) return avisar(error.message, 'erro')
    setFavoritos((atuais) => atuais.filter((f) => f.id !== favorito.id))
    avisar('Removido dos favoritos')
  }

  return (
    <div className="vista-detalhe">
      <div className="detalhe-topo">
        <button className="botao-voltar com-icone" onClick={onVoltar}>
          <ChevronLeft size={20} />
          Voltar
        </button>
      </div>

      {erro && <p className="erro">{erro}</p>}

      {favoritos === null ? (
        <Esqueleto cartoes={3} linhas={3} />
      ) : favoritos.length === 0 ? (
        <EstadoVazio
          icone={Star}
          titulo="Ainda não tens favoritos"
          texto="Abre um treino no Histórico e toca na estrela para o guardar aqui. Depois começas um treino igual com um toque."
        />
      ) : (
        <>
          <p className="nota nota-favoritos com-icone">
            <Info size={14} aria-hidden="true" />
            Cada favorito usa a estrutura do treino original: se o editares no Histórico, o favorito muda com ele.
          </p>
          {favoritos.map((favorito) => (
            <CartaoFavorito
              key={favorito.id}
              favorito={favorito}
              onComecar={() => onComecar('aoVivo', favorito)}
              onRegistar={() => onComecar('passado', favorito)}
              onMudarNome={() => setAMudarNome(favorito)}
              onRemover={() => remover(favorito)}
            />
          ))}
        </>
      )}

      {aMudarNome && (
        <NomeFavorito
          titulo="Mudar o nome"
          inicial={aMudarNome.nome_favorito}
          onGuardar={(nome) => mudarNome(aMudarNome, nome)}
          onFechar={() => setAMudarNome(null)}
        />
      )}
    </div>
  )
}

function CartaoFavorito({ favorito, onComecar, onRegistar, onMudarNome, onRemover }) {
  const { nomes, resto } = exerciciosDaEstrutura(favorito)
  const numBlocos = favorito.blocos?.length ?? 0

  return (
    <div className="cartao cartao-favorito">
      <div className="cartao-favorito-topo">
        <Star size={18} className="estrela-favorito" aria-hidden="true" />
        <h2>{favorito.nome_favorito || 'Treino favorito'}</h2>
      </div>
      <p className="cartao-favorito-detalhe">
        {numBlocos} {numBlocos === 1 ? 'bloco' : 'blocos'}
        {nomes.length > 0 && ` · ${nomes.join(', ')}`}
        {resto > 0 && <span className="mais"> +{resto}</span>}
      </p>
      <p className="nota sem-margem-topo">Treino original: {formatarDataExtenso(favorito.data)}</p>

      <div className="cartao-favorito-acoes">
        <button className="com-icone" onClick={onComecar} disabled={numBlocos === 0}>
          <Play size={18} />
          Começar
        </button>
        <button className="botao-secundario com-icone" onClick={onRegistar} disabled={numBlocos === 0}>
          <CalendarPlus size={18} />
          Registar passado
        </button>
      </div>
      <div className="cartao-favorito-secundarias">
        <button className="botao-terciario com-icone" onClick={onMudarNome}>
          <Pencil size={16} />
          Mudar o nome
        </button>
        <button className="botao-terciario perigo com-icone" onClick={onRemover}>
          <StarOff size={16} />
          Remover
        </button>
      </div>
    </div>
  )
}
