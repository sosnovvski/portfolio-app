-- Fictional data for tests only.
INSERT INTO profile (id, full_name, headline_en, headline_pl, summary_en, summary_pl, location_en, location_pl, linkedin_url)
VALUES (1, 'Test Person', 'Fixture headline', 'Nagłówek testowy', 'Fixture summary', 'Podsumowanie testowe', 'Testville', 'Testowo', 'https://example.test/in/test');

INSERT INTO experience (id, employer, client, role_en, role_pl, start_month, end_month, published) VALUES
    (1, 'Older Fixture Co', 'Fixture Client', 'Engineer', 'Inżynier', '2020-01-01', '2021-03-01', true),
    (2, 'Newer Fixture Co', NULL, 'Lead', 'Lider', '2021-04-01', NULL, true),
    (3, 'Hidden Fixture Co', NULL, 'Draft', 'Szkic', '2022-01-01', NULL, false);

INSERT INTO achievement (experience_id, text_en, text_pl, sort_order) VALUES
    (1, 'Second', 'Drugie', 1),
    (1, 'First', 'Pierwsze', 0);

INSERT INTO skill_group (id, name_en, name_pl, sort_order) VALUES (1, 'Group', 'Grupa', 0);
INSERT INTO skill (group_id, name, sort_order) VALUES (1, 'Beta', 1), (1, 'Alpha', 0);

INSERT INTO credential (kind, title_en, title_pl, issuer, start_year, sort_order)
VALUES ('CERTIFICATION', 'Fixture cert', 'Certyfikat testowy', 'Fixture Issuer', 2021, 0);

INSERT INTO project (slug, name_en, name_pl, summary_en, summary_pl, status, tech, sort_order, published) VALUES
    ('visible', 'Visible', 'Widoczny', 'Summary', 'Opis', 'LIVE', '{Java,SQL}', 0, true),
    ('hidden', 'Hidden', 'Ukryty', 'Summary', 'Opis', 'PLANNED', '{}', 1, false);

SELECT setval(pg_get_serial_sequence('experience', 'id'), 3);
SELECT setval(pg_get_serial_sequence('skill_group', 'id'), 1);
