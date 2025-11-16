/** @type {import('jest').Config} */
const config = {
  clearMocks: true,
  testEnvironment: "jsdom",
  passWithNoTests: true,
  testPathIgnorePatterns: ["/node_modules/"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
};

module.exports = config;
