// Vetoriza a foto do brasão: separa as cores chapadas da pintura e traça cada uma como curvas.
// Uso: node scripts/vetorizar-brasao.mjs "<foto de entrada>"   (requer: npm i -D potrace)
// Saída: src/assets/brasao.svg
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import potrace from 'potrace';
import sharp from 'sharp';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const entrada = process.argv[2];
if (!entrada) throw new Error('Informe o caminho da foto do brasão.');

// Recorte (em pixels da foto de 680x1011): do listel "Dumont" ao listel "France", sem a franja.
const RECORTE = { left: 20, top: 40, width: 640, height: 834 };
const ESCALA = 3;
// Região do elmo, única parte cinza que interessa (o resto do cinza é sombra do tecido).
const ELMO = { x0: 232, x1: 405, y0: 232, y1: 425 };
const LIMITE_CINZA = Number(process.env.CINZA ?? 0.74); // acima disso é o tecido, não o elmo
const LIMITE_AMARELO = 470; // abaixo disso o amarelo é só a franja

const CORES = {
  cinza: '#b9bcc0',
  vermelho: '#e8432b',
  azul: '#1d3f94',
  amarelo: '#f2c230',
  preto: '#1a1a1a',
};

const { data, info } = await sharp(entrada)
  .extract(RECORTE)
  .resize({ width: RECORTE.width * ESCALA, kernel: 'lanczos3' })
  .blur(1.6)
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const { width: L, height: A } = info;

function classificar(r, g, b, x, y) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const v = max / 255;
  const s = max ? (max - min) / max : 0;
  let h = 0;
  if (max !== min) {
    if (max === r) h = ((g - b) / (max - min)) % 6;
    else if (max === g) h = (b - r) / (max - min) + 2;
    else h = (r - g) / (max - min) + 4;
    h = (h * 60 + 360) % 360;
  }
  // O texto "Família Dumont", pintado abaixo do listel, invade o canto inferior do recorte.
  if (y > 826 && x < 165) return null;
  if (v < 0.4 && s < 0.6) return 'preto';
  if (v < 0.25) return 'preto';
  if (s > 0.38 && h >= 195 && h <= 260) return 'azul';
  if (s > 0.42 && (h <= 26 || h >= 340) && v > 0.45) return 'vermelho';
  if (s > 0.4 && h >= 36 && h <= 68 && y < LIMITE_AMARELO) return 'amarelo';
  if (s < 0.2 && v > 0.4 && v < LIMITE_CINZA && x > ELMO.x0 && x < ELMO.x1 && y > ELMO.y0 && y < ELMO.y1) return 'cinza';
  return null;
}

const mascaras = Object.fromEntries(Object.keys(CORES).map((c) => [c, Buffer.alloc(L * A, 255)]));
for (let i = 0; i < L * A; i++) {
  const cor = classificar(data[i * 3], data[i * 3 + 1], data[i * 3 + 2], (i % L) / ESCALA, Math.floor(i / L) / ESCALA);
  if (cor) mascaras[cor][i] = 0;
}

async function tracar(cor) {
  const png = await sharp(mascaras[cor], { raw: { width: L, height: A, channels: 1 } }).png().toBuffer();
  return new Promise((ok, falha) => {
    const p = new potrace.Potrace({ turdSize: cor === 'preto' ? 30 : 120, optTolerance: 0.8, threshold: 128 });
    p.loadImage(png, (erro) => (erro ? falha(erro) : ok(p.getPathTag(CORES[cor]))));
  });
}

// Fundo branco do escudo, para o brasão funcionar também sobre fundos escuros.
const escudo = '<path fill="#fff" d="M189 416H438V612C434 655 385 706 319 738C253 706 193 655 189 612Z"/>';
const camadas = [];
for (const cor of Object.keys(CORES)) camadas.push(await tracar(cor));

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${RECORTE.width} ${RECORTE.height}" role="img" aria-label="Brasão da Família Dumont">
${escudo}
<g transform="scale(${1 / ESCALA})">
${camadas.join('\n')}
</g>
</svg>
`;
const saida = resolve(raiz, 'src/assets/brasao.svg');
writeFileSync(saida, svg);
console.log(`${saida} (${Math.round(svg.length / 1024)} kB)`);
