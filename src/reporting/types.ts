export type PhaseStatus = 'passed' | 'failed' | 'skipped' | 'unknown';

export interface InteractionResult {
  description: string;
  provider: string;
  consumer?: string;
  endpoint?: string;
  method?: string;
  path?: string;
  pactFile?: string;
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
    expected?: string;
    actual?: string;
    details?: Array<{
      path?: string;
      expected?: string;
      actual?: string;
      message?: string;
      type?: string;
    }>;
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
    /** FinVault-style star topology only (Client → Gateway → services). Drawn on the map. */
    edges: Array<{ from: string; to: string; id?: string; status?: PhaseStatus }>;
    /** CT-00…CT-17 producer→consumer edges (matrix table, not drawn on the map). */
    contractEdges?: Array<{ from: string; to: string; id?: string; status?: PhaseStatus }>;
    summary?: { healthy: number; failed: number; unknown: number };
  };
  phases?: {
    consumer: Partial<PhaseSummary> & { ran: boolean; status: PhaseStatus };
    provider: Partial<PhaseSummary> & { ran: boolean; status: PhaseStatus };
  };
  environment: Record<string, string>;
  /** Optional swagger ↔ pact coverage (from reports/swagger-coverage.json). */
  coverage?: {
    totals?: {
      ops?: number;
      covered?: number;
      partial?: number;
      missing?: number;
      mismatch?: number;
      deferred?: number;
    };
    rows?: Array<{
      method: string;
      path: string;
      status: string;
      notes?: string;
      note?: string;
      operation?: string;
      operationId?: string;
      originalStatus?: string;
      evidence?: string[];
    }>;
    /** Explicit gap lists for reports / failure email. */
    gaps?: {
      /** OpenAPI ops with no consumer/pact evidence (swagger coverage missing). */
      consumer: Array<{ method: string; path: string; note?: string; operation?: string }>;
      /** Provider verification failures or mismatched interactions. */
      provider: Array<{ method: string; path: string; note?: string; operation?: string }>;
    };
  };
}
