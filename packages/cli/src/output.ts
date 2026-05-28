/**
 * Output helpers. Pretty by default (TTY), JSON when piped or `--json` is set.
 * Exit codes:
 *  0 = success
 *  1 = user error (missing args, validation)
 *  2 = chain / runtime error
 */

let JSON_MODE: boolean | null = null;

export function setJsonMode(flag: boolean): void {
  JSON_MODE = flag;
}

export function isJsonMode(): boolean {
  if (JSON_MODE !== null) return JSON_MODE;
  return !process.stdout.isTTY;
}

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const CYAN = "\x1b[36m";
const GOLD = "\x1b[38;2;255;213;128m";

function color(c: string, s: string): string {
  if (isJsonMode() || !process.stdout.isTTY) return s;
  return `${c}${s}${RESET}`;
}

export const fmt = {
  bold: (s: string) => color(BOLD, s),
  dim: (s: string) => color(DIM, s),
  green: (s: string) => color(GREEN, s),
  yellow: (s: string) => color(YELLOW, s),
  red: (s: string) => color(RED, s),
  cyan: (s: string) => color(CYAN, s),
  gold: (s: string) => color(GOLD, s),
};

export function emit(payload: object | string): void {
  if (isJsonMode()) {
    process.stdout.write(JSON.stringify(payload, bigintReplacer) + "\n");
    return;
  }
  if (typeof payload === "string") {
    process.stdout.write(payload + "\n");
    return;
  }
  process.stdout.write(JSON.stringify(payload, bigintReplacer, 2) + "\n");
}

export function emitError(err: unknown, exitCode = 2): never {
  const msg = err instanceof Error ? err.message : String(err);
  const code = err instanceof Error && "code" in err ? (err as { code: string }).code : undefined;
  if (isJsonMode()) {
    process.stdout.write(
      JSON.stringify({ error: msg, code: code ?? "ERROR" }, bigintReplacer) + "\n",
    );
  } else {
    process.stderr.write(`${fmt.red("error:")} ${msg}\n`);
    if (code) process.stderr.write(`${fmt.dim(`code: ${code}`)}\n`);
  }
  process.exit(exitCode);
}

function bigintReplacer(_key: string, value: unknown): unknown {
  return typeof value === "bigint" ? value.toString() : value;
}

export function formatUsdc(amount: bigint): string {
  // USDC has 6 decimals
  const whole = amount / 1_000_000n;
  const frac = amount % 1_000_000n;
  return `${whole}.${frac.toString().padStart(6, "0")} USDC`;
}

export function parseUsdc(input: string): bigint {
  const cleaned = input.replace(/[, ]/g, "").replace(/_/g, "");
  if (!/^\d+(\.\d+)?$/.test(cleaned)) {
    throw new Error(`Invalid USDC amount: "${input}". Expected a decimal number like "100" or "12.5".`);
  }
  const [whole, frac = ""] = cleaned.split(".");
  if (frac.length > 6) {
    throw new Error(`USDC amounts cannot have more than 6 decimal places (got "${input}")`);
  }
  const fracPadded = (frac + "000000").slice(0, 6);
  return BigInt(whole) * 1_000_000n + BigInt(fracPadded);
}
