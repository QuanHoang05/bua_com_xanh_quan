import { renderHook, act, waitFor } from '@testing-library/react';
import { useSessions } from './useSessions';
import * as api from '../lib/api';

// Mock the api module
jest.mock('../lib/api', () => ({
  apiGet: jest.fn(),
  apiPost: jest.fn(),
}));

// Mock the Toast hook
jest.mock('../components/ui/Toast', () => ({
  useToast: () => ({
    success: jest.fn(),
    error: jest.fn(),
  }),
}));

describe('useSessions Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Cung cấp giá trị trả về mặc định cho lần load đầu tiên
    api.apiGet.mockResolvedValue([{ id: 'session1', is_current: true }]);
  });

  it('should fetch sessions on initial render', async () => {
    const { result } = renderHook(() => useSessions());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(api.apiGet).toHaveBeenCalledWith('/api/users/sessions');
    expect(result.current.sessions).toHaveLength(1);
  });
});