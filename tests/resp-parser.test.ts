import test from 'node:test';
import assert from 'node:assert/strict';
import { parseResp } from '../src/resp.js';

test('parses a RESP simple string', () => {
    const input = Buffer.from('+OK\r\n');

    assert.deepStrictEqual(parseResp(input), {
        value: {
            type: 'simpleString',
            value: 'OK'
        },
        bytesRead: input.length
    });
});

test('parses a RESP simple error', () => {
    const input = Buffer.from('-ERR failure\r\n');

    assert.deepStrictEqual(parseResp(input), {
        value: {
            type: 'simpleError',
            value: 'ERR failure'
        },
        bytesRead: input.length
    });
});

test('parses a RESP integer', () => {
    const input = Buffer.from(':-42\r\n');

    assert.deepStrictEqual(parseResp(input), {
        value: {
            type: 'integer',
            value: -42n
        },
        bytesRead: input.length
    });
});

test('returns null for incomplete RESP input', () => {
    const input = Buffer.from('+OK\r');

    assert.strictEqual(parseResp(input), null);
});

test('reports only the bytes consumed by the first value', () => {
    const input = Buffer.from('+OK\r\n:1\r\n');

    assert.deepStrictEqual(parseResp(input), {
        value: {
            type: 'simpleString',
            value: 'OK'
        },
        bytesRead: Buffer.byteLength('+OK\r\n')
    });
});

test('rejects an invalid RESP integer', () => {
    assert.throws(
        () => parseResp(Buffer.from(':12.5\r\n')),
        /Invalid RESP integer/
    );
});