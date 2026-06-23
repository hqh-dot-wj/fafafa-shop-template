UPDATE mkt_store_config
SET rules = rules || '{"storeParticipating": true, "storeReady": true, "originalPrice": 980}'::jsonb
WHERE id = 'hf-config-course-art';

UPDATE mkt_store_config
SET rules = rules || '{"storeParticipating": true, "storeReady": true, "originalPrice": 1280}'::jsonb
WHERE id = 'hf-config-course-basketball';

UPDATE mkt_store_config
SET rules = rules || '{"storeParticipating": true, "storeReady": true, "originalPrice": 1280}'::jsonb
WHERE id = 'hf-config-course-basketball-delayed';

UPDATE mkt_store_config
SET rules = rules || '{"storeParticipating": true, "storeReady": true, "originalPrice": 1280}'::jsonb
WHERE id = 'hf-config-course-spoken';
