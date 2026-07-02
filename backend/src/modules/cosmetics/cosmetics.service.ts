import { supabase } from '../../shared';
import { isUserPro } from '../billing';
import { FRAME_CATALOG, getFrameDef, isFrameAvailable } from './cosmetics.schema';
import type { FramesResponse } from './cosmetics.schema';

/**
 * Typed business error so the route layer can map to proper 4xx codes
 * instead of a blanket 500.
 */
export class CosmeticsError extends Error {
  constructor(
    public code: 'unknown_frame' | 'not_owned' | 'already_owned' | 'insufficient_coins' | 'pro_required' | 'expired',
  ) {
    super(code);
    this.name = 'CosmeticsError';
  }
}

/** Full shop view for the caller: coin balance + every frame with ownership. */
export async function getFramesForUser(userId: string): Promise<FramesResponse> {
  const [{ data: user, error: userErr }, { data: owned, error: ownedErr }, pro] = await Promise.all([
    supabase.from('users').select('coins, selected_frame').eq('id', userId).single(),
    supabase.from('user_frames').select('frame_id').eq('user_id', userId),
    isUserPro(userId),
  ]);

  if (userErr || !user) throw new Error('User not found');
  if (ownedErr) throw new Error(ownedErr.message);

  const ownedSet = new Set((owned ?? []).map((r) => r.frame_id as string));

  return {
    coins: user.coins as number,
    selectedFrame: (user.selected_frame as string | null) ?? null,
    frames: FRAME_CATALOG
      // Seasonal frames drop out of the shop after their cutoff — but stay
      // visible (and equippable) for users who already own them.
      .filter((f) => isFrameAvailable(f) || ownedSet.has(f.id))
      .map((f) => ({
        id: f.id,
        price: f.price,
        // Pro frames aren't bought — they're unlocked while Pro is active.
        owned: f.pro ? pro : ownedSet.has(f.id),
        pro: f.pro ?? false,
        availableUntil: f.availableUntil ?? null,
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
  if (def.pro) throw new CosmeticsError('pro_required'); // not for sale — Pro perk
  if (!isFrameAvailable(def)) throw new CosmeticsError('expired'); // seasonal window closed

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
    const def = getFrameDef(frameId);
    if (!def) throw new CosmeticsError('unknown_frame');

    if (def.pro) {
      // Pro frames are unlocked by the subscription, not by ownership rows.
      if (!(await isUserPro(userId))) throw new CosmeticsError('pro_required');
    } else {
      const { data: row, error } = await supabase
        .from('user_frames')
        .select('frame_id')
        .eq('user_id', userId)
        .eq('frame_id', frameId)
        .maybeSingle();

      if (error) throw new Error(error.message);
      if (!row) throw new CosmeticsError('not_owned');
    }
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
