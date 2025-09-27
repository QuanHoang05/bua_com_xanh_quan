import { useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiPost } from "../lib/api";
import {
  Save, Loader2, Image as ImageIcon, Globe, Palette, Mail, CreditCard,
  Search as SeoIcon, Wrench, ExternalLink, Shield, Sparkles, UploadCloud,
  Eye, RefreshCw, CheckCircle2, XCircle, TestTube2
} from "lucide-react";

/* -------------------- helpers -------------------- */
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || ""));

function Section({ icon: Icon, title, desc, children }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start gap-4 p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800">
        <div className="shrink-0 rounded-2xl bg-emerald-50 p-2 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-300">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-slate-500">{desc}</p>
        </div>
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}

function Field({ label, hint, children, error }) {
  return (
    <label className="grid gap-1.5">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
        {hint ? <span className="text-xs text-slate-500">{hint}</span> : null}
      </div>
      {children}
      {error ? <div className="text-xs text-rose-600">{error}</div> : null}
    </label>
  );
}

function Input({ className="", ...props }) {
  return (
    <input
      {...props}
      className={[
        "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none",
        "focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800",
        className
      ].join(" ")}
    />
  );
}
function Select(props){return <Input as="select" {...props} />}

/* -------------------- main page -------------------- */
export default function AdminSettings() {
  const [data, setData] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const s = await apiGet("/api/admin/settings");
        setData(s);
      } catch (e) {
        setMsg({ type: "error", text: "Không tải được cài đặt." });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // auto clear message
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 3000);
    return () => clearTimeout(t);
  }, [msg]);

  const set = (path, value) => {
    setData((prev) => {
      const copy = structuredClone(prev);
      const [a,b,c] = path.split(".");
      if (c != null) copy[a][b][c] = value;
      else {
        if (b != null) copy[a][b] = value;
        else copy[a] = value;
      }
      return copy;
    });
    setDirty(true);
  };

  async function onSave() {
    setSaving(true);
    try {
      // validations
      if (data.general.site_email && !isEmail(data.general.site_email)) {
        setMsg({ type: "error", text: "Email website không hợp lệ." });
        setSaving(false);
        return;
      }
      await apiPost("/api/admin/settings", data);
      setDirty(false);
      setMsg({ type: "ok", text: "Đã lưu cài đặt." });
    } catch {
      setMsg({ type: "error", text: "Lưu thất bại." });
    } finally {
      setSaving(false);
    }
  }

  async function onTestEmail() {
    setTestingEmail(true);
    try {
      await apiPost("/api/admin/settings/test-email", { to: data.email.test_recipient });
      setMsg({ type: "ok", text: "Gửi email thử thành công." });
    } catch {
      setMsg({ type: "error", text: "Gửi email thử thất bại." });
    } finally {
      setTestingEmail(false);
    }
  }

  const palette = useMemo(() => ({
    primary: data?.branding?.primary_color || "#10b981",
    secondary: data?.branding?.secondary_color || "#0ea5e9"
  }), [data]);

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      {/* Header */}
      <div className="mb-4 sm:mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Site Settings</h1>
          <p className="text-sm text-slate-500">Cấu hình tổng thể cho hệ thống quản trị.</p>
        </div>
        <div className="hidden sm:flex items-center gap-2">
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            <RefreshCw className="h-4 w-4" /> Tải lại
          </button>
          <button
            disabled={!dirty || saving}
            onClick={onSave}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Lưu thay đổi
          </button>
        </div>
      </div>

      {/* sticky action bar (mobile + when scrolling) */}
      <div className="sm:hidden sticky top-14 z-10 mb-3">
        <div className="rounded-2xl border border-slate-200 bg-white/90 p-2 backdrop-blur dark:border-slate-700 dark:bg-slate-900/90">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">{dirty ? "Có thay đổi chưa lưu" : "Cài đặt hiện tại"}</span>
            <button
              disabled={!dirty || saving}
              onClick={onSave}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Lưu
            </button>
          </div>
        </div>
      </div>

      {/* message toast */}
      {msg && (
        <div className={[
          "mb-4 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm",
          msg.type === "ok" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                            : "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
        ].join(" ")}>
          {msg.type === "ok" ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          {msg.text}
        </div>
      )}

      {/* content */}
      {loading || !data ? (
        <div className="mt-10 inline-flex items-center gap-2 text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Đang tải…
        </div>
      ) : (
        <div className="grid gap-6">
          {/* General */}
          <Section icon={Globe} title="General" desc="Thông tin cơ bản và nội địa hoá.">
            <div className="grid gap-5">
              <Field label="Tên website">
                <Input value={data.general.site_name} onChange={e => set("general.site_name", e.target.value)} />
              </Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Email" error={data.general.site_email && !isEmail(data.general.site_email) ? "Email không hợp lệ" : ""}>
                  <Input type="email" value={data.general.site_email} onChange={e => set("general.site_email", e.target.value)} />
                </Field>
                <Field label="Hotline">
                  <Input value={data.general.hotline} onChange={e => set("general.hotline", e.target.value)} />
                </Field>
              </div>
              <Field label="Địa chỉ">
                <Input value={data.general.address} onChange={e => set("general.address", e.target.value)} />
              </Field>
              <div className="grid gap-5 sm:grid-cols-3">
                <Field label="Chủ đề">
                  <select
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800"
                    value={data.general.theme} onChange={e => set("general.theme", e.target.value)}
                  >
                    <option value="system">Theo hệ thống</option>
                    <option value="light">Sáng</option>
                    <option value="dark">Tối</option>
                  </select>
                </Field>
                <Field label="Locale">
                  <Input value={data.general.locale} onChange={e => set("general.locale", e.target.value)} />
                </Field>
                <Field label="Timezone">
                  <Input value={data.general.timezone} onChange={e => set("general.timezone", e.target.value)} />
                </Field>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Currency">
                  <Input value={data.general.currency} onChange={e => set("general.currency", e.target.value)} />
                </Field>
              </div>
            </div>
          </Section>

          {/* Branding */}
          <Section icon={Palette} title="Branding" desc="Logo, favicon và màu nhận diện.">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="grid gap-5">
                <Field label="Logo URL" hint="PNG/SVG 1:1 hoặc 4:1">
                  <Input value={data.branding.logo_url} onChange={e => set("branding.logo_url", e.target.value)} placeholder="https://…" />
                </Field>
                <Field label="Favicon URL" hint=".ico / .png 32x32">
                  <Input value={data.branding.favicon_url} onChange={e => set("branding.favicon_url", e.target.value)} placeholder="https://…" />
                </Field>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Primary color">
                    <Input type="color" value={data.branding.primary_color} onChange={e => set("branding.primary_color", e.target.value)} />
                  </Field>
                  <Field label="Secondary color">
                    <Input type="color" value={data.branding.secondary_color} onChange={e => set("branding.secondary_color", e.target.value)} />
                  </Field>
                </div>
              </div>
              {/* Preview card */}
              <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl border border-slate-200 bg-white grid place-items-center overflow-hidden dark:border-slate-700">
                    {data.branding.logo_url ? (
                      <img src={data.branding.logo_url} alt="logo" className="max-h-10 object-contain" />
                    ) : (
                      <ImageIcon className="h-6 w-6 text-slate-400" />
                    )}
                  </div>
                  <div>
                    <div className="font-semibold">{data.general.site_name || "Tên website"}</div>
                    <div className="text-xs text-slate-500">Màu chủ đạo</div>
                  </div>
                </div>
                <div className="mt-4 h-10 rounded-xl" style={{ background: `linear-gradient(90deg, ${palette.primary}, ${palette.secondary})` }} />
              </div>
            </div>
          </Section>

          {/* Email */}
          <Section icon={Mail} title="Email" desc="Cấu hình SMTP và gửi thử.">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="From name">
                <Input value={data.email.from_name} onChange={e => set("email.from_name", e.target.value)} />
              </Field>
              <Field label="From email" error={data.email.from_email && !isEmail(data.email.from_email) ? "Email không hợp lệ" : ""}>
                <Input type="email" value={data.email.from_email} onChange={e => set("email.from_email", e.target.value)} />
              </Field>
              <Field label="SMTP host"><Input value={data.email.smtp_host} onChange={e => set("email.smtp_host", e.target.value)} /></Field>
              <Field label="SMTP port"><Input type="number" value={data.email.smtp_port} onChange={e => set("email.smtp_port", clamp(Number(e.target.value||0),1,65535))} /></Field>
              <Field label="Secure (TLS/SSL)">
                <select
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800"
                  value={data.email.smtp_secure ? "1":"0"} onChange={e=>set("email.smtp_secure", e.target.value==="1")}
                >
                  <option value="0">Không</option>
                  <option value="1">Có</option>
                </select>
              </Field>
              <div className="grid gap-5 sm:grid-cols-2 sm:col-span-2">
                <Field label="SMTP user"><Input value={data.email.smtp_user} onChange={e => set("email.smtp_user", e.target.value)} /></Field>
                <Field label="SMTP pass"><Input type="password" value={data.email.smtp_pass} onChange={e => set("email.smtp_pass", e.target.value)} /></Field>
              </div>
              <div className="sm:col-span-2 grid gap-3 sm:grid-cols-[1fr_auto]">
                <Field label="Email thử (recipient)">
                  <Input type="email" placeholder="you@example.com" value={data.email.test_recipient} onChange={e=>set("email.test_recipient", e.target.value)} />
                </Field>
                <button
                  disabled={testingEmail || !isEmail(data.email.test_recipient)}
                  onClick={onTestEmail}
                  className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  {testingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube2 className="h-4 w-4" />}
                  Gửi email thử
                </button>
              </div>
            </div>
          </Section>

          {/* Payments */}
          <Section icon={CreditCard} title="Payments" desc="Cấu hình cổng thanh toán.">
            <div className="grid gap-5">
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={!!data.payments.enable_vietqr} onChange={e=>set("payments.enable_vietqr", e.target.checked)} />
                  <span className="text-sm">Bật VietQR</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={!!data.payments.enable_momo} onChange={e=>set("payments.enable_momo", e.target.checked)} />
                  <span className="text-sm">Bật MoMo</span>
                </label>
              </div>
              <Field label="Số tài khoản VietQR">
                <Input value={data.payments.vietqr_account} onChange={e=>set("payments.vietqr_account", e.target.value)} />
              </Field>
              <div className="grid gap-5 sm:grid-cols-3">
                <Field label="MoMo Partner Code">
                  <Input value={data.payments.momo_partner_code} onChange={e=>set("payments.momo_partner_code", e.target.value)} />
                </Field>
                <Field label="MoMo Access Key">
                  <Input value={data.payments.momo_access_key} onChange={e=>set("payments.momo_access_key", e.target.value)} />
                </Field>
                <Field label="MoMo Secret Key">
                  <Input value={data.payments.momo_secret_key} onChange={e=>set("payments.momo_secret_key", e.target.value)} />
                </Field>
              </div>
            </div>
          </Section>

          {/* SEO */}
          <Section icon={SeoIcon} title="SEO & Social" desc="Meta tags và chia sẻ mạng xã hội.">
            <div className="grid gap-5">
              <Field label="Site title">
                <Input value={data.seo.site_title} onChange={e=>set("seo.site_title", e.target.value)} />
              </Field>
              <Field label="Mô tả">
                <Input value={data.seo.site_description} onChange={e=>set("seo.site_description", e.target.value)} />
              </Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Twitter handle">
                  <Input value={data.seo.twitter_handle} onChange={e=>set("seo.twitter_handle", e.target.value)} />
                </Field>
                <Field label="OG image URL">
                  <Input value={data.seo.og_image} onChange={e=>set("seo.og_image", e.target.value)} placeholder="https://…" />
                </Field>
              </div>
            </div>
          </Section>

          {/* Advanced */}
          <Section icon={Wrench} title="Advanced" desc="Tuỳ chọn nâng cao.">
            <div className="grid gap-5 sm:grid-cols-3">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={!!data.advanced.maintenance_mode} onChange={e=>set("advanced.maintenance_mode", e.target.checked)} />
                <span className="text-sm">Bảo trì</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={!!data.advanced.allow_signup} onChange={e=>set("advanced.allow_signup", e.target.checked)} />
                <span className="text-sm">Cho phép đăng ký</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={!!data.advanced.telemetry} onChange={e=>set("advanced.telemetry", e.target.checked)} />
                <span className="text-sm">Telemetry</span>
              </label>
            </div>
          </Section>

          {/* Bottom save bar */}
          <div className="sticky bottom-3 z-10 mt-2">
            <div className="rounded-2xl border border-slate-200 bg-white/90 p-2 backdrop-blur shadow-sm dark:border-slate-700 dark:bg-slate-900/90">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  {dirty ? "Có thay đổi chưa lưu" : "Mọi thay đổi đã được lưu"}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                    className="hidden sm:inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                  >
                    <Eye className="h-3.5 w-3.5" /> Lên đầu trang
                  </button>
                  <button
                    disabled={!dirty || saving}
                    onClick={onSave}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    Lưu thay đổi
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
