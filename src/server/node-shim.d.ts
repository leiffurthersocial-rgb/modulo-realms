/*
 * The few Node modules src/server uses. The project has no @types/node on
 * purpose — it would change timer types across the browser code.
 */
interface ShimSocket {
  write(data: string): boolean;
  destroy(): void;
  on(event: string, listener: (...args: any[]) => void): this;
}
declare module 'node:net' {
  export function connect(options: { host: string; port: number }): ShimSocket;
  export function createServer(listener: (socket: ShimSocket) => void): {
    listen(port: number, host: string, cb: () => void): void;
    address(): { port: number };
    close(): void;
  };
}
declare module 'node:tls' {
  export function connect(options: { host: string; port: number; servername?: string }): ShimSocket;
}
