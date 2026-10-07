export const SITE = {
  nome: 'Família Dumont',
  descricao:
    'A história, a árvore genealógica e os encontros da Família Dumont no Brasil, de Bordeaux a Diamantina e de Diamantina a todo o país.',
  // PENDENTE: informar o e-mail que vai receber as mensagens do formulário de contato.
  emailContato: '',
};

export const MENU = [
  { rotulo: 'Início', href: '/' },
  { rotulo: 'História', href: '/historia/' },
  { rotulo: 'Árvore Genealógica', href: '/arvore/' },
  { rotulo: 'Eventos', href: '/eventos/' },
  { rotulo: 'Blog', href: '/blog/' },
  { rotulo: 'Contato', href: '/contato/' },
];

export const formatarData = (data: Date) =>
  data.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
