﻿// ================================================
// src/pages/Register.jsx — full-profile register (final)
// ================================================

import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import {
  Mail, Lock, User as UserIcon, MapPin, Eye, EyeOff,
  AlertTriangle, Phone, Calendar, BadgeCheck
} from "lucide-react";

import Card from "../components/ui/Card";
import { useAuth } from "../auth/AuthContext";
import { apiGet } from "../lib/api";
import AuthHero from "../components/ui/AuthHero";
import RegisterBackground from "../components/ui/RegisterBackground";

/* ===================== Rules & validators ===================== */
const PW_RULES = { min: 8, hasUpper: /[A-Z]/, hasLower: /[a-z]/, hasDigit: /[0-9]/ };

const validateName = (v="") => !v.trim() ? "Vui lòng nhập họ tên"
  : v.trim().length < 2 ? "Họ tên quá ngắn"
  : v.length > 120 ? "Họ tên quá dài" : true;

const validateEmail = (v="") => !v.trim() ? "Vui lòng nhập email"
  : !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? "Email không hợp lệ"
  : v.length > 254 ? "Email quá dài" : true;

// Phone VN: 0xxxxxxxxx (10~11 số) hoặc +84xxxxxxxxx
const validatePhone = (v="") => !v.trim() ? "Vui lòng nhập số điện thoại"
  : !/^(\+?84|0)\d{9,10}$/.test(v.replace(/\s+/g,"")) ? "Số điện thoại không hợp lệ"
  : v.length > 20 ? "Số điện thoại quá dài" : true;

const validateAddressLine = (v="") => !v.trim() ? "Vui lòng nhập số nhà, tên đường"
  : v.trim().length < 3 ? "Địa chỉ quá ngắn" : v.length > 120 ? "Địa chỉ quá dài" : true;

const requiredText = (field) => (v="") => !v.trim() ? `Vui lòng chọn ${field}` : true;

function validatePassword(v="") {
  if (!v) return "Vui lòng nhập mật khẩu";
  if (v.length < PW_RULES.min) return `Mật khẩu tối thiểu ${PW_RULES.min} ký tự`;
  if (!PW_RULES.hasUpper.test(v)) return "Cần ít nhất 1 chữ hoa (A–Z)";
  if (!PW_RULES.hasLower.test(v)) return "Cần ít nhất 1 chữ thường (a–z)";
  if (!PW_RULES.hasDigit.test(v)) return "Cần ít nhất 1 chữ số (0–9)";
  if (v.length > 128) return "Mật khẩu quá dài";
  return true;
}

function strengthLabel(pw="") {
  let s = 0;
  if (pw.length >= PW_RULES.min) s++;
  if (PW_RULES.hasUpper.test(pw)) s++;
  if (PW_RULES.hasLower.test(pw)) s++;
  if (PW_RULES.hasDigit.test(pw)) s++;
  if (pw.length >= 12) s++;
  if (pw.length >= 16) s++;
  if (s <= 2) return { label: "Yếu", bar: 33 };
  if (s <= 4) return { label: "Khá", bar: 66 };
  return { label: "Mạnh", bar: 100 };
}

function mapServerError(err) {
  const status = err?.status ?? err?.response?.status;
  const msg = err?.message || err?.response?.data?.message || err?.error || err?.response?.data?.error || "";

  if (status === 0 || err?.name === "AbortError") {
    return { title: "Hết thời gian chờ", detail: "Máy chủ phản hồi chậm. Vui lòng thử lại." };
  }
  if (msg?.toLowerCase().includes("network")) {
    return { title: "Lỗi mạng", detail: "Không thể kết nối máy chủ. Kiểm tra mạng và thử lại." };
  }
  switch (status) {
    case 400: case 422: return { title: "Dữ liệu không hợp lệ", detail: msg || "Vui lòng kiểm tra lại thông tin." };
    case 401: return { title: "Chưa xác thực", detail: "Phiên đăng nhập không hợp lệ." };
    case 403: return { title: "Không có quyền", detail: "Bạn không có quyền thực hiện hành động này." };
    case 409: return { title: "Đã tồn tại", detail: msg || "Thông tin đã tồn tại.", field: /email/i.test(msg) ? "email" : /phone/i.test(msg) ? "phone" : undefined };
    case 429: return { title: "Quá nhiều yêu cầu", detail: "Vui lòng thử lại sau một lúc." };
    case 500: case 502: case 503: case 504: return { title: "Lỗi máy chủ", detail: "Có vấn đề phía máy chủ. Vui lòng thử lại." };
    default: return msg ? { title: "Không thể đăng ký", detail: msg } : { title: "Không thể đăng ký", detail: "Đã xảy ra lỗi không xác định." };
  }
}

/* ===================== Component ===================== */
export default function Register() {
  const {
    register: rf, handleSubmit, formState, watch, setError, clearErrors
  } = useForm({
    mode: "onBlur",
    defaultValues: {
      name: "", email: "", phone: "",
      line1: "", city: "", district: "", ward: "",
      password: "", confirm: "",
      dob: "", gender: ""
    },
  });
  const { errors, isSubmitting, isValidating } = formState;

  const { register: signup } = useAuth();
  const nav = useNavigate();

  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [banner, setBanner] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const abortRef = useRef(null);

  /* ---- Password helpers ---- */
  const password = watch("password");
  const confirm = watch("confirm");
  const pwMatch = useMemo(() => password && confirm && password === confirm, [password, confirm]);
  const pwStrength = useMemo(() => strengthLabel(password), [password]);
  useEffect(() => {
    if (confirm && !pwMatch) setError("confirm", { type: "validate", message: "Không khớp" }, { shouldFocus: false });
    else clearErrors("confirm");
  }, [confirm, pwMatch, setError, clearErrors]);

  /* ---- Email/Phone uniqueness checks (debounced) ---- */
  const email = watch("email");
  const phone = watch("phone");
  const debounceRef = useRef({ email: 0, phone: 0 });
  const acRef = useRef({ email: null, phone: null });

  useEffect(() => {
    if (!email || validateEmail(email) !== true) return;
    window.clearTimeout(debounceRef.current.email);
    debounceRef.current.email = window.setTimeout(async () => {
      acRef.current.email?.abort?.();
      const ac = new AbortController(); acRef.current.email = ac;
      try {
        // chuẩn: dùng /api/users/check|exists
        let res = await apiGet(`/api/users/check?email=${encodeURIComponent(email)}`, { signal: ac.signal }).catch(() => null);
        if (!res) res = await apiGet(`/api/users/exists?email=${encodeURIComponent(email)}`, { signal: ac.signal }).catch(() => null);
        const exists = !!(res?.exists);
        if (exists) setError("email", { type: "server", message: "Email đã tồn tại" }, { shouldFocus: false });
        else clearErrors("email");
      } catch { /* ignore if BE chưa hỗ trợ */ }
    }, 400);
    return () => window.clearTimeout(debounceRef.current.email);
  }, [email, setError, clearErrors]);

  useEffect(() => {
    if (!phone || validatePhone(phone) !== true) return;
    window.clearTimeout(debounceRef.current.phone);
    debounceRef.current.phone = window.setTimeout(async () => {
      acRef.current.phone?.abort?.();
      const ac = new AbortController(); acRef.current.phone = ac;
      try {
        let res = await apiGet(`/api/users/check?phone=${encodeURIComponent(phone)}`, { signal: ac.signal }).catch(() => null);
        if (!res) res = await apiGet(`/api/users/exists?phone=${encodeURIComponent(phone)}`, { signal: ac.signal }).catch(() => null);
        const exists = !!(res?.exists);
        if (exists) setError("phone", { type: "server", message: "Số điện thoại đã tồn tại" }, { shouldFocus: false });
        else clearErrors("phone");
      } catch { /* ignore */ }
    }, 400);
    return () => window.clearTimeout(debounceRef.current.phone);
  }, [phone, setError, clearErrors]);

  /* ---- Submit ---- */
  const scrollToFirstError = () => {
    const el = document.querySelector("[data-has-error='true']");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const onSubmit = async (v) => {
    setBanner(null);
    if (typeof navigator !== "undefined" && navigator && navigator.onLine === false) {
      setBanner({ type: "error", title: "Bạn đang offline", detail: "Hãy kiểm tra kết nối Internet và thử lại." });
      return;
    }
    if (submitting) return;

    // Hợp nhất địa chỉ: "line1, ward, district, city"
    const address = [v.line1, v.ward, v.district, v.city].filter(Boolean).join(", ");

    const controller = new AbortController();
    abortRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    setSubmitting(true);
    try {
      const result = await signup(
        {
          name: v.name.trim(),
          email: v.email.trim(),
          phone: v.phone.trim(),
          address,
          password: v.password,
          profile: {
            city: v.city, district: v.district, ward: v.ward, line1: v.line1,
            dob: v.dob || null, gender: v.gender || null,
          },
        },
        true,
        { signal: controller.signal }
      );

      if (result && result.ok === false) {
        const serverMsg = result.message || result.error || "";
        if (/email/i.test(serverMsg) && /exist|tồn tại|đã đăng ký/i.test(serverMsg)) {
          setError("email", { type: "server", message: "Email đã tồn tại" }, { shouldFocus: true });
          setBanner({ type: "error", title: "Email đã tồn tại", detail: "Vui lòng dùng email khác." });
          scrollToFirstError(); return;
        }
        if (/phone/i.test(serverMsg) && /exist|tồn tại|đã đăng ký/i.test(serverMsg)) {
          setError("phone", { type: "server", message: "Số điện thoại đã tồn tại" }, { shouldFocus: true });
          setBanner({ type: "error", title: "Số điện thoại đã tồn tại", detail: "Vui lòng dùng số khác." });
          scrollToFirstError(); return;
        }
        setBanner({ type: "error", title: "Không thể đăng ký", detail: serverMsg || "Vui lòng thử lại." });
        return;
      }

      setBanner({ type: "success", title: "Đăng ký thành công", detail: "Đang chuyển về trang chủ..." });
      nav("/", { replace: true });
    } catch (err) {
      const mapped = mapServerError(err);
      if (mapped.field === "email") setError("email", { type: "server", message: mapped.detail || "Email đã tồn tại" }, { shouldFocus: true });
      if (mapped.field === "phone") setError("phone", { type: "server", message: mapped.detail || "Số điện thoại đã tồn tại" }, { shouldFocus: true });
      setBanner({ type: "error", title: mapped.title, detail: mapped.detail });
      scrollToFirstError();
    } finally {
      clearTimeout(timeoutId);
      setSubmitting(false);
      abortRef.current = null;
    }
  };

  useEffect(() => () => abortRef.current?.abort?.(), []);

  /* ===================== UI ===================== */
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-gradient-to-b from-[#0c1222] via-[#0e1a2b] to-[#0b1323] text-white">
      <RegisterBackground />

      <div className="relative z-10 grid min-h-screen grid-cols-1 lg:grid-cols-[3fr_2fr]">
        {/* Left hero */}
        <AuthHero />

        {/* Right: form */}
        <div className="relative flex items-center justify-center p-6 lg:p-10">
          <div className="pointer-events-none absolute -inset-x-6 top-24 hidden lg:block">
            <div className="mx-auto h-40 max-w-md rounded-full bg-emerald-400/20 blur-3xl" />
          </div>

          <div className="group relative w-[min(40vw,560px)] max-w-xl">
            <Card className="w-full border-0 bg-white text-slate-800 shadow-2xl ring-1 ring-black/10 transition duration-300 group-hover:-translate-y-0.5 group-hover:shadow-[0_40px_120px_-20px_rgba(16,185,129,0.35)] rounded-2xl">
              <div className="p-8">
                <header className="mb-6">
                  <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">Đăng ký</h1>
                  <p className="mt-1 text-lg text-slate-600">Tạo tài khoản để sử dụng hệ thống.</p>
                </header>

                {banner && (
                  <div
                    className={`mb-4 flex items-start gap-3 rounded-xl border p-3 ${
                      banner.type === "error"
                        ? "border-rose-300 bg-rose-50 text-rose-800"
                        : banner.type === "success"
                        ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                        : "border-sky-300 bg-sky-50 text-sky-800"
                    }`}
                    role="alert"
                    aria-live="assertive"
                  >
                    <AlertTriangle className="mt-0.5" size={18} />
                    <div>
                      <div className="font-semibold">{banner.title}</div>
                      {banner.detail && <div className="text-sm">{banner.detail}</div>}
                    </div>
                  </div>
                )}

                <form className="space-y-4" onSubmit={handleSubmit(onSubmit, scrollToFirstError)} noValidate>
                  {/* Họ tên */}
                  <Field label="Họ tên" error={errors.name?.message} icon={<UserIcon size={16} />}>
                    <input
                      data-has-error={!!errors.name}
                      className={inputCls(errors.name)}
                      autoComplete="name"
                      {...rf("name", { validate: validateName })}
                    />
                  </Field>

                  {/* Email + Phone */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Email" error={errors.email?.message} icon={<Mail size={16} />}>
                      <input
                        data-has-error={!!errors.email}
                        className={inputCls(errors.email)}
                        type="email" inputMode="email" autoComplete="email"
                        {...rf("email", { validate: validateEmail })}
                      />
                    </Field>
                    <Field label="Số điện thoại" error={errors.phone?.message} icon={<Phone size={16} />}>
                      <input
                        data-has-error={!!errors.phone}
                        className={inputCls(errors.phone)}
                        type="tel" inputMode="tel" autoComplete="tel"
                        placeholder="VD: 0912345678"
                        {...rf("phone", { validate: validatePhone })}
                      />
                    </Field>
                  </div>

                  {/* Địa chỉ chi tiết */}
                  <div className="rounded-xl border-2 border-slate-200 p-4">
                    <div className="mb-2 flex items-center gap-2 text-slate-800 font-semibold">
                      <MapPin size={16} /> Địa chỉ liên hệ nhận quà/ship
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      <Field label="Số nhà, tên đường" error={errors.line1?.message}>
                        <input
                          data-has-error={!!errors.line1}
                          className={inputCls(errors.line1)}
                          placeholder="VD: 12 Nguyễn Văn B, P.4"
                          autoComplete="address-line1"
                          {...rf("line1", { validate: validateAddressLine })}
                        />
                      </Field>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <Field label="Tỉnh/Thành" error={errors.city?.message}>
                          <input
                            data-has-error={!!errors.city}
                            className={inputCls(errors.city)}
                            placeholder="VD: TP. Hồ Chí Minh"
                            autoComplete="address-level1"
                            {...rf("city", { validate: requiredText("tỉnh/thành") })}
                          />
                        </Field>
                        <Field label="Quận/Huyện" error={errors.district?.message}>
                          <input
                            data-has-error={!!errors.district}
                            className={inputCls(errors.district)}
                            placeholder="VD: Quận 3"
                            autoComplete="address-level2"
                            {...rf("district", { validate: requiredText("quận/huyện") })}
                          />
                        </Field>
                        <Field label="Phường/Xã" error={errors.ward?.message}>
                          <input
                            data-has-error={!!errors.ward}
                            className={inputCls(errors.ward)}
                            placeholder="VD: Phường 4"
                            autoComplete="address-level3"
                            {...rf("ward", { validate: requiredText("phường/xã") })}
                          />
                        </Field>
                      </div>
                    </div>
                  </div>

                  {/* Optional: DOB + Gender */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Ngày sinh (tuỳ chọn)" error={errors.dob?.message} icon={<Calendar size={16} />}>
                      <input
                        className={inputCls()}
                        type="date"
                        max={new Date().toISOString().slice(0,10)}
                        {...rf("dob")}
                      />
                    </Field>
                    <Field label="Giới tính (tuỳ chọn)" error={errors.gender?.message} icon={<BadgeCheck size={16} />}>
                      <select className={inputCls()} {...rf("gender")}>
                        <option value="">— Chọn —</option>
                        <option value="male">Nam</option>
                        <option value="female">Nữ</option>
                        <option value="other">Khác</option>
                      </select>
                    </Field>
                  </div>

                  {/* Passwords */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Mật khẩu" error={errors.password?.message} icon={<Lock size={16} />}>
                      <div className="relative">
                        <input
                          data-has-error={!!errors.password}
                          className={inputPwCls(errors.password)}
                          type={showPw ? "text" : "password"}
                          autoComplete="new-password"
                          {...rf("password", { validate: validatePassword })}
                        />
                        <button type="button" onClick={() => setShowPw((s)=>!s)}
                          className="absolute inset-y-0 right-2 flex items-center text-slate-500 hover:text-slate-700"
                          aria-label={showPw ? "Ẩn mật khẩu" : "Hiện mật khẩu"}>
                          {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                      <div className="mt-2">
                        <div className="h-2 w-full rounded-full bg-slate-200">
                          <div className={`h-2 rounded-full transition-all ${
                              pwStrength.bar < 50 ? "bg-rose-500" : pwStrength.bar < 100 ? "bg-amber-500" : "bg-emerald-500"
                            }`} style={{ width: `${pwStrength.bar}%` }} />
                        </div>
                        <div className="mt-1 text-xs text-slate-600">Độ mạnh: {pwStrength.label}</div>
                      </div>
                    </Field>

                    <Field
                      label="Nhập lại mật khẩu"
                      error={errors.confirm?.message || (confirm && !pwMatch ? "Không khớp" : undefined)}
                      icon={<Lock size={16} />}
                    >
                      <div className="relative">
                        <input
                          data-has-error={!!errors.confirm || (confirm && !pwMatch)}
                          className={inputPwCls(errors.confirm || (confirm && !pwMatch))}
                          type={showPw2 ? "text" : "password"}
                          autoComplete="new-password"
                          {...rf("confirm", {
                            validate: (val) => (!!val ? (val === password ? true : "Không khớp") : "Vui lòng nhập lại mật khẩu"),
                          })}
                        />
                        <button type="button" onClick={() => setShowPw2((s)=>!s)}
                          className="absolute inset-y-0 right-2 flex items-center text-slate-500 hover:text-slate-700"
                          aria-label={showPw2 ? "Ẩn mật khẩu" : "Hiện mật khẩu"}>
                          {showPw2 ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </Field>
                  </div>

                  {/* CTA */}
                  <button
                    type="submit"
                    disabled={submitting || isSubmitting || isValidating}
                    className={`relative inline-flex w-full items-center justify-center overflow-hidden rounded-xl px-4 py-3 text-lg font-semibold text-white shadow-lg transition focus:outline-none
                    ${submitting || isSubmitting || isValidating ? "cursor-not-allowed opacity-80" : "hover:shadow-emerald-500/30"}
                    bg-gradient-to-r from-emerald-500 to-cyan-500`}
                    aria-busy={submitting || isSubmitting || isValidating}
                  >
                    <span className="absolute inset-0 -translate-x-full bg-white/30 blur-md transition group-hover:translate-x-full" />
                    <span className="relative">{submitting || isSubmitting ? "Đang đăng ký..." : "Đăng ký"}</span>
                  </button>
                </form>

                <div className="mt-6 text-center text-base text-slate-600">
                  Đã có tài khoản?{" "}
                  <Link className="font-semibold text-emerald-600 hover:text-emerald-500" to="/login">Đăng nhập</Link>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===================== UI bits ===================== */
function Field({ label, error, icon, children }) {
  return (
    <div data-has-error={!!error}>
      <label className="mb-1 block text-base font-semibold text-slate-800">{label}</label>
      <div className="relative">
        {icon && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">{icon}</span>}
        <div className={icon ? "pl-8" : ""}>{children}</div>
      </div>
      {error && <p className="mt-1 text-sm text-rose-600">{error}</p>}
    </div>
  );
}

function Particles({ density = 80 }) {
  const dots = Array.from({ length: density }, (_, i) => ({
    key: i, left: Math.random() * 100, top: Math.random() * 100,
    size: Math.random() * 1.6 + 0.6, opacity: Math.random() * 0.7 + 0.2,
  }));
  return (
    <div className="pointer-events-none absolute inset-0">
      {dots.map((d) => (
        <span
          key={d.key}
          className="absolute rounded-full bg-white"
          style={{ left: `${d.left}%`, top: `${d.top}%`, width: d.size, height: d.size, opacity: d.opacity, boxShadow: "0 0 6px rgba(255,255,255,.6)" }}
        />
      ))}
    </div>
  );
}

/* shared input classes */
const inputCls = (err) =>
  `block w-full rounded-xl border bg-slate-50/80 px-3 py-2.5 text-slate-900 placeholder-slate-400 outline-none focus:ring-2 ${
    err ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500/40"
        : "border-slate-300 focus:border-emerald-500 focus:ring-emerald-500/40"
  }`;

const inputPwCls = (err) =>
  `block w-full rounded-xl border px-3 py-2.5 pr-10 text-slate-900 placeholder-slate-400 outline-none focus:ring-2 ${
    err ? "border-rose-500 bg-rose-50/60 focus:border-rose-500 focus:ring-rose-500/40"
        : "border-slate-300 bg-slate-50/80 focus:border-emerald-500 focus:ring-emerald-500/40"
  }`;
