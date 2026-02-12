
ALTER TABLE public.service_conversations
ADD COLUMN sales_channels jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.service_conversations.sales_channels IS 'Array of platform IDs representing the customer journey path, e.g. ["google-id", "instagram-id", "whatsapp-id"]';
