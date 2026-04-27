export const tracer = {
  startActiveSpan: async (name: string, callback: (span: any) => Promise<any>) => {
    const span = {
      setStatus: () => {},
      recordException: () => {},
      end: () => {}
    };
    return await callback(span);
  }
};

export async function withSpan<T>(name: string, fn: () => Promise<T>): Promise<T> {
  return await fn();
}
