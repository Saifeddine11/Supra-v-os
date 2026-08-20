/**
 * SecureStore-backed storage adapter for the Supabase auth session.
 *
 * Supabase sessions can exceed SecureStore's ~2 KB per-entry recommendation
 * (Android warns/fails on large values), so values are transparently split
 * into chunks: `<key>` holds the chunk count, `<key>.<i>` holds each chunk.
 * SecureStore keys only allow [A-Za-z0-9._-]; Supabase's default storage key
 * (sb-<ref>-auth-token) is compatible.
 */
import * as SecureStore from 'expo-secure-store';

const CHUNK_SIZE = 1800;
const COUNT_PREFIX = 'chunks:';

function chunkKey(key: string, index: number): string {
  return `${key}.${index}`;
}

async function removeChunks(key: string, fromIndex: number): Promise<void> {
  // Best-effort cleanup of stale chunks beyond the new count.
  for (let i = fromIndex; i < fromIndex + 20; i++) {
    const existing = await SecureStore.getItemAsync(chunkKey(key, i));
    if (existing === null) break;
    await SecureStore.deleteItemAsync(chunkKey(key, i));
  }
}

export const secureSessionStore = {
  async getItem(key: string): Promise<string | null> {
    const head = await SecureStore.getItemAsync(key);
    if (head === null) return null;
    if (!head.startsWith(COUNT_PREFIX)) return head;

    const count = Number.parseInt(head.slice(COUNT_PREFIX.length), 10);
    if (!Number.isFinite(count) || count <= 0) return null;

    const chunks: string[] = [];
    for (let i = 0; i < count; i++) {
      const chunk = await SecureStore.getItemAsync(chunkKey(key, i));
      if (chunk === null) return null; // corrupted — treat as signed out
      chunks.push(chunk);
    }
    return chunks.join('');
  },

  async setItem(key: string, value: string): Promise<void> {
    if (value.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, value);
      await removeChunks(key, 0);
      return;
    }
    const count = Math.ceil(value.length / CHUNK_SIZE);
    for (let i = 0; i < count; i++) {
      await SecureStore.setItemAsync(
        chunkKey(key, i),
        value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE),
      );
    }
    await SecureStore.setItemAsync(key, `${COUNT_PREFIX}${count}`);
    await removeChunks(key, count);
  },

  async removeItem(key: string): Promise<void> {
    const head = await SecureStore.getItemAsync(key);
    await SecureStore.deleteItemAsync(key);
    if (head?.startsWith(COUNT_PREFIX)) {
      const count = Number.parseInt(head.slice(COUNT_PREFIX.length), 10) || 0;
      for (let i = 0; i < count; i++) {
        await SecureStore.deleteItemAsync(chunkKey(key, i));
      }
    }
  },
};
