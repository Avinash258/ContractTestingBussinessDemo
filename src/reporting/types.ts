export type PhaseStatus = 'passed' | 'failed' | 'skipped' | 'unknown';

export interface InteractionResult {
  description: string;
  provider: string;
  consumer?: string;
  status: PhaseStatus;
  durationMs?: number;
  reason?: string;
}

export interface PhaseSummary {
  status: PhaseStatus;
  total: number;
  passed: number;
  failed: number;
  durationMs: number;
  label: string;
  interactions: InteractionResult[];
  ran: boolean;
}

export interface PactReport {
  generatedAt: string;
  project: string;
  overallStatus: PhaseStatus;
  consumer: PhaseSummary;
  provider: PhaseSummary;
  pactFiles: string[];
  serviceMap: {
    nodes: Array<{
      id: string;
      label: string;
      status: PhaseStatus;
      passed: number;
      failed: number;
      total: number;
    }>;
    edges: Array<{ from: string; to: string; id: string }>;
  };
  environment: Record<string, string>;
}
