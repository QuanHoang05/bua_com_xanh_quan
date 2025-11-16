import { renderHook, act } from '@testing-library/react';
import { usePasswordChange } from './usePasswordChange';
import * as api from '../lib/api';

// Mock the api module consistently and completely
jest.mock('../lib/api', () => ({
  apiGet: jest.fn(),
  apiPost: jest.fn(),
  apiPatch: jest.fn(),
  apiDelete: jest.fn(),
}));

// Mock the Toast hook
jest.mock('../components/ui/Toast', () => ({
  useToast: () => ({
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  }),
}));

describe('usePasswordChange Hook', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();

    // Provide default mock implementations to prevent potential errors.
    api.apiPatch.mockResolvedValue({ ok: true });
    api.apiPost.mockResolvedValue({ ok: true });
  });

  it('should calculate password strength correctly', () => {
    const { result } = renderHook(() => usePasswordChange());

    act(() => {
      result.current.setPassword('new', 'weak');
    });
    // 'weak' has lowercase and is >= 8 chars is false
    expect(result.current.passwordScore.score).toBe(1);

    act(() => {
      result.current.setPassword('new', 'Stronger123');
    });
    // has lowercase, uppercase, digit, >= 8 chars
    expect(result.current.passwordScore.score).toBe(4);
    expect(result.current.isNewPasswordOK).toBe(true);

    act(() => {
      result.current.setPassword('new', 'EvenStronger123!');
    });
    // has all criteria
    expect(result.current.passwordScore.score).toBe(5);
  });

  it('should call apiPatch when passwords are valid', async () => {
    const { result } = renderHook(() => usePasswordChange());

    act(() => {
      result.current.setPassword('current', 'oldPassword123');
      result.current.setPassword('new', 'NewPassword123!');
      result.current.setPassword('confirm', 'NewPassword123!');
    });

    // Mock successful API call
    api.apiPatch.mockResolvedValue({ ok: true });

    await act(async () => {
      await result.current.doChangePassword();
    });

    expect(api.apiPatch).toHaveBeenCalledWith('/api/users/me/password', {
      current_password: 'oldPassword123',
      new_password: 'NewPassword123!',
    });
    expect(result.current.isChanging).toBe(false);
    // Check if state is reset
    expect(result.current.passwords.current).toBe('');
  });

  it('should not call API if new passwords do not match', async () => {
    const { result } = renderHook(() => usePasswordChange());

    act(() => {
      result.current.setPassword('current', 'oldPassword123');
      result.current.setPassword('new', 'NewPassword123!');
      result.current.setPassword('confirm', 'WrongConfirm123!');
    });

    await act(async () => {
      await result.current.doChangePassword();
    });

    expect(api.apiPatch).not.toHaveBeenCalled();
    expect(result.current.isChanging).toBe(false);
  });
});