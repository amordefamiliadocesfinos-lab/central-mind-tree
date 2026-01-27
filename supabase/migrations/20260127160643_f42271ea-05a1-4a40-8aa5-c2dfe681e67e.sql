-- Remove the old CHECK constraint that validates against hardcoded platform names
-- The platform column now stores UUIDs from the digital_platforms table
ALTER TABLE public.digital_variations DROP CONSTRAINT IF EXISTS digital_variations_platform_check;