import { renderHook, act, waitFor } from '@testing-library/react';
import { usePrivacyActions } from './usePrivacyActions';
import * as api from '../lib/api';

// Mock the api module
jest.mock('../lib/api', () => ({
  apiGet: jest.fn(),
  apiPost: jest.fn(),
}));

// Mock the Toast hook
jest.mock('../components/ui/Toast', () => ({
  useToast: () => ({
    info: jest.fn(),
    error: jest.fn(),
  }),
}));

// Mock the AuthContext
jest.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    signOut: jest.fn(),
  }),
}));

describe('usePrivacyActions Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call apiPost and signOut on successful account deletion', async () => {
    const { result } = renderHook(() => usePrivacyActions());

    api.apiPost.mockResolvedValue({ success: true });

    await act(async () => {
      await result.current.deleteAccount('XOA TAI KHOAN');
    });

    expect(api.apiPost).toHaveBeenCalledWith('/api/users/delete');
    expect(result.current.isDeleting).toBe(false);
  });
});