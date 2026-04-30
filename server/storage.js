import fs from 'node:fs/promises';
import path from 'node:path';

const STORE_PATH = path.resolve('server/data/store.json');
const EMPTY_STORE = { playlists: [], trackOverrides: {} };

const readStore = async () => {
  try {
    const raw = await fs.readFile(STORE_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { ...EMPTY_STORE };
  }
};

const writeStore = async (data) => {
  await fs.writeFile(STORE_PATH, JSON.stringify(data, null, 2), 'utf8');
};

export const getPlaylists = async () => {
  const store = await readStore();
  return store.playlists ?? [];
};

export const savePlaylists = async (playlists) => {
  const store = await readStore();
  store.playlists = playlists;
  await writeStore(store);
  return store.playlists;
};

export const getTrackOverrides = async () => {
  const store = await readStore();
  return store.trackOverrides ?? {};
};

export const saveTrackOverrides = async (trackOverrides) => {
  const store = await readStore();
  store.trackOverrides = trackOverrides;
  await writeStore(store);
  return store.trackOverrides;
};
