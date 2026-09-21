# Redis Lite

Redis Lite is a small Redis-compatible, in-memory data server written in TypeScript. It implements a focused subset of Redis and the RESP2 protocol over TCP. The project explores protocol parsing, TCP stream buffering, command execution, and key expiration.

## Supported commands

| Command | Behavior |
| --- | --- |
| `PING` | Checks that the server is available |
| `ECHO message` | Returns the supplied message |
| `SET key value` | Stores a value and clears any existing expiration |
| `GET key` | Returns a value or a null bulk string |
| `DEL key [key ...]` | Deletes one or more keys |
| `EXISTS key [key ...]` | Counts how many supplied keys exist |
| `EXPIRE key seconds` | Sets an expiration in whole seconds |

## Requirements

- Node.js 24 or later
- npm
- `redis-cli` is optional, but useful for interacting with the server

## Install and run

```bash
git clone https://github.com/Ziad-505/redis-lite.git
cd redis-lite
npm ci
npm run dev
```

The server listens on `127.0.0.1:6379`.

For a compiled build:

```bash
npm run build
npm start
```

## Try it with redis-cli

Start the server, then run these commands in another terminal:

```bash
redis-cli PING
redis-cli SET greeting hello
redis-cli GET greeting
redis-cli EXISTS greeting
redis-cli EXPIRE greeting 10
redis-cli DEL greeting
```

## Development checks

```bash
npm run check
npm run build
```

`npm run check` runs the TypeScript type checker and the complete test suite. Tests cover RESP encoding and parsing, command behavior, expiration, pipelined requests, and requests split across multiple TCP chunks.

## Architecture

```text
TCP client
    |
    v
server.ts       Buffers bytes from the TCP stream
    |
    v
resp.ts         Parses RESP2 values
    |
    v
commands.ts     Validates and executes commands
    |
    v
in-memory Map   Stores values and expiration deadlines
    |
    v
resp.ts         Encodes the response sent to the client
```

RESP messages can arrive across multiple TCP chunks, or multiple messages can arrive in one chunk. The server keeps incomplete bytes until a complete value can be parsed, then continues parsing any remaining data.

Expiration is lazy. An expired key is removed when a supported command accesses it. `EXPIRE` accepts integer seconds, and a value of zero or less deletes an existing key immediately.

## Current limitations

- Data is stored only in memory and is lost when the process stops.
- Only the commands listed above are supported.
- Expired keys are removed when accessed, not by a background cleanup process.
- The server binds only to localhost and has no authentication.
- Redis persistence, replication, transactions, Pub/Sub, and clustering are not implemented.
- Keys are decoded as UTF-8 strings, so they are not fully binary-safe Redis keys.
- Incoming request size is not currently limited.
