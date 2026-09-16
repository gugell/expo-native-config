export type DiagnosticSeverity = 'error' | 'warning' | 'info';

export interface Diagnostic {
  id: string;
  severity: DiagnosticSeverity;
  message: string;
  source?: string;
  hint?: string;
}

export const EXIT_OK = 0;
export const EXIT_ERROR = 1;
export const EXIT_TOOL_FAILURE = 2;

export function exitCodeFor(diagnostics: Diagnostic[], toolFailed = false): number {
  if (toolFailed) return EXIT_TOOL_FAILURE;
  if (diagnostics.some((d) => d.severity === 'error')) return EXIT_ERROR;
  return EXIT_OK;
}
