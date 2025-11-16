import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPatch } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../components/ui/Toast';

const initialProfile = {
  name: "", email: "", phone: "", address: "",
  avatar_url: "", lat: null, lng: null,
};

export function useProfile() {
  const { setUser } = useAuth();
  const t = useToast();

  const [profile, setProfile] = useState(initialProfile);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    try {
      const me = await apiGet("/api/users/me");
      const next = {
        name: me?.name ?? "", email: me?.email ?? "", phone: me?.phone ?? "",
        address: me?.address ?? "", avatar_url: me?.avatar_url ?? "",
        lat: me?.lat ?? null, lng: me?.lng ?? null,
      };
      setProfile(next);
      setUser(me); // Cập nhật global user context
    } catch (e) {
      console.error(e);
      t.error("Không tải được hồ sơ. Bạn có thể cần đăng nhập lại.");
    } finally {
      setIsLoading(false);
    }
  }, [setUser, t]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const setProfileField = useCallback((field, value) => {
    setProfile(p => ({ ...p, [field]: value }));
  }, []);

  const saveProfile = useCallback(async () => {
    setIsSaving(true);
    try {
      await apiPatch("/api/users/me", profile);
      await loadProfile(); // Tải lại để đảm bảo dữ liệu đồng bộ
      t.success("Đã cập nhật thông tin cá nhân");
    } catch (err) {
      console.error(err);
      t.error("Cập nhật thất bại");
    } finally {
      setIsSaving(false);
    }
  }, [profile, loadProfile, t]);

  return { profile, isLoading, isSaving, saveProfile, setProfileField };
}