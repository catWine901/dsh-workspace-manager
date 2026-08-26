/**
 * Profile-local pnpm execution: one thin, injectable wrapper around execa so
 * transactions can run, fake, cancel, and diagnose pnpm without ever
 * concatenating user input into a shell command. Arguments travel as an
 * array; on Windows execa resolves `pnpm` to `pnpm.cmd` itself (the test pins
 * the array-call shape, never a joined string).
 * @module @deepseek-ai/dsh-page-app-manager/executor
 */
/** Error thrown when the caller's AbortSignal fired mid-command. */
export class PageAppCommandAbortedError extends Error {
    constructor() {
        super('page-app: pnpm command aborted');
    }
}
/**
 * Build the production pnpm executor. Windows `.cmd` resolution is execa's
 * own PATH walk — the manager never builds a shell command.
 * @param spawn - injectable execa binding (defaults to execa with reject:false).
 * @returns the executor.
 */
export function createPnpmExecutor(spawn) {
    const exec = spawn ?? (async (file, args, options) => {
        const { execa } = await import('execa');
        const result = await execa(file, args, options);
        return result;
    });
    return {
        async run(args, options) {
            try {
                // execa v10 renamed the cancellation option from `signal` to
                // `cancelSignal`; the manager's seam keeps the AbortSignal name and
                // must not leak the old key to execa.
                const result = await exec('pnpm', [...args], { cwd: options.cwd, cancelSignal: options.signal, reject: false });
                return {
                    exitCode: result.exitCode ?? 0,
                    stdout: result.stdout.slice(0, 64_000),
                    stderr: result.stderr.slice(0, 64_000),
                };
            }
            catch (error) {
                if (error?.name === 'AbortError') {
                    throw new PageAppCommandAbortedError();
                }
                // A spawn failure (missing binary, permission) is a failed command.
                return { exitCode: 1, stdout: '', stderr: String(error) };
            }
        },
    };
}
//# sourceMappingURL=executor.js.map