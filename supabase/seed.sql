-- ============================================================================
-- SUPRA V. AGENCY OS — SEED DATA
-- ============================================================================
-- Run after schema.sql + policies.sql.
-- Provides realistic data based on Supra v.'s actual operations:
--   - 9 employees (tous les rôles métier pour tester l’UI / dashboards)
--   - 6 clients (Le Jardin, Riad Atlas, Villa Peninsula, Africa Beauty, etc.)
--   - 13 videos in different production stages
--   - 10 tasks across the team
--   - 6 invoices (paid, pending, overdue)
--   - Editorial calendars, content ideas, internal Supra v. projects
--
-- IMPORTANT:
--   This seed creates DATA ONLY. It does NOT create auth.users.
--   In dev, create users via Supabase Studio first, then update the
--   `user_id` columns below with their actual UUIDs (see DEPLOYMENT.md).
-- ============================================================================

-- ─── EMPLOYEES ──────────────────────────────────────────────────────────────
-- user_id is null until you wire them to auth.users (see DEPLOYMENT.md).

insert into employees (id, full_name, role, email, phone, avatar_initials, avatar_color, weekly_capacity, hire_date) values
  ('11111111-1111-1111-1111-111111111111', 'Sif Eddine',      'admin',             'sif@suprav3.com',       '+212600000001', 'SE', '#C9A84C', 50, '2024-09-01'),
  ('22222222-2222-2222-2222-222222222222', 'Yasmine Kabbaj',  'editor',            'yasmine@suprav3.com',   '+212600000002', 'YK', '#C4789B', 40, '2025-01-15'),
  ('33333333-3333-3333-3333-333333333333', 'Mohamed Ouali',   'cameraman',         'mohamed@suprav3.com',   '+212600000003', 'MO', '#7C8DB0', 40, '2025-03-01'),
  ('44444444-4444-4444-4444-444444444444', 'Karim Saidi',     'community_manager', 'karim@suprav3.com',     '+212600000004', 'KS', '#6B9E7A', 30, '2025-09-01'),
  ('55555555-5555-5555-5555-555555555555', 'Amina Benjelloun','project_manager',   'pm@suprav3.com',        '+212600000005', 'AB', '#9B8FD9', 45, '2025-06-01'),
  ('66666666-6666-6666-6666-666666666666', 'Omar Fassi',      'commercial',        'commercial@suprav3.com','+212600000006', 'OF', '#D4A574', 40, '2025-04-01'),
  ('77777777-7777-7777-7777-777777777777', 'Salma Idrissi',   'finance',           'finance@suprav3.com',   '+212600000007', 'SI', '#5C8F8A', 40, '2025-05-01'),
  ('88888888-8888-8888-8888-888888888888', 'Hicham Lahlou',   'developer',         'dev@suprav3.com',     '+212600000008', 'HL', '#7A9CC6', 40, '2025-07-01'),
  ('99999999-9999-9999-9999-999999999999', 'Laila Mourad',    'seo',               'seo@suprav3.com',     '+212600000009', 'LM', '#C49A6C', 35, '2025-08-01')
on conflict (id) do nothing;

-- Pour tester chaque rôle : créer un utilisateur Auth (email ci-dessus), puis :
--   update employees set user_id = '<uuid auth.users>' where email = 'finance@suprav3.com';

-- ─── CLIENTS ────────────────────────────────────────────────────────────────

insert into clients (id, name, sector, status, contract_type, primary_contact, email, phone, city,
                     services, monthly_video_quota, monthly_fee, currency,
                     avatar_initials, avatar_color, account_manager_id, start_date) values
  ('aaaa1111-1111-1111-1111-aaaaaaaaaaaa', 'Restaurant Le Jardin', 'Restaurant',  'active', 'monthly',  'Hamid Benali',     'contact@lejardin.ma',          '+212612345678', 'Marrakech', array['Vidéo','Social Media'],            8,  8500,  'MAD', 'LJ', '#D4A853', '11111111-1111-1111-1111-111111111111', '2026-01-15'),
  ('aaaa2222-2222-2222-2222-aaaaaaaaaaaa', 'Riad Atlas Luxury',    'Hôtellerie',  'active', 'monthly',  'Fatima Alaoui',    'hello@riadatlas.ma',           '+212698765432', 'Marrakech', array['Vidéo','Site Web','SEO'],          6,  15000, 'MAD', 'RA', '#7C8DB0', '11111111-1111-1111-1111-111111111111', '2026-02-01'),
  ('aaaa3333-3333-3333-3333-aaaaaaaaaaaa', 'Villa Peninsula',      'Immobilier',  'active', 'one_shot', 'Youssef Mansouri', 'y.mansouri@vp.ma',             '+212655443322', 'Marrakech', array['Vidéo','Site Web'],                4,  22000, 'MAD', 'VP', '#6B9E7A', '11111111-1111-1111-1111-111111111111', '2026-03-10'),
  ('aaaa4444-4444-4444-4444-aaaaaaaaaaaa', 'Africa Beauty',        'Beauté',      'active', 'monthly',  'Nadia Chraibi',    'nadia@africabeauty.ma',        '+212671829304', 'Marrakech', array['Branding','Site Web','SEO'],       5,  6500,  'MAD', 'AB', '#C4789B', '11111111-1111-1111-1111-111111111111', '2026-02-20'),
  ('aaaa5555-5555-5555-5555-aaaaaaaaaaaa', 'Ideal Contemporain',   'Mobilier',    'pause',  'one_shot', 'Karim Tazi',       'k.tazi@idealcontemporain.ma',  '+212623456789', 'Marrakech', array['Site Web'],                        0,  0,     'MAD', 'IC', '#8B8B8B', '11111111-1111-1111-1111-111111111111', '2026-01-05'),
  ('aaaa6666-6666-6666-6666-aaaaaaaaaaaa', 'Addict by Gatsby',     'Lounge Bar',  'active', 'monthly',  'Lucas Bertin',     'lucas@gatsby.ma',              '+212666778899', 'Marrakech', array['Site Web','Branding','Vidéo'],     4,  9000,  'MAD', 'AG', '#A87B52', '11111111-1111-1111-1111-111111111111', '2026-03-01')
on conflict (id) do nothing;

-- ─── CLIENT PORTALS ─────────────────────────────────────────────────────────
-- Generates random tokens (in real app, generated by server actions)

insert into client_portals (client_id, token, is_active, expires_at) values
  ('aaaa1111-1111-1111-1111-aaaaaaaaaaaa', encode(gen_random_bytes(32), 'hex'), true, now() + interval '1 year'),
  ('aaaa2222-2222-2222-2222-aaaaaaaaaaaa', encode(gen_random_bytes(32), 'hex'), true, now() + interval '1 year'),
  ('aaaa3333-3333-3333-3333-aaaaaaaaaaaa', encode(gen_random_bytes(32), 'hex'), true, now() + interval '1 year'),
  ('aaaa4444-4444-4444-4444-aaaaaaaaaaaa', encode(gen_random_bytes(32), 'hex'), true, now() + interval '1 year'),
  ('aaaa6666-6666-6666-6666-aaaaaaaaaaaa', encode(gen_random_bytes(32), 'hex'), true, now() + interval '1 year')
on conflict (client_id) do nothing;

-- ─── EDITORIAL CALENDARS (May 2026) ────────────────────────────────────────

insert into editorial_calendars (client_id, month, quota) values
  ('aaaa1111-1111-1111-1111-aaaaaaaaaaaa', '2026-05-01', 8),
  ('aaaa2222-2222-2222-2222-aaaaaaaaaaaa', '2026-05-01', 6),
  ('aaaa3333-3333-3333-3333-aaaaaaaaaaaa', '2026-05-01', 4),
  ('aaaa4444-4444-4444-4444-aaaaaaaaaaaa', '2026-05-01', 5),
  ('aaaa6666-6666-6666-6666-aaaaaaaaaaaa', '2026-05-01', 4)
on conflict (client_id, month) do nothing;

-- ─── VIDEOS ─────────────────────────────────────────────────────────────────
-- 8 videos for Le Jardin (5 published, 1 editing, 1 shooting, 1 idea)
-- 3 for Riad Atlas, 2 for Villa Peninsula

insert into videos (client_id, title, type, format, platform, status, public_status,
                    editor_id, cameraman_id, delivery_deadline, priority) values
  ('aaaa1111-1111-1111-1111-aaaaaaaaaaaa', 'Nouveau menu printemps',     'Showcase',     'reel',    'instagram', 'published',     'published',          '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', '2026-05-03', 'normal'),
  ('aaaa1111-1111-1111-1111-aaaaaaaaaaaa', 'Recette tajine agneau',      'Tuto',         'tiktok',  'tiktok',    'published',     'published',          '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', '2026-05-06', 'normal'),
  ('aaaa1111-1111-1111-1111-aaaaaaaaaaaa', 'Ambiance soirée terrasse',   'Lifestyle',    'reel',    'instagram', 'published',     'published',          '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', '2026-05-08', 'normal'),
  ('aaaa1111-1111-1111-1111-aaaaaaaaaaaa', 'Interview chef Hamid',       'Behind scenes','long_form','youtube',  'published',     'published',          '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', '2026-05-10', 'normal'),
  ('aaaa1111-1111-1111-1111-aaaaaaaaaaaa', 'Promo week-end',             'Publicité',    'ad',      'instagram', 'published',     'published',          '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', '2026-05-12', 'normal'),
  ('aaaa1111-1111-1111-1111-aaaaaaaaaaaa', 'Dessert signature',          'Produit',      'reel',    'instagram', 'editing',       'in_editing',         '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', '2026-05-09', 'high'),
  ('aaaa1111-1111-1111-1111-aaaaaaaaaaaa', 'Terrasse sunset',            'Ambiance',     'tiktok',  'tiktok',    'shooting_planned','shooting_planned', null,                                   '33333333-3333-3333-3333-333333333333', '2026-05-11', 'normal'),
  ('aaaa1111-1111-1111-1111-aaaaaaaaaaaa', 'Sujet à définir #8',         null,           null,      null,        'idea',          'topic_proposed',     null,                                   null,                                   '2026-05-15', 'urgent'),
  ('aaaa2222-2222-2222-2222-aaaaaaaaaaaa', 'Room tour suite premium',    'Visite',       'long_form','youtube',  'editing',       'in_editing',         '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', '2026-05-10', 'high'),
  ('aaaa2222-2222-2222-2222-aaaaaaaaaaaa', 'Expérience spa',             'Lifestyle',    'reel',    'instagram', 'sent_to_client','in_validation',      '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', '2026-05-08', 'urgent'),
  ('aaaa2222-2222-2222-2222-aaaaaaaaaaaa', 'Petit-déjeuner rooftop',     'Showcase',     'tiktok',  'tiktok',    'shooting_done', 'in_production',      '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', '2026-05-12', 'normal'),
  ('aaaa3333-3333-3333-3333-aaaaaaaaaaaa', 'Visite Villa Peninsula',     'Visite',       'long_form','youtube',  'validated',     'validated',          '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', '2026-05-05', 'normal'),
  ('aaaa3333-3333-3333-3333-aaaaaaaaaaaa', 'Vue panoramique Marrakech',  'Drone',        'reel',    'instagram', 'editing',       'in_editing',         '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', '2026-05-09', 'high');

-- ─── PROJECTS (web/dev/branding) ───────────────────────────────────────────

insert into projects (client_id, title, type, status, progress, lead_id, deadline, budget) values
  ('aaaa2222-2222-2222-2222-aaaaaaaaaaaa', 'Site Web Riad Atlas Luxury',     'Site Web',  'in_progress', 70,  '11111111-1111-1111-1111-111111111111', '2026-05-25', 25000),
  ('aaaa3333-3333-3333-3333-aaaaaaaaaaaa', 'Site Vitrine Villa Peninsula',   'Site Web',  'in_progress', 45,  '11111111-1111-1111-1111-111111111111', '2026-06-01', 18000),
  ('aaaa4444-4444-4444-4444-aaaaaaaaaaaa', 'Branding + Site Africa Beauty',  'Branding',  'in_progress', 60,  '11111111-1111-1111-1111-111111111111', '2026-05-20', 12000),
  ('aaaa6666-6666-6666-6666-aaaaaaaaaaaa', 'Site Web Addict by Gatsby',      'Site Web',  'in_progress', 30,  '11111111-1111-1111-1111-111111111111', '2026-06-15', 15000),
  ('aaaa2222-2222-2222-2222-aaaaaaaaaaaa', 'SEO Riad Atlas',                 'SEO',       'in_progress', 25,  '11111111-1111-1111-1111-111111111111', '2026-08-01', 8000);

-- ─── INTERNAL PROJECTS (Supra v.) ──────────────────────────────────────────

insert into internal_projects (title, category, status, priority, progress, owner_id, deadline) values
  ('Site Web Supra v.',                  'Marketing',  'in_progress', 'high',     65, '11111111-1111-1111-1111-111111111111', '2026-06-01'),
  ('SEO Supra v. — Cocon sémantique',    'SEO',        'in_progress', 'high',     40, '11111111-1111-1111-1111-111111111111', '2026-06-15'),
  ('Instagram Supra v.',                 'Marketing',  'todo',        'normal',   20, '44444444-4444-4444-4444-444444444444', '2026-06-01'),
  ('Portfolio & Case Studies',           'Marketing',  'in_progress', 'normal',   30, '11111111-1111-1111-1111-111111111111', '2026-07-01'),
  ('Prospection Immobilier Marrakech',   'Sales',      'in_progress', 'high',     50, '11111111-1111-1111-1111-111111111111', '2026-05-31'),
  ('Partenariats Hôtels',                'Sales',      'todo',        'normal',   10, '11111111-1111-1111-1111-111111111111', '2026-06-30');

-- ─── TASKS ──────────────────────────────────────────────────────────────────

insert into tasks (title, client_id, assignee_id, priority, status, deadline, progress, estimated_hours) values
  ('Finaliser montage Dessert Signature',         'aaaa1111-1111-1111-1111-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'urgent', 'in_progress',    '2026-05-08 18:00', 70,  3),
  ('Révision vidéo Hôtel Atlas — Spa',            'aaaa2222-2222-2222-2222-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'high',   'review',         '2026-05-09 17:00', 90,  2),
  ('Tournage Restaurant Le Jardin — Terrasse',    'aaaa1111-1111-1111-1111-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'normal', 'todo',           '2026-05-09 14:00', 0,   4),
  ('Site Web Africa Beauty — Pages internes',     'aaaa4444-4444-4444-4444-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'high',   'in_progress',    '2026-05-12 18:00', 55,  8),
  ('SEO Supra v. — Structure cocon',              null,                                    '11111111-1111-1111-1111-111111111111', 'normal', 'in_progress',    '2026-05-15 18:00', 40,  6),
  ('Script vidéo Villa Peninsula',                'aaaa3333-3333-3333-3333-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'high',   'todo',           '2026-05-10 18:00', 0,   2),
  ('Calendrier mai — Addict by Gatsby',           'aaaa6666-6666-6666-6666-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 'normal', 'in_progress',    '2026-05-09 18:00', 60,  3),
  ('Révision logo Africa Beauty V2',              'aaaa4444-4444-4444-4444-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'normal', 'waiting_client', '2026-05-11 18:00', 100, 4),
  ('Montage rushes Riad Atlas — Room tour',       'aaaa2222-2222-2222-2222-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'high',   'in_progress',    '2026-05-10 18:00', 35,  5),
  ('Rapport mensuel Restaurant Le Jardin',        'aaaa1111-1111-1111-1111-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'normal', 'todo',           '2026-05-15 18:00', 0,   2);

-- ─── INVOICES ──────────────────────────────────────────────────────────────

insert into invoices (id, client_id, ref, issue_date, due_date, status, subtotal, tax_rate, tax_amount, total, currency, payment_terms, notes) values
  ('bbbb1111-1111-1111-1111-bbbbbbbbbbbb', 'aaaa1111-1111-1111-1111-aaaaaaaaaaaa', 'FAC-2026-041', '2026-04-01', '2026-04-30', 'paid',    8500,  0, 0, 8500,  'MAD', 'Paiement à 30 jours par virement bancaire',  'Production vidéo mensuelle — Mai 2026'),
  ('bbbb2222-2222-2222-2222-bbbbbbbbbbbb', 'aaaa2222-2222-2222-2222-aaaaaaaaaaaa', 'FAC-2026-042', '2026-04-01', '2026-04-30', 'paid',    15000, 0, 0, 15000, 'MAD', 'Paiement à 30 jours par virement bancaire',  'Package mensuel — Vidéo + Site + SEO'),
  ('bbbb3333-3333-3333-3333-bbbbbbbbbbbb', 'aaaa4444-4444-4444-4444-aaaaaaaaaaaa', 'FAC-2026-043', '2026-04-15', '2026-05-15', 'pending', 6500,  0, 0, 6500,  'MAD', 'Paiement à 30 jours par virement bancaire',  'Branding + Site Web Africa Beauty'),
  ('bbbb4444-4444-4444-4444-bbbbbbbbbbbb', 'aaaa3333-3333-3333-3333-aaaaaaaaaaaa', 'FAC-2026-044', '2026-04-01', '2026-05-01', 'overdue', 22000, 0, 0, 22000, 'MAD', 'Paiement à 30 jours par virement bancaire',  'Site Web + Production Vidéo Villa Peninsula'),
  ('bbbb5555-5555-5555-5555-bbbbbbbbbbbb', 'aaaa6666-6666-6666-6666-aaaaaaaaaaaa', 'FAC-2026-045', '2026-05-01', '2026-05-31', 'pending', 9000,  0, 0, 9000,  'MAD', 'Paiement à 30 jours par virement bancaire',  'Site Web + Branding — Mai 2026'),
  ('bbbb6666-6666-6666-6666-bbbbbbbbbbbb', 'aaaa1111-1111-1111-1111-aaaaaaaaaaaa', 'FAC-2026-046', '2026-05-01', '2026-05-31', 'sent',    8500,  0, 0, 8500,  'MAD', 'Paiement à 30 jours par virement bancaire',  'Production vidéo mensuelle — Juin 2026');

-- ─── INVOICE ITEMS ─────────────────────────────────────────────────────────

insert into invoice_items (invoice_id, position, description, quantity, unit, unit_price) values
  ('bbbb1111-1111-1111-1111-bbbbbbbbbbbb', 1, 'Production vidéo mensuelle — 8 vidéos courts formats',                  8, 'vidéo',   1062.50),
  ('bbbb2222-2222-2222-2222-bbbbbbbbbbbb', 1, 'Production vidéo mensuelle — 6 vidéos',                                  6, 'vidéo',   1500),
  ('bbbb2222-2222-2222-2222-bbbbbbbbbbbb', 2, 'Suivi & maintenance Site Web',                                            1, 'forfait', 3000),
  ('bbbb2222-2222-2222-2222-bbbbbbbbbbbb', 3, 'Optimisation SEO mensuelle',                                              1, 'forfait', 3000),
  ('bbbb3333-3333-3333-3333-bbbbbbbbbbbb', 1, 'Création identité visuelle complète (logo + charte + dérivés)',           1, 'forfait', 4500),
  ('bbbb3333-3333-3333-3333-bbbbbbbbbbbb', 2, 'Site Web vitrine 5 pages',                                                1, 'forfait', 2000),
  ('bbbb4444-4444-4444-4444-bbbbbbbbbbbb', 1, 'Site Web premium custom — Villa Peninsula',                               1, 'forfait', 18000),
  ('bbbb4444-4444-4444-4444-bbbbbbbbbbbb', 2, 'Production vidéo immobilière (visite + drone)',                           1, 'forfait', 4000),
  ('bbbb5555-5555-5555-5555-bbbbbbbbbbbb', 1, 'Site Web Addict by Gatsby — Phase 1',                                     1, 'forfait', 6000),
  ('bbbb5555-5555-5555-5555-bbbbbbbbbbbb', 2, 'Identité de marque',                                                       1, 'forfait', 3000),
  ('bbbb6666-6666-6666-6666-bbbbbbbbbbbb', 1, 'Production vidéo mensuelle — 8 vidéos courts formats',                   8, 'vidéo',   1062.50);

-- ─── PAYMENTS (for paid invoices) ──────────────────────────────────────────

insert into payments (invoice_id, client_id, amount, method, payment_date, reference) values
  ('bbbb1111-1111-1111-1111-bbbbbbbbbbbb', 'aaaa1111-1111-1111-1111-aaaaaaaaaaaa', 8500,  'bank_transfer', '2026-04-25', 'VIR-LJ-042026'),
  ('bbbb2222-2222-2222-2222-bbbbbbbbbbbb', 'aaaa2222-2222-2222-2222-aaaaaaaaaaaa', 15000, 'bank_transfer', '2026-04-28', 'VIR-RA-042026');

update invoices set paid_at = '2026-04-25 10:00' where id = 'bbbb1111-1111-1111-1111-bbbbbbbbbbbb';
update invoices set paid_at = '2026-04-28 14:30' where id = 'bbbb2222-2222-2222-2222-bbbbbbbbbbbb';

-- ─── VIDEO TEMPLATES (per sector) ──────────────────────────────────────────

insert into video_templates (sector, title, description, format, duration_seconds, brief_template) values
  ('Restaurant',  'Recette express du chef',          'Tutoriel cuisine rapide en cuisine, format vertical',                'reel',     60,  '1. Plan d''ouverture sur l''ingrédient phare\n2. Préparation rapide en plans serrés\n3. Plan final assiette dressée\n4. Texte incrusté avec nom du plat'),
  ('Restaurant',  'Ambiance salle / terrasse',        'Mise en valeur de l''ambiance lors du service',                       'reel',     30,  'Plans larges + serrés du lieu en pleine activité, lumière chaude, musique douce'),
  ('Restaurant',  'Interview équipe',                 'Format storytelling avec membre de l''équipe',                        'long_form', 90,  'Interview en cuisine ou en salle, voix-off + plans illustratifs'),
  ('Hôtellerie',  'Room tour suite premium',          'Visite immersive d''une suite haut de gamme',                         'long_form', 60,  'Plan d''entrée + détails déco + vue + spa privé. Musique élégante.'),
  ('Hôtellerie',  'Expérience spa',                   'Mise en valeur des services spa & bien-être',                         'reel',     45,  'Rituels spa, ambiance zen, gros plans textures et matières'),
  ('Hôtellerie',  'Petit-déjeuner rooftop',           'Vue + petit-déjeuner gastronomique',                                  'tiktok',   30,  'Lever de soleil + plans rapprochés du buffet + plan large de la vue'),
  ('Immobilier',  'Visite bien — drone',              'Visite immersive avec plans drone extérieur',                          'long_form', 90,  'Drone arrivée + visite intérieure plan séquence + vue panoramique'),
  ('Immobilier',  'Témoignage acheteur',              'Interview client satisfait',                                          'long_form', 60,  'Interview face caméra dans le bien + b-roll du quartier'),
  ('Beauté',      'Avant / après transformation',     'Showcase d''une prestation cliente',                                  'reel',     60,  'Avant + déroulé soin + résultat final'),
  ('Beauté',      'Tutoriel soin',                    'Démonstration produit ou geste pro',                                  'long_form', 90,  'Présentation produit + application + résultat'),
  ('Lounge Bar',  'Ambiance soirée',                  'Vie nocturne du lieu',                                                'reel',     30,  'Plans cocktails + foule + DJ. Musique entraînante.'),
  ('Lounge Bar',  'Menu cocktails',                   'Présentation des cocktails signature',                                'tiktok',   45,  'Préparation cocktail + plan final présenté');

-- ─── CONTENT IDEAS (suggestions) ───────────────────────────────────────────

insert into content_ideas (client_id, sector, title, format, platform, estimated_duration) values
  ('aaaa1111-1111-1111-1111-aaaaaaaaaaaa', 'Restaurant', 'POV : Tu arrives au restaurant',         'reel',     'instagram', 30),
  ('aaaa1111-1111-1111-1111-aaaaaaaaaaaa', 'Restaurant', 'Témoignage client habitué',              'long_form','instagram', 60),
  ('aaaa1111-1111-1111-1111-aaaaaaaaaaaa', 'Restaurant', 'Recette signature en 3 étapes',          'tiktok',   'tiktok',    45),
  ('aaaa2222-2222-2222-2222-aaaaaaaaaaaa', 'Hôtellerie', 'Coucher de soleil terrasse',             'reel',     'instagram', 30),
  ('aaaa2222-2222-2222-2222-aaaaaaaaaaaa', 'Hôtellerie', 'Visite hammam traditionnel',             'long_form','youtube',   60),
  ('aaaa3333-3333-3333-3333-aaaaaaaaaaaa', 'Immobilier', 'Quartier & localisation',                'long_form','youtube',   45),
  ('aaaa3333-3333-3333-3333-aaaaaaaaaaaa', 'Immobilier', 'Avant / après rénovation',               'reel',     'instagram', 30),
  ('aaaa4444-4444-4444-4444-aaaaaaaaaaaa', 'Beauté',     'Routine soin du jour',                   'reel',     'instagram', 60),
  ('aaaa6666-6666-6666-6666-aaaaaaaaaaaa', 'Lounge Bar', 'DJ set highlights de la semaine',        'reel',     'instagram', 60);

-- ─── NOTIFICATIONS (sample for Sif as admin) ────────────────────────────────
-- Note: recipient_user_id needs to be replaced with actual auth.users uuid
-- These are commented out; un-comment after wiring users in DEPLOYMENT.md

-- insert into notifications (recipient_user_id, type, priority, title, message, related_entity_type, related_entity_id, link_url) values
--   ('SIF_USER_UUID_HERE', 'invoice_overdue',          'urgent', 'Facture en retard',     'Villa Peninsula — FAC-2026-044 — 22 000 MAD impayée depuis le 1er mai', 'invoice', 'bbbb4444-4444-4444-4444-bbbbbbbbbbbb', '/invoices/bbbb4444-4444-4444-4444-bbbbbbbbbbbb'),
--   ('SIF_USER_UUID_HERE', 'quota_incomplete',         'high',   'Quota incomplet',       'Restaurant Le Jardin — 1 vidéo manquante (7/8)',                          'client',  'aaaa1111-1111-1111-1111-aaaaaaaaaaaa', '/clients/aaaa1111-1111-1111-1111-aaaaaaaaaaaa'),
--   ('SIF_USER_UUID_HERE', 'client_revision_requested','normal', 'Modification demandée', 'Riad Atlas Luxury a demandé une modification — Expérience Spa',          'video',   null,                                   '/videos');

-- ============================================================================
-- END OF SEED
-- ============================================================================
