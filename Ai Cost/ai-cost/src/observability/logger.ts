export const logger = {
  info: (obj: any, msg?: string) => console.log(JSON.stringify({ level: 'INFO', ...obj, msg, time: new Date().toISOString() })),
  error: (obj: any, msg?: string) => console.error(JSON.stringify({ level: 'ERROR', ...obj, msg, time: new Date().toISOString() })),
  warn: (obj: any, msg?: string) => console.warn(JSON.stringify({ level: 'WARN', ...obj, msg, time: new Date().toISOString() })),
  debug: (obj: any, msg?: string) => console.debug(JSON.stringify({ level: 'DEBUG', ...obj, msg, time: new Date().toISOString() })),
};
