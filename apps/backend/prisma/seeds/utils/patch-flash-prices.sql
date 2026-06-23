UPDATE mkt_store_config
SET rules = rules || '{
  "originalPrice": 27.9,
  "flashPrice": 19.9,
  "skuPrices": {
    "hf-instant-coconut-water-001-sku-3": {"flashPrice": 19.9, "originalPrice": 27.9},
    "hf-instant-coconut-water-001-sku-1": {"flashPrice": 29.9, "originalPrice": 36.9},
    "hf-instant-coconut-water-001-sku-2": {"flashPrice": 55.9, "originalPrice": 68.0}
  }
}'::jsonb
WHERE id = 'hf-config-flash-coconut';

UPDATE mkt_store_config
SET rules = rules || '{
  "originalPrice": 34.9,
  "skuPrices": {
    "hf-instant-fruit-platter-001-sku-1": {"flashPrice": 29.9, "originalPrice": 34.9},
    "hf-instant-fruit-platter-001-sku-2": {"flashPrice": 49.9, "originalPrice": 55.9},
    "hf-instant-fruit-platter-001-sku-3": {"flashPrice": 69.9, "originalPrice": 75.9}
  }
}'::jsonb
WHERE id = 'hf-config-flash-fruit';

UPDATE mkt_store_config
SET rules = rules || '{
  "originalPrice": 18.5,
  "flashPrice": 14.9,
  "skuPrices": {
    "hf-retail-cleaner-001-sku-3": {"flashPrice": 14.9, "originalPrice": 18.5},
    "hf-retail-cleaner-001-sku-1": {"flashPrice": 17.9, "originalPrice": 21.9},
    "hf-retail-cleaner-001-sku-2": {"flashPrice": 29.9, "originalPrice": 36.9}
  }
}'::jsonb
WHERE id = 'hf-config-flash-cleaner';
