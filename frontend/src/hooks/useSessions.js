import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost } from '../lib/api';
import { useToast } from '../components/ui/Toast';

export function useSessions() {
  const t = useToast();
  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadSessions = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await apiGet("/api/users/sessions");
      setSessions(Array.isArray(list) ? list : []);
    } catch {
      // Endpoint này có thể không tồn tại, không cần báo lỗi
      setSessions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const logoutOthers = useCallback(async () => {
    try {
      await apiPost("/api/users/logout-others");
      t.success("Đã đăng xuất các phiên khác thành công.");
      loadSessions(); // Tải lại danh sách
    } catch (e) {
      t.error("Không thể đăng xuất các phiên khác.");
    }
  }, [t, loadSessions]);

  return { sessions, isLoading, logoutOthers };
}