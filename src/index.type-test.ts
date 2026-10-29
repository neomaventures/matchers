/**
 * Compiled by `pnpm typecheck` against `tsconfig.type-test.json`, which loads
 * only the `node` and `jest` types, so every form below type-checks through
 * this package's declarations alone. Never run.
 */
import "./index"

class TypeTestError extends Error {
  public constructor(public readonly code: string) {
    super(code)
  }
}

expect({ error: new TypeTestError("ERR") }).toEqual({
  error: expect.toMatchError(TypeTestError, {
    code: expect.any(String),
    cause: expect.any(Error),
  }),
})

expect({ error: new Error("other") }).toEqual({
  error: expect.not.toMatchError(TypeTestError, { code: "ERR" }),
})

expect({ run: (): void => {} }).toEqual({
  run: expect.toThrowMatching(TypeTestError, { code: "ERR" }),
})

expect({ run: (): void => {} }).toEqual({
  run: expect.not.toThrowMatching(TypeTestError),
})

// @ts-expect-error the first argument must be a constructor
expect.toMatchError("TypeTestError")

// @ts-expect-error the first argument must be a constructor
expect.not.toMatchError(new TypeTestError("ERR"))

// @ts-expect-error the first argument must be a constructor
expect.toThrowMatching(42)

// @ts-expect-error the first argument must be a constructor
expect.not.toThrowMatching(undefined)
