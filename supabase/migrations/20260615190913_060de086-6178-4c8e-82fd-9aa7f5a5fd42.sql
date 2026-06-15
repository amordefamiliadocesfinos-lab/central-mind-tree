-- Mescla contatos duplicados pelo número de WhatsApp/telefone (apenas dígitos)
-- Mantém como principal: maior paid_orders_count, depois maior lifetime_value, depois mais antigo
DO $$
DECLARE
  r RECORD;
  v_primary uuid;
  v_dup uuid;
BEGIN
  FOR r IN
    WITH norm AS (
      SELECT id,
             regexp_replace(COALESCE(NULLIF(whatsapp,''), NULLIF(phone,''), NULLIF(mobile,'')), '\D','','g') AS digits,
             COALESCE(paid_orders_count,0) AS poc,
             COALESCE(lifetime_value,0) AS ltv,
             created_at
        FROM public.contacts
       WHERE is_active = true
    ),
    ranked AS (
      SELECT digits,
             id,
             ROW_NUMBER() OVER (PARTITION BY digits ORDER BY poc DESC, ltv DESC, created_at ASC, id ASC) AS rn
        FROM norm
       WHERE digits IS NOT NULL AND length(digits) >= 8
    ),
    grp AS (
      SELECT digits FROM ranked GROUP BY digits HAVING COUNT(*) > 1
    )
    SELECT g.digits,
           (SELECT id FROM ranked WHERE digits = g.digits AND rn = 1) AS primary_id,
           ARRAY(SELECT id FROM ranked WHERE digits = g.digits AND rn > 1) AS dup_ids
      FROM grp g
  LOOP
    v_primary := r.primary_id;
    FOREACH v_dup IN ARRAY r.dup_ids LOOP
      BEGIN
        PERFORM public.merge_contacts(v_primary, v_dup);
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Falha ao mesclar % em %: %', v_dup, v_primary, SQLERRM;
      END;
    END LOOP;
  END LOOP;
END $$;