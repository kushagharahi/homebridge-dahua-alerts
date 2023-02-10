/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: 'tsconfig.json' }]
  },
};