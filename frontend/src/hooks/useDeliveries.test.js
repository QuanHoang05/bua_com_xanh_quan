import { renderHook, act } from '@testing-library/react';
import { useDeliveries } from './useDeliveries';
import * as api from '../lib/api';

// Mock the api module
jest.mock('../lib/api', () => ({
  apiGet: jest.fn(),
  apiPatch: jest.fn(),
  apiPost: jest.fn(),
}));

// Mock the Toast hook
jest.mock('../components/ui/Toast', () => ({
  useToast: () => ({
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  }),
}));

test('should exist', () => {
  const { result } = renderHook(() => useDeliveries());
  expect(result.current).toBeDefined();
});