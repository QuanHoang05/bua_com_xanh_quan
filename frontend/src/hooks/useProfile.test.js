import { renderHook, act, waitFor } from '@testing-library/react';
import { useProfile } from './useProfile';
import * as api from '../lib/api';

// Mock the api module
jest.mock('../lib/api', () => ({
  apiGet: jest.fn(),
  apiPatch: jest.fn(),
}));

// Mock the Toast hook
jest.mock('../components/ui/Toast', () => ({
  useToast: () => ({
    success: jest.fn(),
    error: jest.fn(),
  }),
}));

// Mock the AuthContext
jest.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    setUser: jest.fn(),
  }),
}));

describe('useProfile Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Cung cấp giá trị trả về mặc định cho lần load đầu tiên
    api.apiGet.mockResolvedValue({ name: 'Test User', email: 'test@example.com' });
  });

  it('should fetch profile on initial render', async () => {
    const { result } = renderHook(() => useProfile());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(api.apiGet).toHaveBeenCalledWith('/api/users/me');
    expect(result.current.profile.name).toBe('Test User');
  });
});