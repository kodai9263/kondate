import { createMobileRequestClient } from "@/lib/supabase/mobile";
import { z } from "zod";
import { canAccessHousehold } from "@/lib/billing/entitlements";
import { buildMobileShoppingSnapshot } from "@/lib/shopping/mobileSnapshot";
import { getPlannedShopping, getSavedShoppingState } from "@/lib/shopping/server";
import { isShoppingRange } from "@/lib/shopping/period";
import { buildShoppingItemKey, seasoningShoppingCategory } from "@/lib/services/shoppingService";
import type { Json } from "@/types/database";

const noStore = { "Cache-Control": "private, no-store", Vary: "Origin" };
const checkSchema = z.object({
  weekStart: z.string().date(), rangeStart: z.string().date(), rangeEnd: z.string().date(),
  periodMode: z.enum(["today", "week", "custom"]),
  item: z.object({
    source: z.enum(["auto", "manual"]), id: z.string().uuid().optional(),
    category: z.string().trim().min(1).max(80), name: z.string().trim().min(1).max(200),
    position: z.number().int().min(0).max(500), checked: z.boolean(),
  }),
});
const periodFields = checkSchema.pick({ weekStart: true, rangeStart: true, rangeEnd: true, periodMode: true });
const actionSchema = z.discriminatedUnion("action", [
  periodFields.extend({ action: z.literal("add"), name: z.string().trim().min(1).max(200) }),
  periodFields.extend({ action: z.literal("delete"), id: z.string().uuid() }),
  periodFields.extend({ action: z.literal("period"), mode: z.enum(["today", "week", "custom"]),
    start: z.string().date().optional(), end: z.string().date().optional() }),
  periodFields.extend({ action: z.literal("dismiss"), category: z.literal(seasoningShoppingCategory),
    name: z.string().trim().min(1).max(200), position: z.number().int().min(0).max(500) }),
  periodFields.extend({ action: z.literal("restore") }),
  periodFields.extend({ action: z.literal("complete") }),
  periodFields.extend({ action: z.literal("undo"), completionId: z.string().uuid() }),
]);

function allowedOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  if (origin === "capacitor://localhost" || origin === "http://localhost") return origin;
  if (process.env.NODE_ENV !== "production" && origin === process.env.MOBILE_DEV_ORIGIN) return origin;
  return false;
}

function responseHeaders(origin: string | null) {
  return {
    ...noStore,
    ...(origin ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Headers": "Authorization, Content-Type" } : {}),
  };
}

function json(error: string, status: number, origin: string | null) {
  return Response.json({ error }, { status, headers: responseHeaders(origin) });
}

function successfulResult(data: Json): data is { [key: string]: Json | undefined; ok: true } {
  return Boolean(data && typeof data === "object" && !Array.isArray(data) && data.ok === true);
}

export function OPTIONS(request: Request) {
  const origin = allowedOrigin(request);
  if (origin === false || origin === null) return new Response(null, { status: 403, headers: noStore });
  return new Response(null, { status: 204, headers: {
    ...responseHeaders(origin),
    "Access-Control-Allow-Methods": "GET, PATCH, POST, OPTIONS",
    "Access-Control-Max-Age": "600",
  } });
}

async function authorize(request: Request, origin: string | null) {
  const bearer = request.headers.get("authorization")?.match(/^Bearer ([A-Za-z0-9._~-]{16,4096})$/);
  if (!bearer) return json("unauthenticated", 401, origin);

  const supabase = createMobileRequestClient(bearer[1]);
  const { data: { user }, error: userError } = await supabase.auth.getUser(bearer[1]);
  if (userError || !user) return json("unauthenticated", 401, origin);

  const { data: profile, error: profileError } = await supabase.from("profiles")
    .select("household_id").eq("id", user.id).single();
  if (profileError || !profile?.household_id) return json("household_unavailable", 403, origin);

  const [{ data: subscription, error: subscriptionError }, { data: firstMember, error: firstMemberError }] = await Promise.all([
    supabase.from("household_subscriptions").select("status,current_period_end")
      .eq("household_id", profile.household_id).maybeSingle(),
    supabase.from("profiles").select("id").eq("household_id", profile.household_id)
      .order("created_at", { ascending: true }).limit(1).maybeSingle(),
  ]);
  if (subscriptionError || firstMemberError || !firstMember) return json("household_unavailable", 503, origin);
  if (!canAccessHousehold({ userId: user.id, firstMemberId: firstMember.id,
    status: subscription?.status, currentPeriodEnd: subscription?.current_period_end })) {
    return json("family_access_required", 403, origin);
  }
  return { supabase, accessToken: bearer[1] };
}

export async function GET(request: Request) {
  const origin = allowedOrigin(request);
  if (origin === false) return json("origin_not_allowed", 403, null);

  try {
    const authorized = await authorize(request, origin);
    if (authorized instanceof Response) return authorized;
    const shopping = await getPlannedShopping(authorized.supabase, authorized.accessToken);
    const saved = await getSavedShoppingState(shopping);
    return Response.json(buildMobileShoppingSnapshot(shopping, saved), { headers: responseHeaders(origin) });
  } catch (error) {
    console.error("Mobile shopping snapshot failed", error);
    return json("shopping_unavailable", 503, origin);
  }
}

export async function PATCH(request: Request) {
  const origin = allowedOrigin(request);
  if (origin === false) return json("origin_not_allowed", 403, null);

  try {
    const authorized = await authorize(request, origin);
    if (authorized instanceof Response) return authorized;
    const body: unknown = await request.json().catch(() => undefined);
    const parsed = checkSchema.safeParse(body);
    if (!parsed.success) return json("invalid_request", 400, origin);

    const shopping = await getPlannedShopping(authorized.supabase, authorized.accessToken);
    const { weekStart, rangeStart, rangeEnd, periodMode, item } = parsed.data;
    if (weekStart !== shopping.period.storageWeekStart || rangeStart !== shopping.period.start
      || rangeEnd !== shopping.period.end || periodMode !== shopping.period.mode) {
      return json("shopping_changed", 409, origin);
    }

    if (item.source === "auto") {
      const expected = shopping.groups.find((group) => group.category === item.category)?.items[item.position];
      if (!expected || expected.name !== item.name) return json("shopping_changed", 409, origin);
    } else {
      const saved = await getSavedShoppingState(shopping);
      const expected = saved.manualItems.find((stored) => stored.id === item.id);
      if (!expected || expected.category !== item.category || expected.name !== item.name
        || expected.position !== item.position) return json("shopping_changed", 409, origin);
    }

    const { data, error } = await authorized.supabase.rpc("update_planned_shopping", {
      target_week_start: weekStart, expected_range_start: rangeStart, expected_range_end: rangeEnd,
      expected_period_mode: periodMode, operation: "check", item,
    });
    if (error) throw error;
    if (!data || typeof data !== "object" || Array.isArray(data) || data.ok !== true) {
      return json("shopping_changed", 409, origin);
    }
    const saved = await getSavedShoppingState(shopping);
    return Response.json(buildMobileShoppingSnapshot(shopping, saved), { headers: responseHeaders(origin) });
  } catch (error) {
    console.error("Mobile shopping check failed", error);
    return json("shopping_unavailable", 503, origin);
  }
}

export async function POST(request: Request) {
  const origin = allowedOrigin(request);
  if (origin === false) return json("origin_not_allowed", 403, null);

  try {
    const authorized = await authorize(request, origin);
    if (authorized instanceof Response) return authorized;
    const body: unknown = await request.json().catch(() => undefined);
    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) return json("invalid_request", 400, origin);
    const input = parsed.data;
    if (input.action === "period" && input.mode === "custom" && !isShoppingRange(input.start ?? "", input.end ?? "")) {
      return json("invalid_request", 400, origin);
    }

    const shopping = await getPlannedShopping(authorized.supabase, authorized.accessToken);
    if (input.weekStart !== shopping.period.storageWeekStart || input.rangeStart !== shopping.period.start
      || input.rangeEnd !== shopping.period.end || input.periodMode !== shopping.period.mode) {
      return json("shopping_changed", 409, origin);
    }

    if (input.action === "complete") {
      const saved = await getSavedShoppingState(shopping);
      const checkedKeys = new Set(saved.checkedKeys);
      const autoItems = shopping.groups.flatMap((group) => group.items)
        .filter((item) => checkedKeys.has(buildShoppingItemKey(item.category, item.name)))
        .map(({ category, name, label, position, contributions }) =>
          ({ source: "auto", category, name, label, position, contributions }));
      const manualItems = saved.manualItems.filter((item) => item.checked);
      if (autoItems.length + manualItems.length === 0) return json("nothing_checked", 409, origin);
      const { data, error } = await authorized.supabase.rpc("complete_planned_shopping", {
        target_week_start: input.weekStart, expected_range_start: input.rangeStart,
        expected_range_end: input.rangeEnd, expected_period_mode: input.periodMode,
        auto_items: autoItems, manual_ids: manualItems.map((item) => item.id),
      });
      if (error || !successfulResult(data)) return json("shopping_changed", 409, origin);
      return Response.json({ ok: true, completedCount: data.completed_count }, { headers: responseHeaders(origin) });
    }

    if (input.action === "undo") {
      if (input.completionId !== shopping.latestCompletion?.id) return json("shopping_changed", 409, origin);
      const { data, error } = await authorized.supabase.rpc("undo_planned_shopping_completion", {
        target_completion_id: input.completionId, target_week_start: input.weekStart,
        expected_range_start: input.rangeStart, expected_range_end: input.rangeEnd,
        expected_period_mode: input.periodMode,
      });
      if (error || !successfulResult(data)) return json("shopping_changed", 409, origin);
      return Response.json({ ok: true }, { headers: responseHeaders(origin) });
    }

    let item: { [key: string]: Json | undefined } = {};
    if (input.action === "add") item = { name: input.name };
    if (input.action === "delete") {
      const saved = await getSavedShoppingState(shopping);
      if (!saved.manualItems.some((stored) => stored.id === input.id)) return json("shopping_changed", 409, origin);
      item = { id: input.id };
    }
    if (input.action === "period") item = { mode: input.mode, start: input.start, end: input.end };
    if (input.action === "dismiss") {
      const expected = shopping.groups.find((group) => group.category === input.category)?.items[input.position];
      if (!expected || expected.name !== input.name) return json("shopping_changed", 409, origin);
      item = { category: input.category, name: input.name, position: input.position };
    }
    const { data, error } = await authorized.supabase.rpc("update_planned_shopping", {
      target_week_start: input.weekStart, expected_range_start: input.rangeStart,
      expected_range_end: input.rangeEnd, expected_period_mode: input.periodMode,
      operation: input.action, item,
    });
    if (error || !successfulResult(data)) return json("shopping_changed", 409, origin);
    return Response.json({ ok: true }, { headers: responseHeaders(origin) });
  } catch (error) {
    console.error("Mobile shopping action failed", error);
    return json("shopping_unavailable", 503, origin);
  }
}
