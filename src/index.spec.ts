import { stripVTControlCharacters } from "node:util"

import "./index"

const failureMessage = (assertion: () => void): string => {
  try {
    assertion()
  } catch (e) {
    return stripVTControlCharacters((e as Error).message)
  }
  throw new Error("Expected the assertion to fail, but it passed")
}

class TestError extends Error {
  public constructor(
    public readonly code: string,
    message?: string,
    public readonly details?: Record<string, unknown>,
    public readonly tags?: string[],
    public readonly inner?: Error,
  ) {
    super(message)
  }
}

class RawError extends Error {}

class OtherError extends Error {}

class PublicError extends Error {
  public constructor(
    public readonly reason: string,
    cause?: Error,
  ) {
    super("public", { cause })
  }
}

class GetterError extends PublicError {
  public get kind(): string {
    return "getter"
  }
}

const AnonymousError = ((): new (message: string) => Error =>
  class extends Error {})()

const throwingGetter = {
  enumerable: true,
  get: (): never => {
    throw new Error("getter threw")
  },
}

const causeWithThrowingGetter = Object.defineProperty(
  new RawError("x"),
  "boom",
  throwingGetter,
)

const subjectWithThrowingGetter = Object.defineProperty(
  new PublicError("access-lost"),
  "boom",
  throwingGetter,
)

const withoutConstructor = Object.defineProperty(
  new PublicError("access-lost"),
  "constructor",
  { value: undefined },
)

const symbolKey = Symbol("key")

describe("toThrowMatching", () => {
  it("should pass when function throws the expected error class", () => {
    expect(() => {
      throw new TestError("ERR")
    }).toThrowMatching(TestError)
  })

  /* eslint-disable jest/max-expects --
   * Matcher failure-mode tests: the outer `expect(() => …).toThrow(…)` captures
   * the AssertionError raised by the inner matcher invocation. That's two
   * expects by design — one to invoke the matcher, one to verify its failure
   * diagnostic. Splitting or consolidating would defeat the intent.
   */
  it("should fail when function throws a different error class", () => {
    expect(() => {
      expect(() => {
        throw new Error("wrong")
      }).toThrowMatching(TestError)
    }).toThrow(
      /Expected: an instance of .*TestError[\s\S]*Received: an instance of .*Error/,
    )
  })

  it("should fail when function does not throw", () => {
    expect(() => {
      expect(() => {}).toThrowMatching(TestError)
    }).toThrow(/did not throw/)
  })
  /* eslint-enable jest/max-expects */

  it("should pass when properties match", () => {
    expect(() => {
      throw new TestError("ERR_CODE")
    }).toThrowMatching(TestError, { code: "ERR_CODE" })
  })

  /* eslint-disable jest/max-expects --
   * Matcher failure-mode tests: outer expect captures the AssertionError raised
   * by the inner matcher. Two expects are intrinsic to the pattern.
   */
  it("should fail when properties do not match", () => {
    expect(() => {
      expect(() => {
        throw new TestError("ACTUAL")
      }).toThrowMatching(TestError, { code: "EXPECTED" })
    }).toThrow(/code/)
  })

  it("should reject non-function subjects with a clear error", () => {
    expect(() => {
      expect(new TestError("ERR")).toThrowMatching(TestError)
    }).toThrow(/toThrowMatching requires a function/)
  })
  /* eslint-enable jest/max-expects */

  describe("with asymmetric matchers", () => {
    it("should match expect.objectContaining at the top level", () => {
      expect(() => {
        throw new TestError("ERR", undefined, { phase: "exchange", extra: 1 })
      }).toThrowMatching(TestError, {
        details: expect.objectContaining({ phase: "exchange" }),
      })
    })

    it("should match expect.objectContaining inside a nested property", () => {
      expect(() => {
        throw new TestError("ERR", undefined, {
          provider: "google",
          nested: { kind: "codeExchange", attempt: 2 },
        })
      }).toThrowMatching(TestError, {
        details: expect.objectContaining({
          nested: expect.objectContaining({ kind: "codeExchange" }),
        }),
      })
    })

    it("should match expect.arrayContaining", () => {
      expect(() => {
        throw new TestError("ERR", undefined, undefined, ["a", "b", "c"])
      }).toThrowMatching(TestError, {
        tags: expect.arrayContaining(["b"]),
      })
    })

    it("should match expect.any(Class) against an instance property", () => {
      expect(() => {
        throw new TestError(
          "ERR",
          undefined,
          undefined,
          undefined,
          new Error("inner"),
        )
      }).toThrowMatching(TestError, {
        inner: expect.any(Error),
      })
    })

    it("should match expect.stringMatching against a string property", () => {
      expect(() => {
        throw new TestError("ERR_FOO_BAR")
      }).toThrowMatching(TestError, {
        code: expect.stringMatching(/^ERR_/),
      })
    })

    /* eslint-disable jest/max-expects --
     * Matcher failure-mode test: outer expect captures the AssertionError
     * raised by the inner matcher. Two expects are intrinsic to the pattern.
     */
    it("should fail when objectContaining keys are absent", () => {
      expect(() => {
        expect(() => {
          throw new TestError("ERR", undefined, { phase: "exchange" })
        }).toThrowMatching(TestError, {
          details: expect.objectContaining({ phase: "decode" }),
        })
      }).toThrow(/details/)
    })
    /* eslint-enable jest/max-expects */
  })

  /* eslint-disable jest/max-expects --
   * Failure-message tests: the inner expect invokes the matcher so that
   * failureMessage can capture its AssertionError; the outer expect asserts
   * on that message. Two expects are intrinsic to the pattern.
   */
  describe("failure messages", () => {
    const error = new PublicError(
      "access-lost",
      new OtherError("downstream said no"),
    )

    it("should show both causes' class and message when the cause does not match expect.any", () => {
      expect(
        failureMessage(() => {
          expect(() => {
            throw error
          }).toThrowMatching(PublicError, { cause: expect.any(RawError) })
        }),
      ).toIncludeMultiple([
        '-   "cause": Any<RawError>,',
        '+   "cause": [OtherError: downstream said no],',
      ])
    })

    it("should show both causes' class and message when the cause does not equal an error", () => {
      expect(
        failureMessage(() => {
          expect(() => {
            throw error
          }).toThrowMatching(PublicError, { cause: new RawError("x") })
        }),
      ).toIncludeMultiple([
        '-   "cause": [RawError: x],',
        '+   "cause": [OtherError: downstream said no],',
      ])
    })

    it("should report every mismatched property in one message", () => {
      expect(
        failureMessage(() => {
          expect(() => {
            throw error
          }).toThrowMatching(PublicError, { reason: "quota", message: "nope" })
        }),
      ).toIncludeMultiple([
        "Received PublicError has mismatched properties: message, reason",
        '-   "reason": "quota",',
        '+   "reason": "access-lost",',
        '-   "message": "nope",',
        '+   "message": "public",',
      ])
    })

    it("should show matching properties as unchanged in the diff", () => {
      expect(
        failureMessage(() => {
          expect(() => {
            throw error
          }).toThrowMatching(PublicError, {
            reason: "access-lost",
            message: "nope",
          })
        }),
      ).toIncludeMultiple([
        "has mismatched properties: message\n",
        '    "reason": "access-lost",',
      ])
    })

    it("should show the received class and message on a class mismatch", () => {
      expect(
        failureMessage(() => {
          expect(() => {
            throw new OtherError("boom")
          }).toThrowMatching(PublicError)
        }),
      ).toIncludeMultiple([
        "Expected: an instance of PublicError",
        "Received: an instance of OtherError",
        'Received message: "boom"',
      ])
    })

    it("should show the received cause on a class mismatch when there is one", () => {
      expect(
        failureMessage(() => {
          expect(() => {
            throw new OtherError("boom", { cause: new RawError("raw") })
          }).toThrowMatching(PublicError)
        }),
      ).toInclude("Received cause: [RawError: raw]")
    })

    it.each([
      ["a string", "boom", 'Received: "boom"'],
      ["undefined", undefined, "Received: undefined"],
      ["a plain object", { reason: "quota" }, 'Received: {"reason": "quota"}'],
    ])("should show the received value when given %s", (_, subject, shown) => {
      expect(
        failureMessage(() => {
          expect(() => {
            throw subject
          }).toThrowMatching(PublicError)
        }),
      ).toIncludeMultiple(["Expected: an instance of PublicError", shown])
    })

    it("should fall back to the error's name when its constructor is undefined", () => {
      expect(
        failureMessage(() => {
          expect(() => {
            throw withoutConstructor
          }).toThrowMatching(OtherError)
        }),
      ).toIncludeMultiple([
        "Received: an instance of Error",
        'Received message: "public"',
      ])
    })

    it("should name an anonymous error class by its error name", () => {
      expect(
        failureMessage(() => {
          expect(() => {
            throw new AnonymousError("anon")
          }).toThrowMatching(PublicError)
        }),
      ).toIncludeMultiple([
        "Received: an instance of Error",
        'Received message: "anon"',
      ])
    })

    it("should report a property whose getter throws as mismatched", () => {
      expect(
        failureMessage(() => {
          expect(() => {
            throw subjectWithThrowingGetter
          }).toThrowMatching(PublicError, { reason: "zzz", boom: 1 })
        }),
      ).toIncludeMultiple([
        "has mismatched properties: boom, reason",
        "Threw when compared: boom",
        '+   "boom": [Error: getter threw],',
      ])
    })

    it("should say which properties matched when negated", () => {
      expect(
        failureMessage(() => {
          expect(() => {
            throw error
          }).not.toThrowMatching(PublicError, {
            reason: "access-lost",
            cause: expect.any(OtherError),
          })
        }),
      ).toIncludeMultiple([
        "expect(received).not.toThrowMatching(ErrorClass, properties)",
        'Expected: not an instance of PublicError with properties {"cause": Any<OtherError>, "reason": "access-lost"}',
        "Received: an instance of PublicError",
        "Matched properties: cause, reason",
      ])
    })

    it("should show the received error when negated without properties", () => {
      expect(
        failureMessage(() => {
          expect(() => {
            throw error
          }).not.toThrowMatching(PublicError)
        }),
      ).toIncludeMultiple([
        "Expected: not an instance of PublicError",
        "Received: an instance of PublicError",
        'Received message: "public"',
        "Received cause: [OtherError: downstream said no]",
      ])
    })
  })
  /* eslint-enable jest/max-expects */

  describe("as an asymmetric matcher", () => {
    it("should match a throwing function inside toEqual", () => {
      expect({
        run: (): void => {
          throw new TestError("ERR_CODE")
        },
      }).toEqual({
        run: expect.toThrowMatching(TestError, { code: "ERR_CODE" }),
      })
    })

    it("should match a non-throwing function with expect.not inside toEqual", () => {
      expect({ run: (): void => {} }).toEqual({
        run: expect.not.toThrowMatching(TestError),
      })
    })

    /* eslint-disable jest/max-expects --
     * Matcher failure-mode tests: the outer expect captures the AssertionError
     * raised by the expectation the matcher is nested in. Two expects are
     * intrinsic to the pattern.
     */
    it("should fail toEqual when the function throws a different error class", () => {
      expect(() => {
        expect({
          run: (): void => {
            throw new Error("wrong")
          },
        }).toEqual({ run: expect.toThrowMatching(TestError) })
      }).toThrow(/toEqual/)
    })

    it("should fail toEqual with expect.not when the function throws the error class", () => {
      expect(() => {
        expect({
          run: (): void => {
            throw new TestError("ERR")
          },
        }).toEqual({ run: expect.not.toThrowMatching(TestError) })
      }).toThrow(/toEqual/)
    })
    /* eslint-enable jest/max-expects */
  })
})

describe("toMatchError", () => {
  it("should pass when error matches the expected class", () => {
    const error = new TestError("ERR")
    expect(error).toMatchError(TestError)
  })

  it("should pass when error matches class and properties", () => {
    const error = new TestError("ERR_CODE")
    expect(error).toMatchError(TestError, { code: "ERR_CODE" })
  })

  /* eslint-disable jest/max-expects --
   * Matcher failure-mode tests: outer expect captures the AssertionError raised
   * by the inner matcher. Two expects are intrinsic to the pattern.
   */
  it("should fail when error is not the expected class", () => {
    expect(() => {
      expect(new Error("wrong")).toMatchError(TestError)
    }).toThrow(
      /Expected: an instance of .*TestError[\s\S]*Received: an instance of .*Error/,
    )
  })

  it("should reject function subjects with a clear error", () => {
    expect(() => {
      expect(() => {
        throw new TestError("ERR")
      }).toMatchError(TestError)
    }).toThrow(/toMatchError requires an error instance.*received a function/)
  })
  /* eslint-enable jest/max-expects */

  describe("with asymmetric matchers", () => {
    it("should match expect.objectContaining at the top level", () => {
      const error = new TestError("ERR", undefined, {
        phase: "exchange",
        extra: 1,
      })
      expect(error).toMatchError(TestError, {
        details: expect.objectContaining({ phase: "exchange" }),
      })
    })

    it("should match expect.objectContaining inside a nested property", () => {
      const error = new TestError("ERR", undefined, {
        provider: "google",
        nested: { kind: "codeExchange", attempt: 2 },
      })
      expect(error).toMatchError(TestError, {
        details: expect.objectContaining({
          nested: expect.objectContaining({ kind: "codeExchange" }),
        }),
      })
    })

    it("should match expect.arrayContaining", () => {
      const error = new TestError("ERR", undefined, undefined, ["a", "b", "c"])
      expect(error).toMatchError(TestError, {
        tags: expect.arrayContaining(["b"]),
      })
    })

    it("should match expect.any(Class) against an instance property", () => {
      const error = new TestError(
        "ERR",
        undefined,
        undefined,
        undefined,
        new Error("inner"),
      )
      expect(error).toMatchError(TestError, {
        inner: expect.any(Error),
      })
    })

    it("should match expect.stringMatching against a string property", () => {
      const error = new TestError("ERR_FOO_BAR")
      expect(error).toMatchError(TestError, {
        code: expect.stringMatching(/^ERR_/),
      })
    })

    /* eslint-disable jest/max-expects --
     * Matcher failure-mode test: outer expect captures the AssertionError
     * raised by the inner matcher. Two expects are intrinsic to the pattern.
     */
    it("should fail when objectContaining keys are absent", () => {
      const error = new TestError("ERR", undefined, { phase: "exchange" })
      expect(() => {
        expect(error).toMatchError(TestError, {
          details: expect.objectContaining({ phase: "decode" }),
        })
      }).toThrow(/details/)
    })
    /* eslint-enable jest/max-expects */
  })

  describe("as an asymmetric matcher", () => {
    describe("inside toEqual", () => {
      it("should match the error class", () => {
        expect({ error: new TestError("ERR") }).toEqual({
          error: expect.toMatchError(TestError),
        })
      })

      it("should match the error class and properties", () => {
        expect({ error: new TestError("ERR_CODE") }).toEqual({
          error: expect.toMatchError(TestError, { code: "ERR_CODE" }),
        })
      })

      it("should match properties that are themselves asymmetric matchers", () => {
        const error = new TestError(
          "ERR_CODE",
          undefined,
          undefined,
          undefined,
          new TestError("INNER"),
        )
        expect([["failed", { error }]]).toEqual([
          [
            "failed",
            {
              error: expect.toMatchError(TestError, {
                code: "ERR_CODE",
                inner: expect.any(TestError),
              }),
            },
          ],
        ])
      })

      /* eslint-disable jest/max-expects --
       * Matcher failure-mode tests: the outer expect captures the
       * AssertionError raised by the expectation the matcher is nested in.
       * Two expects are intrinsic to the pattern.
       */
      it("should fail when the error is not the expected class", () => {
        expect(() => {
          expect({ error: new Error("wrong") }).toEqual({
            error: expect.toMatchError(TestError),
          })
        }).toThrow(/toEqual/)
      })

      it("should fail when properties do not match", () => {
        expect(() => {
          expect({ error: new TestError("ACTUAL") }).toEqual({
            error: expect.toMatchError(TestError, { code: "EXPECTED" }),
          })
        }).toThrow(/toEqual/)
      })

      it("should fail when a property's asymmetric matcher does not match", () => {
        const error = new TestError(
          "ERR",
          undefined,
          undefined,
          undefined,
          new Error("inner"),
        )
        expect(() => {
          expect({ error }).toEqual({
            error: expect.toMatchError(TestError, {
              inner: expect.any(TestError),
            }),
          })
        }).toThrow(/toEqual/)
      })
      /* eslint-enable jest/max-expects */
    })

    describe("inside toMatchObject", () => {
      it("should match the error class and properties", () => {
        expect({
          status: "failed",
          error: new TestError("ERR_CODE"),
        }).toMatchObject({
          error: expect.toMatchError(TestError, {
            code: expect.stringMatching(/^ERR_/),
          }),
        })
      })

      /* eslint-disable jest/max-expects --
       * Matcher failure-mode test: the outer expect captures the
       * AssertionError raised by the expectation the matcher is nested in.
       * Two expects are intrinsic to the pattern.
       */
      it("should fail when properties do not match", () => {
        expect(() => {
          expect({
            status: "failed",
            error: new TestError("ACTUAL"),
          }).toMatchObject({
            error: expect.toMatchError(TestError, { code: "EXPECTED" }),
          })
        }).toThrow(/toMatchObject/)
      })
      /* eslint-enable jest/max-expects */
    })

    describe("inside toHaveBeenCalledWith", () => {
      it("should match an error passed as an argument", () => {
        const onError = jest.fn()
        onError("sync", new TestError("ERR_CODE"))
        expect(onError).toHaveBeenCalledWith(
          "sync",
          expect.toMatchError(TestError, { code: "ERR_CODE" }),
        )
      })

      /* eslint-disable jest/max-expects --
       * Matcher failure-mode test: the outer expect captures the
       * AssertionError raised by the expectation the matcher is nested in.
       * Two expects are intrinsic to the pattern.
       */
      it("should fail when the argument is not the expected class", () => {
        const onError = jest.fn()
        onError("sync", new Error("wrong"))
        expect(() => {
          expect(onError).toHaveBeenCalledWith(
            "sync",
            expect.toMatchError(TestError),
          )
        }).toThrow(/toHaveBeenCalledWith/)
      })
      /* eslint-enable jest/max-expects */
    })

    describe("with expect.not", () => {
      it("should match an error of a different class", () => {
        expect({ error: new Error("other") }).toEqual({
          error: expect.not.toMatchError(TestError),
        })
      })

      it("should match an error whose properties differ", () => {
        expect({ error: new TestError("ACTUAL") }).toEqual({
          error: expect.not.toMatchError(TestError, { code: "EXPECTED" }),
        })
      })

      /* eslint-disable jest/max-expects --
       * Matcher failure-mode test: the outer expect captures the
       * AssertionError raised by the expectation the matcher is nested in.
       * Two expects are intrinsic to the pattern.
       */
      it("should fail when the error matches the class and properties", () => {
        expect(() => {
          expect({ error: new TestError("ERR_CODE") }).toEqual({
            error: expect.not.toMatchError(TestError, { code: "ERR_CODE" }),
          })
        }).toThrow(/toEqual/)
      })
      /* eslint-enable jest/max-expects */
    })
  })

  /* eslint-disable jest/max-expects --
   * Failure-message tests: the inner expect invokes the matcher so that
   * failureMessage can capture its AssertionError; the outer expect asserts
   * on that message. Two expects are intrinsic to the pattern.
   */
  describe("failure messages", () => {
    const error = new PublicError(
      "access-lost",
      new OtherError("downstream said no"),
    )

    it("should show both causes' class and message when the cause does not match expect.any", () => {
      expect(
        failureMessage(() => {
          expect(error).toMatchError(PublicError, {
            cause: expect.any(RawError),
          })
        }),
      ).toIncludeMultiple([
        '-   "cause": Any<RawError>,',
        '+   "cause": [OtherError: downstream said no],',
      ])
    })

    it("should show both causes' class and message when the cause does not equal an error", () => {
      expect(
        failureMessage(() => {
          expect(error).toMatchError(PublicError, { cause: new RawError("x") })
        }),
      ).toIncludeMultiple([
        '-   "cause": [RawError: x],',
        '+   "cause": [OtherError: downstream said no],',
      ])
    })

    it("should report every mismatched property in one message", () => {
      expect(
        failureMessage(() => {
          expect(error).toMatchError(PublicError, {
            reason: "quota",
            message: "nope",
          })
        }),
      ).toIncludeMultiple([
        "Received PublicError has mismatched properties: message, reason",
        '-   "reason": "quota",',
        '+   "reason": "access-lost",',
        '-   "message": "nope",',
        '+   "message": "public",',
      ])
    })

    it("should show matching properties as unchanged in the diff", () => {
      expect(
        failureMessage(() => {
          expect(error).toMatchError(PublicError, {
            reason: "access-lost",
            message: "nope",
          })
        }),
      ).toIncludeMultiple([
        "has mismatched properties: message\n",
        '    "reason": "access-lost",',
      ])
    })

    it("should show the received class and message on a class mismatch", () => {
      expect(
        failureMessage(() => {
          expect(new OtherError("boom")).toMatchError(PublicError)
        }),
      ).toIncludeMultiple([
        "Expected: an instance of PublicError",
        "Received: an instance of OtherError",
        'Received message: "boom"',
      ])
    })

    it("should show the received cause on a class mismatch when there is one", () => {
      expect(
        failureMessage(() => {
          expect(
            new OtherError("boom", { cause: new RawError("raw") }),
          ).toMatchError(PublicError)
        }),
      ).toInclude("Received cause: [RawError: raw]")
    })

    it.each([
      ["a string", "boom", 'Received: "boom"'],
      ["undefined", undefined, "Received: undefined"],
      ["a plain object", { reason: "quota" }, 'Received: {"reason": "quota"}'],
    ])("should show the received value when given %s", (_, subject, shown) => {
      expect(
        failureMessage(() => {
          expect(subject).toMatchError(PublicError)
        }),
      ).toIncludeMultiple(["Expected: an instance of PublicError", shown])
    })

    it("should fall back to the error's name when its constructor is undefined", () => {
      expect(
        failureMessage(() => {
          expect(withoutConstructor).toMatchError(OtherError)
        }),
      ).toIncludeMultiple([
        "Received: an instance of Error",
        'Received message: "public"',
      ])
    })

    it("should name an anonymous error class by its error name", () => {
      expect(
        failureMessage(() => {
          expect(new AnonymousError("anon")).toMatchError(PublicError)
        }),
      ).toIncludeMultiple([
        "Received: an instance of Error",
        'Received message: "anon"',
      ])
    })

    it("should say when the expected class is anonymous", () => {
      expect(
        failureMessage(() => {
          expect(new TestError("ERR")).toMatchError(AnonymousError)
        }),
      ).toInclude("Expected: an instance of an anonymous class")
    })

    it("should report a property whose getter throws as mismatched", () => {
      expect(
        failureMessage(() => {
          expect(subjectWithThrowingGetter).toMatchError(PublicError, {
            reason: "zzz",
            boom: 1,
          })
        }),
      ).toIncludeMultiple([
        "has mismatched properties: boom, reason",
        "Threw when compared: boom",
        '+   "boom": [Error: getter threw],',
      ])
    })

    it("should say which properties matched when negated", () => {
      expect(
        failureMessage(() => {
          expect(error).not.toMatchError(PublicError, {
            reason: "access-lost",
            cause: expect.any(OtherError),
          })
        }),
      ).toIncludeMultiple([
        "expect(received).not.toMatchError(ErrorClass, properties)",
        'Expected: not an instance of PublicError with properties {"cause": Any<OtherError>, "reason": "access-lost"}',
        "Received: an instance of PublicError",
        "Matched properties: cause, reason",
      ])
    })

    it("should show the received error when negated without properties", () => {
      expect(
        failureMessage(() => {
          expect(error).not.toMatchError(PublicError)
        }),
      ).toIncludeMultiple([
        "Expected: not an instance of PublicError",
        "Received: an instance of PublicError",
        'Received message: "public"',
        "Received cause: [OtherError: downstream said no]",
      ])
    })
  })
  /* eslint-enable jest/max-expects */
})

describe("pass and fail outcomes", () => {
  const error = new PublicError(
    "access-lost",
    new OtherError("downstream said no"),
  )

  const passing: [string, unknown, new (...args: any[]) => Error, object?][] = [
    ["the class alone", error, PublicError, undefined],
    [
      "an error whose constructor is undefined",
      withoutConstructor,
      PublicError,
      { reason: "access-lost" },
    ],
    [
      "an anonymous error class",
      new AnonymousError("anon"),
      AnonymousError,
      undefined,
    ],
    [
      "undefined expected for an absent property",
      error,
      PublicError,
      { code: undefined },
    ],
    [
      "an inherited property",
      Object.create(error),
      PublicError,
      { reason: "access-lost" },
    ],
    [
      "a getter property",
      new GetterError("access-lost"),
      PublicError,
      { kind: "getter" },
    ],
    [
      "a symbol-keyed property, which is not compared",
      error,
      PublicError,
      { [symbolKey]: "anything" },
    ],
    ["a base class", error, Error, undefined],
    ["no properties", error, PublicError, {}],
    ["one matching property", error, PublicError, { reason: "access-lost" }],
    [
      "every property matching",
      error,
      PublicError,
      { reason: "access-lost", message: "public" },
    ],
    [
      "a cause matching expect.any",
      error,
      PublicError,
      { cause: expect.any(OtherError) },
    ],
    [
      "a cause equal to an error",
      error,
      PublicError,
      { cause: new OtherError("downstream said no") },
    ],
    [
      "a property matching expect.stringMatching",
      error,
      PublicError,
      { reason: expect.stringMatching(/^access/) },
    ],
  ]

  const failing: [string, unknown, new (...args: any[]) => Error, object?][] = [
    [
      "a non-Error subject with properties",
      { reason: "access-lost" },
      PublicError,
      { reason: "access-lost" },
    ],
    [
      "a mismatched getter property",
      new GetterError("access-lost"),
      PublicError,
      { kind: "other" },
    ],
    [
      "a mismatch alongside a cause with a throwing getter",
      error,
      PublicError,
      { reason: "nope", cause: causeWithThrowingGetter },
    ],
    [
      "a mismatch before a property whose getter throws",
      subjectWithThrowingGetter,
      PublicError,
      { reason: "zzz", boom: 1 },
    ],
    ["another class", new OtherError("boom"), PublicError, undefined],
    ["a base class instance", new Error("boom"), PublicError, undefined],
    ["a string", "boom", PublicError, undefined],
    ["undefined", undefined, PublicError, undefined],
    ["a plain object", { reason: "access-lost" }, PublicError, undefined],
    ["one mismatched property", error, PublicError, { reason: "quota" }],
    [
      "every property mismatched",
      error,
      PublicError,
      { reason: "quota", message: "nope" },
    ],
    [
      "one of two properties mismatched",
      error,
      PublicError,
      { reason: "access-lost", message: "nope" },
    ],
    ["an absent property", error, PublicError, { code: "ERR" }],
    [
      "a cause not matching expect.any",
      error,
      PublicError,
      { cause: expect.any(RawError) },
    ],
    [
      "a cause not equal to an error",
      error,
      PublicError,
      { cause: new RawError("x") },
    ],
  ]

  describe("toMatchError", () => {
    it.each(passing)("should pass given %s", (_, subject, Class, props) => {
      expect(subject).toMatchError(Class, props)
    })

    it.each(failing)("should fail given %s", (_, subject, Class, props) => {
      expect(subject).not.toMatchError(Class, props)
    })
  })

  describe("toThrowMatching", () => {
    it.each(passing)("should pass given %s", (_, thrown, Class, props) => {
      expect(() => {
        throw thrown
      }).toThrowMatching(Class, props)
    })

    it.each(failing)("should fail given %s", (_, thrown, Class, props) => {
      expect(() => {
        throw thrown
      }).not.toThrowMatching(Class, props)
    })

    it("should fail given a function that does not throw", () => {
      expect(() => {}).not.toThrowMatching(PublicError)
    })
  })
})
