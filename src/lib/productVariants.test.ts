import {
  formatVariantAttributes,
  getVariantUnit,
  getVariantValue,
  parseVariantAttributes,
} from './productVariants';

function expect(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const attributes = parseVariantAttributes('sabor=chocolate; peso=120g');
expect(attributes.sabor === 'chocolate', 'Deve manter o atributo sabor');
expect(attributes.peso === '120g', 'Deve manter o atributo peso');
expect(formatVariantAttributes(attributes) === 'sabor=chocolate; peso=120g', 'Deve formatar atributos para edição');
expect(getVariantValue(12.5, 10) === 12.5, 'Override deve prevalecer sobre o mestre');
expect(getVariantValue(null, 10) === 10, 'Sem override deve herdar valor do mestre');
expect(getVariantUnit(null, 'cx') === 'cx', 'Sem unidade própria deve herdar unidade do mestre');
