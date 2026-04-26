export type StorycraftRuleSummary = { id: string; name: string; bucket: string };

export type StorycraftRequestBody = {
  scene_id: string;
  surface?: string;
  intent: string;
  selection: string;
  chapter_position?: string | null;
  run_model?: boolean;
};

export type StorycraftAnalyzeResult = {
  diagnosis: string[];
  rules: StorycraftRuleSummary[];
  warnings: string[];
  diagnostics: Record<string, unknown>;
};

export type StorycraftRewriteResult = StorycraftAnalyzeResult & {
  rewrite: string;
  packet_meta: { approx_tokens?: number; chunks_used?: number; skipped_model?: boolean };
};
