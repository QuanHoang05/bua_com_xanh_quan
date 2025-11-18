// IntegrationTest/jest.env.js

// This file runs BEFORE any other code, including Jest's own setup.
// It's the perfect place to set environment variables for the test run.
process.env.NODE_ENV = "test";
process.env.DB_DRIVER = "sqlite";