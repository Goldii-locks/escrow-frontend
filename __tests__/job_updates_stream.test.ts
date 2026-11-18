import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

type Listener = (event: MessageEvent | Event) => void;

class MockEventSource {
  static instances: MockEventSource[] = [];
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;

  url: string;
  readyState = MockEventSource.CONNECTING;
  withCredentials = false;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  private listeners: Record<string, Listener[]> = {};

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: Listener) {
    (this.listeners[type] ||= []).push(listener);
  }

  removeEventListener(type: string, listener: Listener) {
    const arr = this.listeners[type];
    if (!arr) return;
    this.listeners[type] = arr.filter((l) => l !== listener);
  }

  emit(type: string, data?: unknown) {
    const event =
      type === 'message'
        ? ({ data: typeof data === 'string' ? data : JSON.stringify(data) } as MessageEvent)
        : (new Event(type) as Event);
    if (type === 'message' && this.onmessage) this.onmessage(event as MessageEvent);
    if (type === 'open' && this.onopen) this.onopen(event);
    if (type === 'error' && this.onerror) this.onerror(event);
    for (const listener of this.listeners[type] || []) listener(event);
  }

  close() {
    this.readyState = MockEventSource.CLOSED;
  }

  static reset() {
    MockEventSource.instances = [];
  }
}

// The module under test is expected to export a factory that wires up the
// SSE stream. We import it lazily so the mocked EventSource is installed first.
type StreamOptions = {
  wallet: string;
  onJobUpdate: (jobId: string) => void;
  onFallbackToPolling: () => void;
  reconnectBaseDelayMs?: number;
  reconnectMaxDelayMs?: number;
  maxReconnectAttempts?: number;
};

type JobUpdatesStream = {
  close: () => void;
  isFallbackActive: () => boolean;
};

type StreamModule = {
  createJobUpdatesStream: (options: StreamOptions) => JobUpdatesStream;
};

let createJobUpdatesStream: StreamModule['createJobUpdatesStream'];

describe('job updates SSE stream (#904)', () => {
  beforeEach(async () => {
    MockEventSource.reset();
    vi.useFakeTimers();
    vi.stubGlobal('EventSource', MockEventSource as unknown as typeof EventSource);
    vi.resetModules();
    const mod = (await import('../lib/jobUpdatesStream')) as StreamModule;
    createJobUpdatesStream = mod.createJobUpdatesStream;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('opens a single EventSource for the connected wallet', () => {
    const onJobUpdate = vi.fn();
    const onFallbackToPolling = vi.fn();
    const stream = createJobUpdatesStream({
      wallet: '0xabc',
      onJobUpdate,
      onFallbackToPolling,
    });

    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0].url).toContain('0xabc');
    stream.close();
  });

  it('triggers a targeted refetch of the affected job on an event', () => {
    const onJobUpdate = vi.fn();
    const onFallbackToPolling = vi.fn();
    const stream = createJobUpdatesStream({
      wallet: '0xabc',
      onJobUpdate,
      onFallbackToPolling,
    });

    const es = MockEventSource.instances[0];
    es.emit('open');
    es.emit('message', { jobId: 'job-42', type: 'updated' });

    expect(onJobUpdate).toHaveBeenCalledTimes(1);
    expect(onJobUpdate).toHaveBeenCalledWith('job-42');
    expect(onFallbackToPolling).not.toHaveBeenCalled();
    stream.close();
  });

  it('schedules a reconnect with backoff after a connection error', () => {
    const onJobUpdate = vi.fn();
    const onFallbackToPolling = vi.fn();
    const stream = createJobUpdatesStream({
      wallet: '0xabc',
      onJobUpdate,
      onFallbackToPolling,
      reconnectBaseDelayMs: 1000,
      reconnectMaxDelayMs: 30000,
    });

    const first = MockEventSource.instances[0];
    first.emit('open');
    first.emit('error');

    // No immediate reconnect; backoff delay must elapse first.
    expect(MockEventSource.instances).toHaveLength(1);

    vi.advanceTimersByTime(999);
    expect(MockEventSource.instances).toHaveLength(1);

    vi.advanceTimersByTime(1);
    expect(MockEventSource.instances).toHaveLength(2);

    // Second failure should back off further (exponential).
    const second = MockEventSource.instances[1];
    second.emit('error');
    vi.advanceTimersByTime(1000);
    expect(MockEventSource.instances).toHaveLength(2);
    vi.advanceTimersByTime(1000);
    expect(MockEventSource.instances).toHaveLength(3);

    expect(onFallbackToPolling).not.toHaveBeenCalled();
    stream.close();
  });

  it('falls back to polling after repeated failures', () => {
    const onJobUpdate = vi.fn();
    const onFallbackToPolling = vi.fn();
    const stream = createJobUpdatesStream({
      wallet: '0xabc',
      onJobUpdate,
      onFallbackToPolling,
      reconnectBaseDelayMs: 1000,
      reconnectMaxDelayMs: 8000,
      maxReconnectAttempts: 3,
    });

    // Drive repeated failures until the fallback threshold is reached.
    for (let i = 0; i < 3; i++) {
      const es = MockEventSource.instances[MockEventSource.instances.length - 1];
      es.emit('error');
      vi.advanceTimersByTime(8000);
    }

    expect(onFallbackToPolling).toHaveBeenCalledTimes(1);
    expect(stream.isFallbackActive()).toBe(true);
    stream.close();
  });

  it('closes the stream when the tab becomes hidden and reopens when visible', () => {
    const onJobUpdate = vi.fn();
    const onFallbackToPolling = vi.fn();
    const stream = createJobUpdatesStream({
      wallet: '0xabc',
      onJobUpdate,
      onFallbackToPolling,
    });

    expect(MockEventSource.instances).toHaveLength(1);
    const first = MockEventSource.instances[0];

    // Simulate tab hidden.
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    document.dispatchEvent(new Event('visibilitychange'));

    expect(first.readyState).toBe(MockEventSource.CLOSED);

    // Simulate tab visible again.
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    document.dispatchEvent(new Event('visibilitychange'));

    expect(MockEventSource.instances).toHaveLength(2);
    const second = MockEventSource.instances[1];
    second.emit('open');
    second.emit('message', { jobId: 'job-7', type: 'updated' });
    expect(onJobUpdate).toHaveBeenCalledWith('job-7');

    stream.close();
  });
});