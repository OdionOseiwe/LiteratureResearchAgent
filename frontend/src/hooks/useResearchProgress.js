import { useEffect, useRef, useState, useCallback } from 'react';
import { fetchResearch } from '../services/researchApi.js';

/**
 * Subscribe to live research progress via Server-Sent Events, with a polling fallback.
 * Returns { data, connected, error } where data mirrors the SSE payload (progressPayload).
 */
export function useResearchProgress(id) {
  const [data, setData] = useState(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const sourceRef = useRef(null);
  const pollRef = useRef(null);
  const doneRef = useRef(false);

  const stopAll = useCallback(() => {
    sourceRef.current?.close();
    sourceRef.current = null;
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  }, []);

  useEffect(() => {
    if (!id) return undefined;
    let cancelled = false;

    const es = new EventSource(`/api/research/${id}/progress`);
    sourceRef.current = es;

    es.addEventListener('progress', (ev) => {
      try {
        const payload = JSON.parse(ev.data);
        if (cancelled) return;
        setData(payload);
        setConnected(true);
        setError(null);
        if (payload?.done || ['completed', 'failed', 'partial'].includes(payload?.status)) {
          doneRef.current = true;
          stopAll();
        }
      } catch { /* ignore malformed events */ }
    });
    es.addEventListener('done', (ev) => {
      try {
        const payload = JSON.parse(ev.data);
        setData((prev) => ({ ...(prev || {}), ...payload, done: true }));
      } catch { /* noop */ }
      doneRef.current = true;
      stopAll();
    });
    es.onerror = () => {
      setConnected(false);
      // EventSource auto-reconnects; if the job already finished the stream closes and we stop via polling fallback
      if (!doneRef.current && !pollRef.current) {
        pollRef.current = setInterval(async () => {
          try {
            const research = await fetchResearch(id);
            setData((prev) => ({ ...(prev || {}), ...normalize(research) }));
            if (['completed', 'failed', 'partial'].includes(research.status)) {
              doneRef.current = true;
              stopAll();
            }
          } catch (err) {
            setError(err?.response?.data?.error || err.message);
            stopAll();
          }
        }, 3000);
      }
    };

    return () => {
      cancelled = true;
      stopAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return { data, connected, error };
}

/** Normalize the REST job shape into the SSE payload shape. */
function normalize(research) {
  return {
    id: research.id,
    topic: research.topic,
    depth: research.depth,
    status: research.status,
    progress: research.progress,
    currentStage: research.currentStage,
    agents: (research.agents || []).map((a) => ({
      agent: a.agent,
      agentType: a.agentType,
      status: a.status,
      task: a.task,
      outputSummary: a.outputSummary,
      startedAt: a.startedAt,
      endedAt: a.endedAt,
      error: a.error,
      retryCount: a.retryCount,
    })),
    sourceCount: research.sourceCount,
    findingCount: research.findingCount,
    rounds: research.rounds,
    tokensUsed: research.tokensUsed,
    activity: (research.activityLog || []).slice(-12),
    error: research.error || '',
  };
}
