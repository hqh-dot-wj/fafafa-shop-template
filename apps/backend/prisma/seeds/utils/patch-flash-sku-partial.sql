UPDATE mkt_store_config
SET rules = jsonb_set(rules, '{skuPrices}', '{
  "hf-instant-coconut-water-001-sku-3": {"flashPrice": 19.9, "originalPrice": 27.9}
}'::jsonb)
WHERE id = 'hf-config-flash-coconut';

UPDATE mkt_store_config
SET rules = jsonb_set(rules, '{skuPrices}', '{
  "hf-instant-fruit-platter-001-sku-1": {"flashPrice": 29.9, "originalPrice": 34.9}
}'::jsonb)
WHERE id = 'hf-config-flash-fruit';

UPDATE mkt_store_config
SET rules = jsonb_set(rules, '{skuPrices}', '{
  "hf-retail-cleaner-001-sku-3": {"flashPrice": 14.9, "originalPrice": 18.5},
  "hf-retail-cleaner-001-sku-1": {"flashPrice": 17.9, "originalPrice": 21.9}
}'::jsonb)
WHERE id = 'hf-config-flash-cleaner';
