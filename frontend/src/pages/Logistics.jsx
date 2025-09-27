// src/pages/Logistics.jsx
import { useEffect, useState } from "react";
import { apiGet } from "../lib/api";
import { Truck, HandHeart, Users } from "lucide-react";

export default function Logistics() {
  const [stats, setStats] = useState(null);
  const [rows, setRows] = useState([]);

  useEffect(() => {
    apiGet("/api/admin/logistics/overview").then(setStats);
    apiGet("/api/admin/logistics/rows").then(setRows);
  }, []);

  return (
    <div className="p-4 mx-auto max-w-6xl space-y-6">
      <div className="grid md:grid-cols-3 gap-4">
        <Stat kpi="Donations" val={stats?.donations} icon={<HandHeart/>}/>
        <Stat kpi="Requests" val={stats?.requests} icon={<Users/>}/>
        <Stat kpi="Deliveries (ongoing)" val={stats?.deliveries_ongoing} icon={<Truck/>}/>
      </div>
      <div className="overflow-x-auto rounded-2xl border">
        <table className="w-full text-sm">
          <thead><tr className="text-left">
            <th className="py-2 px-2">Delivery</th><th>Donation</th><th>Request</th><th>Courier</th><th>Status</th><th>Pickup</th><th>Dropoff</th>
          </tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.deliveryId} className="border-t">
                <td className="py-2 px-2">#{r.deliveryId}</td>
                <td>#{r.donationId}</td>
                <td>#{r.requestId}</td>
                <td>{r.courierName || "-"}</td>
                <td>{r.status}</td>
                <td>{r.pickupName || r.pickupAddrId}</td>
                <td>{r.dropoffName || r.dropoffAddrId}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
function Stat({kpi, val, icon}) {
  return (
    <div className="rounded-2xl border bg-white p-5">
      <div className="text-slate-500 text-sm">{kpi}</div>
      <div className="text-2xl font-semibold flex items-center gap-2">{icon}{val ?? "—"}</div>
    </div>
  );
}
