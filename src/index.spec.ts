import "./index"

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
    }).toThrow(/Expected.*TestError.*got.*Error/)
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
    }).toThrow(/Expected.*TestError.*got.*Error/)
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
})
