import { useState, useEffect, useCallback, useMemo } from "react";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
}

export function useAdminUsers(initialPageSize = 15) {
  const t = useToast();
  const [data, setData] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [filters, setFilters] = useState({
    q: "",
    role: "all",
    status: "all",
  });
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: initialPageSize,
  });

  const debouncedQ = useDebounce(filters.q, 350);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        page: pagination.page,
        pageSize: pagination.pageSize,
        q: debouncedQ.trim(),
        role: filters.role === "all" ? "" : filters.role,
        status: filters.status === "all" ? "" : filters.status,
        sortBy: "created_at",
        order: "desc",
      });

      const res = await apiGet(`/api/admin/users?${params.toString()}`);
      setData({
        items: res.items || [],
        total: res.total || 0,
      });
    } catch (e) {
      setError(e.message || "Không thể tải danh sách người dùng.");
      t.error(e.message || "Không thể tải danh sách người dùng.");
    } finally {
      setLoading(false);
    }
  }, [pagination, debouncedQ, filters.role, filters.status]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(data.total / pagination.pageSize)),
    [data.total, pagination.pageSize]
  );

  const createUser = async (userData) => {
    await apiPost("/api/admin/users", userData);
    t.success("Tạo người dùng thành công!");
    loadUsers();
  };

  const updateUser = async (userId, userData) => {
    await apiPatch(`/api/admin/users/${userId}`, userData);
    t.success("Cập nhật người dùng thành công!");
    loadUsers();
  };

  const deleteUser = async (userId) => {
    await apiDelete(`/api/admin/users/${userId}?mode=soft`);
    t.success("Đã xóa (mềm) người dùng.");
    loadUsers();
  };

  return {
    users: data.items,
    totalUsers: data.total,
    loading,
    error,
    filters, setFilters,
    pagination, setPagination, totalPages,
    createUser, updateUser, deleteUser,
    refresh: loadUsers,
  };
}