-- Add the requested official-site placeholders once, without replacing saved links.
UPDATE site_configs
SET value = json_insert(value, '$.links[#]', json('{"name":"B 站","icon":"fa6-brands:bilibili","url":"https://www.bilibili.com/"}')),
    updated_at = unixepoch()
WHERE key = 'profile' AND json_valid(value) AND json_type(value, '$.links') = 'array'
  AND NOT EXISTS (SELECT 1 FROM system_configs WHERE key = 'migration_profile_socials_20261001')
  AND NOT EXISTS (SELECT 1 FROM json_each(site_configs.value, '$.links') AS link WHERE json_extract(link.value, '$.icon') = 'fa6-brands:bilibili' OR lower(json_extract(link.value, '$.name')) IN ('bilibili', 'b站', 'b 站'));

UPDATE site_configs
SET value = json_insert(value, '$.links[#]', json('{"name":"QQ","icon":"fa6-brands:qq","url":"https://im.qq.com/"}')),
    updated_at = unixepoch()
WHERE key = 'profile' AND json_valid(value) AND json_type(value, '$.links') = 'array'
  AND NOT EXISTS (SELECT 1 FROM system_configs WHERE key = 'migration_profile_socials_20261001')
  AND NOT EXISTS (SELECT 1 FROM json_each(site_configs.value, '$.links') AS link WHERE json_extract(link.value, '$.icon') = 'fa6-brands:qq' OR lower(json_extract(link.value, '$.name')) = 'qq');

INSERT OR IGNORE INTO system_configs (key, value, updated_at)
VALUES ('migration_profile_socials_20261001', 'true', unixepoch());
