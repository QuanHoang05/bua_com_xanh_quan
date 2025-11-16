import { renderHook, waitFor } from '@testing-library/react';
import { useAdminDashboard } from './useAdminDashboard';
import { apiGet } from '@/lib/api';

// Mock the api module consistently and completely
jest.mock('@/lib/api', () => ({
  apiGet: jest.fn(),
  apiPost: jest.fn(),
  apiPatch: jest.fn(),
  apiDelete: jest.fn(),
}));

describe('useAdminDashboard Hook', () => {
  beforeEach(() => {
    // Reset mocks before each test to ensure a clean state
    apiGet.mockReset();
  });

  it('should fetch all data in parallel on mount', async () => {
    const mockOverview = { users: { total: 100 } };
    const mockGrowth = [{ date: '2023-01-01', users: 5 }];
    const mockUsers = { items: [{ id: 1, name: 'Test User' }] };
    const mockBookings = { items: [{ id: 1, title: 'Test Booking' }] };

    // Set up the entire mock sequence for this specific test.
    apiGet
      .mockResolvedValueOnce(mockOverview)
      .mockResolvedValueOnce(mockGrowth)
      .mockResolvedValueOnce(mockUsers)
      .mockResolvedValueOnce(mockBookings);

    const { result } = renderHook(() => useAdminDashboard());

    await waitFor(() => {
      // Wait for a specific piece of data to be present, which is more reliable.
      expect(result.current.stats).not.toBeNull();
    });

    expect(apiGet).toHaveBeenCalledWith('/api/admin/stats/overview');
    expect(apiGet).toHaveBeenCalledWith('/api/admin/stats/growth?period=30d');
    expect(apiGet).toHaveBeenCalledWith('/api/admin/users?limit=5&sortBy=created_at');
    expect(apiGet).toHaveBeenCalledWith('/api/admin/bookings?limit=5&sortBy=created_at');

    expect(result.current.loading).toBe(false);
    expect(result.current.stats).toEqual({ users: { total: 100 } });
    expect(result.current.recentUsers).toHaveLength(1);
    expect(result.current.recentBookings).toHaveLength(1);
  });

  it('should process chart data correctly', async () => {
    const mockChartData = [
      { date: '2023-10-26T00:00:00.000Z', users: 5 },
      { date: '2023-10-27T00:00:00.000Z', users: 8 },
    ];
    const mockOverview = { users: { total: 0 } };
    const mockUsers = { items: [] };
    const mockBookings = { items: [] };

    // Set up the entire mock sequence for this specific test.
    // We reset the mock to clear the default queue from beforeEach.
    apiGet
      .mockResolvedValueOnce(mockOverview)
      .mockResolvedValueOnce(mockChartData)
      .mockResolvedValueOnce(mockUsers)
      .mockResolvedValueOnce(mockBookings);
    const { result } = renderHook(() => useAdminDashboard());

    await waitFor(() => {
      expect(result.current.chartData.length).toBeGreaterThan(0);
    });

    const processedData = result.current.chartData;
    expect(processedData).toHaveLength(2);
    expect(processedData[0]).toEqual({ date: '26/10', value: 5 });
    expect(processedData[1]).toEqual({ date: '27/10', value: 8 });
  });
});