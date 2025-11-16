import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { apiPost } from "../../lib/api";
import { buildVietQRUrl, gatewaysForCampaign } from "../../lib/campaignUtils";

// Note: UI Primitives (Card, Btn, Input, Select) should be imported from a shared location
import Card from "../ui/Card";
import Button from "../ui/Button";

const Input = (props) => <input {...props} className="input w-full" />;
const Select = (props) => <select {...props} className="input w-full" />;

const useAnim = () => ({
  pop: { initial: { opacity: 0, scale: 0.98 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.98 } },
  backdrop: { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } },
});

async function createPayment({ method, amount, campaign_id, orderInfo, extraData }) {
  const m = (method || "").toLowerCase();
  const body = { amount: Number(amount), orderInfo, extraData, campaign_id, method: m || undefined };
  if (m === "momo") {
    const res = await apiPost("/api/payments/momo/create", body);
    return { pay_url: res?.payUrl, qr_svg: res?.qr_svg, qr_image: res?.qr_image, raw: res };
  }
  const res = await apiPost("/api/payments/create", body).catch(() => ({}));
  return { pay_url: res?.pay_url, qr_svg: res?.qr_svg, qr_image: res?.qr_image, raw: res };
}

export default function DonateMoneyModal({ open, onClose, campaign, globalGateways }) {
  const { pop, backdrop } = useAnim();
  const gateways = useMemo(() => gatewaysForCampaign(campaign, globalGateways), [campaign, globalGateways]);
  const [amount, setAmount] = useState(200000);
  const [method, setMethod] = useState(gateways?.[0]?.code || "momo");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");
  const [qr, setQr] = useState({ img: "", svg: "" });

  useEffect(() => {
    if (!open) return;
    setAmount(200000);
    setMethod(gateways?.[0]?.code || "momo");
    setSubmitting(false);
    setErr("");
    setQr({ img: "", svg: "" });
  }, [open, gateways]);

  async function handleCreate() {
    try {
      setErr(""); setSubmitting(true); setQr({ img: "", svg: "" });
      const m = (method || "").toLowerCase();

      if (m === "custom_qr") {
        const img = campaign?.payment?.qr_url || "";
        if (!img) throw new Error("Chiến dịch chưa cấu hình QR.");
        setQr({ img, svg: "" }); return;
      }
      if (m === "vietqr") {
        const img = campaign?.payment?.qr_url || buildVietQRUrl({ bank: campaign?.payment?.bank, account: campaign?.payment?.account, name: campaign?.payment?.name, memo: campaign?.payment?.memo, amount });
        if (!img) throw new Error("Không tạo được QR VietQR (thiếu bank/account).");
        setQr({ img, svg: "" }); return;
      }

      const resp = await createPayment({ method: m, amount: Number(amount || 0), campaign_id: campaign?.id, orderInfo: `Ủng hộ chiến dịch ${campaign?.title || ""}`.trim() });
      if (resp?.pay_url) { window.location.href = resp.pay_url; return; }
      if (resp?.qr_image || resp?.qr_svg) { setQr({ img: resp.qr_image || "", svg: resp.qr_svg || "" }); return; }
      setErr("Chưa nhận được liên kết thanh toán/QR. Vui lòng thử lại.");
    } catch (e) {
      setErr(e?.message || "Không tạo được giao dịch. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[60] grid place-items-center" {...backdrop}>
          <motion.div className="absolute inset-0 bg-black/60" onClick={onClose} />
          <motion.div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto" {...pop}>
            <Card>
              <div className="p-5 border-b border-slate-200">
                <div className="text-lg font-bold text-slate-900">Ủng hộ chiến dịch</div>
                <div className="text-sm text-slate-700">{campaign?.title}</div>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-800">Số tiền (đ)</label>
                  <Input type="number" min={10000} step={1000} value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1" />
                  <div className="mt-2 flex flex-wrap gap-2">
                    {[50000, 100000, 200000, 500000].map((v) => (
                      <button key={v} type="button" onClick={() => setAmount(v)} className={`px-3 py-1 rounded-xl border text-[14px] ${Number(amount) === v ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-slate-300 bg-white hover:bg-slate-50"}`}>
                        {v.toLocaleString("vi-VN")} đ
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <Select className="mt-1" value={method} onChange={(e) => setMethod(e.target.value)}>
                      {gateways.map((g) => <option key={g.code} value={g.code}>{g.name || g.code}</option>)}
                    </Select>
                    <div className="mt-1 text-xs text-slate-600">{campaign?.payment_method ? `Cấu hình của chiến dịch: ${campaign.payment_method}` : "Mặc định MoMo nếu chiến dịch không cấu hình riêng."}</div>
                  </div>
                  <div className="flex items-end">
                    <Button className="w-full" onClick={handleCreate} disabled={submitting || Number(amount) < 10000}>{submitting ? "Đang tạo…" : "Tạo giao dịch"}</Button>
                  </div>
                </div>
                {err && <div className="text-sm text-rose-600">{err}</div>}
                {(qr.img || qr.svg) && (
                  <div className="mt-2 flex flex-col items-center gap-2">
                    {qr.svg ? <div className="w-56 h-56 bg-white rounded-xl p-2" dangerouslySetInnerHTML={{ __html: qr.svg }} /> : <img src={qr.img} alt="QR" className="w-56 h-56 object-contain bg-white rounded-xl p-2 border border-slate-200" />}
                    <div className="text-xs text-slate-600">Quét QR để hoàn tất ủng hộ</div>
                  </div>
                )}
              </div>
              <div className="p-5 border-t border-slate-200 flex items-center justify-end gap-2">
                <Button variant="ghost" onClick={onClose}>Đóng</Button>
              </div>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}