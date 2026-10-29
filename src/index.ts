import { EXPECTED_COLOR, RECEIVED_COLOR } from "jest-matcher-utils"

type ErrorClass = new (...args: any[]) => Error

const printable = (value: unknown): unknown => {
  if (!(value instanceof Error)) {
    return value
  }

  const copy = Object.assign(
    Object.create(Object.getPrototypeOf(value) as object) as Error,
    value,
  )
  Object.defineProperties(copy, {
    name: { value: value.constructor.name },
    message: { value: value.message },
  })
  return copy
}

const describeReceived = (
  context: jest.MatcherContext,
  subject: unknown,
): string => {
  const { printReceived } = context.utils

  if (!(subject instanceof Error)) {
    return `Received value: ${printReceived(subject)}`
  }

  const lines = [
    `Received class: ${RECEIVED_COLOR(subject.constructor.name)}`,
    `Received message: ${printReceived(subject.message)}`,
  ]
  if (subject.cause !== undefined) {
    lines.push(`Received cause: ${printReceived(printable(subject.cause))}`)
  }
  return lines.join("\n")
}

const checkErrorInstance = (
  context: jest.MatcherContext,
  matcherName: string,
  subject: unknown,
  ErrorClass: ErrorClass,
  expectedProps: Record<string, unknown> | undefined,
): jest.CustomMatcherResult => {
  const { matcherHint, printExpected, printReceived, printDiffOrStringify } =
    context.utils
  const hint = matcherHint(matcherName, undefined, "ErrorClass", {
    isNot: context.isNot,
    promise: context.promise,
    secondArgument: expectedProps ? "properties" : undefined,
  })

  if (!(subject instanceof ErrorClass)) {
    return {
      pass: false,
      message: () =>
        `${hint}\n\n` +
        `Expected class: ${EXPECTED_COLOR(ErrorClass.name)}\n` +
        describeReceived(context, subject),
    }
  }

  if (!expectedProps) {
    return {
      pass: true,
      message: () =>
        `${hint}\n\n` +
        `Expected: not an instance of ${EXPECTED_COLOR(ErrorClass.name)}\n` +
        `Received: ${printReceived(printable(subject))}`,
    }
  }

  const keys = Object.keys(expectedProps)
  const printableExpected: Record<string, unknown> = {}
  const printableReceived: Record<string, unknown> = {}
  const mismatched: string[] = []
  for (const key of keys) {
    const actual = (subject as any)[key]
    printableExpected[key] = printable(expectedProps[key])
    if (context.equals(actual, expectedProps[key])) {
      printableReceived[key] = printableExpected[key]
    } else {
      printableReceived[key] = printable(actual)
      mismatched.push(key)
    }
  }

  if (mismatched.length > 0) {
    return {
      pass: false,
      message: () =>
        `${hint}\n\n` +
        `Received ${RECEIVED_COLOR(subject.constructor.name)} has mismatched properties: ${mismatched.join(", ")}\n\n` +
        printDiffOrStringify(
          printableExpected,
          printableReceived,
          "Expected properties",
          "Received properties",
          context.expand !== false,
        ),
    }
  }

  return {
    pass: true,
    message: () =>
      `${hint}\n\n` +
      `Expected: not an instance of ${EXPECTED_COLOR(ErrorClass.name)} with properties ${printExpected(printableExpected)}\n` +
      `Received: ${printReceived(printable(subject))}\n` +
      `Matched properties: ${keys.join(", ")}`,
  }
}

function toThrowMatching(
  this: jest.MatcherContext,
  subject: unknown,
  ErrorClass: new (...args: any[]) => Error,
  expectedProps?: Record<string, unknown>,
): jest.CustomMatcherResult {
  if (!(subject instanceof Function)) {
    return {
      pass: false,
      message: () =>
        `toThrowMatching requires a function, but received ${RECEIVED_COLOR(typeof subject)}. Use toMatchError to check an already-caught error.`,
    }
  }

  try {
    subject()
    return {
      pass: false,
      message: () =>
        `Expected function to throw ${EXPECTED_COLOR(ErrorClass.name)}, but it did not throw`,
    }
  } catch (e) {
    return checkErrorInstance(
      this,
      "toThrowMatching",
      e,
      ErrorClass,
      expectedProps,
    )
  }
}

function toMatchError(
  this: jest.MatcherContext,
  subject: unknown,
  ErrorClass: new (...args: any[]) => Error,
  expectedProps?: Record<string, unknown>,
): jest.CustomMatcherResult {
  if (subject instanceof Function) {
    return {
      pass: false,
      message: () =>
        `toMatchError requires an error instance, but received a function. Use toThrowMatching to assert on a throwing function.`,
    }
  }

  return checkErrorInstance(
    this,
    "toMatchError",
    subject,
    ErrorClass,
    expectedProps,
  )
}

expect.extend({
  toThrowMatching,
  toMatchError,
})

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- Jest matcher augmentation requires namespace syntax
  namespace jest {
    interface Matchers<R> {
      /**
       * Checks if a function throws an instance of an error class, optionally
       * with specific properties. Property values may be Jest asymmetric
       * matchers (e.g. `expect.objectContaining(...)`).
       *
       * @param ErrorClass The expected error class/constructor
       * @param expectedProps Optional object of properties to match
       */
      toThrowMatching<T>(
        ErrorClass: new (...args: any[]) => T,
        expectedProps?: Partial<T> | Record<string, unknown>,
      ): R

      /**
       * Checks if a value is an instance of an error class, optionally
       * with specific properties. Property values may be Jest asymmetric
       * matchers (e.g. `expect.objectContaining(...)`).
       *
       * @param ErrorClass The expected error class/constructor
       * @param expectedProps Optional object of properties to match
       */
      toMatchError<T>(
        ErrorClass: new (...args: any[]) => T,
        expectedProps?: Partial<T> | Record<string, unknown>,
      ): R
    }
  }
}
