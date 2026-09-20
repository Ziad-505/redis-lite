export function encodeSimpleString(value: string): Buffer {
    if (value.includes('\r') || value.includes('\n')) {
      throw new Error("RESP Simple Strings must not contain CR or LF characters.");
    }
    return Buffer.from(`+${value}\r\n`, 'utf-8');
  }