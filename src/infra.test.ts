import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The function url is public, so the account has to hold two grants on the function. The provider
// writes one of them without being asked. This reads the configuration to check the other one is
// declared, because a missing grant makes every path answer 403 while the function itself still
// runs and every other gate stays green.
const source = readFileSync(new URL("../infra/function.tf", import.meta.url), "utf8");

interface Block {
  type: string;
  name: string;
  body: string;
}

function resourceBlocks(text: string): Block[] {
  const found: Block[] = [];
  const header = /resource\s+"([^"]+)"\s+"([^"]+)"\s*\{/g;
  let match = header.exec(text);
  while (match !== null) {
    const start = header.lastIndex;
    let depth = 1;
    let at = start;
    while (at < text.length && depth > 0) {
      const character = text[at];
      if (character === "{") depth += 1;
      if (character === "}") depth -= 1;
      at += 1;
    }
    found.push({
      type: match[1] ?? "",
      name: match[2] ?? "",
      body: text.slice(start, at - 1),
    });
    match = header.exec(text);
  }
  return found;
}

function attribute(body: string, key: string): string {
  const found = new RegExp(`^\\s*${key}\\s*=\\s*(.+)$`, "m").exec(body);
  return (found?.[1] ?? "").trim();
}

const grants = resourceBlocks(source).filter((block) => block.type === "aws_lambda_permission");

describe("the grants that make the function url answer", () => {
  it("declares a permission on the function", () => {
    expect(grants).toHaveLength(1);
  });

  it("grants the invoke action the provider does not grant on its own", () => {
    const grant = grants[0];
    expect(grant).toBeDefined();
    expect(attribute(grant?.body ?? "", "action")).toBe('"lambda:InvokeFunction"');
    expect(attribute(grant?.body ?? "", "statement_id")).toBe('"FunctionURLAllowPublicInvoke"');
  });

  it("opens the action to any caller, which is what a public url means", () => {
    expect(attribute(grants[0]?.body ?? "", "principal")).toBe('"*"');
  });

  it("attaches the grant to the handler the url points at", () => {
    expect(attribute(grants[0]?.body ?? "", "function_name")).toBe(
      "aws_lambda_function.handler.function_name",
    );
  });

  // The provider adds FunctionURLAllowPublicAccess itself, and a second attempt to add a statement
  // id that is already there fails the apply. So this one stays undeclared on purpose. The check
  // reads the declarations rather than the file, because the comments name both grants.
  it("leaves the grant the provider already adds undeclared", () => {
    const declared = grants.map((grant) => grant.body).join("\n");
    expect(declared).not.toContain("lambda:InvokeFunctionUrl");
    expect(declared).not.toContain("FunctionURLAllowPublicAccess");
  });

  it("carries no auth type condition, matching the public urls in this account", () => {
    expect(attribute(grants[0]?.body ?? "", "function_url_auth_type")).toBe("");
  });
});
