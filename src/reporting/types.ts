export type PhaseStatus = 'passed' | 'failed' | 'skipped' | 'unknown';

export interface InteractionResult {
  description: string;
  provider: string;
  consumer?: string;
  endpoint?: string;
  status: PhaseStatus;
  durationMs?: number;
  reason?: string;
  expected?: string;
  actual?: string;
}

export interface PhaseSummary {
  status: PhaseStatus;
  total: number;
  passed: number;
  failed: number;
  durationMs: number;
  label: string;
  interactions: InteractionResult[];
  /** Consumer Jest-style rows (EY report compatibility) */
  tests?: Array<{
    suite: string;
    name: string;
    endpoint?: string;
    status: string;
    durationMs: number;
    reason?: string;
  }>;
  failures?: Array<{
    test?: string;
    interaction?: string;
    endpoint?: string;
    reason?: string;
    details?: Array<{ path?: string; expected?: string; actual?: string }>;
  }>;
  ran: boolean;
  providerBaseUrl?: string;
  skippedReason?: string;
}

export interface ServiceMapNode {
  id: string;
  label: string;
  shortLabel?: string;
  layer?: string;
  status: PhaseStatus;
  passed: number;
  failed: number;
  total: number;
  endpoints?: Array<{
    phase: string;
    endpoint: string;
    status: string;
    reason?: string;
  }>;
}

export interface PactReport {
  generatedAt: string;
  project: string;
  overallStatus: PhaseStatus;
  consumer: PhaseSummary;
  provider: PhaseSummary;
  pactFiles: string[];
  serviceMap: {
    nodes: ServiceMapNode[];
    edges: Array<{ from: string; to: string; id?: string; status?: PhaseStatus }>;
    summary?: { healthy: number; failed: number; unknown: number };
  };
  phases?: {
    consumer: Partial<PhaseSummary> & { ran: boolean; status: PhaseStatus };
    provider: Partial<PhaseSummary> & { ran: boolean; status: PhaseStatus };
  };
  environment: Record<string, string>;
}
