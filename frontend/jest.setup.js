// jest.setup.js
// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Mock `import.meta.env` for Jest environment
// This is necessary because Jest runs in Node.js and doesn't understand Vite's `import.meta.env` syntax.
// We define a mock object that simulates the structure of `import.meta.env`.
Object.defineProperty(global, 'import.meta', {
  value: {
    env: {
      VITE_GOOGLE_MAPS_API_KEY: 'mock-api-key-for-jest',
      VITE_API_BASE_URL: 'http://localhost:4000/api',
    },
  },
  writable: true,
});