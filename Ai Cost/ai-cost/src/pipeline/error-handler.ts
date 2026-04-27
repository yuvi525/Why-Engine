export class ProviderExecutionError extends Error {
  constructor(public provider: string, public model: string, message: string) {
    super(message);
    this.name = 'ProviderExecutionError';
  }
}

export function handlePipelineError(error: any) {
  console.error('[Orchestrator] Pipeline Critical Error:', error);
  return {
    error: error.message || 'Internal Server Error',
    status: error.status || 500
  };
}
