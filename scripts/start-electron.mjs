import electron from 'electron';
import { spawn } from 'node:child_process';

const electronEnvironment = { ...process.env };
delete electronEnvironment.ELECTRON_RUN_AS_NODE;
delete electronEnvironment.ELECTRON_RENDERER_URL;
const child = spawn(electron, ['.'], { stdio: 'inherit', env: electronEnvironment });
child.on('error', (error) => { console.error(error); process.exitCode = 1; });
child.on('exit', (code) => { process.exitCode = code ?? 0; });
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => { if (!child.killed) child.kill(); });
}
