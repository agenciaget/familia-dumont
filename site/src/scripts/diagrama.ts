// Diagrama da árvore genealógica: caixas ligadas por linhas, com zoom, arraste e ramos que abrem e fecham.
import { hierarchy, tree } from 'd3-hierarchy';
import { select } from 'd3-selection';
import 'd3-transition';
import { zoom, zoomIdentity, zoomTransform } from 'd3-zoom';
import type { Pessoa } from '../lib/arvore';

export type Orientacao = 'vertical' | 'horizontal';

const LARGURA = 184;
const ALTURA = 62;
const NIVEL_VERTICAL = 132;
const NIVEL_HORIZONTAL = 252;
const ZOOM_MIN = 0.06;
const ZOOM_MAX = 2;

const esc = (t: string) =>
  t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const rotuloGeracao = (g: number) => (g === 0 ? 'Tronco' : g < 0 ? 'Ascendentes' : `${g}ª geração`);

export function criarDiagrama(palco: HTMLElement, pessoas: Pessoa[], aoEscolher: (id: string) => void) {
  const mundo = palco.querySelector<HTMLElement>('.mundo')!;
  const porId = new Map(pessoas.map((p) => [p.id, p]));
  const filhos = new Map<string, Pessoa[]>();
  for (const p of pessoas) {
    if (!p.paiId) continue;
    if (!filhos.has(p.paiId)) filhos.set(p.paiId, []);
    filhos.get(p.paiId)!.push(p);
  }
  const ramos = (filhos.get('victor') ?? []).map((p) => p.id);

  let orientacao: Orientacao = 'vertical';
  let tronco = 'victor';
  let selecionado: string | null = null;
  const abertos = new Set<string>();
  const posicoes = new Map<string, { x: number; y: number }>();

  const alvo = select(palco);
  const comportamento = zoom<HTMLElement, unknown>()
    .scaleExtent([ZOOM_MIN, ZOOM_MAX])
    // Os botões sobrepostos ao palco não iniciam arraste nem zoom.
    .filter(
      (e) =>
        !(e.target as Element).closest('.palco-controles, .palco-ficha') &&
        (!e.ctrlKey || e.type === 'wheel') &&
        !e.button,
    )
    .on('zoom', (e) => {
      mundo.style.transform = `translate(${e.transform.x}px, ${e.transform.y}px) scale(${e.transform.k})`;
    });
  alvo.call(comportamento).on('dblclick.zoom', null);

  // Foco por teclado em uma caixa fora da vista faria o navegador rolar o palco por dentro.
  palco.addEventListener('scroll', () => palco.scrollTo(0, 0));

  const linhagem = (id: string | null) => {
    const ids = new Set<string>();
    for (let p = id ? porId.get(id) : undefined; p; p = p.paiId ? porId.get(p.paiId) : undefined) ids.add(p.id);
    return ids;
  };

  function abrirPadrao(id: string) {
    abertos.add(id);
  }

  /** Recalcula as posições e redesenha. `ancora` é a pessoa que deve permanecer parada na tela. */
  function desenhar(ancora?: string) {
    const antes = ancora ? posicoes.get(ancora) : undefined;
    const vertical = orientacao === 'vertical';
    const raiz = hierarchy(porId.get(tronco)!, (p) => (abertos.has(p.id) ? filhos.get(p.id) : undefined));
    const nos = tree<Pessoa>()
      .nodeSize(vertical ? [LARGURA + 18, 1] : [ALTURA + 14, 1])
      .separation((a, b) => (a.parent === b.parent ? 1 : 1.25))(raiz);

    posicoes.clear();
    nos.each((n) =>
      posicoes.set(
        n.data.id,
        vertical ? { x: n.x, y: n.depth * NIVEL_VERTICAL } : { x: n.depth * NIVEL_HORIZONTAL, y: n.x },
      ),
    );

    const naLinha = linhagem(selecionado);
    const caminhos = nos
      .links()
      .map((l) => {
        const a = posicoes.get(l.source.data.id)!;
        const b = posicoes.get(l.target.data.id)!;
        const d = vertical
          ? `M${a.x},${a.y + ALTURA / 2}V${(a.y + b.y) / 2}H${b.x}V${b.y - ALTURA / 2}`
          : `M${a.x + LARGURA / 2},${a.y}H${(a.x + b.x) / 2}V${b.y}H${b.x - LARGURA / 2}`;
        return { d, destaque: naLinha.has(l.target.data.id) };
      })
      // As linhas em destaque vão por último para ficarem por cima das outras.
      .sort((a, b) => Number(a.destaque) - Number(b.destaque))
      .map((c) => `<path d="${c.d}"${c.destaque ? ' class="destaque"' : ''}/>`)
      .join('');

    const caixas = nos
      .descendants()
      .map((n) => {
        const p = n.data;
        const { x, y } = posicoes.get(p.id)!;
        const qtd = filhos.get(p.id)?.length ?? 0;
        const aberto = abertos.has(p.id);
        const cc = p.conjuges
          .map((c) => c.nome)
          .filter(Boolean)
          .join(' e ');
        const classes = [
          'no',
          `ramo-${p.ramoId ? ramos.indexOf(p.ramoId) + 1 : 0}`,
          naLinha.has(p.id) ? 'na-linha' : '',
          p.id === selecionado ? 'selecionado' : '',
          n.depth === 0 ? 'raiz' : '',
        ].join(' ');
        return `<div class="${classes}" style="left:${x - LARGURA / 2}px;top:${y - ALTURA / 2}px">
          <button class="no-corpo" data-id="${p.id}" title="${esc(p.nome)}${cc ? ` · c.c. ${esc(cc)}` : ''}">
            <span class="no-nome">${esc(p.nome)}</span>
            ${cc ? `<span class="no-cc">c.c. ${esc(cc)}</span>` : ''}
          </button>
          ${
            qtd
              ? `<button class="no-alternar" data-alternar="${p.id}" aria-expanded="${aberto}" aria-label="${aberto ? 'Recolher' : 'Mostrar'} os ${qtd} filhos de ${esc(p.nome)}">${aberto ? '−' : `+${qtd}`}</button>`
              : ''
          }
        </div>`;
      })
      .join('');

    const todas = [...posicoes.values()];
    const minX = Math.min(...todas.map((p) => p.x));
    const minY = Math.min(...todas.map((p) => p.y));
    const geracaoBase = porId.get(tronco)!.geracao;
    const rotulos = [...new Set(nos.descendants().map((n) => n.depth))]
      .map((nivel) => {
        const estilo = vertical
          ? `left:${minX - LARGURA / 2 - 150}px;top:${nivel * NIVEL_VERTICAL - 10}px;width:130px;text-align:right`
          : `left:${nivel * NIVEL_HORIZONTAL - LARGURA / 2}px;top:${minY - ALTURA / 2 - 34}px;width:${LARGURA}px;text-align:center`;
        return `<div class="rotulo-geracao" style="${estilo}">${rotuloGeracao(geracaoBase + nivel)}</div>`;
      })
      .join('');

    mundo.innerHTML = `<svg aria-hidden="true">${caminhos}</svg>${rotulos}${caixas}`;

    const depois = ancora ? posicoes.get(ancora) : undefined;
    if (antes && depois) {
      const t = zoomTransform(palco);
      alvo.call(
        comportamento.transform,
        zoomIdentity.translate(t.x + t.k * (antes.x - depois.x), t.y + t.k * (antes.y - depois.y)).scale(t.k),
      );
    }
  }

  function irPara(x: number, y: number, k: number, animar = true) {
    const destino = zoomIdentity.translate(x, y).scale(k);
    if (animar) alvo.transition().duration(450).call(comportamento.transform, destino);
    else alvo.call(comportamento.transform, destino);
  }

  function centralizar(id: string, animar = true) {
    const p = posicoes.get(id);
    if (!p || !palco.clientWidth) return;
    const k = Math.max(zoomTransform(palco).k, 0.7);
    irPara(palco.clientWidth / 2 - k * p.x, palco.clientHeight / 2 - k * p.y, k, animar);
  }

  /** Posição inicial: o tronco no alto (ou à esquerda), com os filhos à vista. */
  function inicio(animar = false) {
    if (!palco.clientWidth) return;
    const k = palco.clientWidth < 640 ? 0.6 : 0.9;
    const p = posicoes.get(tronco)!;
    if (orientacao === 'vertical') irPara(palco.clientWidth / 2 - k * p.x, 70 - k * p.y, k, animar);
    else irPara(40 + (k * LARGURA) / 2 - k * p.x, palco.clientHeight / 2 - k * p.y, k, animar);
  }

  function verTudo() {
    if (!palco.clientWidth) return;
    const todas = [...posicoes.values()];
    const x0 = Math.min(...todas.map((p) => p.x)) - LARGURA / 2 - 160;
    const x1 = Math.max(...todas.map((p) => p.x)) + LARGURA / 2 + 30;
    const y0 = Math.min(...todas.map((p) => p.y)) - ALTURA / 2 - 50;
    const y1 = Math.max(...todas.map((p) => p.y)) + ALTURA / 2 + 40;
    const k = Math.max(ZOOM_MIN, Math.min(1, palco.clientWidth / (x1 - x0), palco.clientHeight / (y1 - y0)));
    irPara(
      (palco.clientWidth - k * (x0 + x1)) / 2,
      (palco.clientHeight - k * (y0 + y1)) / 2,
      k,
    );
  }

  mundo.addEventListener('click', (evento) => {
    const el = evento.target as HTMLElement;
    const alternar = el.closest<HTMLElement>('[data-alternar]');
    if (alternar) {
      const id = alternar.dataset.alternar!;
      if (abertos.has(id)) abertos.delete(id);
      else abertos.add(id);
      desenhar(id);
      mundo.querySelector<HTMLElement>(`[data-alternar="${id}"]`)?.focus({ preventScroll: true });
      return;
    }
    const corpo = el.closest<HTMLElement>('[data-id]');
    if (corpo) aoEscolher(corpo.dataset.id!);
  });

  function trocarTronco(id: string) {
    tronco = id;
    abrirPadrao(id);
  }

  abrirPadrao(tronco);
  desenhar();
  inicio();

  return {
    get tronco() {
      return tronco;
    },
    selecionar(id: string, { centralizar: centro = true, animar = true } = {}) {
      const p = porId.get(id);
      if (!p) return;
      if (p.troncoId !== tronco) trocarTronco(p.troncoId);
      for (const a of linhagem(id)) if (a !== id) abertos.add(a);
      selecionado = id;
      // Sem âncora quando vai centralizar; com âncora, a caixa clicada não sai do lugar.
      desenhar(centro ? undefined : id);
      if (centro) centralizar(id, animar);
    },
    mostrarTronco(id: string) {
      trocarTronco(id);
      selecionado = porId.get(selecionado ?? '')?.troncoId === id ? selecionado : null;
      desenhar();
      inicio();
    },
    orientar(nova: Orientacao) {
      if (nova === orientacao) return;
      orientacao = nova;
      palco.dataset.orientacao = nova;
      desenhar();
      if (selecionado && posicoes.has(selecionado)) centralizar(selecionado, false);
      else inicio();
    },
    expandirTudo() {
      for (const p of pessoas) if (filhos.has(p.id)) abertos.add(p.id);
      desenhar();
      // A árvore inteira aberta é larga demais para caber legível na tela: mantém o zoom de leitura.
      if (selecionado && posicoes.has(selecionado)) centralizar(selecionado);
      else inicio(true);
    },
    recolherTudo() {
      abertos.clear();
      abrirPadrao(tronco);
      for (const a of linhagem(selecionado)) if (a !== selecionado) abertos.add(a);
      desenhar();
      if (selecionado && posicoes.has(selecionado)) centralizar(selecionado);
      else inicio(true);
    },
    zoom(fator: number) {
      alvo.transition().duration(200).call(comportamento.scaleBy, fator);
    },
    verTudo,
    /** Chamar quando o palco muda de tamanho ou volta a ficar visível. */
    reposicionar() {
      if (selecionado && posicoes.has(selecionado)) centralizar(selecionado, false);
      else inicio();
    },
  };
}
