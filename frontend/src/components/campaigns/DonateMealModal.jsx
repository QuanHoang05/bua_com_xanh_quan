import { useEffect, useMemo, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { apiPost } from "@/lib/api";
import { buildVietQRUrl, gatewaysForCampaign, createPayment } from "@/lib/campaignUtils";
import { usePickupPoints } from "@/hooks/usePickupPoints";
import { useToast } from "@/components/ui/Toast"; // Thêm dòng này
import Card from "../ui/Card";
import Button from "../ui/Button";

const Input = (props) => <input {...props} className="input w-full" />;
const Select = (props) => <select {...props} className="input w-full" />;

const useAnim = () => ({
  pop: { initial: { opacity: 0, scale: 0.98 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.98 } },
  backdrop: { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } },
  listStagger: (stagger = 0.06, delay = 0) => ({ animate: { transition: { staggerChildren: stagger, delayChildren: delay } } }),
  item: { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: 10 } },
});

export default function DonateMealModal({ open, onClose, campaign, globalGateways = [], mealPrice = 10000 }) {
  const { pop, backdrop } = useAnim();
  const gateways = useMemo(() => gatewaysForCampaign(campaign, globalGateways), [campaign, globalGateways]);
  const [tab, setTab] = useState("money");

  // Tab "money" states
  const [mealsMoney, setMealsMoney] = useState(10);
  const [method, setMethod] = useState(gateways?.[0]?.code || "momo");
  const [paying, setPaying] = useState(false);
  const [payErr, setPayErr] = useState("");
  const [qr, setQr] = useState({ img: "", svg: "" });

  // Tab "in_kind" states
  const [mealsKind, setMealsKind] = useState(10);
  const [submittingKind, setSubmittingKind] = useState(false);
  const [submitMsg, setSubmitMsg] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactNote, setContactNote] = useState("");
  const [selectedPointId, setSelectedPointId] = useState(null);

  const { nearest, loading: loadingPoints, error: pointsErr, geoError, getMyLocation } = usePickupPoints();

  useEffect(() => {
    if (!open) return;
    setTab("money");
    setMealsMoney(10);
    setMethod(gateways?.[0]?.code || "momo");
    setPaying(false);
    setPayErr("");
    setQr({ img: "", svg: "" });
    setMealsKind(10);
    setSubmittingKind(false);
    setSubmitMsg("");
    setContactName("");
    setContactPhone("");
    setContactNote("");
    setSelectedPointId(null);
  }, [open, gateways]);

  async function createMealPayment() {
    try {
      setPayErr(""); setPaying(true); setQr({ img: "", svg: "" });
      const amount = Number(mealsMoney || 0) * Number(mealPrice || 0);
      if (!amount || amount < mealPrice) { setPayErr("Số bữa không hợp lệ."); return; }

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

      const resp = await createPayment({ method: m, amount, campaign_id: campaign?.id, orderInfo: `Ủng hộ ${mealsMoney} bữa ăn (${mealPrice.toLocaleString("vi-VN")}đ/bữa)` });
      if (resp?.pay_url) { window.location.href = resp.pay_url; return; }
      if (resp?.qr_image || resp?.qr_svg) { setQr({ img: resp.qr_image || "", svg: resp.qr_svg || "" }); return; }
      setPayErr("Chưa nhận được liên kết thanh toán/QR.");
    } catch (e) {
      setPayErr(e?.message || "Không tạo được thanh toán.");
    } finally {
      setPaying(false);
    }
  }

  async function registerInKind() {
    try {
      setSubmittingKind(true); setSubmitMsg("");
      const servings = Number(mealsKind || 0);
      if (!servings || servings <= 0) { setSubmitMsg("Số bữa không hợp lệ."); return; }
      if (!selectedPointId) { setSubmitMsg("Vui lòng chọn một điểm tập trung."); return; }
      if (!contactName?.trim() || !contactPhone?.trim()) { setSubmitMsg("Vui lòng nhập họ tên và số điện thoại liên hệ."); return; }

      const body = { type: "food", amount: 0, qty: servings, currency: "VND", donor_name: contactName.trim(), donor_note: contactNote?.trim() || "", memo: `IN_KIND | pickup_point=${selectedPointId}${contactPhone ? ` | phone=${contactPhone}` : ""}`, pickup_point_id: selectedPointId, in_kind: true, paid_at: new Date().toISOString() };
      let res = await apiPost(`/api/campaigns/${campaign?.id}/donations`, body).catch((e) => ({ ok: false, status: e?.status, message: e?.message }));
      if (!res?.ok && (res?.status === 404 || res?.status === 405)) {
        res = await apiPost("/api/meals/donate", { campaign_id: campaign?.id, servings, pickup_point_id: selectedPointId, in_kind: true, contact_name: contactName.trim(), contact_phone: contactPhone.trim(), contact_note: contactNote?.trim() || "" }).catch((e) => ({ ok: false, message: e?.message }));
      }
      if (res?.ok) {
        setSubmitMsg("Đăng ký gửi bữa thành công! Chúng tôi sẽ liên hệ xác nhận.");
        setMealsKind(10); setSelectedPointId(null); setContactName(""); setContactPhone(""); setContactNote("");
      } else {
        setSubmitMsg(res?.message || "Gửi yêu cầu thất bại. Vui lòng thử lại.");
      }
    } finally {
      setSubmittingKind(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[60] grid place-items-center" {...backdrop}>
          <motion.div className="absolute inset-0 bg-black/60" onClick={onClose} />
          <motion.div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto" {...pop}>
            <Card>
              <div className="p-5 border-b border-slate-200 flex items-start gap-3">
                <div className="flex-1">
                  <div className="text-lg font-bold text-slate-900">Ủng hộ bữa ăn</div>
                  <div className="text-sm text-slate-700">{campaign?.title}</div>
                </div>
                <Button variant="ghost" onClick={onClose}>Đóng</Button>
              </div>
              <div className="px-5 pt-4">
                <div className="inline-flex rounded-xl border border-slate-300 bg-white overflow-hidden">
                  <button onClick={() => setTab("money")} className={`px-4 py-2 text-sm font-medium transition ${tab === "money" ? "bg-emerald-600 text-white" : "hover:bg-slate-50 text-slate-800"}`}>Tài trợ tiền</button>
                  <button onClick={() => setTab("in_kind")} className={`px-4 py-2 text-sm font-medium border-l border-slate-300 transition ${tab === "in_kind" ? "bg-emerald-600 text-white" : "hover:bg-slate-50 text-slate-800"}`}>Gửi bữa đến điểm tập trung</button>
                </div>
              </div>
              {tab === "money" ? (
                <div className="p-5 space-y-5">
                  <Card className="p-4">
                    <div className="text-sm font-medium text-slate-800">Số bữa (mỗi bữa {mealPrice.toLocaleString("vi-VN")}đ)</div>
                    <div className="mt-2 flex items-center gap-2">
                      <Input type="number" min={1} step={1} value={mealsMoney} onChange={(e) => setMealsMoney(e.target.value)} className="w-40" />
                      <div className="flex gap-2">{[5, 10, 20, 50].map((v) => <button key={v} type="button" onClick={() => setMealsMoney(v)} className={`px-3 py-1 rounded-xl border text-[14px] ${Number(mealsMoney) === v ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-slate-300 bg-white hover:bg-slate-50"}`}>{v}</button>)}</div>
                    </div>
                    <div className="mt-2 text-sm">Tổng tiền: <b className="text-emerald-700">{(Number(mealsMoney || 0) * Number(mealPrice || 0)).toLocaleString("vi-VN")} đ</b></div>
                  </Card>
                  <Card className="p-4">
                    <div className="grid sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2">
                        <Select value={method} onChange={(e) => setMethod(e.target.value)}>{gateways.map((g) => <option key={g.code} value={g.code}>{g.name || g.code}</option>)}</Select>
                        <div className="mt-1 text-xs text-slate-600">{campaign?.payment_method ? `Cấu hình của chiến dịch: ${campaign.payment_method}` : "Mặc định MoMo nếu không cấu hình riêng."}</div>
                      </div>
                      <div className="flex items-end"><Button className="w-full" onClick={createMealPayment} disabled={paying || !method || Number(mealsMoney) <= 0}>{paying ? "Đang tạo thanh toán…" : "Ủng hộ bằng tiền"}</Button></div>
                    </div>
                    {payErr && <div className="mt-2 text-sm text-rose-600">{payErr}</div>}
                    {(qr.img || qr.svg) && <div className="mt-3 flex flex-col items-center gap-2">{qr.svg ? <div className="w-56 h-56 bg-white rounded-xl p-2" dangerouslySetInnerHTML={{ __html: qr.svg }} /> : <img src={qr.img} alt="QR" className="w-56 h-56 object-contain bg-white rounded-xl p-2 border border-slate-200" />}<div className="text-xs text-slate-600">Quét QR để thanh toán</div></div>}
                  </Card>
                </div>
              ) : (
                <div className="p-5 space-y-5">
                  <Card className="p-4">
                    <div className="text-sm font-medium text-slate-800">Số bữa bạn sẽ gửi</div>
                    <div className="mt-2 flex items-center gap-2">
                      <Input type="number" min={1} step={1} value={mealsKind} onChange={(e) => setMealsKind(e.target.value)} className="w-40" />
                      <div className="flex gap-2">{[5, 10, 20, 50].map((v) => <button key={v} type="button" onClick={() => setMealsKind(v)} className={`px-3 py-1 rounded-xl border text-[14px] ${Number(mealsKind) === v ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-slate-300 bg-white hover:bg-slate-50"}`}>{v}</button>)}</div>
                    </div>
                    <div className="mt-1 text-xs text-slate-600">Bạn sẽ chủ động mang bữa tới điểm tập trung phù hợp. Chúng tôi sẽ xác nhận khi nhận được.</div>
                  </Card>
                  <PickupPointsSection getMyLocation={getMyLocation} geoErr={geoError} loadingPoints={loadingPoints} pointsErr={pointsErr} nearest={nearest} selectedPointId={selectedPointId} onSelectPoint={setSelectedPointId} />
                  <Card className="p-4">
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div><div className="text-sm font-medium text-slate-800">Họ tên người liên hệ</div><Input value={contactName} onChange={(e) => setContactName(e.target.value)} className="mt-1" /></div>
                      <div><div className="text-sm font-medium text-slate-800">Số điện thoại</div><Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className="mt-1" /></div>
                    </div>
                    <div className="mt-3"><div className="text-sm font-medium text-slate-800">Ghi chú (tuỳ chọn)</div><Input value={contactNote} onChange={(e) => setContactNote(e.target.value)} className="mt-1" /></div>
                    <div className="mt-4 flex items-center justify-between">
                      <div className="text-sm text-slate-700">{selectedPointId ? <>Đã chọn điểm: <b>{selectedPointId}</b></> : "Chưa chọn điểm tập trung."}</div>
                      <Button onClick={registerInKind} disabled={submittingKind}>{submittingKind ? "Đang gửi…" : "Đăng ký gửi bữa"}</Button>
                    </div>
                    {submitMsg && <div className="mt-3 text-sm text-emerald-700">{submitMsg}</div>}
                  </Card>
                </div>
              )}
              <div className="p-5 border-t border-slate-200 flex items-center justify-end gap-2"><Button variant="ghost" onClick={onClose}>Đóng</Button></div>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function PickupPointsSection({ getMyLocation, geoErr, loadingPoints, pointsErr, nearest, selectedPointId, onSelectPoint }) {
  const { listStagger, item } = useAnim();
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-medium text-slate-800">Chọn điểm tập trung để gửi bữa</div>
          <div className="text-xs text-slate-600">Bấm <b>Lấy vị trí của tôi</b> để sắp theo khoảng cách.</div>
        </div>
        <Button variant="ghost" onClick={getMyLocation}>Lấy vị trí của tôi</Button>
      </div>
      {geoErr && <div className="mt-2 text-sm text-amber-700">{geoErr}</div>}
      <div className="mt-3">
        {loadingPoints ? (
          <div className="flex items-center gap-3 text-slate-800"><div className="h-4 w-4 rounded-full border-2 border-slate-300 border-t-transparent animate-spin" />Đang tải điểm tập trung…</div>
        ) : pointsErr ? (
          <div className="text-sm text-amber-700">{pointsErr}</div>
        ) : !nearest?.length ? (
          <div className="text-sm text-slate-700">Chưa có điểm tập trung khả dụng.</div>
        ) : (
          <motion.ul className="divide-y divide-slate-200 rounded-xl border border-slate-300 overflow-hidden" {...listStagger(0.05)}>
            {nearest.map((p) => {
              const gmaps = p.lat != null && p.lng != null ? `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.address || p.name)}`;
              const active = selectedPointId === p.id;
              return (
                <motion.li key={p.id} className="p-3 sm:p-4 bg-white" {...item}>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 truncate">{p.name}</div>
                      <div className="text-sm text-slate-800 truncate">{p.address}</div>
                      <div className="text-xs text-slate-600">{p.open_hours ? `Giờ mở cửa: ${p.open_hours}` : "Giờ mở cửa: cập nhật sau"}</div>
                      <div className="text-xs text-slate-600">{p._distance != null && isFinite(p._distance) ? `${p._distance.toFixed(2)} km` : "Khoảng cách: —"}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <a href={gmaps} target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800" title="Chỉ đường">Chỉ đường</a>
                      <motion.button whileTap={{ scale: 0.97 }} onClick={() => onSelectPoint(active ? null : p.id)} className={`px-3 py-1.5 rounded-xl border font-semibold ${active ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-slate-300 bg-white hover:bg-slate-50 text-slate-800"}`}>{active ? "Đã chọn" : "Chọn điểm"}</motion.button>
                    </div>
                  </div>
                </motion.li>
              );
            })}
          </motion.ul>
        )}
      </div>
    </Card>
  );
}