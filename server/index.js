import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { getPlaylists, getTrackOverrides, savePlaylists, saveTrackOverrides } from './storage.js';

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

const buildProxyAudioUrl = (sourceUrl, baseUrl = '') =>
  sourceUrl ? `${baseUrl}/api/audio?url=${encodeURIComponent(sourceUrl)}` : undefined;

const getTrackLookupKey = ({ title, artist }) => `${normalize(title)}::${normalize(artist)}`;

const extractYouTubeVideoId = (value) => {
  const input = String(value ?? '').trim();
  if (!input) return null;

  const directMatch = input.match(/^[a-zA-Z0-9_-]{11}$/);
  if (directMatch) return directMatch[0];

  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtube\.com\/shorts\/|youtube\.com\/embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /[?&]v=([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match?.[1]) return match[1];
  }

  return null;
};

const sanitizeTrackOverride = (override) => ({
  title: override.title ?? '',
  artist: override.artist ?? '',
  album: override.album ?? 'YouTube',
  duration: Number(override.duration ?? 0),
  imageUrl: override.imageUrl ?? '',
  youtubeVideoId: override.youtubeVideoId ?? undefined,
  externalAudioUrl: override.externalAudioUrl ?? undefined,
  preview_url: override.preview_url ?? undefined,
  playbackType: override.playbackType ?? (override.youtubeVideoId ? 'youtube' : 'preview'),
  sourceLabel: override.sourceLabel ?? (override.youtubeVideoId ? 'YouTube' : 'Preview'),
  updatedAt: override.updatedAt ?? new Date().toISOString(),
});

const materializeTrackOverride = (override, baseUrl = '') => {
  if (!override) return null;

  return {
    id: `${override.title}-${override.artist}`.toLowerCase().replace(/\s+/g, '-'),
    title: override.title,
    artist: override.artist,
    album: override.album ?? 'Unknown',
    duration: Number(override.duration ?? 0),
    imageUrl: override.imageUrl ?? '',
    audioUrl: override.externalAudioUrl ? buildProxyAudioUrl(override.externalAudioUrl, baseUrl) : undefined,
    preview_url: override.preview_url ?? undefined,
    youtubeVideoId: override.youtubeVideoId ?? undefined,
    playbackType: override.playbackType ?? (override.youtubeVideoId ? 'youtube' : 'preview'),
    sourceLabel: override.sourceLabel ?? (override.youtubeVideoId ? 'YouTube' : 'Preview'),
  };
};

const findTrackOverride = async ({ title, artist }) => {
  const overrides = await getTrackOverrides();
  const key = getTrackLookupKey({ title, artist });
  return overrides[key] ? sanitizeTrackOverride(overrides[key]) : null;
};

const upsertTrackOverride = async ({ title, artist, track }) => {
  const overrides = await getTrackOverrides();
  const key = getTrackLookupKey({ title, artist });
  overrides[key] = sanitizeTrackOverride({
    title,
    artist,
    album: track.album,
    duration: track.duration,
    imageUrl: track.imageUrl,
    youtubeVideoId: track.youtubeVideoId,
    externalAudioUrl: track.externalAudioUrl ?? track.audioUrl,
    preview_url: track.preview_url,
    playbackType: track.playbackType,
    sourceLabel: track.sourceLabel,
    updatedAt: new Date().toISOString(),
  });
  await saveTrackOverrides(overrides);
  return overrides[key];
};

const mapItunesTrack = (track, baseUrl = '') => {
  const previewUrl = track.previewUrl;
  const proxiedAudioUrl = buildProxyAudioUrl(previewUrl, baseUrl);

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
    playbackType: 'preview',
    sourceLabel: 'iTunes Preview',
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
  const cleanTitle = String(title ?? '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\b(feat|ft)\.?\b.*$/i, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const cleanArtist = String(artist ?? '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const queries = [
    `${cleanTitle} ${cleanArtist} official audio`,
    `${cleanArtist} ${cleanTitle} official audio`,
    `${cleanTitle} ${cleanArtist} audio`,
    `${cleanArtist} ${cleanTitle} audio`,
    `${cleanTitle} ${cleanArtist} official video`,
    `${cleanArtist} ${cleanTitle} official video`,
    `${cleanTitle} ${cleanArtist} music video`,
    `${cleanArtist} ${cleanTitle} music video`,
    `${cleanTitle} ${cleanArtist} song`,
    `${cleanArtist} ${cleanTitle} song`,
    `${cleanTitle} ${cleanArtist}`,
    `${cleanArtist} ${cleanTitle}`,
    cleanTitle,
  ];

  return [...new Set(queries.map((value) => value.trim()).filter(Boolean))];
};

const extractBracketedJson = (source, marker) => {
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) return null;

  const startIndex = source.indexOf('{', markerIndex);
  if (startIndex < 0) return null;

  let depth = 0;
  let inString = false;
  let escaping = false;

  for (let index = startIndex; index < source.length; index += 1) {
    const char = source[index];

    if (escaping) {
      escaping = false;
      continue;
    }

    if (char === '\\') {
      escaping = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;

    if (depth === 0) {
      return source.slice(startIndex, index + 1);
    }
  }

  return null;
};

const collectVideoRenderers = (node, results = []) => {
  if (!node) return results;

  if (Array.isArray(node)) {
    node.forEach((item) => collectVideoRenderers(item, results));
    return results;
  }

  if (typeof node !== 'object') {
    return results;
  }

  if (node.videoRenderer) {
    results.push(node.videoRenderer);
  }

  Object.values(node).forEach((value) => collectVideoRenderers(value, results));
  return results;
};

const extractRunsText = (value) => {
  if (typeof value === 'string') return value;
  if (!value) return '';
  if (Array.isArray(value.runs)) {
    return value.runs.map((run) => run?.text ?? '').join('').trim();
  }
  if (typeof value.simpleText === 'string') {
    return value.simpleText.trim();
  }
  return '';
};

const mapHtmlVideoRendererToCandidate = (videoRenderer) => ({
  id: {
    videoId: videoRenderer.videoId,
  },
  snippet: {
    title: extractRunsText(videoRenderer.title),
    channelTitle: extractRunsText(videoRenderer.ownerText) || extractRunsText(videoRenderer.longBylineText),
    thumbnails: {
      high: {
        url:
          videoRenderer.thumbnail?.thumbnails?.[videoRenderer.thumbnail.thumbnails.length - 1]?.url ??
          '',
      },
    },
  },
});

const scoreYouTubeMatch = ({ item, title, artist }) => {
  const normalizedTitle = normalize(title);
  const normalizedArtist = normalize(artist);
  const snippetTitle = normalize(item.snippet?.title ?? '');
  const snippetChannel = normalize(item.snippet?.channelTitle ?? '');
  const titleTokens = tokenize(title);
  const artistTokens = tokenize(artist);

  let score = 0;
  if (snippetTitle.includes(normalizedTitle)) score += 8;
  if (snippetTitle.includes(normalizedArtist)) score += 5;
  if (snippetChannel.includes(normalizedArtist)) score += 4;
  if (snippetChannel.includes('topic')) score += 5;
  if (snippetTitle.includes('official audio')) score += 6;
  if (snippetTitle.includes('official video')) score += 3;
  if (snippetTitle.includes('lyrics')) score -= 2;
  if (snippetTitle.includes('live')) score -= 3;
  if (snippetTitle.includes('remix')) score -= 2;
  if (snippetTitle.includes('teaser')) score -= 3;
  if (snippetTitle.includes('shorts')) score -= 4;

  score += titleTokens.filter((token) => snippetTitle.includes(token)).length * 2;
  score += artistTokens.filter((token) => snippetTitle.includes(token) || snippetChannel.includes(token)).length * 2;

  return score;
};

const resolveYouTubeTrack = async ({ title, artist, debug = false }) => {
  const ytKey = process.env.YOUTUBE_API_KEY;
  if (!ytKey) {
    console.warn('⚠️ YOUTUBE_API_KEY is not set. YouTube resolution will fail.');
    return debug ? { track: null, debug: { error: 'YOUTUBE_API_KEY is not set' } } : null;
  }

  console.log(`📺 Resolving YouTube track: "${title}" by "${artist}"`);
  const queries = buildYouTubeQueries({ title, artist });
  console.log(`📺 Built ${queries.length} search queries:`, queries);

  const debugInfo = debug
    ? {
        queries,
        queryResults: [],
        candidateCountByMode: { category: 0, all: 0 },
        selected: null,
      }
    : null;

  const fetchYouTubeResults = async (query, withCategory = true) => {
    let ytUrl =
      'https://www.googleapis.com/youtube/v3/search' +
      `?part=snippet&type=video&maxResults=10&q=${encodeURIComponent(query)}&key=${ytKey}`;

    if (withCategory) {
      ytUrl += '&videoCategoryId=10';
    }

    console.log(`📺 YouTube search: "${query}" (category=${withCategory})`);
    const response = await fetch(ytUrl);
    if (!response.ok) {
      const text = await response.text();
      console.error(`❌ YouTube search failed for "${query}": ${response.status} ${text}`);
      if (debugInfo) {
        debugInfo.queryResults.push({ query, withCategory, status: 'error', statusCode: response.status, error: text });
      }
      throw new Error(`YouTube search failed: ${response.status} ${text}`);
    }

    const data = await response.json();
    const items = Array.isArray(data.items) ? data.items : [];
    const errorMessage = data.error?.message || null;
    if (debugInfo) {
      debugInfo.queryResults.push({ query, withCategory, status: 'ok', itemCount: items.length, errorMessage });
    }
    if (errorMessage) {
      console.error(`❌ YouTube API responded with error for "${query}": ${errorMessage}`);
    }
    console.log(`  ✅ Got ${items.length} results for "${query}"`);
    return items;
  };

  let candidates = [];
  const runSearch = async (withCategory) => {
    const results = await Promise.allSettled(
      queries.map(async (query) => await fetchYouTubeResults(query, withCategory))
    );
    const fulfilled = results.flatMap((result) => {
      if (result.status === 'fulfilled') return result.value;
      console.error(`  ❌ Query failed: ${result.reason}`);
      if (debugInfo) {
        debugInfo.queryResults.push({ query: 'unknown', withCategory, status: 'fetch_error', error: String(result.reason) });
      }
      return [];
    });
    const filtered = fulfilled.filter((item) => item?.id?.videoId);
    if (debugInfo) {
      if (withCategory) {
        debugInfo.candidateCountByMode.category = filtered.length;
      } else {
        debugInfo.candidateCountByMode.all = filtered.length;
      }
    }
    return filtered;
  };

  try {
    candidates = await runSearch(true);
    console.log(`📺 Round 1 (with category): ${candidates.length} candidates`);
    if (candidates.length === 0) {
      console.log(`📺 Round 1 failed, trying without category...`);
      candidates = await runSearch(false);
      console.log(`📺 Round 2 (no category): ${candidates.length} candidates`);
    }

    if (candidates.length === 0) {
      console.warn('⚠️ YouTube resolution returned no candidates for', title, artist);
      return debug ? { track: null, debug: debugInfo } : null;
    }

    console.log(`📺 Scoring ${candidates.length} candidates for "${title}" by "${artist}"...`);
    const firstItem = candidates.sort((left, right) => {
      const rightScore = scoreYouTubeMatch({ item: right, title, artist });
      const leftScore = scoreYouTubeMatch({ item: left, title, artist });
      return rightScore - leftScore;
    })[0];

    console.log(`✅ Selected: "${firstItem.snippet?.title}" (ID: ${firstItem.id.videoId})`);
    const track = {
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
    return debug ? { track, debug: debugInfo } : track;
  } catch (err) {
    console.error(`❌ YouTube resolution error: ${String(err)}`);
    if (debugInfo) {
      debugInfo.error = String(err);
      return { track: null, debug: debugInfo };
    }
    return null;
  }
};

const resolveYouTubeTrackWithFallback = async ({ title, artist, debug = false }) => {
  const initialResult = await resolveYouTubeTrack({ title, artist, debug: true });
  if (initialResult?.track?.youtubeVideoId) {
    return debug ? initialResult : initialResult.track;
  }

  const queries = buildYouTubeQueries({ title, artist }).slice(0, 6);
  const debugInfo = {
    ...(initialResult?.debug ?? {}),
    fallback: {
      mode: 'youtube_html',
      queries,
      results: [],
      selected: null,
    },
  };

  const fetchYouTubeHtmlResults = async (query) => {
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&hl=en`;
    console.log(`YouTube HTML fallback search: "${query}"`);

    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!response.ok) {
      const text = await response.text();
      debugInfo.fallback.results.push({
        query,
        status: 'error',
        statusCode: response.status,
      });
      throw new Error(`YouTube HTML fallback failed: ${response.status} ${text}`);
    }

    const html = await response.text();
    const jsonText =
      extractBracketedJson(html, 'var ytInitialData = ') ??
      extractBracketedJson(html, 'window["ytInitialData"] = ') ??
      extractBracketedJson(html, 'ytInitialData = ');

    if (!jsonText) {
      debugInfo.fallback.results.push({
        query,
        status: 'parse_error',
      });
      throw new Error('Unable to parse YouTube HTML fallback results');
    }

    const items = collectVideoRenderers(JSON.parse(jsonText))
      .filter((videoRenderer) => typeof videoRenderer?.videoId === 'string' && videoRenderer.videoId.length > 0)
      .slice(0, 12)
      .map(mapHtmlVideoRendererToCandidate);

    debugInfo.fallback.results.push({
      query,
      status: 'ok',
      itemCount: items.length,
    });
    return items;
  };

  try {
    const results = await Promise.allSettled(
      queries.map(async (query) => await fetchYouTubeHtmlResults(query))
    );

    const deduped = new Map();
    results.forEach((result) => {
      if (result.status !== 'fulfilled') {
        console.error(`YouTube HTML fallback query failed: ${String(result.reason)}`);
        return;
      }

      result.value.forEach((item) => {
        const videoId = item?.id?.videoId;
        if (videoId && !deduped.has(videoId)) {
          deduped.set(videoId, item);
        }
      });
    });

    const candidates = [...deduped.values()];
    if (candidates.length === 0) {
      return debug ? { track: null, debug: debugInfo } : null;
    }

    const bestCandidate = candidates.sort((left, right) => {
      const rightScore = scoreYouTubeMatch({ item: right, title, artist });
      const leftScore = scoreYouTubeMatch({ item: left, title, artist });
      return rightScore - leftScore;
    })[0];

    const track = {
      id: `${title}-${artist}`.toLowerCase().replace(/\s+/g, '-'),
      title,
      artist,
      album: 'YouTube',
      duration: 0,
      imageUrl:
        bestCandidate.snippet?.thumbnails?.high?.url ??
        bestCandidate.snippet?.thumbnails?.medium?.url ??
        '',
      youtubeVideoId: bestCandidate.id.videoId,
    };

    debugInfo.fallback.selected = {
      title: bestCandidate.snippet?.title ?? '',
      channelTitle: bestCandidate.snippet?.channelTitle ?? '',
      videoId: bestCandidate.id.videoId,
      score: scoreYouTubeMatch({ item: bestCandidate, title, artist }),
    };

    return debug ? { track, debug: debugInfo } : track;
  } catch (error) {
    debugInfo.fallback.error = String(error);
    return debug ? { track: null, debug: debugInfo } : null;
  }
};

const resolveJamendoTrack = async ({ title, artist, baseUrl = '', debug = false }) => {
  const clientId = String(process.env.JAMENDO_CLIENT_ID || '').trim();
  if (!clientId) {
    return debug
      ? { track: null, debug: { provider: 'jamendo', skipped: true, reason: 'JAMENDO_CLIENT_ID is not set' } }
      : null;
  }

  const baseApiUrl = 'https://api.jamendo.com/v3.0/tracks';
  const queryParams = new URLSearchParams({
    client_id: clientId,
    format: 'json',
    limit: '10',
    namesearch: title,
    artist_name: artist,
    audioformat: 'mp32',
    imagesize: '300',
    include: 'musicinfo',
    order: 'relevance',
  });

  try {
    const response = await fetch(`${baseApiUrl}/?${queryParams.toString()}`);
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Jamendo search failed: ${response.status} ${text}`);
    }

    const data = await response.json();
    const results = Array.isArray(data.results) ? data.results : [];
    if (results.length === 0) {
      return debug ? { track: null, debug: { provider: 'jamendo', resultCount: 0 } } : null;
    }

    const bestMatch = results
      .map((item) => {
        const candidate = {
          title: item.name ?? '',
          artist: item.artist_name ?? '',
          album: item.album_name ?? 'Jamendo',
          duration: Number(item.duration ?? 0),
          imageUrl: item.image ?? item.album_image ?? '',
          externalAudioUrl: item.audio ?? '',
        };

        let score = 0;
        const normalizedCandidateTitle = normalize(candidate.title);
        const normalizedCandidateArtist = normalize(candidate.artist);
        const normalizedTitle = normalize(title);
        const normalizedArtist = normalize(artist);

        if (normalizedCandidateTitle.includes(normalizedTitle)) score += 8;
        if (normalizedCandidateArtist.includes(normalizedArtist)) score += 7;
        score += tokenize(title).filter((token) => normalizedCandidateTitle.includes(token)).length * 2;
        score += tokenize(artist).filter((token) => normalizedCandidateArtist.includes(token)).length * 2;

        return { candidate, score };
      })
      .sort((left, right) => right.score - left.score)[0];

    if (!bestMatch?.candidate?.externalAudioUrl) {
      return debug ? { track: null, debug: { provider: 'jamendo', resultCount: results.length, selected: null } } : null;
    }

    const track = {
      id: `${title}-${artist}`.toLowerCase().replace(/\s+/g, '-'),
      title,
      artist,
      album: bestMatch.candidate.album,
      duration: bestMatch.candidate.duration,
      imageUrl: bestMatch.candidate.imageUrl,
      audioUrl: buildProxyAudioUrl(bestMatch.candidate.externalAudioUrl, baseUrl),
      externalAudioUrl: bestMatch.candidate.externalAudioUrl,
      preview_url: undefined,
      youtubeVideoId: undefined,
      playbackType: 'full_audio',
      sourceLabel: 'Jamendo',
    };

    return debug
      ? {
          track,
          debug: {
            provider: 'jamendo',
            resultCount: results.length,
            selected: {
              title: bestMatch.candidate.title,
              artist: bestMatch.candidate.artist,
              score: bestMatch.score,
            },
          },
        }
      : track;
  } catch (error) {
    return debug ? { track: null, debug: { provider: 'jamendo', error: String(error) } } : null;
  }
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
    const requestOrigin = String(req.headers.origin || '*');

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    res.setHeader('Vary', 'Origin');

    const buffer = await audioResponse.arrayBuffer();
    res.end(Buffer.from(buffer));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch audio', details: String(error) });
  }
});

app.post('/api/resolve-youtube-track', async (req, res) => {
  const { title, artist } = req.body ?? {};
  if (!title || !artist) {
    console.warn('⚠️ YouTube resolve endpoint called without title/artist');
    return res.status(400).json({ error: 'Missing title or artist' });
  }

  console.log(`📡 POST /api/resolve-youtube-track: "${title}" by "${artist}"`);
  try {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const storedOverride = await findTrackOverride({ title, artist });
    if (storedOverride) {
      const track = materializeTrackOverride(storedOverride, baseUrl);
      res.json({ track, error: null, debug: { provider: 'override-cache' } });
      return;
    }

    const youtubeResult = await resolveYouTubeTrackWithFallback({ title, artist, debug: true });
    const youtubeTrack = youtubeResult.track ?? null;
    if (youtubeTrack?.youtubeVideoId) {
      await upsertTrackOverride({ title, artist, track: youtubeTrack });
      console.log(`✅ YouTube resolve succeeded: videoId=${youtubeTrack.youtubeVideoId}`);
      res.json({ track: youtubeTrack, error: null, debug: youtubeResult.debug });
      return;
    }

    const jamendoResult = await resolveJamendoTrack({ title, artist, baseUrl, debug: true });
    const jamendoTrack = jamendoResult.track ?? null;
    if (jamendoTrack?.audioUrl) {
      await upsertTrackOverride({ title, artist, track: jamendoTrack });
      res.json({
        track: jamendoTrack,
        error: null,
        debug: {
          youtube: youtubeResult.debug,
          fullAudio: jamendoResult.debug,
        },
      });
      return;
    }

    console.warn(`❌ YouTube/Jamendo resolve failed: returned null`);
    res.json({
      track: null,
      error: 'No full-track source found.',
      debug: {
        youtube: youtubeResult.debug,
        fullAudio: jamendoResult.debug,
      },
    });
  } catch (error) {
    console.error(`❌ YouTube resolve endpoint error: ${String(error)}`);
    res.status(500).json({ error: 'Failed to resolve YouTube track', details: String(error) });
  }
});

app.post('/api/track-overrides/manual-youtube', async (req, res) => {
  const { title, artist, youtubeUrl, imageUrl = '', duration = 0, album = 'YouTube' } = req.body ?? {};
  if (!title || !artist || !youtubeUrl) {
    return res.status(400).json({ error: 'Missing title, artist, or youtubeUrl' });
  }

  const youtubeVideoId = extractYouTubeVideoId(youtubeUrl);
  if (!youtubeVideoId) {
    return res.status(400).json({ error: 'Could not extract a YouTube video ID from the provided link' });
  }

  const override = await upsertTrackOverride({
    title,
    artist,
    track: {
      title,
      artist,
      album,
      duration,
      imageUrl,
      youtubeVideoId,
      playbackType: 'youtube',
      sourceLabel: 'Manual YouTube',
    },
  });

  const baseUrl = `${req.protocol}://${req.get('host')}`;
  res.status(201).json({ track: materializeTrackOverride(override, baseUrl) });
});

app.get('/api/playlists', async (req, res) => {
  const userId = req.query.userId ? String(req.query.userId) : null;
  
  // userId is required - users can only see their own playlists
  if (!userId) {
    return res.status(400).json({ error: 'Missing userId query parameter' });
  }
  
  const playlists = await getPlaylists();
  const filtered = playlists.filter((p) => p.ownerId === userId);
  
  res.json({ playlists: filtered });
});

app.post('/api/playlists', async (req, res) => {
  const { name, description, imageUrl, userId } = req.body ?? {};
  if (!name) {
    return res.status(400).json({ error: 'Missing playlist name' });
  }
  if (!userId) {
    return res.status(400).json({ error: 'Missing userId' });
  }

  const playlists = await getPlaylists();
  const created = {
    id: Date.now().toString(),
    name,
    description: description || '',
    imageUrl: imageUrl || '',
    tracks: [],
    ownerId: userId,
    createdAt: new Date().toISOString(),
  };

  playlists.push(created);
  await savePlaylists(playlists);
  res.status(201).json({ playlist: created });
});

app.patch('/api/playlists/:playlistId', async (req, res) => {
  const { playlistId } = req.params;
  const { userId, ...updates } = req.body ?? {};
  
  if (!userId) {
    return res.status(400).json({ error: 'Missing userId' });
  }
  
  const playlists = await getPlaylists();
  const idx = playlists.findIndex((playlist) => playlist.id === playlistId);

  if (idx < 0) {
    return res.status(404).json({ error: 'Playlist not found' });
  }
  
  // Check ownership
  if (playlists[idx].ownerId !== userId) {
    return res.status(403).json({ error: 'You can only edit your own playlists' });
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
  const { userId } = req.body ?? {};
  
  if (!userId) {
    return res.status(400).json({ error: 'Missing userId' });
  }
  
  const playlists = await getPlaylists();
  const idx = playlists.findIndex((playlist) => playlist.id === playlistId);
  
  if (idx < 0) {
    return res.status(404).json({ error: 'Playlist not found' });
  }
  
  // Check ownership
  if (playlists[idx].ownerId !== userId) {
    return res.status(403).json({ error: 'You can only delete your own playlists' });
  }
  
  const next = playlists.filter((playlist) => playlist.id !== playlistId);
  await savePlaylists(next);
  res.status(204).send();
});

app.post('/api/playlists/:playlistId/tracks', async (req, res) => {
  const { playlistId } = req.params;
  const { track, userId } = req.body ?? {};

  if (!track?.id) {
    return res.status(400).json({ error: 'Missing track payload' });
  }
  
  if (!userId) {
    return res.status(400).json({ error: 'Missing userId' });
  }

  const playlists = await getPlaylists();
  const idx = playlists.findIndex((playlist) => playlist.id === playlistId);

  if (idx < 0) {
    return res.status(404).json({ error: 'Playlist not found' });
  }
  
  // Check ownership
  if (playlists[idx].ownerId !== userId) {
    return res.status(403).json({ error: 'You can only add tracks to your own playlists' });
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
  const { userId } = req.body ?? {};
  
  if (!userId) {
    return res.status(400).json({ error: 'Missing userId' });
  }
  
  const playlists = await getPlaylists();
  const idx = playlists.findIndex((playlist) => playlist.id === playlistId);

  if (idx < 0) {
    return res.status(404).json({ error: 'Playlist not found' });
  }
  
  // Check ownership
  if (playlists[idx].ownerId !== userId) {
    return res.status(403).json({ error: 'You can only remove tracks from your own playlists' });
  }

  playlists[idx].tracks = playlists[idx].tracks.filter((track) => track.id !== trackId);
  await savePlaylists(playlists);
  res.json({ playlist: playlists[idx] });
});

app.listen(PORT, () => {
  console.log(`MyPlayer API running on http://localhost:${PORT}`);
});
