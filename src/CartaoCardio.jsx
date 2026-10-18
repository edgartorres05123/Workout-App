import { useState } from 'react'
import { Check, Ellipsis, Plus, Timer, X } from 'lucide-react'
import CamposCardio from './CamposCardio'
import CronometroBloco from './CronometroBloco'
import IconeAtividade from './IconeAtividade'
import { atividadeDoBloco, linhasCardio } from './blocos'
import { campoCalculadoDoEstado, editarCampo, estadoInicialIntervalo, linhaFeita, validarIntervalo } from './cardio'
import { formatarTempo } from './condicionamento'
import { vibrar } from './movimento'

// Um bloco de cardio no editor: a atividade e os intervalos (1 ou mais, como 8 × 400 m), cada um com os
// seus campos e o ✓ (grava logo no Supabase). Um cronómetro opcional mede a duração ao vivo: ao terminar,
// preenche a duração do primeiro intervalo por fazer. As on* devolvem uma mensagem de erro, ou null:
//   onGuardarIntervalo(linha, dados) — dados com duracao_seg = 0 desfaz o intervalo
//   onAdicionarIntervalo(); onRemoverIntervalo(linha)
export default function CartaoCardio({
  bloco,
  titulo,
  aoVivo = false,
  onOpcoes,
  onGuardarIntervalo,
  onAdicionarIntervalo,
  onRemoverIntervalo,
}) {
  const linhas = linhasCardio(bloco)
  const atividadeId = atividadeDoBloco(bloco) ?? 'outra'
  const [estados, setEstados] = useState({}) // linha.id → { valores, editados } escritos à mão
  const [cronometro, setCronometro] = useState(() => aoVivo && !linhas.some(linhaFeita))
  const [aGravar, setAGravar] = useState(null) // id da linha a gravar
  const [erros, setErros] = useState({})
  const [erro, setErro] = useState('')

  const estadoDe = (linha) => estados[linha.id] ?? estadoInicialIntervalo(linha, atividadeId)

  function mudar(linha, campo, texto) {
    setEstados((atuais) => ({ ...atuais, [linha.id]: editarCampo(atuais[linha.id] ?? estadoInicialIntervalo(linha, atividadeId), campo, texto, atividadeId) }))
  }

  function esquecer(linha) {
    setEstados(({ [linha.id]: _removido, ...resto }) => resto)
  }

  const mostrarErro = (linha, mensagem) => setErros((atuais) => ({ ...atuais, [linha.id]: mensagem }))

  async function guardar(linha) {
    const { dados, erro: mensagem } = validarIntervalo(atividadeId, estadoDe(linha).valores)
    if (mensagem) return mostrarErro(linha, mensagem)
    mostrarErro(linha, '')
    setAGravar(linha.id)
    const falha = await onGuardarIntervalo(linha, dados)
    setAGravar(null)
    if (falha) return mostrarErro(linha, falha)
    esquecer(linha)
    return true
  }

  async function alternar(linha) {
    if (!linhaFeita(linha)) {
      if (await guardar(linha)) vibrar(30)
      return
    }
    // Desfaz (a duração volta a 0), mas os números ficam nos campos
    const atual = estadoDe(linha)
    setAGravar(linha.id)
    const falha = await onGuardarIntervalo(linha, { duracao_seg: 0 })
    setAGravar(null)
    if (falha) return mostrarErro(linha, falha)
    setEstados((atuais) => ({ ...atuais, [linha.id]: atual }))
  }

  // Num intervalo já feito, cada campo grava ao sair (se mudou)
  function sair(linha) {
    if (linhaFeita(linha) && estados[linha.id]) guardar(linha)
  }

  async function executar(operacao) {
    setErro('')
    const mensagem = await operacao()
    if (mensagem) setErro(mensagem)
  }

  // Ao terminar o cronómetro: a duração vai para o primeiro intervalo por fazer
  function duracaoCronometrada(segundos) {
    const linha = linhas.find((l) => !linhaFeita(l))
    if (!linha || !segundos) return
    mudar(linha, 'duracao', formatarTempo(segundos))
  }

  return (
    <div className="cartao bloco bloco-cardio">
      <div className="bloco-topo">
        <h2 className="etiqueta-bloco">
          <IconeAtividade atividade={atividadeId} />
          {titulo}
        </h2>
        <button className="botao-opcoes" onClick={onOpcoes} aria-label="Opções do bloco">
          <Ellipsis size={22} />
        </button>
      </div>

      {cronometro && (
        <div className="condicionamento">
          <CronometroBloco
            tipo="cardio"
            chave={`cronometro-bloco-${bloco.id}`}
            modo="crescente"
            textoTerminar="Parar"
            onFim={duracaoCronometrada}
          />
        </div>
      )}

      {linhas.map((linha, i) => {
        const feita = linhaFeita(linha)
        const estado = estadoDe(linha)
        return (
          <div key={linha.id} className={feita ? 'intervalo-cardio feito' : 'intervalo-cardio'}>
            <div className="intervalo-cardio-topo">
              <span className="volta-numero">{i + 1}</span>
              <span className="intervalo-cardio-nome">{linhas.length > 1 ? `Intervalo ${i + 1}` : feita ? 'Feito' : 'Por fazer'}</span>
              {linhas.length > 1 && !feita && (
                <button
                  className="botao-apagar"
                  onClick={() => executar(() => onRemoverIntervalo(linha))}
                  aria-label={`Tirar o intervalo ${i + 1}`}
                >
                  <X size={18} />
                </button>
              )}
              <button
                className={feita ? 'botao-volta feita' : 'botao-volta'}
                onClick={() => alternar(linha)}
                disabled={aGravar === linha.id}
                aria-pressed={feita}
                aria-label={feita ? `Desfazer o intervalo ${i + 1}` : `Marcar o intervalo ${i + 1} como feito`}
              >
                <Check size={26} strokeWidth={3} />
              </button>
            </div>
            <CamposCardio
              atividadeId={atividadeId}
              estado={estado}
              calculado={campoCalculadoDoEstado(estado, atividadeId)}
              onMudar={(campo, texto) => mudar(linha, campo, texto)}
              onSair={() => sair(linha)}
            />
            {erros[linha.id] && <p className="erro">{erros[linha.id]}</p>}
          </div>
        )
      })}

      <div className="linha-botoes acoes-cardio">
        <button className="botao-secundario com-icone" onClick={() => executar(onAdicionarIntervalo)}>
          <Plus size={18} />
          Intervalo
        </button>
        <button
          className={cronometro ? 'botao-secundario com-icone ativo' : 'botao-secundario com-icone'}
          onClick={() => setCronometro((c) => !c)}
          aria-pressed={cronometro}
        >
          <Timer size={18} />
          {cronometro ? 'Esconder cronómetro' : 'Cronometrar'}
        </button>
      </div>

      {bloco.notas && <p className="nota">{bloco.notas}</p>}
      {erro && <p className="erro">{erro}</p>}
    </div>
  )
}
