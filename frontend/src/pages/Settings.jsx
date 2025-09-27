// src/pages/Settings.jsx
import { useEffect, useMemo, useState, useRef } from "react";
import { useAuth } from "../auth/AuthContext";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { API_BASE, apiGet } from "../lib/api";
import { useToast } from "../components/ui/Toast";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail, Lock, User, Phone, Image, MapPin, LocateFixed, LogOut, ShieldCheck,
  History, Download, Trash2, ArrowRight, Globe, Loader2, Eye, EyeOff,
  UserCog, Shield, ListChecks, FileLock2, UploadCloud,
  KeyRound, AlertTriangle, Activity, Home, ChevronRight,
  Copy, Compass, Crosshair, MapPinned, CheckCircle2, Clock, XCircle
} from "lucide-react";

/** ==============================
 *  SETTINGS HUB — UI nâng cấp
 *  ============================== */
export default function Settings() {
  const { setUser, signOut } = useAuth();
  const t = useToast();
  const nav = useNavigate();

  /* ===== STATE ===== */
  const [tab, setTab] = useState("activity"); // 'profile' | 'security' | 'activity' | 'privacy'
  const [isEditing, setIsEditing] = useState(false);
  const [snapshot, setSnapshot] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "", email: "", phone: "", address: "",
    avatar_url: "", lat: null, lng: null,
  });

  // --- Password change states ---
  const [curPw, setCurPw] = useState("");
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [changing, setChanging] = useState(false);
  const [showCur, setShowCur] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [confirmPwOpen, setConfirmPwOpen] = useState(false);

  // --- Geolocation states ---
  const [locating, setLocating] = useState(false);
  const [locAccuracy, setLocAccuracy] = useState(null); // meters
  const watchIdRef = useRef(null);

  const [sessions, setSessions] = useState([]);
  const [sessLoading, setSessLoading] = useState(false);

  // lịch sử từ API: {given:[], received:[], payments:[]}
  const [history, setHistory] = useState({ given: [], received: [], payments: [] });
  const [histLoading, setHistLoading] = useState(false);

  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  /* ===== HELPERS ===== */
  function setField(k, v) { setForm((s) => ({ ...s, [k]: v })); }
  const avatar = useMemo(() => (
    form.avatar_url?.trim() ? form.avatar_url : "https://i.pravatar.cc/160?img=12"
  ), [form.avatar_url]);

  function startEdit() { setSnapshot(form); setIsEditing(true); }
  function cancelEdit() { if (snapshot) setForm(snapshot); setIsEditing(false); }
  const disabled = !isEditing || profileLoading;

  const passwordScore = useMemo(() => scorePassword(pw1), [pw1]);
  const passwordOK = passwordScore.score >= 3 && pw1.length >= 8;
  const passwordsMatch = pw1 && pw2 && pw1 === pw2;

  // 🎯 Button styles (đậm nét, rõ ràng)
  const btnPrimary =
    "rounded-full font-semibold border ring-1 border-emerald-600 ring-emerald-600 " +
    "bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 " +
    "shadow-[0_8px_24px_rgba(16,185,129,0.28)] hover:shadow-[0_12px_28px_rgba(16,185,129,0.36)] " +
    "transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed";
  const btnSecondary =
    "rounded-full font-semibold border ring-1 border-slate-300 ring-slate-300 text-slate-800 " +
    "bg-white hover:bg-slate-50 active:bg-slate-100 transition-all duration-200 " +
    "disabled:opacity-60 disabled:cursor-not-allowed";

  /* ===== LOADERS ===== */
  async function loadProfile() {
    setProfileLoading(true);
    try {
      const me = await apiGet("/api/users/me");
      const next = {
        name: me?.name ?? "", email: me?.email ?? "", phone: me?.phone ?? "",
        address: me?.address ?? "", avatar_url: me?.avatar_url ?? "",
        lat: me?.lat ?? null, lng: me?.lng ?? null,
      };
      setForm(next); setUser(me); setSnapshot(next); setIsEditing(false);
    } catch (e) { console.error(e); t.error("Không tải được hồ sơ. Bạn có thể cần đăng nhập lại."); }
    finally { setProfileLoading(false); }
  }
  useEffect(() => { loadProfile(); /* eslint-disable-next-line */ }, []);

  async function loadSessions() {
    setSessLoading(true);
    try { const list = await apiGet("/api/users/sessions"); setSessions(Array.isArray(list) ? list : []); }
    catch { /* optional */ }
    finally { setSessLoading(false); }
  }
  useEffect(() => { loadSessions(); }, []);

  // Lịch sử: chuẩn hoá nhiều dạng dữ liệu để hiển thị đúng
  useEffect(() => {
    (async () => {
      setHistLoading(true);
      try {
        const data = await apiGet("/api/users/history?limit=8");
        const hist = {
          given: normalizeGiven(data?.given ?? []),
          received: normalizeReceived(data?.received ?? []),
          payments: normalizePayments(data?.payments ?? data?.donations ?? []), // fallback donations
        };
        setHistory(hist);
      } catch (e) {
        console.error(e);
        t.error("Không tải được lịch sử hoạt động");
        setHistory({ given: [], received: [], payments: [] });
      } finally {
        setHistLoading(false);
      }
    })();
  }, []);

  /* ===== ACTIONS ===== */
  async function onSaveProfile(e) {
    e?.preventDefault?.();
    setSaving(true);
    try {
      const token = localStorage.getItem("bua_token") || sessionStorage.getItem("bua_token");
      const res = await fetch(`${API_BASE}/api/users/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          name: form.name?.trim(), phone: form.phone?.trim(), address: form.address?.trim(),
          avatar_url: form.avatar_url?.trim(), lat: form.lat, lng: form.lng,
        }),
      });
      if (!res.ok) throw new Error(`Save failed: ${res.status}`);
      await loadProfile(); t.success("Đã cập nhật thông tin cá nhân");
    } catch (err) { console.error(err); t.error("Cập nhật thất bại"); }
    finally { setSaving(false); }
  }

  async function onPickAvatar(file) {
    if (!isEditing || !file) return;
    try {
      const token = localStorage.getItem("bua_token") || sessionStorage.getItem("bua_token");
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch(`${API_BASE}/api/upload`, {
        method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : undefined, body: fd,
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      if (!data?.url) throw new Error("No url");
      setField("avatar_url", data.url);
      t.success("Tải ảnh thành công. Nhớ bấm 'Lưu thay đổi' để lưu vào hồ sơ.");
    } catch (e) { console.error(e); t.error("Upload ảnh thất bại (kiểm tra API /api/upload)"); }
  }

  // ---- Improved Geolocation (permission preflight + watch for better accuracy) ----
  async function detectLocation() {
    if (!isEditing) return;
    if (!navigator.geolocation) { t.error("Trình duyệt không hỗ trợ định vị"); return; }
    setLocating(true); setLocAccuracy(null);

    try {
      const perm = await getGeoPermissionState();
      if (perm === "denied") {
        setLocating(false);
        t.error("Bạn đã chặn quyền định vị. Hãy bật lại quyền Location cho trình duyệt.");
        return;
      }
      const first = await getPositionOnce({ enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
      applyPosition(first);
      await refinePosition(8000, 20);
      t.success("Đã lấy vị trí hiện tại");
    } catch (err) {
      console.error(err);
      t.error("Không lấy được vị trí");
    } finally {
      clearWatch();
      setLocating(false);
    }
  }

  function applyPosition(pos) {
    if (!pos?.coords) return;
    const { latitude, longitude, accuracy } = pos.coords;
    setField("lat", Number(latitude.toFixed(6)));
    setField("lng", Number(longitude.toFixed(6)));
    setLocAccuracy(Math.round(accuracy));
  }

  async function refinePosition(maxMs = 8000, targetAcc = 20) {
    if (!navigator.geolocation) return;
    clearWatch();
    const start = Date.now();
    return new Promise((resolve) => {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (p) => {
          applyPosition(p);
          if (p?.coords?.accuracy && p.coords.accuracy <= targetAcc) resolve();
          else if (Date.now() - start > maxMs) resolve();
        },
        () => resolve(),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
      );
    });
  }
  function clearWatch() {
    if (watchIdRef.current != null && navigator.geolocation?.clearWatch) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }

  async function logoutOthers() {
    try {
      const token = localStorage.getItem("bua_token") || sessionStorage.getItem("bua_token");
      const res = await fetch(`${API_BASE}/api/users/logout-others`, {
        method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) throw new Error("logout-others failed");
      t.success("Đã đăng xuất các phiên khác"); loadSessions();
    } catch (e) { console.error(e); t.error("Không thể đăng xuất các phiên khác"); }
  }

  async function exportData() {
    try {
      const token = localStorage.getItem("bua_token") || sessionStorage.getItem("bua_token");
      const r = await fetch(`${API_BASE}/api/users/export`, {
        method: "GET", headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!r.ok) throw new Error("Export failed");
      const blob = await r.blob(); const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = "bua-com-xanh-data.json"; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { console.error(e); t.error("Không tải được dữ liệu (kiểm tra API /api/users/export)"); }
  }

  async function deleteAccount() {
    if (confirmText !== "XOA TAI KHOAN") { t.error('Vui lòng gõ chính xác: "XOA TAI KHOAN"'); return; }
    setDeleting(true);
    try {
      const token = localStorage.getItem("bua_token") || sessionStorage.getItem("bua_token");
      const r = await fetch(`${API_BASE}/api/users/delete`, {
        method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!r.ok) throw new Error("Delete failed");
      t.info("Tài khoản đã được xóa"); signOut();
    } catch (e) { console.error(e); t.error("Không xóa được (kiểm tra API /api/users/delete)"); }
    finally { setDeleting(false); }
  }

  // ---- Change password with current password + confirmation dialog ----
  async function changePassword() {
    if (!curPw || !pw1 || !pw2) { t.error("Vui lòng nhập đầy đủ: mật khẩu hiện tại và mật khẩu mới (2 lần)"); return; }
    if (!passwordOK) { t.error("Mật khẩu mới chưa đủ mạnh (ít nhất 8 ký tự, gồm chữ hoa, chữ thường, số/ký tự đặc biệt)"); return; }
    if (!passwordsMatch) { t.error("Hai mật khẩu mới chưa khớp"); return; }
    setConfirmPwOpen(true);
  }

  async function doChangePassword() {
    setChanging(true);
    setConfirmPwOpen(false);
    const token = localStorage.getItem("bua_token") || sessionStorage.getItem("bua_token");
    try {
      let res = await fetch(`${API_BASE}/api/users/me/password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ current_password: curPw, new_password: pw1 }),
      });
      if (!res.ok) {
        res = await fetch(`${API_BASE}/api/auth/change-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ current_password: curPw, new_password: pw1 }),
        });
      }
      if (!res.ok) throw new Error(`Change password failed: ${res.status}`);
      setCurPw(""); setPw1(""); setPw2("");
      t.success("Đã đổi mật khẩu. Bạn có thể sẽ cần đăng nhập lại.");
    } catch (e) { console.error(e); t.error("Đổi mật khẩu thất bại. Hãy kiểm tra mật khẩu hiện tại hoặc thử lại."); }
    finally { setChanging(false); }
  }

  /* ===== ANIM ===== */
  const fadeUp = { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.35, ease: "easeOut" } };
  const fadeIn = { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.25 } };

  /* ===== VIEW ===== */
  return (
    <motion.div {...fadeIn} className="max-w-6xl mx-auto p-6 md:p-8">
      {/* Header */}
      <motion.div {...fadeUp} className="mb-6 md:mb-8">
        <div className="flex items-center gap-3 text-slate-500 text-sm md:text-base">
          <Home size={16} /> <ChevronRight size={16} /> <span className="font-medium">Cài đặt</span>
        </div>
        <div className="mt-3 md:mt-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={avatar} alt="avatar" className="h-14 w-14 md:h-16 md:w-16 rounded-full object-cover ring-2 ring-white border shadow-sm" />
            <div>
              <div className="text-xl md:text-2xl font-bold tracking-tight text-slate-900">{form.name || "Người dùng"}</div>
              <div className="text-sm md:text-base text-slate-700">{form.email || "—"}</div>
            </div>
          </div>

          {/* Quick actions */}
          <div className="hidden sm:flex flex-wrap gap-3">
            <QuickActionButton icon={KeyRound} onClick={() => setTab("security")} variant="primary">
              Đổi mật khẩu
            </QuickActionButton>
            <QuickActionButton icon={Download} onClick={() => setTab("privacy")} variant="secondary">
              Tải dữ liệu
            </QuickActionButton>
            <QuickActionButton icon={Activity} onClick={() => setTab("activity")} variant="secondary">
              Xem hoạt động
            </QuickActionButton>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-[260px_minmax(0,1fr)] gap-6 md:gap-8">
        {/* Sidebar */}
        <aside className="md:sticky md:top-6 h-fit justify-self-start md:-ml-2">
          <motion.div {...fadeUp}>
            <Card className="w-[240px] md:w-[260px] p-2 md:p-3 rounded-2xl shadow-lg bg-white border border-slate-200">
              <SidebarItem active={tab === "profile"} icon={UserCog} label="Hồ sơ cá nhân" desc="Tên, ảnh, địa chỉ, vị trí" onClick={() => setTab("profile")} />
              <SidebarItem active={tab === "security"} icon={Shield} label="Bảo mật & Đăng nhập" desc="Mật khẩu, phiên đăng nhập" onClick={() => setTab("security")} />
              <SidebarItem active={tab === "activity"} icon={ListChecks} label="Hoạt động" desc="Đã cho, đã nhận, giao dịch" onClick={() => setTab("activity")} />
              <SidebarItem active={tab === "privacy"} icon={FileLock2} label="Quyền riêng tư & TK" desc="Xuất dữ liệu, xóa tài khoản" onClick={() => setTab("privacy")} />
            </Card>
          </motion.div>
        </aside>

        {/* Content */}
        <section className="space-y-6 md:space-y-8">
          <AnimatePresence mode="wait">
            {tab === "profile" && (
              <motion.div key="tab-profile" {...fadeUp} exit={{ opacity: 0, y: 10 }}>
                <Card className="p-6 md:p-8 border rounded-2xl shadow-xl bg-white">
                  <div className="flex items-center justify-between mb-5">
                    <div className="text-xl md:text-2xl font-bold text-slate-900">Hồ sơ cá nhân</div>
                    <div className="flex items-center gap-2">
                      {!isEditing ? (
                        <Button type="button" onClick={startEdit} className={`${btnPrimary} px-5 py-2`}>Chỉnh sửa</Button>
                      ) : (
                        <>
                          <Button type="button" variant="secondary" onClick={cancelEdit} className={`${btnSecondary} px-5 py-2 !text-red-600 hover:bg-red-50`}>
                            Hủy
                          </Button>
                          <Button type="button" onClick={onSaveProfile} disabled={saving} className={`${btnPrimary} px-5 py-2`}>
                            {saving ? "Đang lưu..." : "Lưu thay đổi"}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {profileLoading ? (
                    <SkeletonProfile />
                  ) : (
                    <form onSubmit={onSaveProfile} className="space-y-6">
                      {/* Avatar + Upload */}
                      <div className="flex flex-col sm:flex-row sm:items-center gap-5">
                        <img src={avatar} alt="avatar" className="h-20 w-20 rounded-full object-cover border shadow" />
                        <div className="flex flex-1 items-center gap-3">
                          <input
                            className="input w-full sm:w-[360px] !text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                            placeholder="https://..."
                            value={form.avatar_url}
                            onChange={(e) => setField("avatar_url", e.target.value)}
                            disabled={disabled}
                          />
                          <label className={`inline-flex ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}>
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => onPickAvatar(e.target.files?.[0])} disabled={disabled} />
                            <span className="px-4 py-2 border rounded-full font-semibold text-emerald-700 hover:text-emerald-800 ring-1 ring-emerald-300">
                              <span className="inline-flex items-center gap-2"><UploadCloud size={16} /> Tải ảnh</span>
                            </span>
                          </label>
                        </div>
                      </div>

                      {/* Basic fields */}
                      <div className="grid md:grid-cols-2 gap-5">
                        <LabeledInput icon={User} label="Họ và tên" value={form.name} onChange={(e) => setField("name", e.target.value)} disabled={disabled} required />
                        <LabeledInput icon={Mail} label="Email" value={form.email} disabled readOnly extraClass="bg-gray-100 cursor-not-allowed" />
                      </div>

                      <div className="grid md:grid-cols-2 gap-5">
                        <LabeledInput icon={Phone} label="Số điện thoại" value={form.phone} onChange={(e) => setField("phone", e.target.value)} disabled={disabled} />
                        <LabeledInput icon={Image} label="Ảnh đại diện (URL)" value={form.avatar_url} onChange={(e) => setField("avatar_url", e.target.value)} disabled={disabled} />
                      </div>

                      <div>
                        <label className="text-sm font-semibold text-slate-800 mb-1 block">Địa chỉ</label>
                        <textarea className="input w-full !text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                          value={form.address} onChange={(e) => setField("address", e.target.value)} disabled={disabled} />
                      </div>

                      {/* Location */}
                      <LocationRow
                        disabled={disabled}
                        locating={locating}
                        accuracy={locAccuracy}
                        lat={form.lat}
                        lng={form.lng}
                        onDetect={detectLocation}
                        onChangeLat={(v) => setField("lat", v === "" ? null : Number(v))}
                        onChangeLng={(v) => setField("lng", v === "" ? null : Number(v))}
                        btnSecondary={btnSecondary}
                      />
                    </form>
                  )}
                </Card>
              </motion.div>
            )}

            {tab === "security" && (
              <motion.div key="tab-security" {...fadeUp} exit={{ opacity: 0, y: 10 }}>
                <Card className="p-6 md:p-8 border rounded-2xl shadow-xl bg-white">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xl md:text-2xl font-bold text-slate-900">Bảo mật & Đăng nhập</div>
                    <div className="text-sm md:text-base font-medium text-slate-700 flex items-center gap-2">
                      <ShieldCheck size={16} /> Thông tin được bảo vệ
                    </div>
                  </div>
                  <p className="text-slate-700 text-sm md:text-base mb-5">
                    Để đổi mật khẩu, vui lòng nhập <b>mật khẩu hiện tại</b> và <b>mật khẩu mới</b> (2 lần). Sau khi đổi thành công, bạn có thể sẽ cần đăng nhập lại.
                  </p>

                  <div className="grid lg:grid-cols-2 gap-8">
                    {/* Change password */}
                    <div className="space-y-3">
                      <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                        <Lock size={16} /> Đổi mật khẩu
                      </label>

                      <div className="space-y-3">
                        <PasswordInput value={curPw} onChange={setCurPw} show={showCur} setShow={setShowCur}
                          placeholder="Mật khẩu hiện tại" />

                        <div className="space-y-2">
                          <PasswordInput value={pw1} onChange={setPw1} show={showPw} setShow={setShowPw}
                            placeholder="Mật khẩu mới (tối thiểu 8 ký tự)" />
                          <PasswordStrengthBar score={passwordScore.score} hints={passwordScore.hints} />
                        </div>

                        <PasswordInput value={pw2} onChange={setPw2} show={showPw2} setShow={setShowPw2}
                          placeholder="Nhập lại mật khẩu mới" />
                        {!!pw2 && !passwordsMatch && (<p className="text-xs text-red-600">Hai mật khẩu mới chưa khớp</p>)}
                      </div>

                      <Button onClick={changePassword} disabled={changing} className={`${btnPrimary} px-5 py-2 inline-flex items-center gap-2`}>
                        {changing ? <Loader2 className="animate-spin" size={16} /> : <ShieldCheck size={16} />}
                        {changing ? "Đang xử lý..." : "Đổi mật khẩu"}
                      </Button>
                      <p className="text-xs text-slate-600">Mẹo: dùng cụm từ dài + số/ký tự đặc biệt để mạnh hơn.</p>
                    </div>

                    {/* Sessions */}
                    <div className="space-y-3">
                      <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                        <LogOut size={16} /> Phiên đăng nhập
                      </label>
                      <div className="rounded-xl border p-4 bg-gray-50">
                        <div className="text-sm md:text-base font-medium text-slate-800 mb-2">
                          {sessLoading ? "Đang tải phiên..." : "Phiên hiện tại và các thiết bị đã đăng nhập:"}
                        </div>
                        <ul className="space-y-1 max-h-40 overflow-auto pr-1">
                          {(sessions ?? []).map((s) => (
                            <li key={s.id} className="text-sm md:text-base">
                              <span className={s.current ? "font-semibold text-slate-900" : "text-slate-800"}>
                                {s.device || "Thiết bị"} – {s.ip || "?"} – {s.last_seen || ""}{s.current ? " (hiện tại)" : ""}
                              </span>
                            </li>
                          ))}
                          {!sessions?.length && !sessLoading && (
                            <li className="text-sm text-slate-600">Không có dữ liệu phiên (API tùy chọn).</li>
                          )}
                        </ul>
                        <div className="pt-3">
                          <Button variant="secondary" onClick={logoutOthers} className={`${btnSecondary} px-5 py-2`}>
                            Đăng xuất tất cả phiên khác
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Confirm dialog */}
                  {confirmPwOpen && (
                    <ConfirmDialog
                      title="Xác nhận đổi mật khẩu"
                      desc="Bạn có chắc chắn muốn đổi mật khẩu? Bạn có thể sẽ phải đăng nhập lại."
                      onCancel={() => setConfirmPwOpen(false)}
                      onConfirm={doChangePassword}
                    />
                  )}
                </Card>
              </motion.div>
            )}

            {tab === "activity" && (
              <motion.div key="tab-activity" {...fadeUp} exit={{ opacity: 0, y: 10 }}>
                <Card className="p-6 md:p-8 border rounded-2xl shadow-xl bg-white">
                  <div className="flex items-center justify-between">
                    <div className="text-xl md:text-2xl font-bold text-slate-900">Lịch sử hoạt động</div>
                    <History size={20} className="text-slate-700" />
                  </div>

                  {histLoading ? (
                    <SkeletonHistory />
                  ) : (
                    <div className="grid lg:grid-cols-3 gap-6 mt-5">
                      <SectionList
                        title="Món đã cho"
                        rows={(history.given || []).slice(0, 6)}
                        empty="Chưa có món đã cho"
                        link={{ to: "/donors", label: "Xem tất cả" }}
                      />
                      <SectionList
                        title="Món đã nhận"
                        rows={(history.received || []).slice(0, 6)}
                        empty="Chưa có món đã nhận"
                        link={{ to: "/recipients", label: "Xem tất cả" }}
                      />
                      <SectionList
                        title="Giao dịch"
                        rows={(history.payments || []).slice(0, 6)}
                        empty="Chưa có giao dịch"
                        link={{ to: "/reports", label: "Xem báo cáo" }}
                      />
                    </div>
                  )}
                </Card>
              </motion.div>
            )}

            {tab === "privacy" && (
              <motion.div key="tab-privacy" {...fadeUp} exit={{ opacity: 0, y: 10 }}>
                <Card className="p-6 md:p-8 border rounded-2xl shadow-xl bg-white">
                  <div className="text-xl md:text-2xl font-bold text-slate-900 mb-2">Quyền riêng tư & Tài khoản</div>
                  <p className="text-sm md:text-base font-medium text-slate-700 mb-5">Bạn có thể tải dữ liệu hoặc xóa tài khoản của mình.</p>

                  <div className="flex flex-wrap gap-3">
                    <Button onClick={exportData} className={`${btnPrimary} px-5 py-2 inline-flex items-center gap-2`}>
                      <Download size={16} /> Tải dữ liệu của tôi
                    </Button>
                    <DangerButton onClick={() => document.getElementById("delete-dlg").showModal()}>
                      <Trash2 size={16} /> Xóa tài khoản
                    </DangerButton>
                  </div>

                  <dialog id="delete-dlg" className="rounded-2xl p-0">
                    <div className="p-6 w-[min(92vw,520px)]">
                      <div className="text-lg md:text-xl font-bold text-slate-900 mb-1">Xóa tài khoản</div>
                      <p className="text-sm text-red-600 mb-3 flex items-center gap-2">
                        <AlertTriangle size={16} /> Hành động này không thể hoàn tác. Dữ liệu của bạn sẽ bị xóa vĩnh viễn.
                      </p>
                      <p className="text-sm text-slate-700 mb-3">
                        Gõ <span className="font-mono bg-gray-100 px-1 py-0.5 rounded">XOA TAI KHOAN</span> để xác nhận.
                      </p>
                      <input
                        className="input w-full mb-4 !text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                        value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="XOA TAI KHOAN"
                      />
                      <div className="flex items-center justify-end gap-3">
                        <Button variant="secondary" onClick={() => document.getElementById("delete-dlg").close()} className={`${btnSecondary} px-5 py-2`}>Hủy</Button>
                        <DangerButton onClick={deleteAccount} disabled={deleting}>
                          {deleting ? "Đang xóa..." : "Xóa vĩnh viễn"}
                        </DangerButton>
                      </div>
                    </div>
                  </dialog>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </div>
    </motion.div>
  );
}

/* ===================== Reusable UI ===================== */

// Nút quick action riêng để đảm bảo hover/active đổi màu rõ ràng
function QuickActionButton({ icon: Icon, children, onClick, variant = "primary" }) {
  const base =
    "inline-flex items-center gap-2 px-5 py-2 rounded-full font-semibold border shadow-sm " +
    "transition-colors duration-150 focus-visible:outline-none";
  const variants = {
    primary:
      "bg-emerald-600 text-white border-emerald-600 " +
      "hover:bg-emerald-700 active:bg-emerald-800 " +
      "focus-visible:ring-2 focus-visible:ring-emerald-400",
    secondary:
      "bg-white text-slate-800 border-slate-300 " +
      "hover:bg-slate-50 active:bg-slate-100 " +
      "focus-visible:ring-2 focus-visible:ring-slate-300",
  };
  return (
    <motion.button type="button" whileTap={{ scale: 0.98 }} onClick={onClick} className={`${base} ${variants[variant]}`}>
      {Icon ? <Icon size={16} /> : null}
      {children}
    </motion.button>
  );
}

function SidebarItem({ active, icon: Icon, label, desc, onClick }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.995 }}
      className={[
        "w-full rounded-xl px-4 py-4 text-left transition relative group",
        active ? "bg-emerald-50 border border-emerald-200 shadow-sm" : "hover:bg-gray-50"
      ].join(" ")}
    >
      {/* active indicator */}
      <span className={[
        "absolute left-0 top-1/2 -translate-y-1/2 h-7 w-1 rounded-r-full",
        active ? "bg-emerald-500" : "bg-transparent"
      ].join(" ")} />
      <div className="flex items-center gap-3">
        <div className={[
          "h-11 w-11 rounded-xl border flex items-center justify-center transition",
          active ? "bg-white border-emerald-200 shadow-sm" : "bg-white border-slate-200 group-hover:border-slate-300"
        ].join(" ")}>
          <Icon size={20} className={active ? "text-emerald-700" : "text-slate-700"} />
        </div>
        <div>
          <div className={"text-base font-semibold " + (active ? "text-emerald-800" : "text-slate-900")}>{label}</div>
          <div className="text-xs text-slate-500">{desc}</div>
        </div>
      </div>
    </motion.button>
  );
}

function LabeledInput({ icon: Icon, label, value, onChange, disabled, required, readOnly, placeholder, extraClass }) {
  return (
    <div>
      <label className="flex items-center gap-2 text-sm font-semibold text-slate-800 mb-1">
        <Icon size={16} /> {label}
      </label>
      <input
        className={`input w-full !text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-300 ${extraClass || ""}`}
        value={value}
        onChange={onChange}
        disabled={disabled}
        required={required}
        readOnly={readOnly}
        placeholder={placeholder}
      />
    </div>
  );
}

function PasswordInput({ value, onChange, show, setShow, placeholder }) {
  return (
    <div className="relative">
      <input
        className="input w-full pr-10 !text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-300"
        type={show ? "text" : "password"}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="new-password"
      />
      <button
        type="button"
        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-700"
        onClick={() => setShow(s => !s)}
        aria-label={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
      >
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}

function PasswordStrengthBar({ score, hints }) {
  const steps = 5;
  const filled = Math.min(steps, Math.max(0, score));
  const labels = ["Rất yếu", "Yếu", "Trung bình", "Mạnh", "Rất mạnh"];
  const color = [
    "bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-emerald-500", "bg-emerald-600"
  ][Math.max(0, filled - 1)] || "bg-gray-300";

  return (
    <div>
      <div className="flex items-center gap-1 mb-1">
        {Array.from({ length: steps }).map((_, i) => (
          <div key={i} className={`h-1.5 flex-1 rounded ${i < filled ? color : "bg-gray-200"}`} />
        ))}
      </div>
      <div className="text-xs text-slate-600">
        {labels[Math.max(0, filled - 1)]}{hints?.length ? ` — ${hints.join(", ")}` : ""}
      </div>
    </div>
  );
}

function LocationRow({ disabled, locating, accuracy, lat, lng, onDetect, onChangeLat, onChangeLng, btnSecondary }) {
  const mapHref = (lat && lng) ? `https://www.google.com/maps?q=${lat},${lng}&z=18` : null;

  async function copyCoord() {
    try { await navigator.clipboard.writeText(`${lat ?? ""},${lng ?? ""}`); } catch {}
  }
  function clearCoord() { onChangeLat(""); onChangeLng(""); }

  return (
    <div className="grid lg:grid-cols-[1fr_1fr_auto] gap-5 items-end">
      <div>
        <label className="text-sm font-semibold text-slate-800 mb-1 block">Vĩ độ (lat)</label>
        <div className="flex items-center gap-2">
          <input
            className="input w-full !text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-300"
            value={lat ?? ""}
            placeholder="16.047079"
            onChange={(e) => onChangeLat(e.target.value)}
            disabled={disabled}
          />
          <button
            type="button"
            className="px-3 py-2 rounded-full border text-slate-800 ring-1 ring-slate-300 hover:bg-slate-50"
            onClick={copyCoord}
            title="Copy toạ độ"
            disabled={disabled}
          >
            <Copy size={16} />
          </button>
        </div>
      </div>

      <div>
        <label className="text-sm font-semibold text-slate-800 mb-1 block">Kinh độ (lng)</label>
        <div className="flex items-center gap-2">
          <input
            className="input w-full !text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-300"
            value={lng ?? ""}
            placeholder="108.206230"
            onChange={(e) => onChangeLng(e.target.value)}
            disabled={disabled}
          />
          <button
            type="button"
            className="px-3 py-2 rounded-full border text-slate-800 ring-1 ring-slate-300 hover:bg-slate-50"
            onClick={clearCoord}
            title="Xoá toạ độ"
            disabled={disabled}
          >
            <Crosshair size={16} />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Button
          type="button"
          onClick={onDetect}
          disabled={disabled || locating}
          className={`${btnSecondary} px-5 py-2 
              bg-emerald-500 hover:bg-emerald-600 
              text-white font-medium rounded-lg 
              disabled:bg-emerald-300 disabled:cursor-not-allowed 
              transition-colors`}
        >
          {locating ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="animate-spin" size={16} /> Đang lấy vị trí
            </span>
          ) : (
            <span className="inline-flex items-center gap-2">
              <LocateFixed size={16} /> Lấy vị trí hiện tại
            </span>
          )}
        </Button>

        <div className="text-xs text-slate-600 flex items-center gap-2">
          <Compass size={14} /> Độ chính xác: {accuracy != null ? `${accuracy} m` : "—"}
        </div>
        {mapHref && (
          <a href={mapHref} target="_blank" rel="noreferrer" className="text-xs text-emerald-700 font-semibold inline-flex items-center gap-1 hover:underline">
            <MapPinned size={14} /> Mở Google Maps
          </a>
        )}
      </div>
    </div>
  );
}

function ConfirmDialog({ title, desc, onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl shadow-xl w-[min(92vw,520px)] p-6 border">
        <div className="text-lg md:text-xl font-bold text-slate-900 mb-2">{title}</div>
        <p className="text-sm text-slate-700 mb-4">{desc}</p>
        <div className="flex items-center justify-end gap-3">
          <button onClick={onCancel} className="px-5 py-2 rounded-full border bg-white text-slate-800 ring-1 ring-slate-300 hover:bg-slate-50">
            Hủy
          </button>
          <button onClick={onConfirm} className="px-5 py-2 rounded-full border bg-emerald-600 text-white ring-1 ring-emerald-600 hover:bg-emerald-700">
            Xác nhận
          </button>
        </div>
      </div>
    </div>
  );
}

function DangerButton({ children, disabled, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 px-5 py-2 rounded-full border text-white font-semibold transition
        ${disabled ? "bg-red-300 cursor-not-allowed" : "bg-red-600 hover:bg-red-700"} shadow-[0_8px_22px_rgba(225,29,72,0.25)]`}
      type="button"
    >
      {children}
    </button>
  );
}

/* ---------- Lịch sử: render “đúng dữ liệu DB” (donations/deliveries/payments) ---------- */

function SectionList({ title, rows, empty, link }) {
  return (
    <div className="rounded-2xl border bg-white shadow-md">
      <div className="px-4 py-3 border-b font-semibold text-slate-900">{title}</div>
      <ul className="divide-y">
        {(rows && rows.length) ? rows.map((r) => (
          <li key={r.id || r.key} className="px-4 py-3 text-sm md:text-base">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-medium text-slate-800">{r.title}</div>
                <div className="text-xs md:text-sm text-slate-600">{r.timeText}</div>
                {r.sub && <div className="text-xs text-slate-600 mt-0.5">{r.sub}</div>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {r.qty != null && r.qty > 0 && <Badge neutral>{`x${r.qty}`}</Badge>}
                {r.amountVND != null && <Badge success>{fmtVND(r.amountVND)}</Badge>}
                {r.status && <StatusPill status={r.status} />}
              </div>
            </div>
          </li>
        )) : (
          <li className="px-4 py-6 text-sm md:text-base text-slate-600">{empty}</li>
        )}
      </ul>
      {link && (
        <div className="px-4 py-2 text-sm">
          <Link className="inline-flex items-center gap-1 text-emerald-700 font-semibold hover:underline" to={link.to}>
            {link.label} <ArrowRight size={14} />
          </Link>
        </div>
      )}
    </div>
  );
}

function Badge({ children, success, danger, neutral }) {
  const cls = success
    ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
    : danger
    ? "bg-red-50 text-red-700 ring-1 ring-red-200"
    : "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{children}</span>;
}

function StatusPill({ status }) {
  const map = {
    success: { icon: CheckCircle2, text: "success", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
    paid: { icon: CheckCircle2, text: "paid", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
    pending: { icon: Clock, text: "pending", cls: "bg-amber-50 text-amber-700 ring-amber-200" },
    failed: { icon: XCircle, text: "failed", cls: "bg-red-50 text-red-700 ring-red-200" },
    refunded: { icon: XCircle, text: "refunded", cls: "bg-slate-50 text-slate-700 ring-slate-200" },
    delivered: { icon: CheckCircle2, text: "delivered", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
    completed: { icon: CheckCircle2, text: "completed", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
    accepted: { icon: CheckCircle2, text: "accepted", cls: "bg-blue-50 text-blue-700 ring-blue-200" },
  };
  const s = map[String(status || "").toLowerCase()] || { text: String(status || ""), cls: "bg-slate-50 text-slate-700 ring-slate-200" };
  const Icon = s.icon || CheckCircle2;
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ring-1 ${s.cls}`}><Icon size={12} /> {s.text}</span>;
}

/* ---------- Utilities ---------- */

function fmtVND(n) {
  try { return Number(n || 0).toLocaleString("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }); }
  catch { return `${n} VND`; }
}

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

async function getGeoPermissionState() {
  try {
    if (!navigator.permissions?.query) return "prompt";
    const s = await navigator.permissions.query({ name: "geolocation" });
    return s.state; // 'granted' | 'prompt' | 'denied'
  } catch { return "prompt"; }
}
function getPositionOnce(opts) {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, opts);
  });
}
async function safeReadText(res) {
  try { return await res.text(); } catch { return ""; }
}

/* ---------- Chuẩn hoá dữ liệu lịch sử từ API để “ăn” đúng DB ---------- */
/** given: có thể đến từ:
 * - deliveries (shipper/donor đã giao): id, qty, status, created_at/delivered_at, dropoff_name/address
 * - food_items đã cho: title, qty, unit, created_at
 */
function normalizeGiven(arr) {
  return (Array.isArray(arr) ? arr : []).map((x, i) => {
    const id = x.id || x.delivery_id || x.item_id || `g-${i}`;
    const title = x.title || x.item_title || x.dropoff_name || x.name || "Đã cho";
    const qty = pickInt(x.qty, x.quantity);
    const timeText = x.delivered_at || x.arrived_at || x.created_at || x.at || "";
    const status = x.status || (x.delivered_at ? "delivered" : x.state);
    const sub = x.dropoff_address || x.address || undefined;
    return { id, title, qty, status, timeText, sub };
  });
}

/** received: có thể đến từ bookings/deliveries đã hoàn tất của receiver */
function normalizeReceived(arr) {
  return (Array.isArray(arr) ? arr : []).map((x, i) => {
    const id = x.id || x.booking_id || `r-${i}`;
    const title = x.title || x.item_title || x.pickup_name || x.name || "Đã nhận";
    const qty = pickInt(x.qty, x.quantity);
    const timeText = x.completed_at || x.delivered_at || x.created_at || x.at || "";
    const status = x.status || (x.completed_at ? "completed" : x.state);
    const sub = x.pickup_address || x.dropoff_address || x.address || undefined;
    return { id, title, qty, status, timeText, sub };
  });
}

/** payments: map từ:
 * - bảng payments (booking fee): id (char36), amount(int), status: pending|paid|failed|refunded, created_at
 * - donations (quyên góp): id (bigint), amount(decimal), status: pending|success|failed, created_at/paid_at
 */
function normalizePayments(arr) {
  return (Array.isArray(arr) ? arr : []).map((x, i) => {
    const id = x.id || x.payment_id || `p-${i}`;
    const amountVND = pickAmount(x.amount, x.amount_vnd, x.value);
    const rawStatus = (x.status || "").toLowerCase();
    const status = rawStatus === "success" ? "success" : rawStatus; // unify
    const timeText = x.created_at || x.paid_at || x.at || "";
    const orderShort = (x.order_id && String(x.order_id).slice(0, 6)) || (x.booking_id && String(x.booking_id).slice(0, 6)) || null;
    const title = x.title || (orderShort ? `#${orderShort}` : "Giao dịch");
    const sub = x.provider ? `Cổng: ${String(x.provider).toUpperCase()}` : (x.currency ? `Tiền tệ: ${x.currency}` : undefined);
    return { id, title, amountVND, status, timeText, sub };
  });
}

function pickAmount(...vals) {
  for (const v of vals) if (v != null && !Number.isNaN(Number(v))) return Number(v);
  return null;
}
function pickInt(...vals) {
  for (const v of vals) {
    const n = Number(v);
    if (Number.isInteger(n) && n >= 0) return n;
  }
  return null;
}

/* ---------- Skeletons ---------- */
function SkeletonProfile() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="h-20 w-20 rounded-full bg-slate-100 animate-pulse" />
        <div className="space-y-2">
          <div className="h-4 w-40 bg-slate-100 rounded animate-pulse" />
          <div className="h-3 w-56 bg-slate-100 rounded animate-pulse" />
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />
        ))}
      </div>
      <div className="h-24 bg-slate-100 rounded animate-pulse" />
    </div>
  );
}

function SkeletonHistory() {
  return (
    <div className="grid lg:grid-cols-3 gap-6 mt-5">
      {Array.from({ length: 3 }).map((_, c) => (
        <div key={c} className="rounded-2xl border bg-white shadow-md">
          <div className="px-4 py-3 border-b font-semibold text-slate-900">—</div>
          <div className="p-4 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
