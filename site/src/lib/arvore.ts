// Única porta de acesso aos dados da árvore. Quando a árvore passar a viver em um
// banco de dados (para o cadastro de familiares com aprovação), só este arquivo muda.
import dados from '../data/arvore.json';

export interface Conjuge {
  nome: string;
  /** Preenchido quando o cônjuge também é uma pessoa da árvore (casamento entre primos). */
  pessoaId?: string;
}

export interface Pessoa {
  id: string;
  nome: string;
  paiId: string | null;
  /** De qual casamento do pai/mãe a pessoa nasceu (1 = primeiro, 0 = a fonte não informa). */
  uniao: number;
  conjuges: Conjuge[];
  /** 0 = Tronco, 1 = 1ª geração... */
  geracao: number;
  troncoId: string;
  /** Filho(a) do tronco de quem a pessoa descende. */
  ramoId: string | null;
  nota: string | null;
  /** Leitura incerta na prancha original. */
  duvidoso: boolean;
  status: 'verificado' | 'pendente';
  origem: string;
}

export const pessoas = (dados as Pessoa[]).filter((p) => p.status === 'verificado');

const porId = new Map(pessoas.map((p) => [p.id, p]));
const filhosPorPai = new Map<string, Pessoa[]>();
for (const p of pessoas) {
  if (!p.paiId) continue;
  if (!filhosPorPai.has(p.paiId)) filhosPorPai.set(p.paiId, []);
  filhosPorPai.get(p.paiId)!.push(p);
}

export const buscarPessoa = (id: string) => porId.get(id);
export const filhosDiretos = (id: string) => filhosPorPai.get(id) ?? [];
export const troncos = () => pessoas.filter((p) => !p.paiId);

export function totalDescendentes(id: string): number {
  return filhosDiretos(id).reduce((soma, f) => soma + 1 + totalDescendentes(f.id), 0);
}

export const rotuloGeracao = (g: number) => (g === 0 ? 'Tronco' : g < 0 ? 'Ascendentes' : `${g}ª geração`);

export const TRONCO_VICTOR = 'victor';
export const TRONCO_FRANCOIS = 'francois';
export const TRONCO_SANTOS = 'goncalo';
