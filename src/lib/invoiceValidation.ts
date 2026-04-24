// Validador fiscal para emissão de Nota Fiscal
// Valida CPF/CNPJ, endereço, produto vinculado, valor, natureza da operação e dados mínimos

export type FiscalCheckSeverity = 'erro' | 'aviso';

export interface FiscalIssue {
  field: string;
  label: string;
  message: string;
  severity: FiscalCheckSeverity;
  fixHint?: string;
  // Onde corrigir: rota e id do registro
  fixTarget?: 'contact' | 'order' | 'invoice';
  fixId?: string;
}

export interface FiscalValidationResult {
  valid: boolean;
  issues: FiscalIssue[];
  errorsCount: number;
  warningsCount: number;
}

/** Remove caracteres não numéricos */
const onlyDigits = (v: string | null | undefined) => (v || '').replace(/\D/g, '');

/** Valida CPF (11 dígitos com cálculo de DV) */
export function isValidCPF(cpf: string | null | undefined): boolean {
  const c = onlyDigits(cpf);
  if (c.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(c)) return false; // todos iguais
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(c[i]) * (10 - i);
  let d1 = 11 - (sum % 11);
  if (d1 >= 10) d1 = 0;
  if (d1 !== parseInt(c[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(c[i]) * (11 - i);
  let d2 = 11 - (sum % 11);
  if (d2 >= 10) d2 = 0;
  return d2 === parseInt(c[10]);
}

/** Valida CNPJ (14 dígitos com cálculo de DV) */
export function isValidCNPJ(cnpj: string | null | undefined): boolean {
  const c = onlyDigits(cnpj);
  if (c.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(c)) return false;
  const calc = (base: string, weights: number[]) => {
    let sum = 0;
    for (let i = 0; i < weights.length; i++) sum += parseInt(base[i]) * weights[i];
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = calc(c, w1);
  if (d1 !== parseInt(c[12])) return false;
  const d2 = calc(c, w2);
  return d2 === parseInt(c[13]);
}

/** Valida documento (CPF para PF, CNPJ para PJ; ou aceita qualquer um) */
export function isValidDocument(doc: string | null | undefined): boolean {
  const d = onlyDigits(doc);
  if (d.length === 11) return isValidCPF(d);
  if (d.length === 14) return isValidCNPJ(d);
  return false;
}

const isBlank = (v: any) => v === null || v === undefined || String(v).trim() === '';

interface InvoiceDataForValidation {
  id?: string;
  invoice_type: 'NFe' | 'NFCe' | 'NFSe';
  value: number | null;
  operation_nature?: string | null;
  order_id?: string | null;
  contact_id?: string | null;
  customer_name?: string | null;
}

interface ContactDataForValidation {
  id: string;
  name?: string | null;
  document?: string | null;
  person_type?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  zip_code?: string | null;
  state?: string | null;
  city?: string | null;
  address?: string | null;
  address_number?: string | null;
  neighborhood?: string | null;
}

interface OrderDataForValidation {
  id: string;
  total_value?: number | null;
  items?: Array<{ product_id?: string | null; quantity?: number | null; unit_price?: number | null }>;
}

/**
 * Valida todos os dados fiscais necessários para emissão de uma nota.
 * Retorna a lista de problemas encontrados (erros bloqueiam emissão; avisos são recomendações).
 */
export function validateInvoiceForIssue(params: {
  invoice: InvoiceDataForValidation;
  contact?: ContactDataForValidation | null;
  order?: OrderDataForValidation | null;
}): FiscalValidationResult {
  const { invoice, contact, order } = params;
  const issues: FiscalIssue[] = [];

  // 1. CPF/CNPJ do cliente
  if (!contact) {
    if (invoice.invoice_type !== 'NFCe') {
      issues.push({
        field: 'contact',
        label: 'Cliente',
        message: 'Nenhum cliente vinculado à nota.',
        severity: 'erro',
        fixHint: 'Vincule um cliente do CRM com CPF/CNPJ cadastrado.',
        fixTarget: 'invoice',
        fixId: invoice.id,
      });
    } else {
      issues.push({
        field: 'contact',
        label: 'Cliente',
        message: 'NFC-e sem cliente identificado (consumidor final).',
        severity: 'aviso',
      });
    }
  } else {
    if (isBlank(contact.document)) {
      issues.push({
        field: 'document',
        label: 'CPF / CNPJ',
        message: `Cliente "${contact.name || 'sem nome'}" sem CPF ou CNPJ cadastrado.`,
        severity: invoice.invoice_type === 'NFCe' ? 'aviso' : 'erro',
        fixHint: 'Cadastre o documento do cliente no CRM.',
        fixTarget: 'contact',
        fixId: contact.id,
      });
    } else if (!isValidDocument(contact.document)) {
      issues.push({
        field: 'document',
        label: 'CPF / CNPJ',
        message: `Documento "${contact.document}" é inválido.`,
        severity: 'erro',
        fixHint: 'Corrija o CPF/CNPJ no cadastro do cliente.',
        fixTarget: 'contact',
        fixId: contact.id,
      });
    }

    // 2. Endereço completo (não exigido para NFC-e simples)
    if (invoice.invoice_type !== 'NFCe') {
      const addressFields = [
        { key: 'zip_code', label: 'CEP', value: contact.zip_code },
        { key: 'address', label: 'Logradouro', value: contact.address },
        { key: 'address_number', label: 'Número', value: contact.address_number },
        { key: 'neighborhood', label: 'Bairro', value: contact.neighborhood },
        { key: 'city', label: 'Cidade', value: contact.city },
        { key: 'state', label: 'UF', value: contact.state },
      ];
      const missing = addressFields.filter((f) => isBlank(f.value)).map((f) => f.label);
      if (missing.length > 0) {
        issues.push({
          field: 'address',
          label: 'Endereço',
          message: `Endereço incompleto: faltam ${missing.join(', ')}.`,
          severity: 'erro',
          fixHint: 'Complete o endereço do cliente no CRM.',
          fixTarget: 'contact',
          fixId: contact.id,
        });
      }
    }

    // 3. Contato (e-mail ou telefone) — recomendado
    if (isBlank(contact.email) && isBlank(contact.phone) && isBlank(contact.whatsapp)) {
      issues.push({
        field: 'contact_info',
        label: 'Contato',
        message: 'Cliente sem e-mail ou telefone para envio da nota.',
        severity: 'aviso',
        fixTarget: 'contact',
        fixId: contact.id,
      });
    }
  }

  // 4. Produto vinculado (via pedido)
  if (!invoice.order_id) {
    issues.push({
      field: 'order',
      label: 'Produto',
      message: 'Nenhum pedido vinculado — não há produtos para destacar na nota.',
      severity: 'erro',
      fixHint: 'Vincule a nota a um pedido com itens cadastrados.',
      fixTarget: 'invoice',
      fixId: invoice.id,
    });
  } else if (order) {
    const items = order.items || [];
    if (items.length === 0) {
      issues.push({
        field: 'order_items',
        label: 'Itens do pedido',
        message: 'O pedido vinculado não possui itens.',
        severity: 'erro',
        fixHint: 'Adicione produtos ao pedido em Operações.',
        fixTarget: 'order',
        fixId: order.id,
      });
    } else {
      const itemsWithoutProduct = items.filter((i) => isBlank(i.product_id));
      if (itemsWithoutProduct.length > 0) {
        issues.push({
          field: 'order_items_product',
          label: 'Produto vinculado',
          message: `${itemsWithoutProduct.length} item(ns) do pedido sem produto cadastrado.`,
          severity: 'erro',
          fixTarget: 'order',
          fixId: order.id,
        });
      }
      const itemsWithoutPrice = items.filter((i) => !i.unit_price || Number(i.unit_price) <= 0);
      if (itemsWithoutPrice.length > 0) {
        issues.push({
          field: 'order_items_price',
          label: 'Preço dos itens',
          message: `${itemsWithoutPrice.length} item(ns) sem preço unitário.`,
          severity: 'erro',
          fixTarget: 'order',
          fixId: order.id,
        });
      }
    }
  }

  // 5. Valor correto (>0 e batendo com pedido se houver)
  if (!invoice.value || Number(invoice.value) <= 0) {
    issues.push({
      field: 'value',
      label: 'Valor',
      message: 'Valor da nota deve ser maior que zero.',
      severity: 'erro',
      fixTarget: 'invoice',
      fixId: invoice.id,
    });
  } else if (order && order.total_value != null) {
    const diff = Math.abs(Number(invoice.value) - Number(order.total_value));
    if (diff > 0.01) {
      issues.push({
        field: 'value_match',
        label: 'Valor x Pedido',
        message: `Valor da nota (R$ ${Number(invoice.value).toFixed(2)}) diferente do pedido (R$ ${Number(order.total_value).toFixed(2)}).`,
        severity: 'aviso',
        fixHint: 'Confirme o valor correto antes de emitir.',
      });
    }
  }

  // 6. Natureza da operação
  if (isBlank(invoice.operation_nature)) {
    issues.push({
      field: 'operation_nature',
      label: 'Natureza da operação',
      message: 'Informe a natureza da operação (ex.: Venda de mercadoria, Prestação de serviço).',
      severity: 'erro',
      fixTarget: 'invoice',
      fixId: invoice.id,
    });
  }

  // 7. Tipo de nota válido
  if (!['NFe', 'NFCe', 'NFSe'].includes(invoice.invoice_type)) {
    issues.push({
      field: 'invoice_type',
      label: 'Tipo de nota',
      message: 'Tipo de nota fiscal inválido.',
      severity: 'erro',
      fixTarget: 'invoice',
      fixId: invoice.id,
    });
  }

  const errorsCount = issues.filter((i) => i.severity === 'erro').length;
  const warningsCount = issues.filter((i) => i.severity === 'aviso').length;

  return {
    valid: errorsCount === 0,
    issues,
    errorsCount,
    warningsCount,
  };
}

/** Sugestões padrão para o campo "Natureza da operação" */
export const OPERATION_NATURE_SUGGESTIONS = [
  'Venda de mercadoria',
  'Venda de produto de produção própria',
  'Prestação de serviço',
  'Devolução de venda',
  'Remessa para conserto',
  'Bonificação / Brinde',
  'Transferência entre estabelecimentos',
];
