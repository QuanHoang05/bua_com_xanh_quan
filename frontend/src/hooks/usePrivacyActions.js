import { useState, useCallback } from 'react';
import { apiGet, apiPost } from '../lib/api';
import { useToast } from '../components/ui/Toast';
import { useAuth } from '../auth/AuthContext';

export function usePrivacyActions() {
  const t = useToast();
  const { signOut } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);

  const exportData = useCallback(async () => {
    try {
      const blob = await apiGet("/api/users/export", {}, { responseType: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "bua-com-xanh-data.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      t.error("Không tải được dữ liệu.");
    }
  }, [t]);

  const deleteAccount = useCallback(async (confirmText) => {
    if (confirmText !== "XOA TAI KHOAN") {
      t.error('Vui lòng gõ chính xác: "XOA TAI KHOAN"');
      return;
    }
    setIsDeleting(true);
    try {
      await apiPost("/api/users/delete");
      t.info("Tài khoản đã được xóa.");
      signOut();
    } catch (e) {
      t.error("Không xóa được tài khoản.");
    } finally {
      setIsDeleting(false);
    }
  }, [t, signOut]);

  return { exportData, deleteAccount, isDeleting };
}