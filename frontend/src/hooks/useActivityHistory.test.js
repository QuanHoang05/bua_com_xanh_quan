import { renderHook, waitFor } from '@testing-library/react';
import { useActivityHistory } from './useActivityHistory';
import * as api from '../lib/api';

// Mock the api module
jest.mock('../lib/api', () => ({
  apiGet: jest.fn(),
}));

// Mock the Toast hook
jest.mock('../components/ui/Toast', () => ({
  useToast: () => ({
    error: jest.fn(),
  }),
}));

describe('useActivityHistory Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Cung cấp giá trị trả về mặc định cho lần load đầu tiên
    api.apiGet.mockResolvedValue({ given: [], received: [], payments: [] });
  });

  it('should fetch history on initial render', async () => {
    const { result } = renderHook(() => useActivityHistory());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(api.apiGet).toHaveBeenCalledWith('/api/users/history?limit=8');
    expect(result.current.history.given).toEqual([]);
  });
});