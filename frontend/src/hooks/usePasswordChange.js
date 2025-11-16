import { useState, useMemo, useCallback } from 'react';
import { apiPatch, apiPost } from '../lib/api';
import { useToast } from '../components/ui/Toast';

// Helper function to score password strength
function validateSetPresence(str, re) { return re.test(str || ""); }
function scorePassword(pw) {
  if (!pw) return { score: 0, hints: ["Thêm ký tự"] };
  let score = 0;
  const hints = [];
  if (pw.length >= 8) score++; else hints.push("≥8 ký tự");
  if (validateSetPresence(pw, /[a-z]/)) score++; else hints.push("có chữ thường");
  if (validateSetPresence(pw, /[A-Z]/)) score++; else hints.push("có chữ hoa");
  if (validateSetPresence(pw, /[0-9]/)) score++; else hints.push("có số");
  if (validateSetPresence(pw, /[^A-Za-z0-9]/)) score++; else hints.push("có ký tự đặc biệt");
  return { score, hints };
}

export function usePasswordChange() {
  const t = useToast();
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
  const [isChanging, setIsChanging] = useState(false);

  const setPassword = (field, value) => {
    setPasswords(p => ({ ...p, [field]: value }));
  };

  const passwordScore = useMemo(() => scorePassword(passwords.new), [passwords.new]);
  const isNewPasswordOK = useMemo(() => passwordScore.score >= 3 && passwords.new.length >= 8, [passwordScore, passwords.new]);
  const passwordsMatch = useMemo(() => passwords.new && passwords.confirm && passwords.new === passwords.confirm, [passwords.new, passwords.confirm]);

  const reset = () => {
    setPasswords({ current: '', new: '', confirm: '' });
  };

  const doChangePassword = useCallback(async () => {
    if (!passwords.current || !passwords.new || !passwords.confirm) {
      t.error("Vui lòng nhập đầy đủ thông tin.");
      return;
    }
    if (!isNewPasswordOK) {
      t.error("Mật khẩu mới chưa đủ mạnh.");
      return;
    }
    if (!passwordsMatch) {
      t.error("Hai mật khẩu mới không khớp.");
      return;
    }

    setIsChanging(true);
    try {
      // Thử endpoint mới trước, fallback về endpoint cũ
      try {
        await apiPatch("/api/users/me/password", {
          current_password: passwords.current,
          new_password: passwords.new,
        });
      } catch (e) {
        if (e.status === 404) { // Endpoint không tồn tại, thử endpoint cũ
          await apiPost("/api/auth/change-password", {
            current_password: passwords.current,
            new_password: passwords.new,
          });
        } else {
          throw e; // Ném lại lỗi nếu không phải 404
        }
      }
      reset();
      t.success("Đã đổi mật khẩu thành công!");
    } catch (err) {
      console.error(err);
      t.error(err.message || "Đổi mật khẩu thất bại. Vui lòng kiểm tra lại mật khẩu hiện tại.");
    } finally {
      setIsChanging(false);
    }
  }, [passwords, isNewPasswordOK, passwordsMatch, t]);

  return { passwords, setPassword, isChanging, doChangePassword, passwordScore, isNewPasswordOK, passwordsMatch };
}