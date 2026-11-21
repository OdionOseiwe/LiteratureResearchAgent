import { EventEmitter } from 'events';

/** In-memory pub/sub for per-job progress events streamed over SSE. */
const channels = new Map(); // jobId -> EventEmitter
const listenersPerJob = new Map();

function channelFor(jobId) {
  const key = String(jobId);
  if (!channels.has(key)) {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(50);
    channels.set(key, emitter);
    listenersPerJob.set(key, 0);
  }
  return channels.get(key);
}

export function publishProgress(jobId, payload) {
  channelFor(jobId).emit('progress', { ...payload, at: new Date().toISOString() });
}

/** Subscribe to a job's progress events. Returns an unsubscribe function. */
export function subscribeProgress(jobId, handler) {
  const key = String(jobId);
  const emitter = channelFor(key);
  listenersPerJob.set(key, (listenersPerJob.get(key) || 0) + 1);
  emitter.on('progress', handler);
  return () => {
    emitter.off('progress', handler);
    const n = (listenersPerJob.get(key) || 1) - 1;
    listenersPerJob.set(key, n);
    if (n <= 0) {
      channels.delete(key);
      listenersPerJob.delete(key);
    }
  };
}

/** Publish a terminal event so SSE clients can close cleanly. */
export function publishDone(jobId, payload) {
  channelFor(jobId).emit('progress', { ...payload, done: true, at: new Date().toISOString() });
}
