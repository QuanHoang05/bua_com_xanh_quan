import { renderHook, act } from '@testing-library/react';
import { useFoodRecommendations } from './useFoodRecommendations';
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

// Mock Geolocation
const mockGeolocation = {
  getCurrentPosition: jest.fn(),
};
global.navigator.geolocation = mockGeolocation;

describe('useFoodRecommendations Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Provide a default mock implementation for apiGet to avoid errors on initial load.
    api.apiGet.mockResolvedValue([]);
  });

  it('should fetch recommendations with correct parameters', async () => {
    const { result } = renderHook(() => useFoodRecommendations());

    // Mock successful API call
    api.apiGet.mockResolvedValue([]);

    await act(async () => {
      await result.current.fetchRecommendations();
    });

    // Default filters
    expect(api.apiGet).toHaveBeenCalledWith(
      '/api/reco/foods?maxKm=5&diet=any&personalize=true&sort=priority&limit=50&lat=&lng='
    );

    // Change a filter and fetch again
    act(() => {
      result.current.setFilter('maxKm', 10);
      result.current.setFilter('diet', 'chay');
    });

    await act(async () => {
      await result.current.fetchRecommendations();
    });

    expect(api.apiGet).toHaveBeenCalledWith(
      '/api/reco/foods?maxKm=10&diet=chay&personalize=true&sort=priority&limit=50&lat=&lng='
    );
  });

  it('should group food items correctly when merge is true', async () => {
    const { result } = renderHook(() => useFoodRecommendations());

    const mockFoodItems = [
      { id: 1, donor_name: 'Donor A', title: 'Cơm Gà', unit: 'hộp', qty: 5, expire_at: '2025-01-01T12:00:00Z' },
      { id: 2, donor_name: 'Donor A', title: 'Cơm Gà', unit: 'hộp', qty: 10, expire_at: '2025-01-01T10:00:00Z' }, // Earlier expiry
      { id: 3, donor_name: 'Donor B', title: 'Cơm Gà', unit: 'hộp', qty: 3 },
      { id: 4, donor_name: 'Donor A', title: 'Bánh Mì', unit: 'cái', qty: 20 },
    ];

    api.apiGet.mockResolvedValue(mockFoodItems);

    // Ensure merge is true (default)
    expect(result.current.filters.merge).toBe(true);

    await act(async () => {
      await result.current.fetchRecommendations();
    });

    const groupedItems = result.current.displayItems;

    expect(groupedItems).toHaveLength(3);

    const comGaDonorA = groupedItems.find(item => item.title === 'Cơm Gà' && item.donor_name === 'Donor A');
    expect(comGaDonorA).toBeDefined();
    expect(comGaDonorA.qty).toBe(15); // 5 + 10
    expect(comGaDonorA.expire_at).toBe('2025-01-01T10:00:00.000Z'); // Should take the earlier date

    const comGaDonorB = groupedItems.find(item => item.title === 'Cơm Gà' && item.donor_name === 'Donor B');
    expect(comGaDonorB).toBeDefined();
    expect(comGaDonorB.qty).toBe(3);

    const banhMi = groupedItems.find(item => item.title === 'Bánh Mì');
    expect(banhMi).toBeDefined();
    expect(banhMi.qty).toBe(20);
  });

  it('should not group food items when merge is false', async () => {
    const { result } = renderHook(() => useFoodRecommendations());

    const mockFoodItems = [
      { id: 1, donor_name: 'Donor A', title: 'Cơm Gà', unit: 'hộp', qty: 5 },
      { id: 2, donor_name: 'Donor A', title: 'Cơm Gà', unit: 'hộp', qty: 10 },
    ];
    api.apiGet.mockResolvedValue(mockFoodItems);

    act(() => {
      result.current.setFilter('merge', false);
    });

    await act(async () => {
      await result.current.fetchRecommendations();
    });

    expect(result.current.displayItems).toHaveLength(2);
  });
});