/**
 * The transform matches `.ts`/`.tsx` only — never `.js` — so @swc/jest never
 * tries to recompile already-built output.
 *
 * No `reflect-metadata` in setupFiles: these matchers are plain Jest
 * extensions with no decorator metadata to emit.
 *
 * @type {import('jest').Config}
 */
module.exports = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: ".",
  testRegex: ".*\\.spec\\.ts$",
  transform: {
    "^.+\\.tsx?$": [
      "@swc/jest",
      {
        jsc: {
          parser: {
            syntax: "typescript",
            decorators: true,
            dynamicImport: true,
          },
          transform: {
            legacyDecorator: true,
            decoratorMetadata: true,
          },
        },
      },
    ],
  },
  testEnvironment: "node",
  roots: ["<rootDir>/src/"],
  setupFilesAfterEnv: ["jest-extended/all"],
}
