// Converte dados/arvore-fonte.txt em src/data/arvore.json.
// Uso: node scripts/gerar-arvore.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FONTE = resolve(raiz, 'dados/arvore-fonte.txt');
const SAIDA = resolve(raiz, 'src/data/arvore.json');

// Geração em que cada tronco começa (as pranchas alinham Victor e François na coluna "Tronco" = 0).
const GERACAO_INICIAL = { goncalo: -2 };

const slug = (texto) =>
  texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

function lerSegmento(bruto) {
  let texto = bruto.trim();
  const duvidoso = /\?\s*$/.test(texto);
  if (duvidoso) texto = texto.replace(/\?\s*$/, '').trim();
  return { texto, duvidoso };
}

const erros = [];
const pessoas = [];
const porId = new Map();
const pilha = []; // pilha[nivel] = pessoa

const linhas = readFileSync(FONTE, 'utf8').split(/\r?\n/);
linhas.forEach((linha, i) => {
  if (!linha.trim() || linha.trim().startsWith('#')) return;
  const num = i + 1;
  const recuo = linha.match(/^ */)[0].length;
  if (recuo % 2) return erros.push(`Linha ${num}: recuo ímpar`);
  const nivel = recuo / 2;
  if (nivel > pilha.length) return erros.push(`Linha ${num}: recuo pula um nível`);

  let [corpo, ...restoNota] = linha.trim().split(' # ');
  const nota = restoNota.join(' # ').trim() || null;

  let uniao = 1;
  const marcaUniao = corpo.match(/^\[(\d)\]\s*/);
  if (marcaUniao) {
    uniao = Number(marcaUniao[1]);
    corpo = corpo.slice(marcaUniao[0].length);
  }

  const [parteNome, ...partesConjuge] = corpo.split(' ~ ');
  let idFixo = null;
  const comId = parteNome.match(/\{([a-z0-9-]+)\}/);
  if (comId) idFixo = comId[1];
  const nome = lerSegmento(parteNome.replace(/\{[a-z0-9-]+\}/, ''));
  let duvidoso = nome.duvidoso;

  const conjuges = partesConjuge.map((parte) => {
    const seg = lerSegmento(parte);
    duvidoso ||= seg.duvidoso;
    const ref = seg.texto.match(/^=\s*\{([a-z0-9-]+)\}$/);
    return ref ? { pessoaId: ref[1] } : { nome: seg.texto };
  });

  const pai = nivel ? pilha[nivel - 1] : null;
  let id = idFixo ?? slug(nome.texto);
  if (porId.has(id) && !idFixo && pai) id = `${id}--${pai.id}`;
  for (let n = 2; porId.has(id); n++) {
    if (idFixo) {
      erros.push(`Linha ${num}: id {${idFixo}} repetido`);
      break;
    }
    id = `${id.replace(/-\d+$/, '')}-${n}`;
  }

  const pessoa = {
    id,
    nome: nome.texto,
    paiId: pai?.id ?? null,
    uniao,
    conjuges,
    geracao: pai ? pai.geracao + 1 : (GERACAO_INICIAL[id] ?? 0),
    troncoId: pai ? pai.troncoId : id,
    ramoId: pai ? (pai.ramoId ?? id) : null,
    nota,
    duvidoso,
    // Campos pensados para o futuro cadastro pelos familiares (com aprovação do administrador).
    status: 'verificado',
    origem: 'esboco-genealogico',
  };
  pessoas.push(pessoa);
  porId.set(id, pessoa);
  pilha.length = nivel;
  pilha.push(pessoa);
});

// Resolve os cônjuges que são pessoas da própria árvore.
for (const p of pessoas) {
  for (const c of p.conjuges) {
    if (!c.pessoaId) continue;
    const outro = porId.get(c.pessoaId);
    if (!outro) erros.push(`${p.nome}: cônjuge {${c.pessoaId}} não existe`);
    else {
      c.nome = outro.nome;
      if (!outro.conjuges.some((x) => x.pessoaId === p.id))
        erros.push(`${p.nome} aponta para ${outro.nome}, mas o inverso não existe`);
    }
  }
  if (p.uniao > 1) {
    const pai = porId.get(p.paiId);
    if (!pai.conjuges[p.uniao - 1]) erros.push(`${p.nome}: ${pai.nome} não tem ${p.uniao}º cônjuge`);
  }
}

// Pai/mãe com dois casamentos e nenhum filho marcado com [n]: a prancha não diz de qual
// casamento os filhos são, então a união fica desconhecida (0) em vez de presumir a primeira.
for (const p of pessoas) {
  if (p.conjuges.length < 2) continue;
  const filhos = pessoas.filter((f) => f.paiId === p.id);
  if (filhos.every((f) => f.uniao === 1)) filhos.forEach((f) => (f.uniao = 0));
}

if (erros.length) {
  console.error(erros.join('\n'));
  process.exit(1);
}

mkdirSync(dirname(SAIDA), { recursive: true });
writeFileSync(SAIDA, JSON.stringify(pessoas, null, 1) + '\n');
console.log(`${pessoas.length} pessoas gravadas em src/data/arvore.json`);
