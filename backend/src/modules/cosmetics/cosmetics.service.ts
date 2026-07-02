import { supabase } from '../../shared';
import { FRAME_CATALOG, getFrameDef } from './cosmetics.schema';
import type { FramesResponse } from './cosmetics.schema';

/**
 * Typed business error so the route layer can map to proper 4xx codes
 * instead of a blanket 500.
 */
export class CosmeticsError extends Error {
  constructor(
    public code: 'unknown_frame' | 'not_owned' | 'already_owned' | 'insufficient_coins',
  ) {
    super(code);
    this.name = 'CosmeticsError';
  }
}

/** Full shop view for the caller: coin balance + every frame with ownership. */
export async function getFramesForUser(userId: string): Promise<FramesResponse> {
  const [{ data: user, error: userErr }, { data: owned, error: ownedErr }] = await Promise.all([
    supabase.from('users').select('coins, selected_frame').eq('id', userId).single(),
    supabase.from('user_frames').select('frame_id').eq('user_id', userId),
  ]);

  if (userErr || !user) throw new Error('User not found');
  if (ownedErr) throw new Error(ownedErr.message);

  const ownedSet = new Set((owned ?? []).map((r) => r.frame_id as string));

  return {
    coins: user.coins as number,
    selectedFrame: (user.selected_frame as string | null) ?? null,
    frames: FRAME_CATALOG.map((f) => ({
      id: f.id,
      price: f.price,
      owned: ownedSet.has(f.id),
    })),
  };
}

/**
 * Purchase a frame. Atomic via the buy_frame() DB function (row lock +
 * deduct + insert in one transaction). Returns the new coin balance.
 */
export async function buyFrame(userId: string, frameId: string): Promise<{ coins: number }> {
  const def = getFrameDef(frameId);
  if (!def) throw new CosmeticsError('unknown_frame');

  const { data, error } = await supabase.rpc('buy_frame', {
    p_user_id: userId,
    p_frame_id: frameId,
    p_price: def.price,
  });

  if (error) {
    if (error.message.includes('already_owned')) throw new CosmeticsError('already_owned');
    if (error.message.includes('insufficient_coins')) throw new CosmeticsError('insufficient_coins');
    throw new Error(error.message);
  }

  return { coins: data as number };
}

/**
 * Equip a frame (must be owned) or clear it back to default with null.
 */
export async function selectFrame(userId: string, frameId: string | null): Promise<void> {
  if (frameId !== null) {
    if (!getFrameDef(frameId)) throw new CosmeticsError('unknown_frame');

    const { data: row, error } = await supabase
      .from('user_frames')
      .select('frame_id')
      .eq('user_id', userId)
      .eq('frame_id', frameId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!row) throw new CosmeticsError('not_owned');
  }

  const { error: updErr } = await supabase
    .from('users')
    .update({ selected_frame: frameId })
    .eq('id', userId);

  if (updErr) throw new Error(updErr.message);
}

/** Public read for other users' equipped frame (rooms/leaderboard later). */
export async function getSelectedFrame(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('users')
    .select('selected_frame')
    .eq('id', userId)
    .single();
  return (data?.selected_frame as string | null) ?? null;
}
