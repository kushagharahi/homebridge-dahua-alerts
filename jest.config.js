/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  transform: {
    "^.+\\.ts?$": ["ts-jest", { tsconfig: 'tsconfig.json' }]
  },
};