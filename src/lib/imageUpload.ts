/**
 * The single choke-point for user image uploads (avatars, cooked-meal photos,
 * post images). Every feature uploads the same way so per-user folder paths,
 * compression and content-type stay consistent — and so Storage RLS (each user
 * may only write under `${uid}/…`, see migration 0005) is always satisfied.
 *
 * One code path for web AND native: we ask the picker for base64 and decode it
 * to bytes ourselves, sidestepping the patchy Blob/File support on React
 * Native. Web is the first launch surface, but this works on both.
 */

import * as ImagePicker from 'expo-image-picker';

import { supabase } from '@/lib/supabase';

export type UploadBucket = 'avatars' | 'meal-photos' | 'post-images';

export type UploadResult =
  | { url: string }
  | { canceled: true }
  | { error: string };

/** Decode a base64 string to bytes without Buffer/atob (works everywhere). */
function base64ToBytes(base64: string): Uint8Array {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i;

  const clean = base64.replace(/=+$/, '');
  const len = clean.length;
  const bytes = new Uint8Array(Math.floor((len * 3) / 4));
  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const e1 = lookup[clean.charCodeAt(i)];
    const e2 = lookup[clean.charCodeAt(i + 1)];
    const e3 = lookup[clean.charCodeAt(i + 2)];
    const e4 = lookup[clean.charCodeAt(i + 3)];
    bytes[p++] = (e1 << 2) | (e2 >> 4);
    if (i + 2 < len) bytes[p++] = ((e2 & 15) << 4) | (e3 >> 2);
    if (i + 3 < len) bytes[p++] = ((e3 & 3) << 6) | e4;
  }
  return bytes;
}

/** Cheap unique filename — the folder is already per-user, so this only needs
 * to avoid same-user collisions. */
function uniqueName(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}.jpg`;
}

/**
 * Prompt the user to pick a photo, then upload it to `bucket` under their own
 * folder. Returns the public URL, or a `canceled`/`error` outcome the caller
 * can branch on. `square` crops to 1:1 (used for avatars).
 */
export async function pickAndUploadImage(bucket: UploadBucket, opts?: { square?: boolean }): Promise<UploadResult> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { error: 'Sign in to upload a photo.' };

  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return { error: 'Photo access was not granted.' };

  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: opts?.square ? [1, 1] : undefined,
    quality: 0.6, // compress — cooked-meal photos don't need full resolution
    base64: true,
  });
  if (picked.canceled) return { canceled: true };

  const asset = picked.assets[0];
  if (!asset?.base64) return { error: 'Could not read the selected image.' };

  const bytes = base64ToBytes(asset.base64);
  const path = `${userId}/${uniqueName()}`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
  if (error) return { error: error.message };

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return { url: data.publicUrl };
}
