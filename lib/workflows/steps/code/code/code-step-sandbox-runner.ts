import { CODE_STEP_STDOUT_RESULT_PREFIX } from "@/lib/workflows/steps/code/code/code-step-return-transform"

const RUNNER_PATH = "/tmp/workflow-runner.mjs"
const INPUT_PATH = "/tmp/workflow-input.json"

/**
 * Builds the sandbox `runner.mjs` source: reads JSON input, defines emit helper, runs transformed `__run`.
 */
export function buildCodeStepSandboxRunnerSource({ transformedBody }: { transformedBody: string }): string {
  const prefixLiteral = JSON.stringify(CODE_STEP_STDOUT_RESULT_PREFIX)
  return `
import fs from 'node:fs';

function __WORKFLOW_emitReturn(v) {
  const payload = { value: v === undefined ? null : v };
  process.stdout.write(${prefixLiteral} + JSON.stringify(payload) + '\\n');
}

const input = JSON.parse(fs.readFileSync(${JSON.stringify(INPUT_PATH)}, 'utf8'));

async function __run(input) {
${transformedBody}
}

__run(input)
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    process.stderr.write(String(err?.stack ?? err) + '\\n');
    process.exit(1);
  });
`.trimStart()
}

export { INPUT_PATH, RUNNER_PATH }
