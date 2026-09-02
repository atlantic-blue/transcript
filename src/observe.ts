// One line of JSON per thing worth knowing. CloudWatch reads a JSON line as fields, so a query can
// count causes without a regular expression over prose.
//
// Nothing here ever carries a credential. The cookies the watch page sets, the proof of origin
// token and the signature on a caption address are all secrets, so an address is reduced to its
// host and path before it is written, and no header is written at all.

export type Fields = Record<string, unknown>;

export function withoutSecrets(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return "an address that does not parse";
  }
}

export function line(event: string, fields: Fields): string {
  return JSON.stringify({ event, ...fields });
}

export function observe(event: string, fields: Fields): void {
  console.log(line(event, fields));
}
