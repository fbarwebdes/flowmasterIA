
// Type definitions for Deno environment
// This file helps silence IDE errors when the Deno extension is not active or configured

declare global {
    namespace Deno {
        export interface Env {
            get(key: string): string | undefined;
            set(key: string, value: string): void;
            toObject(): { [key: string]: string };
        }
        export const env: Env;
    }
}

export { };
