-- ============================================================
-- 001_schema.sql — tables, constraints, indexes, triggers
-- ============================================================

-- ── users ────────────────────────────────────────────────────
CREATE TABLE users (
  id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username        text        NOT NULL UNIQUE,
  email           text        NOT NULL UNIQUE,
  avatar_url      text,
  level           int         NOT NULL DEFAULT 1 CHECK (level >= 1),
  xp              int         NOT NULL DEFAULT 0  CHECK (xp >= 0),
  streak          int         NOT NULL DEFAULT 0  CHECK (streak >= 0),
  longest_streak  int         NOT NULL DEFAULT 0  CHECK (longest_streak >= 0),
  timezone        text        NOT NULL DEFAULT 'UTC',
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ── subjects ─────────────────────────────────────────────────
CREATE TABLE subjects (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 50),
  color               text        NOT NULL CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
  icon                text        NOT NULL,
  daily_goal_minutes  int         NOT NULL DEFAULT 60 CHECK (daily_goal_minutes > 0),
  is_active           bool        NOT NULL DEFAULT true
);

-- ── sessions ─────────────────────────────────────────────────
CREATE TABLE sessions (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id        uuid        REFERENCES subjects(id) ON DELETE SET NULL,
  started_at        timestamptz NOT NULL,
  ended_at          timestamptz,
  duration_minutes  int         NOT NULL DEFAULT 0 CHECK (duration_minutes >= 0),
  was_completed     bool        NOT NULL DEFAULT false,
  synced            bool        NOT NULL DEFAULT false,
  CONSTRAINT sessions_ended_after_started CHECK (ended_at IS NULL OR ended_at >= started_at)
);

-- ── rooms ────────────────────────────────────────────────────
CREATE TABLE rooms (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  owner_id    uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_private  bool        NOT NULL DEFAULT false,
  max_members int         NOT NULL DEFAULT 10 CHECK (max_members BETWEEN 2 AND 50),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── room_members ─────────────────────────────────────────────
CREATE TABLE room_members (
  room_id    uuid        NOT NULL REFERENCES rooms(id)  ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  joined_at  timestamptz NOT NULL DEFAULT now(),
  is_active  bool        NOT NULL DEFAULT true,
  PRIMARY KEY (room_id, user_id)
);

-- ── friendships ──────────────────────────────────────────────
CREATE TABLE friendships (
  requester_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  addressee_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status        text NOT NULL CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (requester_id, addressee_id),
  CONSTRAINT friendships_no_self_friend CHECK (requester_id <> addressee_id)
);

-- ── achievements ─────────────────────────────────────────────
CREATE TABLE achievements (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_type  text        NOT NULL CHECK (badge_type IN (
                'first_session', 'streak_3', 'streak_7', 'streak_30',
                'hours_10', 'hours_100', 'level_5', 'level_10',
                'room_host', 'social_butterfly'
              )),
  earned_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT achievements_user_badge_unique UNIQUE (user_id, badge_type)
);

-- ── indexes ──────────────────────────────────────────────────
CREATE INDEX idx_sessions_user_id        ON sessions(user_id);
CREATE INDEX idx_sessions_started_at     ON sessions(started_at);
CREATE INDEX idx_sessions_user_started   ON sessions(user_id, started_at DESC);
CREATE INDEX idx_subjects_user_id        ON subjects(user_id);
CREATE INDEX idx_subjects_user_active    ON subjects(user_id) WHERE is_active = true;
CREATE INDEX idx_room_members_room_id    ON room_members(room_id);
CREATE INDEX idx_room_members_user_id    ON room_members(user_id);
CREATE INDEX idx_room_members_active     ON room_members(room_id) WHERE is_active = true;
CREATE INDEX idx_friendships_addressee   ON friendships(addressee_id);
CREATE INDEX idx_friendships_status      ON friendships(requester_id, status);
CREATE INDEX idx_achievements_user_id    ON achievements(user_id);
CREATE INDEX idx_rooms_owner_id          ON rooms(owner_id);
CREATE INDEX idx_rooms_public            ON rooms(created_at DESC) WHERE is_private = false;

-- ── trigger: auto-create user profile on signup ──────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, username, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    NEW.email
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
