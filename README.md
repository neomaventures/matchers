# @neomaventures/matchers

Custom Jest matchers for asserting on thrown errors, self-registering via `setupFilesAfterEnv`.

[![npm version](https://img.shields.io/npm/v/%40neomaventures%2Fmatchers)](https://www.npmjs.com/package/@neomaventures/matchers)
[![CI](https://github.com/neomaventures/matchers/actions/workflows/ci.yml/badge.svg)](https://github.com/neomaventures/matchers/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Provides `toThrowMatching` and `toMatchError` — both assert that an error is an
instance of a given class *and* carries the properties you expect, which
Jest's built-in `toThrow` cannot do in one assertion.

## Installation

```bash
npm install --save-dev @neomaventures/matchers
```

Register it in your Jest config. The import has no exports — it calls
`expect.extend()` on load and augments Jest's `jest.Matchers`, `jest.Expect`
and `jest.InverseAsymmetricMatchers` interfaces, so the matchers and their
types are available everywhere without importing them per file.

```json
{
  "setupFilesAfterEnv": ["@neomaventures/matchers"]
}
```

## Usage

```json
{
  "setupFilesAfterEnv": ["@neomaventures/matchers"]
}
```

Then use in tests:

```typescript
// Check that a function throws a specific error class
expect(() => service.register(email)).toThrowMatching(
  EmailAlreadyExistsException,
)

// Check class + properties
expect(() => service.register(email)).toThrowMatching(
  EmailAlreadyExistsException,
  { email: 'test@example.com' },
)

// Check an already-caught error
expect(caughtError).toMatchError(NotFoundException, { message: 'Not found' })
```

Both matchers also work inside another expectation, the same way
`expect.any(...)` does — in `toEqual`, `toMatchObject` and
`toHaveBeenCalledWith`. Their property values may be asymmetric matchers too:

```typescript
// Check an error nested in a larger value
expect(events).toEqual([
  {
    status: 'failed',
    error: expect.toMatchError(PaymentDeclinedException, {
      reason: 'insufficient-funds',
      cause: expect.any(GatewayTimeoutError),
    }),
  },
])

// Check an error passed to a callback
expect(onError).toHaveBeenCalledWith(expect.toMatchError(NotFoundException))

// Check that a nested value is not a given error
expect(result).toEqual({ error: expect.not.toMatchError(NotFoundException) })
```


## License

MIT
