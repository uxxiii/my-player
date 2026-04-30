import { api } from './api';
import type { ScrobbleEntry, Track } from '../types';

const normalize = (value: string) => value.trim().toLowerCase();
const STOPWORDS = new Set(['the', 'and', 'feat', 'with', 'for', 'from', 'remix', 'edit', 'version']);

const tokenize = (value: string) =>
  normalize(value)
    .split(/[^a-z0-9]+/g)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));

const dedupeTracks = (tracks: Track[], excludedIds: Set<string>) => {
  const seen = new Set<string>();

  return tracks.filter((track) => {
    if (excludedIds.has(track.id) || seen.has(track.id)) {
      return false;
    }

    seen.add(track.id);
    return true;
  });
};

const mergeUniqueTracks = (tracks: Track[]) => {
  const seen = new Set<string>();
  return tracks.filter((track) => {
    if (seen.has(track.id)) return false;
    seen.add(track.id);
    return true;
  });
};

export const getPersonalizationSeedArtists = (
  recentScrobbles: ScrobbleEntry[],
  likedTracks: Track[],
  focusedTrack?: Track | null
) => {
  const artists = [
    focusedTrack?.artist,
    ...recentScrobbles.map((entry) => entry.track.artist),
    ...likedTracks.map((track) => track.artist),
  ].filter(Boolean) as string[];

  return artists.filter((artist, index) => artists.findIndex((value) => normalize(value) === normalize(artist)) === index);
};

export const buildSmartQueue = async ({
  focusedTrack,
  recentScrobbles,
  likedTracks,
  excludedTrackIds = [],
}: {
  focusedTrack: Track;
  recentScrobbles: ScrobbleEntry[];
  likedTracks: Track[];
  excludedTrackIds?: string[];
}) => {
  const seedArtists = getPersonalizationSeedArtists(recentScrobbles, likedTracks, focusedTrack).slice(0, 5);
  const seedTitles = recentScrobbles
    .slice(0, 5)
    .flatMap((entry) => tokenize(entry.track.title))
    .slice(0, 12);

  const { tracks } = await api.getRelatedRecommendations({
    artist: focusedTrack.artist,
    title: focusedTrack.title,
    album: focusedTrack.album,
    seedArtists,
    seedTitles,
    excludeTrackIds: [focusedTrack.id, ...excludedTrackIds],
  });

  const relatedTracks = dedupeTracks(tracks, new Set<string>([focusedTrack.id, ...excludedTrackIds])).slice(0, 24);

  if (relatedTracks.length >= 8) {
    return mergeUniqueTracks([focusedTrack, ...relatedTracks]);
  }

  const fallbackRecommendations = await api.getRecommendations(focusedTrack.artist);
  return mergeUniqueTracks([
    focusedTrack,
    ...relatedTracks,
    ...dedupeTracks(fallbackRecommendations.tracks, new Set<string>([focusedTrack.id, ...excludedTrackIds])),
  ]);
};

export const loadPersonalizedRecommendations = async ({
  recentScrobbles,
  likedTracks,
  fallbackArtist,
}: {
  recentScrobbles: ScrobbleEntry[];
  likedTracks: Track[];
  fallbackArtist?: string;
}) => {
  const seedArtists = getPersonalizationSeedArtists(recentScrobbles, likedTracks).slice(0, 5);

  if (seedArtists.length === 0 && fallbackArtist) {
    seedArtists.push(fallbackArtist);
  }

  const listenedTrackIds = recentScrobbles.map((entry) => entry.track.id);
  const seedTrack = recentScrobbles[0]?.track ?? likedTracks[0];

  const { tracks } = await api.getRelatedRecommendations({
    artist: seedTrack?.artist ?? fallbackArtist,
    title: seedTrack?.title,
    album: seedTrack?.album,
    seedArtists,
    seedTitles: recentScrobbles.flatMap((entry) => tokenize(entry.track.title)).slice(0, 12),
    excludeTrackIds: listenedTrackIds,
  });

  const primaryRecommendations = dedupeTracks(tracks, new Set<string>(listenedTrackIds));
  if (primaryRecommendations.length >= 8) {
    return primaryRecommendations;
  }

  const fallbackRecommendations = seedTrack?.artist || fallbackArtist ? await api.getRecommendations(seedTrack?.artist ?? fallbackArtist ?? 'popular') : { tracks: [] };
  return mergeUniqueTracks([
    ...primaryRecommendations,
    ...dedupeTracks(fallbackRecommendations.tracks, new Set<string>(listenedTrackIds)),
  ]);
};

export const loadPlaylistRecommendations = async ({
  playlistTracks,
  fallbackArtist,
}: {
  playlistTracks: Track[];
  fallbackArtist?: string;
}) => {
  const seedTrack = playlistTracks[0];
  const seedArtists = playlistTracks
    .map((track) => track.artist)
    .filter((artist, index, artists) => artists.findIndex((value) => normalize(value) === normalize(artist)) === index)
    .slice(0, 5);

  if (seedArtists.length === 0 && fallbackArtist) {
    seedArtists.push(fallbackArtist);
  }

  const seedTitles = playlistTracks.flatMap((track) => tokenize(track.title)).slice(0, 12);
  const excludeTrackIds = playlistTracks.map((track) => track.id);

  const { tracks } = await api.getRelatedRecommendations({
    artist: seedTrack?.artist ?? fallbackArtist,
    title: seedTrack?.title,
    album: seedTrack?.album,
    seedArtists,
    seedTitles,
    excludeTrackIds,
  });

  const primaryRecommendations = dedupeTracks(tracks, new Set<string>(excludeTrackIds));
  if (primaryRecommendations.length >= 8) {
    return primaryRecommendations;
  }

  const fallbackRecommendations = seedTrack?.artist || fallbackArtist ? await api.getRecommendations(seedTrack?.artist ?? fallbackArtist ?? 'popular') : { tracks: [] };
  return mergeUniqueTracks([
    ...primaryRecommendations,
    ...dedupeTracks(fallbackRecommendations.tracks, new Set<string>(excludeTrackIds)),
  ]);
};

export const buildContextualQueue = async ({
  focusedTrack,
  contextTracks,
  recentScrobbles,
  likedTracks,
  excludedTrackIds = [],
}: {
  focusedTrack: Track;
  contextTracks: Track[];
  recentScrobbles: ScrobbleEntry[];
  likedTracks: Track[];
  excludedTrackIds?: string[];
}) => {
  const queueSeedIds = new Set<string>([focusedTrack.id, ...excludedTrackIds]);
  const queueSeedTracks = [focusedTrack, ...contextTracks.filter((track) => track.id !== focusedTrack.id)];
  const recommendations = await buildSmartQueue({
    focusedTrack,
    recentScrobbles,
    likedTracks,
    excludedTrackIds,
  });

  return mergeUniqueTracks([
    ...queueSeedTracks,
    ...recommendations.slice(1).filter((track) => !queueSeedIds.has(track.id)),
  ]);
};
