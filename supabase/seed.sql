-- Development seed data — run after migrations
-- Only used locally; never run against production

INSERT INTO auth.users (id, email, created_at, email_confirmed_at)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'alice@test.com', now(), now()),
  ('00000000-0000-0000-0000-000000000002', 'bob@test.com',   now(), now())
ON CONFLICT DO NOTHING;

-- handle_new_user trigger will create users rows automatically
-- Update xp/level for richer dev state
UPDATE users SET username = 'alice', level = 5, xp = 420, streak = 7 WHERE id = '00000000-0000-0000-0000-000000000001';
UPDATE users SET username = 'bob',   level = 2, xp = 110, streak = 2 WHERE id = '00000000-0000-0000-0000-000000000002';

INSERT INTO subjects (user_id, name, color, icon, daily_goal_minutes) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Mathematics', '#7c3aed', 'calculator', 60),
  ('00000000-0000-0000-0000-000000000001', 'Physics',     '#2563eb', 'atom',       90),
  ('00000000-0000-0000-0000-000000000002', 'Coding',      '#059669', 'code',       120)
ON CONFLICT DO NOTHING;
