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
