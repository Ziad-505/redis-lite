export function encodeSimpleString(value: string): Buffer {
    if (value.includes('\r') || value.includes('\n')) {
      throw new Error('RESP Simple Strings must not contain CR or LF characters.');
    }
    return Buffer.from(`+${value}\r\n`, 'utf8');
}

export function encodeSimpleError(message: string): Buffer {
  if (message.includes('\r') || message.includes('\n')) {
    throw new Error('RESP Simple Error must not contain CR or LF characters.');
  }
  return Buffer.from(`-${message}\r\n`, 'utf8');
}

const MIN_RESP_INTEGER = -(2n ** 63n);
const MAX_RESP_INTEGER = (2n ** 63n) - 1n;

export function encodeInteger(value: bigint): Buffer {
  if(value < MIN_RESP_INTEGER || value > MAX_RESP_INTEGER) {
    throw new Error('RESP integer must be within the signed 64-bit range')
  }
  return Buffer.from(`:${value}\r\n`);
}

export function encodeBulkString(value: Buffer | null): Buffer {
  if (value === null) {
      return Buffer.from('$-1\r\n');
  }
  const header = Buffer.from(`$${value.length}\r\n`);
  const terminator = Buffer.from('\r\n');
  return Buffer.concat([header, value, terminator]);
}

export function encodeArray(
  encodedElements: readonly Buffer[] | null
): Buffer {
  if (encodedElements === null) {
    return Buffer.from('*-1\r\n');
  }
  const header = Buffer.from(`*${encodedElements.length}\r\n`);
  return Buffer.concat([header, ...encodedElements]);
}
