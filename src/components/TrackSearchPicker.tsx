import React, { useState } from 'react';
import { Check, Loader2, Plus, Search as SearchIcon } from 'lucide-react';
import { api } from '../lib/api';
import type { Track } from '../types';

interface TrackSearchPickerProps {
  onTrackSelect: (track: Track) => void;
  selectedTrackIds?: string[];
  placeholder?: string;
  resultsHeightClassName?: string;
}

export const TrackSearchPicker: React.FC<TrackSearchPickerProps> = ({
  onTrackSelect,
  selectedTrackIds = [],
  placeholder = 'Search for songs...',
  resultsHeightClassName = 'max-h-72',
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (value: string) => {
    setQuery(value);
    setHasSearched(Boolean(value.trim()));

    if (!value.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { tracks } = await api.searchTracks(value);
      setResults(tracks);
    } catch (error) {
      console.error('Track search failed:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <SearchIcon className="absolute left-3 top-3 text-gray-500" size={16} />
        <input
          type="text"
          value={query}
          onChange={(event) => void handleSearch(event.target.value)}
          placeholder={placeholder}
          className="w-full rounded-2xl border border-dark-border bg-dark-bg pl-10 pr-4 py-3 text-sm text-white outline-none transition-colors focus:border-blue-primary"
        />
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Loader2 size={16} className="animate-spin" />
          <span>Searching tracks...</span>
        </div>
      )}

      {results.length > 0 && (
        <div className={`overflow-y-auto rounded-2xl border border-dark-border bg-dark-bg ${resultsHeightClassName}`}>
          {results.map((track) => {
            const isSelected = selectedTrackIds.includes(track.id);

            return (
              <div
                key={track.id}
                className="flex items-center gap-3 border-b border-dark-border/80 px-4 py-3 last:border-b-0"
              >
                <img
                  src={track.imageUrl}
                  alt={track.title}
                  className="h-11 w-11 rounded-xl object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">{track.title}</p>
                  <p className="truncate text-xs text-gray-400">{track.artist}</p>
                </div>
                <button
                  type="button"
                  disabled={isSelected}
                  onClick={() => onTrackSelect(track)}
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    isSelected
                      ? 'bg-emerald-500/10 text-emerald-300'
                      : 'bg-blue-primary/15 text-blue-200 hover:bg-blue-primary hover:text-white'
                  }`}
                >
                  {isSelected ? <Check size={14} /> : <Plus size={14} />}
                  <span>{isSelected ? 'Added' : 'Add'}</span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {hasSearched && !loading && results.length === 0 && (
        <div className="rounded-2xl border border-dashed border-dark-border bg-dark-bg px-4 py-6 text-center text-sm text-gray-400">
          No matching tracks yet. Try a different artist, song, or album.
        </div>
      )}
    </div>
  );
};
