import type { Metadata } from "next"
import Link from "next/link"

import { LearnArticle } from "@/components/site/learn-article"
import {
  ExpressionVariableTag,
  LearnDocTwoColumnTable,
  LearnExprVarTable,
} from "@/components/site/learn-doc-table"
import { LearnWorkflowCodeNodeExample } from "@/components/site/learn-workflow-code-node-example"
import { LearnWorkflowStepTitleIcon } from "@/components/site/learn-workflow-step-title-icon"
import { SugarHighCodeBlock } from "@/components/site/sugar-high-code-block"

/** Placeholder character used in docs for “any expression token” (`{{…}}`). */
const EXPR_ELLIPSIS_PLACEHOLDER = "\u2026"

export const metadata: Metadata = {
  title: "Code | Learn | Dailify",
  description:
    "Run code sandbox: tag substitution, return value, result type, timeout, and {{exe.*}} outputs; see linked articles for helper steps.",
  openGraph: {
    title: "Code | Learn | Dailify",
    description:
      "Run code sandbox: tag substitution, return value, result type, timeout, and {{exe.*}} outputs; see linked articles for helper steps.",
  },
}

const LEARN_CODE_STEP_EDITOR_SNIPPET = `// Tags in a helper: values are fixed before the sandbox runs
function greet(name) {
  return "Hello, " + name;
}
return greet({{input.name}});

// Tag in a switch (often wrap with String(...) if cases are string labels)
switch (String({{input.status}})) {
  case "done":
    return { ok: true };
  default:
    return { ok: false };
}

// Tag as a binding, then a template literal (readable when ids are dynamic)
const orderId = {{input.order_id}};
return \`Order \${orderId} is ready\`;

// Tag as a numeric literal
const n = Number({{input.count}});
return n * 2;`

/**
 * Learn: Code family (Run code sandbox JavaScript on the canvas).
 */
export default function LearnWorkflowCodeStepPage() {
  return (
    <LearnArticle
      title="Code"
      description="The Run code template executes JavaScript in a sandbox and returns a single result. Expression variables in the source are replaced with values before the script runs; the return value is coerced and exposed on the execution record for downstream steps. Random number and iteration helpers live in the same Code group — see those articles from the hub."
      hero={<LearnWorkflowCodeNodeExample />}
      titleLeading={<LearnWorkflowStepTitleIcon type="code" />}
    >
      {/* Intro: role of the step */}
      <h2>What this step does</h2>
      <p>
        The <strong>Run code</strong> step runs a short <strong>Node.js</strong> snippet in an <strong>isolated sandbox</strong>{" "}
        (separate from your browser and the editor). Use it for deterministic glue: parse or reshape JSON, compute a
        value, or prepare data for a webhook, document, or AI step, without model drift or browser APIs.
      </p>

      {/* Return value and execution metadata tags */}
      <h2>Return value and <ExpressionVariableTag id="exe.result" variant="pill" /></h2>
      <p>
        The value produced by the <strong>top-level script body</strong> (your <code className="rounded bg-muted px-1 py-0.5 font-mono text-sm">return</code>{" "}
        or the final expression the runner treats as the result) is the <strong>primary execution result</strong>. After
        the run, that value is available on the execution record as <ExpressionVariableTag id="exe.result" variant="pill" /> for the Output tab
        and for later steps when you map fields from this step&apos;s execution.
      </p>
      <p>
        The runner also exposes <ExpressionVariableTag id="exe.execution_ms" variant="pill" />: total execution time in milliseconds for the code
        run. Use it in output mappings or debugging without re-parsing stdout.
      </p>

      {/* Tags in source + palette-style examples */}
      <h2>Expression variables inside the source</h2>
      <p>
        Any <Link href="/learn/workflows/steps/expressions">expression variable</Link> you type in the JavaScript field
        is <strong>resolved to a literal value before</strong> the sandbox executes. The runtime never sees the raw{" "}
        <ExpressionVariableTag id={EXPR_ELLIPSIS_PLACEHOLDER} variant="pill" /> tokens: only the substituted
        text or JSON that the template engine produced.
      </p>
      <p>
        The previous step&apos;s payload is still passed into the sandbox as the <code className="rounded bg-muted px-1 py-0.5 font-mono text-sm">input</code>{" "}
        binding. You can use <code className="rounded bg-muted px-1 py-0.5 font-mono text-sm">input</code> and tags
        together: tags become fixed literals in the emitted source; <code className="rounded bg-muted px-1 py-0.5 font-mono text-sm">input</code> stays a live object
        at run time.
      </p>

      <p className="text-sm font-medium text-foreground">
        Example tokens below use the same light purple monospace chip styling as tags in the editor palette.
      </p>
      <LearnExprVarTable
        variant="pill"
        rows={[
          {
            id: "input.hello",
            description:
              "Example inbound field, resolved from the previous step or your Input schema before the script runs.",
          },
          {
            id: "exe.result",
            description: "Coerced return value from this step after the sandbox finishes (primary execution result).",
          },
          {
            id: "exe.execution_ms",
            description: "Total execution time in milliseconds for the code run.",
          },
        ]}
      />

      <h3>String concatenation</h3>
      <p>
        If <ExpressionVariableTag id="input.hello" variant="pill" /> resolves to the string <code className="rounded bg-muted px-1 py-0.5 font-mono text-sm">&quot;World!&quot;</code>, then
        source like{" "}
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-sm">
          return &quot;Hello &quot; + <ExpressionVariableTag id="input.hello" variant="pill" />
        </code>{" "}
        becomes <code className="rounded bg-muted px-1 py-0.5 font-mono text-sm">return &quot;Hello &quot; + &quot;World!&quot;</code>{" "}
        before execution, and the result is <code className="rounded bg-muted px-1 py-0.5 font-mono text-sm">&quot;Hello World!&quot;</code>.
      </p>

      <h3>More patterns (what you type in the editor)</h3>
      <p>
        After tags are replaced, the file is ordinary JavaScript. You can place tags inside functions, branches, template
        literals, or anywhere a literal could appear. The following shows typical source <em>before</em> the runner
        substitutes each <ExpressionVariableTag id={EXPR_ELLIPSIS_PLACEHOLDER} variant="pill" /> token.
      </p>
      <SugarHighCodeBlock code={LEARN_CODE_STEP_EDITOR_SNIPPET} />
      <p className="text-sm text-muted-foreground">
        Choose <strong>Result type</strong> so the coerced return matches what you emit (for example <strong>JSON</strong>{" "}
        for objects, <strong>Number</strong> for numeric returns).
      </p>

      {/* Execution tab: timeout, result type, editor */}
      <h2>Execution tab settings</h2>
      <p>
        These fields appear on the <strong>Execution</strong> tab when you select a <strong>Run code</strong> step in the
        workflow editor.
      </p>
      <LearnDocTwoColumnTable
        valueHeader="Field"
        descriptionHeader="Description"
        rows={[
          {
            key: "timeout",
            value: "Timeout (seconds)",
            valueCellClassName: "whitespace-nowrap font-medium text-foreground",
            description: (
              <>
                Maximum wall-clock time for the sandbox run. The control allows <strong>1 to 60</strong> seconds (values
                outside that range are clamped). If execution exceeds the limit, this step fails so you can branch or
                retry downstream.
              </>
            ),
          },
          {
            key: "result-type",
            value: "Result type",
            valueCellClassName: "whitespace-nowrap font-medium text-foreground",
            description: (
              <>
                How the runner coerces the value your script returns: <strong>String</strong>, <strong>Number</strong>,{" "}
                <strong>JSON</strong>, or <strong>Null</strong>. It should match what the code actually returns. For
                example, returning an object while <strong>Result type</strong> is <strong>String</strong> can cause
                coercion or step errors. Prefer <strong>JSON</strong> for objects or arrays and <strong>Number</strong>{" "}
                for numeric results.
              </>
            ),
          },
          {
            key: "javascript",
            value: "JavaScript source",
            valueCellClassName: "whitespace-nowrap font-medium text-foreground",
            description: (
              <>
                The runnable source. Type <code className="rounded bg-muted px-1 py-0.5 font-mono text-[13px]">{"{{"}</code>{" "}
                for tag completion. Prefer returning a value for the main payload; use{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-[13px]">console.log</code> sparingly because
                stdout may be truncated in storage.
              </>
            ),
          },
        ]}
      />

      {/* Output mappings */}
      <h2>Output tab</h2>
      <p>
        Map each output row&apos;s value from expression variables (typically <ExpressionVariableTag id="exe.*" variant="pill" />) into the JSON
        object the next step receives as <code className="rounded bg-muted px-1 py-0.5 font-mono text-sm">input</code>.
        Use <strong>Import from execution</strong> to add suggested rows for the common <code className="rounded bg-muted px-1 py-0.5 font-mono text-sm">exe</code> fields
        below; you can still add custom keys and bind any tag the runner resolves after this step runs.
      </p>
      <LearnExprVarTable
        variant="pill"
        rows={[
          {
            id: "exe.result",
            description: "Coerced return value from the JavaScript snippet (stdout protocol).",
          },
          {
            id: "exe.execution_ms",
            description: "Total execution time in milliseconds for the code run.",
          },
          {
            id: "exe.exit_code",
            description: "Process exit code from the Node runner inside the sandbox.",
          },
          {
            id: "exe.active_cpu_ms",
            description:
              "Sandbox-reported active CPU milliseconds when the platform exposes it after the VM stops.",
          },
          {
            id: "exe.stderr",
            description: "Captured stderr from the snippet (truncated in the payload when very long).",
          },
        ]}
      />

      {/* Guidance */}
      <h2>When to use Run code</h2>
      <ul>
        <li>You need logic that is awkward to express with AI prompts or fixed templates alone.</li>
        <li>You want predictable behaviour and cost (no model sampling).</li>
        <li>You must transform upstream data with strict control before a webhook, document, or termination step.</li>
      </ul>

      {/* Caveats */}
      <h2>Security and side effects</h2>
      <p>
        Treat the sandbox as <strong>ephemeral</strong>. Do not rely on hidden local disk between runs unless the
        product explicitly documents it. Do not embed long-lived secrets in source; use workflow constants or patterns your
        organisation approves. Be cautious calling untrusted URLs from inside the sandbox unless you understand egress
        rules for your environment.
      </p>

      {/* Cross-links */}
      <h2>Related</h2>
      <ul>
        <li>
          <Link href="/learn/workflows/steps/expressions">Expression variables</Link>
        </li>
        <li>
          <Link href="/learn/workflows/steps/execution-settings">Execution settings</Link>
        </li>
        <li>
          <Link href="/learn/workflows/steps/computation">Code helpers</Link>, when a small dedicated step fits better
          than custom code.
        </li>
        <li>
          <Link href="/learn/workflows/steps">Steps and behaviour hub</Link>
        </li>
      </ul>
    </LearnArticle>
  )
}
