import React, { useState } from 'react';
import { ImagePlus, Music2, Plus, Upload, X } from 'lucide-react';
import { useMusic } from '../context/MusicContext';
import type { Track } from '../types';
import { TrackSearchPicker } from './TrackSearchPicker';

interface PlaylistComposerProps {
  isOpen: boolean;
  onClose: () => void;
}

const initialForm = {
  name: '',
  description: '',
  coverDataUrl: '',
};

export const PlaylistComposer: React.FC<PlaylistComposerProps> = ({ isOpen, onClose }) => {
  const { createPlaylist, addTrackToPlaylist } = useMusic();
  const [form, setForm] = useState(initialForm);
  const [selectedTracks, setSelectedTracks] = useState<Track[]>([]);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const reset = () => {
    setForm(initialForm);
    setSelectedTracks([]);
    setSubmitting(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleCoverUpload = (file: File | undefined) => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        setForm((prev) => ({ ...prev, coverDataUrl: result }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCreatePlaylist = async () => {
    if (!form.name.trim() || submitting) return;

    setSubmitting(true);

    try {
      const { id: playlistId } = await createPlaylist(
        form.name.trim(),
        form.description.trim(),
        form.coverDataUrl || undefined
      );

      for (const track of selectedTracks) {
        await addTrackToPlaylist(playlistId, track);
      }

      handleClose();
    } catch (error) {
      console.error('Playlist creation failed:', error);
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-6xl overflow-hidden rounded-[2rem] border border-white/10 bg-dark-card shadow-2xl shadow-black/40">
        <div className="flex items-center justify-between border-b border-dark-border px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-gray-500">New Playlist</p>
            <h2 className="mt-1 text-2xl font-bold text-white">Shape your playlist in one place</h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-full border border-white/10 p-2 text-gray-400 transition-colors hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid gap-0 lg:grid-cols-[24rem_minmax(0,1fr)]">
          <div className="border-b border-dark-border p-6 lg:border-b-0 lg:border-r">
            <div className="mb-6 rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-4">
              {form.coverDataUrl ? (
                <img
                  src={form.coverDataUrl}
                  alt="Playlist cover preview"
                  className="h-56 w-full rounded-[1.25rem] object-cover"
                />
              ) : (
                <div className="flex h-56 w-full items-center justify-center rounded-[1.25rem] bg-gradient-to-br from-blue-primary/30 via-cyan-400/10 to-emerald-300/20 text-blue-100">
                  <Music2 size={52} />
                </div>
              )}
            </div>

            <div className="space-y-4">
              <input
                type="text"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Playlist name"
                className="w-full rounded-2xl border border-dark-border bg-dark-bg px-4 py-3 text-white outline-none transition-colors focus:border-blue-primary"
              />
              <textarea
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="What is this playlist for?"
                rows={4}
                className="w-full rounded-2xl border border-dark-border bg-dark-bg px-4 py-3 text-white outline-none transition-colors focus:border-blue-primary"
              />
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-dark-border bg-dark-bg px-4 py-3 text-sm font-semibold text-gray-300 transition-colors hover:border-blue-primary hover:text-white">
                <Upload size={16} />
                <span>{form.coverDataUrl ? 'Replace cover image' : 'Upload cover image'}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => handleCoverUpload(event.target.files?.[0])}
                />
              </label>
            </div>
          </div>

          <div className="p-6">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-white">Select tracks with less friction</p>
                <p className="text-sm text-gray-400">
                  Search once, add with one click, and review everything before you save.
                </p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-gray-300">
                <ImagePlus size={14} />
                <span>{selectedTracks.length} selected</span>
              </div>
            </div>

            <TrackSearchPicker
              onTrackSelect={(track) =>
                setSelectedTracks((prev) => (prev.some((item) => item.id === track.id) ? prev : [...prev, track]))
              }
              selectedTrackIds={selectedTracks.map((track) => track.id)}
              placeholder="Search tracks to include in this playlist..."
              resultsHeightClassName="max-h-64"
            />

            <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-white/[0.03]">
              <div className="flex items-center justify-between border-b border-dark-border px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-white">Selected Tracks</p>
                  <p className="text-xs text-gray-400">Review the sequence before you create the playlist.</p>
                </div>
              </div>

              {selectedTracks.length > 0 ? (
                <div className="max-h-64 overflow-y-auto">
                  {selectedTracks.map((track, index) => (
                    <div
                      key={track.id}
                      className="flex items-center gap-3 border-b border-dark-border/80 px-4 py-3 last:border-b-0"
                    >
                      <span className="w-6 text-xs text-gray-500">{index + 1}</span>
                      <img src={track.imageUrl} alt={track.title} className="h-10 w-10 rounded-xl object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-white">{track.title}</p>
                        <p className="truncate text-xs text-gray-400">{track.artist}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedTracks((prev) => prev.filter((item) => item.id !== track.id))
                        }
                        className="rounded-full p-2 text-gray-400 transition-colors hover:bg-white/5 hover:text-red-400"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-8 text-center text-sm text-gray-400">
                  Add a few tracks here and they will be saved straight into the new playlist.
                </div>
              )}
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 font-semibold text-white transition-colors hover:bg-white/[0.06]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleCreatePlaylist()}
                disabled={!form.name.trim() || submitting}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-blue-primary px-4 py-3 font-semibold text-white transition-colors hover:bg-blue-secondary disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus size={16} />
                <span>{submitting ? 'Creating...' : 'Create Playlist'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
