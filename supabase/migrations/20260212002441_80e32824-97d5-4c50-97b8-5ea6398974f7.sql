
ALTER TABLE public.contacts
ADD COLUMN sales_channels jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.contacts.sales_channels IS 'Array of platform IDs representing how the customer was acquired, e.g. [{"platform_id":"...", "added_at":"..."}]';
