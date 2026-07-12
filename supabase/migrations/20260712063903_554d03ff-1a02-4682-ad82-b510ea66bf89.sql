-- ============================================================================
-- FASE 04.1 — Organograma: tipagem de nós, responsável, arquivamento
-- ============================================================================

-- 1) Colunas novas ---------------------------------------------------------
ALTER TABLE public.nodes
  ADD COLUMN IF NOT EXISTS node_type text NULL,
  ADD COLUMN IF NOT EXISTS responsible_user_id uuid NULL
    REFERENCES public.app_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- CHECK apenas quando não nulo (permite legado node_type NULL)
ALTER TABLE public.nodes DROP CONSTRAINT IF EXISTS nodes_node_type_check;
ALTER TABLE public.nodes
  ADD CONSTRAINT nodes_node_type_check
  CHECK (node_type IS NULL OR node_type IN ('root','area','team','function'));

-- 2) Classificar somente a raiz inequívoca Deividi ------------------------
UPDATE public.nodes
   SET node_type = 'root',
       is_active = true
 WHERE id = 'd7c76db8-b7e0-4ce1-87ca-21275c346326'
   AND parent_id IS NULL;

-- 3) Função de validação + trigger ---------------------------------------
CREATE OR REPLACE FUNCTION public.nodes_validate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
DECLARE
  v_root constant uuid := 'd7c76db8-b7e0-4ce1-87ca-21275c346326';
  v_parent record;
  v_cur uuid;
  v_hops int := 0;
BEGIN
  -- Proteções da raiz
  IF TG_OP = 'UPDATE' AND OLD.id = v_root THEN
    IF NEW.parent_id IS NOT NULL THEN
      RAISE EXCEPTION 'A raiz Deividi não pode ser movida.';
    END IF;
    IF NEW.title IS DISTINCT FROM 'Deividi' THEN
      RAISE EXCEPTION 'A raiz Deividi não pode ser renomeada.';
    END IF;
    IF NEW.node_type IS DISTINCT FROM 'root' THEN
      RAISE EXCEPTION 'A raiz Deividi deve permanecer do tipo root.';
    END IF;
    IF NEW.is_active = false THEN
      RAISE EXCEPTION 'A raiz Deividi não pode ser arquivada.';
    END IF;
  END IF;

  -- INSERT exige node_type
  IF TG_OP = 'INSERT' AND NEW.node_type IS NULL THEN
    RAISE EXCEPTION 'node_type é obrigatório ao criar um nó.';
  END IF;

  -- Regras para nós que não são a raiz Deividi
  IF NEW.id <> v_root THEN
    IF NEW.node_type = 'root' THEN
      RAISE EXCEPTION 'Já existe uma raiz (Deividi). Não é permitido criar outra.';
    END IF;

    IF NEW.parent_id IS NULL THEN
      RAISE EXCEPTION 'parent_id é obrigatório para nós não-raiz.';
    END IF;

    IF NEW.parent_id = NEW.id THEN
      RAISE EXCEPTION 'Um nó não pode ser pai de si mesmo.';
    END IF;

    SELECT id, node_type, is_active
      INTO v_parent
      FROM public.nodes
     WHERE id = NEW.parent_id;

    IF v_parent.id IS NULL THEN
      RAISE EXCEPTION 'Nó pai (%) não existe.', NEW.parent_id;
    END IF;

    IF v_parent.is_active = false THEN
      RAISE EXCEPTION 'Não é possível vincular a um nó pai arquivado.';
    END IF;

    IF v_parent.node_type = 'function' THEN
      RAISE EXCEPTION 'Nós do tipo function não podem receber filhos.';
    END IF;

    -- Hierarquia tipada (apenas quando ambos os tipos são conhecidos)
    IF NEW.node_type IS NOT NULL AND v_parent.node_type IS NOT NULL THEN
      IF NEW.node_type = 'area' AND v_parent.node_type NOT IN ('root','area') THEN
        RAISE EXCEPTION 'Áreas só podem estar sob a raiz ou sob outra área.';
      ELSIF NEW.node_type = 'team' AND v_parent.node_type NOT IN ('area','team') THEN
        RAISE EXCEPTION 'Equipes só podem estar sob área ou outra equipe.';
      ELSIF NEW.node_type = 'function' AND v_parent.node_type NOT IN ('area','team') THEN
        RAISE EXCEPTION 'Funções só podem estar sob área ou equipe.';
      END IF;
    END IF;

    -- Verificação de ciclo somente quando o pai muda
    IF TG_OP = 'INSERT'
       OR (TG_OP = 'UPDATE' AND NEW.parent_id IS DISTINCT FROM OLD.parent_id) THEN
      v_cur := NEW.parent_id;
      v_hops := 0;
      WHILE v_cur IS NOT NULL LOOP
        IF v_cur = NEW.id THEN
          RAISE EXCEPTION 'Operação criaria ciclo: descendente não pode ser pai.';
        END IF;
        v_hops := v_hops + 1;
        IF v_hops > 1000 THEN
          RAISE EXCEPTION 'Ciclo detectado ao validar ancestrais.';
        END IF;
        SELECT parent_id INTO v_cur FROM public.nodes WHERE id = v_cur;
      END LOOP;
    END IF;
  END IF;

  -- Arquivamento: proibir se houver filhos ativos
  IF TG_OP = 'UPDATE' AND OLD.is_active = true AND NEW.is_active = false THEN
    IF EXISTS (
      SELECT 1 FROM public.nodes
       WHERE parent_id = NEW.id AND is_active = true
    ) THEN
      RAISE EXCEPTION 'Não é possível arquivar um nó com filhos ativos.';
    END IF;
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_nodes_validate ON public.nodes;
CREATE TRIGGER trg_nodes_validate
  BEFORE INSERT OR UPDATE ON public.nodes
  FOR EACH ROW EXECUTE FUNCTION public.nodes_validate();

-- 4) Índices essenciais --------------------------------------------------
CREATE INDEX IF NOT EXISTS nodes_parent_id_idx           ON public.nodes(parent_id);
CREATE INDEX IF NOT EXISTS nodes_responsible_user_id_idx ON public.nodes(responsible_user_id);
CREATE INDEX IF NOT EXISTS nodes_is_active_idx           ON public.nodes(is_active);
CREATE INDEX IF NOT EXISTS nodes_node_type_idx           ON public.nodes(node_type);

-- Raiz ativa única
DROP INDEX IF EXISTS nodes_single_active_root_uniq;
CREATE UNIQUE INDEX nodes_single_active_root_uniq
  ON public.nodes ((1))
  WHERE node_type = 'root' AND is_active = true;

-- Título único entre irmãos ativos (normalizado)
DROP INDEX IF EXISTS nodes_active_sibling_title_uniq;
CREATE UNIQUE INDEX nodes_active_sibling_title_uniq
  ON public.nodes (
    COALESCE(parent_id::text, ''),
    lower(regexp_replace(btrim(title), '\s+', ' ', 'g'))
  )
  WHERE is_active = true;