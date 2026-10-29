import { EXPECTED_COLOR, RECEIVED_COLOR } from "jest-matcher-utils"

type ErrorClass = new (...args: any[]) => Error

const className = (value: Error): string =>
  value.constructor?.name || value.name || "Error"

const printable = (value: unknown): unknown =>
  value instanceof Error
    ? Object.create(Object.getPrototypeOf(value) as object | null, {
        name: { value: className(value) },
        message: { value: value.message },
      })
    : value

const describeReceived = (
  context: jest.MatcherContext,
  subject: unknown,
): string => {
  const { printReceived } = context.utils

  if (!(subject instanceof Error)) {
    return `Received value: ${printReceived(subject)}`
  }

  const lines = [
    `Received class: ${RECEIVED_COLOR(className(subject))}`,
    `Received message: ${printReceived(subject.message)}`,
  ]
  if (subject.cause !== undefined) {
    lines.push(`Received cause: ${printReceived(printable(subject.cause))}`)
  }
  return lines.join("\n")
}

const hintFor = (
  context: jest.MatcherContext,
  matcherName: string,
  expectedProps: Record<string, unknown> | undefined,
): string =>
  context.utils.matcherHint(matcherName, undefined, "ErrorClass", {
    isNot: context.isNot,
    promise: context.promise,
    secondArgument: expectedProps ? "properties" : undefined,
  })

const describeMismatch = (
  context: jest.MatcherContext,
  subject: Error,
  expectedProps: Record<string, unknown>,
): string => {
  const printableExpected: Record<string, unknown> = {}
  const printableReceived: Record<string, unknown> = {}
  const mismatched: string[] = []
  const unreadable: string[] = []

  for (const [key, value] of Object.entries(expectedProps)) {
    printableExpected[key] = printable(value)
    try {
      const actual = (subject as any)[key]
      if (context.equals(actual, value)) {
        printableReceived[key] = printableExpected[key]
      } else {
        printableReceived[key] = printable(actual)
        mismatched.push(key)
      }
    } catch (e) {
      printableReceived[key] = printable(e)
      mismatched.push(key)
      unreadable.push(key)
    }
  }

  const lines = [
    `Received ${RECEIVED_COLOR(className(subject))} has mismatched properties: ${mismatched.join(", ")}`,
  ]
  if (unreadable.length > 0) {
    lines.push(`Threw when compared: ${unreadable.join(", ")}`)
  }
  return (
    lines.join("\n") +
    "\n\n" +
    context.utils.printDiffOrStringify(
      printableExpected,
      printableReceived,
      "Expected properties",
      "Received properties",
      context.expand !== false,
    )
  )
}

const checkErrorInstance = (
  context: jest.MatcherContext,
  matcherName: string,
  subject: unknown,
  ErrorClass: ErrorClass,
  expectedProps: Record<string, unknown> | undefined,
): jest.CustomMatcherResult => {
  if (!(subject instanceof ErrorClass)) {
    return {
      pass: false,
      message: () =>
        `${hintFor(context, matcherName, expectedProps)}\n\n` +
        `Expected class: ${EXPECTED_COLOR(ErrorClass.name)}\n` +
        describeReceived(context, subject),
    }
  }

  if (!expectedProps) {
    return {
      pass: true,
      message: () =>
        `${hintFor(context, matcherName, expectedProps)}\n\n` +
        `Expected: not an instance of ${EXPECTED_COLOR(ErrorClass.name)}\n` +
        `Received: ${context.utils.printReceived(printable(subject))}`,
    }
  }

  const pass = Object.entries(expectedProps).every(([key, value]) =>
    context.equals((subject as any)[key], value),
  )

  if (!pass) {
    return {
      pass: false,
      message: () =>
        `${hintFor(context, matcherName, expectedProps)}\n\n` +
        describeMismatch(context, subject, expectedProps),
    }
  }

  return {
    pass: true,
    message: () =>
      `${hintFor(context, matcherName, expectedProps)}\n\n` +
      `Expected: not an instance of ${EXPECTED_COLOR(ErrorClass.name)} with properties ${context.utils.printExpected(
        Object.fromEntries(
          Object.entries(expectedProps).map(([key, value]) => [
            key,
            printable(value),
          ]),
        ),
      )}\n` +
      `Received: ${context.utils.printReceived(printable(subject))}\n` +
      `Matched properties: ${Object.keys(expectedProps).join(", ")}`,
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
