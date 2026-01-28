-- Migrar a coluna 'fields' de text[] para jsonb com estrutura rica de campos personalizados
-- Nova estrutura: [{ "id": "titulo", "label": "Título do Produto", "type": "input" }, ...]

-- Primeiro, criar uma nova coluna para os campos customizáveis
ALTER TABLE public.digital_platforms 
ADD COLUMN custom_fields jsonb DEFAULT '[]'::jsonb;

-- Migrar dados existentes de 'fields' (text[]) para 'custom_fields' (jsonb)
UPDATE public.digital_platforms
SET custom_fields = (
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', field,
      'label', CASE field
        WHEN 'caption' THEN 'Legenda'
        WHEN 'cta' THEN 'Call to Action'
        WHEN 'description' THEN 'Descrição'
        WHEN 'title' THEN 'Título'
        WHEN 'hashtags' THEN 'Hashtags'
        WHEN 'link' THEN 'Link'
        WHEN 'cover_url' THEN 'URL da Capa'
        WHEN 'music' THEN 'Música'
        WHEN 'tags' THEN 'Tags'
        WHEN 'chapters' THEN 'Capítulos'
        WHEN 'playlist' THEN 'Playlist'
        WHEN 'thumbnail_url' THEN 'URL da Thumbnail'
        ELSE initcap(replace(field, '_', ' '))
      END,
      'type', CASE field
        WHEN 'caption' THEN 'textarea'
        WHEN 'description' THEN 'textarea'
        WHEN 'chapters' THEN 'textarea'
        ELSE 'input'
      END
    )
  )
  FROM unnest(fields) AS field
)
WHERE fields IS NOT NULL AND array_length(fields, 1) > 0;

-- Para registros sem fields, definir campos padrão
UPDATE public.digital_platforms
SET custom_fields = '[{"id": "caption", "label": "Legenda", "type": "textarea"}, {"id": "cta", "label": "Call to Action", "type": "input"}]'::jsonb
WHERE custom_fields IS NULL OR custom_fields = '[]'::jsonb;