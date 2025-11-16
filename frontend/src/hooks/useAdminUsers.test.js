import { renderHook, act, waitFor } from '@testing-library/react';
import { useAdminUsers } from './useAdminUsers';
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
  }),
}));

describe('useAdminUsers Hook', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    // Provide a default mock implementation for apiGet to avoid errors on initial load
    api.apiGet.mockResolvedValue({ items: [], total: 0 });
  });

  it('should fetch users on initial render with default parameters', async () => {
    renderHook(() => useAdminUsers());

    await waitFor(() => {
      expect(api.apiGet).toHaveBeenCalledTimes(1);
    });

    expect(api.apiGet).toHaveBeenCalledTimes(1);
    expect(api.apiGet).toHaveBeenCalledWith(
      '/api/admin/users?page=1&pageSize=15&q=&role=&status=&sortBy=created_at&order=desc'
    );
  });

  it('should refetch when page changes', async () => {
    const { result } = renderHook(() => useAdminUsers());

    await waitFor(() => {
      expect(api.apiGet).toHaveBeenCalledTimes(1);
    }); // Initial fetch

    act(() => {
      result.current.setPagination(p => ({ ...p, page: 2 }));
    });

    await waitFor(() => expect(api.apiGet).toHaveBeenCalledTimes(2));

    expect(api.apiGet).toHaveBeenCalledTimes(2);
    expect(api.apiGet).toHaveBeenLastCalledWith(
      '/api/admin/users?page=2&pageSize=15&q=&role=&status=&sortBy=created_at&order=desc'
    );
  });

  it('should debounce search query', async () => {
    jest.useFakeTimers(); // Activate fake timers for this test

    const { result } = renderHook(() => useAdminUsers());

    // Wait for the initial fetch to complete
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(api.apiGet).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.setFilters(f => ({ ...f, q: 'test' }));
    });

    // API should NOT be called again immediately
    expect(api.apiGet).toHaveBeenCalledTimes(1);

    // Fast-forward time past the 350ms debounce delay
    act(() => { jest.advanceTimersByTime(350); });

    // Now, the API should have been called a second time
    await waitFor(() => expect(api.apiGet).toHaveBeenCalledTimes(2));
    expect(api.apiGet).toHaveBeenLastCalledWith(
      '/api/admin/users?page=1&pageSize=15&q=test&role=&status=&sortBy=created_at&order=desc'
    );

    jest.useRealTimers(); // Restore real timers
  });

  it('should call apiPost on createUser and refresh list', async () => {
    const { result } = renderHook(() => useAdminUsers());

    await waitFor(() => {
      expect(api.apiGet).toHaveBeenCalledTimes(1);
    }); // Wait for initial load
    const newUser = { name: 'New User', email: 'new@test.com' };

    api.apiPost.mockResolvedValue({ id: 123, ...newUser });

    await act(async () => {
      await result.current.createUser(newUser);
    });

    expect(api.apiPost).toHaveBeenCalledWith('/api/admin/users', newUser);
    expect(api.apiGet).toHaveBeenCalledTimes(2); // Initial load + refresh
  });

  it('should call apiDelete on deleteUser and refresh list', async () => {
    const { result } = renderHook(() => useAdminUsers());

    await waitFor(() => {
      expect(api.apiGet).toHaveBeenCalledTimes(1);
    }); // Wait for initial load
    const userIdToDelete = 'user-1';

    api.apiDelete.mockResolvedValue({ ok: true });

    await act(async () => {
      await result.current.deleteUser(userIdToDelete);
    });

    expect(api.apiDelete).toHaveBeenCalledWith(`/api/admin/users/${userIdToDelete}?mode=soft`);
    expect(api.apiGet).toHaveBeenCalledTimes(2); // Initial load + refresh
  });

  it('should call apiPatch on updateUser and refresh list', async () => {
    const { result } = renderHook(() => useAdminUsers());

    await waitFor(() => {
      expect(api.apiGet).toHaveBeenCalledTimes(1);
    }); // Wait for initial load

    const userIdToUpdate = 'user-2';
    const updatedData = { name: 'Updated Name' };

    api.apiPatch.mockResolvedValue({ id: userIdToUpdate, ...updatedData });

    await act(async () => {
      await result.current.updateUser(userIdToUpdate, updatedData);
    });

    expect(api.apiPatch).toHaveBeenCalledWith(`/api/admin/users/${userIdToUpdate}`, updatedData);
    expect(api.apiGet).toHaveBeenCalledTimes(2); // Initial load + refresh
  });
});