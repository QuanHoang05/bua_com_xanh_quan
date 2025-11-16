import { useEffect, useMemo, useState } from "react";
import { apiGet } from "@/lib/api";

const toNum = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

export function useOverviewStats(featuredCampaigns = []) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      setLoading(true);
      try {
        const s = await apiGet("/api/overview").catch(() => ({}));
        if (isMounted) setStats(s || {});
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => { isMounted = false; };
  }, []);

  const derived = useMemo(() => {
    const s = stats || {};
    const mealsGivenApi = toNum(s.meals_given ?? s.meals ?? s.distributed_meals, 0);
    const mealsFromStatsCampaign = toNum(s.extra_meals ?? s.meals_from_campaigns ?? s.sum_meal_received_qty, 0);
    const mealsFromFeatured = (featuredCampaigns || []).reduce((sum, c) => sum + toNum(c.meal_received_qty, 0), 0);

    const mealsGiven = Math.max(0, mealsGivenApi, mealsFromStatsCampaign, mealsFromFeatured);

    const donors = toNum(s.donors ?? s.total_donors, 0);
    const recipients = toNum(s.recipients ?? s.total_recipients, 0);
    const campaigns = toNum(s.campaigns ?? s.active_campaigns, 0);
    const deliveredMeals = toNum(s.rescued_meals_total ?? s.meals_delivered ?? s.delivered_meals, 0);

    const globalGoal = toNum(s.global_goal ?? s.target_meals ?? s.target_amount, 0);
    const globalRaised = toNum(s.global_raised ?? s.raised_meals ?? s.raised_amount ?? s.raised, 0);
    const progressPct = globalGoal > 0 ? Math.min(100, Math.round((globalRaised / globalGoal) * 100)) : 0;

    return {
      mealsGiven,
      donors,
      recipients,
      campaigns,
      deliveredMeals,
      globalGoal,
      globalRaised,
      progressPct,
      unit: s.unit || "bữa/đồng",
    };
  }, [stats, featuredCampaigns]);

  return {
    loading,
    ...derived,
  };
}