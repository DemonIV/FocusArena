-- ============================================================
-- 002_rls.sql — Row Level Security policies
-- ============================================================

-- ── users ────────────────────────────────────────────────────
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read profiles (leaderboard, rooms, search)
CREATE POLICY "users_select_all" ON users
  FOR SELECT TO authenticated
  USING (true);

-- Users update only their own profile
CREATE POLICY "users_update_own" ON users
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ── subjects ─────────────────────────────────────────────────
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subjects_select_own" ON subjects
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "subjects_insert_own" ON subjects
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "subjects_update_own" ON subjects
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "subjects_delete_own" ON subjects
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ── sessions ─────────────────────────────────────────────────
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sessions_select_own" ON sessions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "sessions_insert_own" ON sessions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "sessions_update_own" ON sessions
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "sessions_delete_own" ON sessions
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ── rooms ────────────────────────────────────────────────────
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

-- Public rooms visible to all; private rooms only to owner + members
CREATE POLICY "rooms_select" ON rooms
  FOR SELECT TO authenticated
  USING (
    is_private = false
    OR owner_id = auth.uid()
    OR id IN (
      SELECT room_id FROM room_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "rooms_insert_own" ON rooms
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "rooms_update_owner" ON rooms
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "rooms_delete_owner" ON rooms
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- ── room_members ─────────────────────────────────────────────
ALTER TABLE room_members ENABLE ROW LEVEL SECURITY;

-- Visible to the member themselves and all active members of the same room
CREATE POLICY "room_members_select" ON room_members
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR room_id IN (
      SELECT room_id FROM room_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Users can only add themselves to a room
CREATE POLICY "room_members_insert_self" ON room_members
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users update only their own membership row
CREATE POLICY "room_members_update_own" ON room_members
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can leave; room owners can remove any member
CREATE POLICY "room_members_delete" ON room_members
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR room_id IN (
      SELECT id FROM rooms WHERE owner_id = auth.uid()
    )
  );

-- ── friendships ──────────────────────────────────────────────
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "friendships_select_own" ON friendships
  FOR SELECT TO authenticated
  USING (requester_id = auth.uid() OR addressee_id = auth.uid());

-- Only requester can initiate
CREATE POLICY "friendships_insert" ON friendships
  FOR INSERT TO authenticated
  WITH CHECK (requester_id = auth.uid());

-- Either party can update (accept / block)
CREATE POLICY "friendships_update" ON friendships
  FOR UPDATE TO authenticated
  USING (requester_id = auth.uid() OR addressee_id = auth.uid())
  WITH CHECK (requester_id = auth.uid() OR addressee_id = auth.uid());

-- Either party can remove the friendship
CREATE POLICY "friendships_delete" ON friendships
  FOR DELETE TO authenticated
  USING (requester_id = auth.uid() OR addressee_id = auth.uid());

-- ── achievements ─────────────────────────────────────────────
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;

-- Users read their own; other users can read for profile display
CREATE POLICY "achievements_select" ON achievements
  FOR SELECT TO authenticated
  USING (true);

-- Insert/update/delete handled exclusively by service role (backend)
-- No client-side policies needed — service role bypasses RLS
