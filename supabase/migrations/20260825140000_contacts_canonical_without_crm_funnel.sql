-- A contact is the canonical identity record. CRM participation is optional.
-- Existing contacts are intentionally preserved as-is.
ALTER TABLE public.contacts
  ALTER COLUMN funnel_status DROP NOT NULL,
  ALTER COLUMN funnel_status DROP DEFAULT;
