## Objetivo

Ter um único banco de mídia (`digital_media`) como fonte da verdade para imagens/vídeos de **Ideias do Digital** e **Produtos das Operações**. Hoje temos:

- `digital_media` (com `idea_id` / `variation_id`) — usado pela Mídia do Digital
- `products.cover_image_url` + `products.media_urls` — usado nos cards de produto

Vamos consolidar tudo no `digital_media`, mantendo retrocompatibilidade com os campos atuais do produto.

## O que muda no banco

```sql
ALTER TABLE public.digital_media
  ADD COLUMN product_id uuid NULL,
  ADD COLUMN is_product_cover boolean NOT NULL DEFAULT false;

CREATE INDEX idx_digital_media_product_id ON public.digital_media(product_id);
```

Backfill (uma vez):
- Para cada produto com `cover_image_url`, criar uma linha em `digital_media` com aquele URL, `product_id = product.id`, `is_product_cover = true`.
- Para cada URL extra em `products.media_urls`, criar linha equivalente com `product_id` setado e `is_product_cover = false` (evitando duplicar a cover).

`products.cover_image_url` e `products.media_urls` permanecem (sincronizados em escrita) para não quebrar o que já consome esses campos.

## Mudanças no app

1. **Hook novo `useProductMedia(productId)`**: lê `digital_media` filtrando por `product_id`, devolve `{ items, cover, addUpload, removeItem, setCover }`. Toda escrita também espelha `cover_image_url` e `media_urls` na tabela `products` para manter consumidores legados funcionando.

2. **Editor de produto (`ProductCostEditor` / formulário em Operacoes)**:
   - Upload e seleção passam a operar via `useProductMedia`.
   - Adicionar botão "Escolher da biblioteca" abrindo `MediaLibrary` em modo seletor (filtrado por produto + ideias).

3. **`MediaLibrary` (Digital → Mídia)**:
   - Novo filtro lateral: **Produtos** (mostra mídias com `product_id`, agrupadas por produto).
   - Permitir vincular/desvincular uma mídia a um produto (botão "Vincular a produto").
   - Continua suportando ideias/variações; `product_id` é independente, então uma imagem pode estar ligada a produto **e** ideia ao mesmo tempo.

4. **`ProductCard` / `ProductGallery`**: continuam lendo `cover_image_url` e `media_urls` (que agora ficam em sincronia automática), sem alteração visual.

5. **Vínculo Produto ↔ Ideia** (já existente): quando uma ideia é vinculada a um produto, a aba de mídia da ideia passa a mostrar **também** as mídias daquele produto como sugestão para reaproveitar.

## Observações técnicas

- `digital_media.product_id` fica nullable — mídia pode existir só para uma ideia, só para um produto, ou para ambos.
- Não vamos remover `cover_image_url`/`media_urls` agora; esse passo pode vir num cleanup futuro depois que toda a UI estiver migrada.
- Tudo via UI, nada exige ação manual do usuário. O backfill roda na migration.

## Confirmação

Posso seguir com:
1. Migration (coluna `product_id`, índice, backfill).
2. Hook `useProductMedia` + sincronização espelhada com `products`.
3. Adaptação do editor de produto (upload + escolher da biblioteca).
4. Filtro "Produtos" no `MediaLibrary` com vincular/desvincular.

Confirma esse plano?