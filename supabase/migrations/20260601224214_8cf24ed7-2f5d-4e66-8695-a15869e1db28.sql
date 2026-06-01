ALTER TABLE public.monthly_goals ALTER COLUMN user_id DROP NOT NULL;
DROP POLICY IF EXISTS "Users can view their own goals" ON public.monthly_goals;
DROP POLICY IF EXISTS "Users can create their own goals" ON public.monthly_goals;
DROP POLICY IF EXISTS "Users can update their own goals" ON public.monthly_goals;
DROP POLICY IF EXISTS "Users can delete their own goals" ON public.monthly_goals;
CREATE POLICY "Allow all operations on monthly_goals" ON public.monthly_goals FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monthly_goals TO anon;