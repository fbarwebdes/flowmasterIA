-- Clear all products to start fresh with corrected Shopee links
TRUNCATE TABLE products CASCADE;

-- Reset automation cycle
UPDATE automation_config 
SET 
  last_shuffle_index = 0, 
  shuffled_product_ids = '[]'::jsonb, 
  cycle_completed = false;

-- Optional: Clear schedules history if you want a completely clean slate
-- TRUNCATE TABLE schedules;
