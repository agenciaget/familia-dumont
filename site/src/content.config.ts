import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Artigos e eventos são arquivos Markdown. O futuro painel de administração
// só precisa gravar arquivos neste mesmo formato (ou trocar o loader por um banco de dados).
const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    titulo: z.string(),
    resumo: z.string(),
    data: z.coerce.date(),
    autor: z.string().default('Família Dumont'),
    rascunho: z.boolean().default(false),
  }),
});

const eventos = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/eventos' }),
  schema: z.object({
    titulo: z.string(),
    data: z.coerce.date(),
    local: z.string(),
    resumo: z.string(),
    // Marca os eventos fictícios usados só para demonstrar a página.
    exemplo: z.boolean().default(false),
  }),
});

export const collections = { blog, eventos };
