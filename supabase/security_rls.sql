-- Security Script: Enable RLS and Set Policies

-- 1. Products Table
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to see only their own products
-- Note: If the column user_id is missing, this script will fail gracefully 
-- in the SQL editor until the column is added.
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='user_id') THEN
        ALTER TABLE products ADD COLUMN user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();
    END IF;
END $$;

CREATE POLICY "Users can manage their own products" 
ON products FOR ALL 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

-- 2. Schedules Table
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='schedules' AND column_name='user_id') THEN
        ALTER TABLE schedules ADD COLUMN user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();
    END IF;
END $$;

CREATE POLICY "Users can manage their own schedules" 
ON schedules FOR ALL 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

-- 3. App Settings Table
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own settings" 
ON app_settings FOR ALL 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

-- 4. Automation Config Table
ALTER TABLE automation_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own automation" 
ON automation_config FOR ALL 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

-- Ensure correct defaults for new rows
ALTER TABLE products ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE schedules ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE app_settings ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE automation_config ALTER COLUMN user_id SET DEFAULT auth.uid();
