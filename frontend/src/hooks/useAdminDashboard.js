import { useEffect, useMemo, useState } from "react";
import { apiGet } from "@/lib/api";

const toNum = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

function processChartData(data = [], key = "users") {
  if (!Array.isArray(data) || !data.length) return [];
  
  const processed = data.map(item => ({
    date: new Date(item.date).toLocaleDateString('vi-VN', { month: 'numeric', day: 'numeric' }),
    value: toNum(item[key] ?? item.count ?? item.total, 0),
  }));

  // Fill missing dates if necessary (optional but good for continuous charts)
  // For simplicity, we'll assume the backend provides continuous data for now.

  return processed;
}

export function useAdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [stats, setStats] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [recentUsers, setRecentUsers] = useState([]);
  const [recentBookings, setRecentBookings] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [
          statsRes,
          chartRes,
          usersRes,
          bookingsRes
        ] = await Promise.allSettled([
          apiGet("/api/admin/stats/overview"),
          apiGet("/api/admin/stats/growth?period=30d"),
          apiGet("/api/admin/users?limit=5&sortBy=created_at"),
          apiGet("/api/admin/bookings?limit=5&sortBy=created_at"),
        ]);

        if (statsRes.status === 'fulfilled') {
          setStats(statsRes.value);
        }

        if (chartRes.status === 'fulfilled') {
          setChartData(chartRes.value);
        }

        if (usersRes.status === 'fulfilled') {
          setRecentUsers(usersRes.value.items || usersRes.value || []);
        }

        if (bookingsRes.status === 'fulfilled') {
          setRecentBookings(bookingsRes.value.items || bookingsRes.value || []);
        }

      } catch (e) {
        setError("Failed to load dashboard data.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const processedChartData = useMemo(() => processChartData(chartData, 'users'), [chartData]);

  return { loading, error, stats, recentUsers, recentBookings, chartData: processedChartData };
}