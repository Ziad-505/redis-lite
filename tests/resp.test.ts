import test from "node:test";
import assert from "node:assert/strict";
import { encodeSimpleString } from "../src/resp.js";

test('encodes a RESP simple string', () => {
    const result = encodeSimpleString('OK');
    const expected = Buffer.from('+OK\r\n');
    assert.deepStrictEqual(result, expected);
});

test('rejects a carriage return in a RESP simple string', () => {
    assert.throws(
        () => encodeSimpleString('hello\rworld'),
        /must not contain CR or LF/
    );
});

test('rejects a line feed in a RESP simple string', () => {
    assert.throws(
        () => encodeSimpleString('hello\nworld'),
        /must not contain CR or LF/
    );
});