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

export type RespValue =
    | { type: 'simpleString'; value: string }
    | { type: 'simpleError'; value: string }
    | { type: 'integer'; value: bigint }
    | { type: 'bulkString'; value: Buffer | null }
    | { type: 'array'; value: RespValue[] | null };

export type ParseResult = {
    value: RespValue;
    bytesRead: number;
};

export function parseResp(input: Buffer): ParseResult | null {
  if (input.length === 0) {
      return null;
  }

  const lineEnd = input.indexOf('\r\n');

  if (lineEnd === -1) {
      return null;
  }

  const prefix = String.fromCharCode(input[0]);
  const content = input.subarray(1, lineEnd).toString('utf8');
  const bytesRead = lineEnd + 2;

  switch (prefix) {
    case '+':
        return {
            value: {
                type: 'simpleString',
                value: content
            },
            bytesRead
        };

    case '-':
        return {
            value: {
                type: 'simpleError',
                value: content
            },
            bytesRead
        };

    case ':': {
        if (!/^[+-]?\d+$/.test(content)) {
            throw new Error('Invalid RESP integer');
        }

        const value = BigInt(content);

        if (value < MIN_RESP_INTEGER || value > MAX_RESP_INTEGER) {
            throw new Error(
                'RESP integer must be within the signed 64-bit range'
            );
        }

        return {
            value: {
                type: 'integer',
                value
            },
            bytesRead
        };
    }

    case '$': {
      if (!/^-?\d+$/.test(content)) {
        throw new Error('Invalid RESP bulk string length');
      }

      const length = Number(content);

      if (!Number.isSafeInteger(length) || length < -1) {
        throw new Error('Invalid RESP bulk string length');
      }

      if (length === -1) {
        return {
          value: {
            type: 'bulkString',
            value: null,
          },
          bytesRead,
        };
      }

      const dataStart = lineEnd + 2;
      const dataEnd = dataStart + length;
      const messageEnd = dataEnd + 2;

      if (input.length < messageEnd) {
        return null;
      }

      if (input[dataEnd] !== 13 || input[dataEnd + 1] !== 10) {
        throw new Error('Invalid RESP bulk string terminator');
      }

      return {
        value: {
          type: 'bulkString',
          value: Buffer.from(input.subarray(dataStart, dataEnd)),
        },
        bytesRead: messageEnd,
      };
    }

    case '*': {
      if (!/^-?\d+$/.test(content)) {
        throw new Error('Invalid RESP array length');
      }
      const length = Number(content);
      if (!Number.isSafeInteger(length) || length < -1) {
        throw new Error('Invalid RESP array length');
      }
      if (length === -1) {
        return {
            value: {
                type: 'array',
                value: null
            },
            bytesRead
          };
      }
      const elements: RespValue[] = [];
      let offset = bytesRead;
      for (let index = 0; index < length; index++) {
          const result = parseResp(input.subarray(offset));
          if (result === null) {
              return null;
          }
          elements.push(result.value);
          offset += result.bytesRead;
      }
      return {
          value: {
              type: 'array',
              value: elements
          },
          bytesRead: offset
      };
  }
    default:
        throw new Error(`Unsupported RESP type prefix: ${prefix}`);
}
}
