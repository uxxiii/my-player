import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { getPlaylists, savePlaylists } from './storage.js';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 4000);
const FRONTEND_URL = String(process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');

// CORS configured to allow any origin for the audio proxy and API routes.
app.use(
  cors({
    origin: true,
    credentials: false,
  })
);
app.use(express.json({ limit: '2mb' }));

const mapItunesTrack = (track, baseUrl = '') => {
  const previewUrl = track.previewUrl;
  const proxiedAudioUrl = previewUrl ? `${baseUrl}/api/audio?url=${encodeURIComponent(previewUrl)}` : undefined;

  return {
    id: String(track.trackId ?? track.collectionId ?? Date.now()),
    title: track.trackName ?? track.collectionName ?? 'Unknown',
    artist: track.artistName ?? 'Unknown',
    album: track.collectionName ?? 'Unknown',
    duration: Math.floor((track.trackTimeMillis ?? 0) / 1000),
    imageUrl: track.artworkUrl100?.replace('100x100', '300x300') ?? '',
    audioUrl: proxiedAudioUrl,
    preview_url: previewUrl,
    youtubeVideoId: undefined,
  };
};

const normalize = (value) => String(value ?? '').trim().toLowerCase();
const STOPWORDS = new Set(['the', 'and', 'feat', 'with', 'for', 'from', 'remix', 'edit', 'version']);
const tokenize = (value) =>
  normalize(value)
    .split(/[^a-z0-9]+/g)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));

const searchItunesTracks = async (term, baseUrl, limit = 25) => {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=song&limit=${limit}`;
  const response = await fetch(url);
  const data = await response.json();
  return (data.results ?? []).map((track) => mapItunesTrack(track, baseUrl));
};

const rankRecommendationCandidates = ({
  tracks,
  focusedTrack,
  seedArtists = [],
  seedTitles = [],
  excludeTrackIds = [],
}) => {
  const excludedIds = new Set(excludeTrackIds);
  const artistSet = new Set(seedArtists.map(normalize).filter(Boolean));
  const titleTokenSet = new Set(seedTitles.map(normalize).filter(Boolean));
  const focusedAlbumTokens = new Set(tokenize(focusedTrack?.album ?? ''));
  const focusedTitleTokens = new Set(tokenize(focusedTrack?.title ?? ''));
  const seen = new Map();

  tracks.forEach((track) => {
    if (excludedIds.has(track.id)) return;

    const key = track.id;
    const artist = normalize(track.artist);
    const albumTokens = tokenize(track.album);
    const titleTokens = tokenize(track.title);
    let score = seen.has(key) ? seen.get(key).score + 2 : 0;

    if (artistSet.has(artist)) score += 7;
    if (focusedTrack && artist === normalize(focusedTrack.artist)) score += 5;
    if (focusedTrack && normalize(track.album) === normalize(focusedTrack.album)) score += 4;

    score += albumTokens.filter((token) => focusedAlbumTokens.has(token)).length * 2;
    score += titleTokens.filter((token) => focusedTitleTokens.has(token)).length * 2;
    score += titleTokens.filter((token) => titleTokenSet.has(token)).length;

    if (!seen.has(key) || score > seen.get(key).score) {
      seen.set(key, { track, score });
    }
  });

  return [...seen.values()]
    .sort((left, right) => right.score - left.score)
    .map((item) => item.track);
};

const buildRelatedQueries = ({ artist, title, album, seedArtists = [], seedTitles = [] }) => {
  const queries = new Set();
  if (artist) queries.add(artist);
  if (artist && album) queries.add(`${artist} ${album}`);
  if (artist && title) queries.add(`${artist} ${title}`);
  seedArtists.slice(0, 4).forEach((value) => queries.add(value));
  seedTitles.slice(0, 6).forEach((value) => queries.add(value));
  return [...queries].filter(Boolean);
};

const buildYouTubeQueries = ({ title, artist }) => {
  const queries = [
    `${title} ${artist} official audio`,
    `${artist} ${title} official audio`,
    `${title} ${artist} audio`,
    `${artist} ${title} audio`,
    `${title} ${artist} topic`,
    `${artist} ${title} topic`,
    `${title} ${artist} official video`,
    `${artist} ${title} lyrics`,
  ];

  return [...new Set(queries.map((value) => value.trim()).filter(Boolean))];
};

const scoreYouTubeMatch = ({ item, title, artist }) => {
  const normalizedTitle = normalize(title);
  const normalizedArtist = normalize(artist);
  const snippetTitle = normalize(item.snippet?.title ?? '');
  const snippetChannel = normalize(item.snippet?.channelTitle ?? '');

  let score = 0;
  if (snippetTitle.includes(normalizedTitle)) score += 8;
  if (snippetTitle.includes(normalizedArtist)) score += 5;
  if (snippetChannel.includes(normalizedArtist)) score += 4;
  if (snippetTitle.includes('official audio')) score += 6;
  if (snippetTitle.includes('topic')) score += 5;
  if (snippetTitle.includes('official video')) score += 3;
  if (snippetTitle.includes('lyrics')) score -= 2;
  if (snippetTitle.includes('live')) score -= 3;
  if (snippetTitle.includes('remix')) score -= 2;

  return score;
};

const resolveYouTubeTrack = async ({ title, artist }) => {
  const ytKey = process.env.YOUTUBE_API_KEY;
  if (!ytKey) {
    console.warn('⚠️ YOUTUBE_API_KEY is not set in backend environment. YouTube resolution will fail.');
    return null;
  }

  const queries = buildYouTubeQueries({ title, artist });
  const results = await Promise.allSettled(
    queries.map(async (query) => {
      const ytUrl =
        'https://www.googleapis.com/youtube/v3/search' +
        `?part=snippet&type=video&maxResults=5&videoEmbeddable=true&videoCategoryId=10&q=${encodeURIComponent(query)}&key=${ytKey}`;
      const response = await fetch(ytUrl);

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`YouTube search failed: ${text}`);
      }

      const data = await response.json();
      return Array.isArray(data.items) ? data.items : [];
    })
  );

  const candidates = results
    .flatMap((result) => (result.status === 'fulfilled' ? result.value : []))
    .filter((item) => item?.id?.videoId);

  if (candidates.length === 0) {
    return null;
  }

  const firstItem = candidates.sort((left, right) => {
    const rightScore = scoreYouTubeMatch({ item: right, title, artist });
    const leftScore = scoreYouTubeMatch({ item: left, title, artist });
    return rightScore - leftScore;
  })[0];

  return {
    id: `${title}-${artist}`.toLowerCase().replace(/\s+/g, '-'),
    title,
    artist,
    album: 'YouTube',
    duration: 0,
    imageUrl:
      firstItem.snippet?.thumbnails?.high?.url ??
      firstItem.snippet?.thumbnails?.medium?.url ??
      '',
    youtubeVideoId: firstItem.id.videoId,
  };
};

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, deployedAt: new Date().toISOString() });
});

app.get('/api/tracks/trending', async (req, res) => {
  try {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const response = await fetch(
      'https://itunes.apple.com/search?term=top%20global%20hits&media=music&entity=song&limit=20'
    );
    const data = await response.json();
    res.json({ tracks: (data.results ?? []).map((track) => mapItunesTrack(track, baseUrl)) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch trending tracks', details: String(error) });
  }
});

app.get('/api/search', async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  if (!q) {
    return res.status(400).json({ error: 'Missing q query param' });
  }

  try {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&entity=song&limit=30`;
    const response = await fetch(url);
    const data = await response.json();
    res.json({ tracks: (data.results ?? []).map((track) => mapItunesTrack(track, baseUrl)) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to search tracks', details: String(error) });
  }
});

app.get('/api/recommendations', async (req, res) => {
  const artist = String(req.query.artist ?? 'popular').trim();

  try {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(artist)}&media=music&entity=song&limit=20`;
    const response = await fetch(url);
    const data = await response.json();
    res.json({ tracks: (data.results ?? []).map((track) => mapItunesTrack(track, baseUrl)) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch recommendations', details: String(error) });
  }
});

app.post('/api/recommendations/related', async (req, res) => {
  const {
    artist = '',
    title = '',
    album = '',
    seedArtists = [],
    seedTitles = [],
    excludeTrackIds = [],
  } = req.body ?? {};

  try {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const queries = buildRelatedQueries({
      artist: String(artist).trim(),
      title: String(title).trim(),
      album: String(album).trim(),
      seedArtists: Array.isArray(seedArtists) ? seedArtists.map(String) : [],
      seedTitles: Array.isArray(seedTitles) ? seedTitles.map(String) : [],
    }).slice(0, 8);

    const results = await Promise.allSettled(
      queries.map((query) => searchItunesTracks(query, baseUrl, 25))
    );

    const flattened = results.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));
    const tracks = rankRecommendationCandidates({
      tracks: flattened,
      focusedTrack: { artist, title, album },
      seedArtists: Array.isArray(seedArtists) ? seedArtists.map(String) : [],
      seedTitles: Array.isArray(seedTitles) ? seedTitles.map(String) : [],
      excludeTrackIds: Array.isArray(excludeTrackIds) ? excludeTrackIds.map(String) : [],
    }).slice(0, 30);

    res.json({ tracks });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load related recommendations', details: String(error) });
  }
});

app.get('/api/lyrics', async (req, res) => {
  const artist = String(req.query.artist ?? '').trim();
  const title = String(req.query.title ?? '').trim();
  if (!artist || !title) {
    return res.status(400).json({ error: 'Missing artist or title' });
  }

  try {
    const response = await fetch(
      `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`
    );

    if (!response.ok) {
      return res.status(404).json({ error: 'Lyrics not found' });
    }

    const data = await response.json();
    res.json({ lyrics: data.lyrics ?? '' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch lyrics', details: String(error) });
  }
});

app.get('/api/audio', async (req, res) => {
  const url = String(req.query.url ?? '').trim();
  if (!url) {
    return res.status(400).json({ error: 'Missing url query param' });
  }

  try {
    const audioResponse = await fetch(url);
    if (!audioResponse.ok) {
      return res.status(404).json({ error: 'Audio not found' });
    }

    const contentType = audioResponse.headers.get('content-type') || 'audio/mpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Access-Control-Allow-Origin', '*');

    const buffer = await audioResponse.arrayBuffer();
    res.end(Buffer.from(buffer));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch audio', details: String(error) });
  }
});

app.post('/api/resolve-youtube-track', async (req, res) => {
  const { title, artist } = req.body ?? {};
  if (!title || !artist) {
    return res.status(400).json({ error: 'Missing title or artist' });
  }

  try {
    const track = await resolveYouTubeTrack({ title, artist });
    res.json({ track });
  } catch (error) {
    res.status(500).json({ error: 'Failed to resolve YouTube track', details: String(error) });
  }
});

app.get('/api/playlists', async (_req, res) => {
  const playlists = await getPlaylists();
  res.json({ playlists });
});

app.post('/api/playlists', async (req, res) => {
  const { name, description, imageUrl } = req.body ?? {};
  if (!name) {
    return res.status(400).json({ error: 'Missing playlist name' });
  }

  const playlists = await getPlaylists();
  const created = {
    id: Date.now().toString(),
    name,
    description: description || '',
    imageUrl: imageUrl || '',
    tracks: [],
    createdAt: new Date().toISOString(),
  };

  playlists.push(created);
  await savePlaylists(playlists);
  res.status(201).json({ playlist: created });
});

app.patch('/api/playlists/:playlistId', async (req, res) => {
  const { playlistId } = req.params;
  const updates = req.body ?? {};
  const playlists = await getPlaylists();
  const idx = playlists.findIndex((playlist) => playlist.id === playlistId);

  if (idx < 0) {
    return res.status(404).json({ error: 'Playlist not found' });
  }

  playlists[idx] = {
    ...playlists[idx],
    name: updates.name ?? playlists[idx].name,
    description: updates.description ?? playlists[idx].description,
    imageUrl: updates.imageUrl ?? playlists[idx].imageUrl,
  };

  await savePlaylists(playlists);
  res.json({ playlist: playlists[idx] });
});

app.delete('/api/playlists/:playlistId', async (req, res) => {
  const { playlistId } = req.params;
  const playlists = await getPlaylists();
  const next = playlists.filter((playlist) => playlist.id !== playlistId);
  await savePlaylists(next);
  res.status(204).send();
});

app.post('/api/playlists/:playlistId/tracks', async (req, res) => {
  const { playlistId } = req.params;
  const { track } = req.body ?? {};

  if (!track?.id) {
    return res.status(400).json({ error: 'Missing track payload' });
  }

  const playlists = await getPlaylists();
  const idx = playlists.findIndex((playlist) => playlist.id === playlistId);

  if (idx < 0) {
    return res.status(404).json({ error: 'Playlist not found' });
  }

  const exists = playlists[idx].tracks.some((item) => item.id === track.id);
  if (!exists) {
    playlists[idx].tracks.push(track);
    await savePlaylists(playlists);
  }

  res.json({ playlist: playlists[idx] });
});

app.delete('/api/playlists/:playlistId/tracks/:trackId', async (req, res) => {
  const { playlistId, trackId } = req.params;
  const playlists = await getPlaylists();
  const idx = playlists.findIndex((playlist) => playlist.id === playlistId);

  if (idx < 0) {
    return res.status(404).json({ error: 'Playlist not found' });
  }

  playlists[idx].tracks = playlists[idx].tracks.filter((track) => track.id !== trackId);
  await savePlaylists(playlists);
  res.json({ playlist: playlists[idx] });
});

app.listen(PORT, () => {
  console.log(`MyPlayer API running on http://localhost:${PORT}`);
});
