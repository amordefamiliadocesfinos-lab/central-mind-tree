export interface WhatsAppTemplate {
  key: string;
  label: string;
  stages?: string[];
  message: string;
}

export const WHATSAPP_TEMPLATES: WhatsAppTemplate[] = [
  {
    key: 'orcamento',
    label: 'Orçamento',
    stages: ['orcamento'],
    message: 'Olá, tudo bem?\nEstou passando para saber se você conseguiu analisar o orçamento que enviamos 😊',
  },
  {
    key: 'negociacao',
    label: 'Negociação',
    stages: ['negociacao'],
    message: 'Oi, tudo bem?\nConseguimos ajustar seu pedido, quer que eu finalize pra você?',
  },
  {
    key: 'follow_up',
    label: 'Follow-up',
    stages: ['novo', 'contato_feito', 'qualificado'],
    message: 'Olá {nome}, tudo bem?\nSó passando para ver se posso te ajudar com seu pedido 😊',
  },
  {
    key: 'cliente_ativo',
    label: 'Cliente Ativo',
    stages: ['fechado'],
    message: 'Olá {nome}! Tudo bem?\nEstamos com produção aberta essa semana, deseja fazer um novo pedido?',
  },
];

export const CUSTOM_STORAGE_KEY = 'whatsapp_custom_templates_v1';

export interface CustomTemplate {
  key: string;
  label: string;
  message: string;
}

export function loadCustomTemplates(): CustomTemplate[] {
  try {
    const raw = localStorage.getItem(CUSTOM_STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveCustomTemplates(list: CustomTemplate[]) {
  try {
    localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}
