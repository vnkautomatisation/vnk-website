"use client";
// Time pickers. Values are "YYYY-MM-DDTHH:MM" (datetime-local compatible).
// Dates default to the current project week; pass minDate/maxDate to widen.
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { DatePopover } from "@/components/admin/date-popover";

function pad(n: number) { return n.toString().padStart(2, "0"); }

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function startOfWeekISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay()); // getDay(): 0 = Sunday
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// 5-min grid, plus the current value so a 19:47 punch is not blank.
function minuteOptions(current: string): string[] {
  const base = Array.from({ length: 12 }, (_, i) => pad(i * 5));
  if (/^\d{2}$/.test(current) && !base.includes(current)) {
    return [...base, current].sort();
  }
  return base;
}

function parseLocal(v: string): { date: string; h: string; m: string } {
  if (!v || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) {
    const now = new Date();
    return {
      date: todayISO(),
      h: pad(now.getHours()),
      m: pad(Math.floor(now.getMinutes() / 5) * 5),
    };
  }
  const [datePart, timePart] = v.split("T");
  const [h, m] = timePart.split(":");
  return { date: datePart, h, m };
}

// <TimePicker> - date + hour + minute (precise punch times).
export function TimePicker({
  value, onChange, minDate, maxDate, disabled = false,
}: {
  value: string;
  onChange: (v: string) => void;
  minDate?: string;
  maxDate?: string;
  disabled?: boolean;
}) {
  const t = useTranslations("admin.ui");
  const { date, h, m } = useMemo(() => parseLocal(value), [value]);
  const min = minDate ?? startOfWeekISO();
  const max = maxDate ?? todayISO();

  const update = (next: { date?: string; h?: string; m?: string }) => {
    onChange(`${next.date ?? date}T${next.h ?? h}:${next.m ?? m}`);
  };

  const setNow = () => {
    const now = new Date();
    onChange(`${todayISO()}T${pad(now.getHours())}:${pad(Math.floor(now.getMinutes() / 5) * 5)}`);
  };

  const hours = Array.from({ length: 24 }, (_, i) => pad(i));
  const minutes = minuteOptions(m);

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <DatePopover
        value={date}
        onChange={(v) => update({ date: v })}
        min={min}
        max={max}
        disabled={disabled}
      />
      <Select value={h} onValueChange={(v) => update({ h: v })} disabled={disabled}>
        <SelectTrigger className="h-9 w-[78px] text-sm font-mono tabular-nums"><SelectValue /></SelectTrigger>
        <SelectContent className="max-h-[280px]">
          {hours.map((hr) => <SelectItem key={hr} value={hr} className="font-mono">{hr} h</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={m} onValueChange={(v) => update({ m: v })} disabled={disabled}>
        <SelectTrigger className="h-9 w-[72px] text-sm font-mono tabular-nums"><SelectValue /></SelectTrigger>
        <SelectContent className="max-h-[280px]">
          {minutes.map((mn) => <SelectItem key={mn} value={mn} className="font-mono">{mn}</SelectItem>)}
        </SelectContent>
      </Select>
      <button
        type="button"
        onClick={setNow}
        disabled={disabled}
        className="text-[10px] uppercase tracking-wider text-muted-foreground hover:text-[#0F2D52] underline-offset-2 hover:underline px-1"
      >
        {t("maintenant")}
      </button>
    </div>
  );
}

// <HourMinutePicker> - hour + minute only (HH:MM), no date.
export function HourMinutePicker({
  value, onChange, disabled = false,
}: {
  value: string;            // HH:MM
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const [h, m] = useMemo(() => {
    if (!value || !/^\d{2}:\d{2}/.test(value)) {
      const d = new Date();
      return [pad(d.getHours()), pad(Math.floor(d.getMinutes() / 5) * 5)];
    }
    return value.split(":");
  }, [value]);
  const update = (next: { h?: string; m?: string }) => {
    onChange(`${next.h ?? h}:${next.m ?? m}`);
  };
  const hours = Array.from({ length: 24 }, (_, i) => pad(i));
  const minutes = minuteOptions(m);
  return (
    <div className="flex items-center gap-1.5">
      <Select value={h} onValueChange={(v) => update({ h: v })} disabled={disabled}>
        <SelectTrigger className="h-9 w-[78px] text-sm font-mono tabular-nums"><SelectValue /></SelectTrigger>
        <SelectContent className="max-h-[280px]">
          {hours.map((hr) => <SelectItem key={hr} value={hr} className="font-mono">{hr} h</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={m} onValueChange={(v) => update({ m: v })} disabled={disabled}>
        <SelectTrigger className="h-9 w-[72px] text-sm font-mono tabular-nums"><SelectValue /></SelectTrigger>
        <SelectContent className="max-h-[280px]">
          {minutes.map((mn) => <SelectItem key={mn} value={mn} className="font-mono">{mn}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

// <DurationPicker> - date + total duration.
// Output: { date: "YYYY-MM-DD", durationMin: number }
export function DurationPicker({
  date, durationMin, onChange, minDate, maxDate, disabled = false,
}: {
  date: string;             // YYYY-MM-DD
  durationMin: number;      // minutes totales
  onChange: (v: { date: string; durationMin: number }) => void;
  minDate?: string;
  maxDate?: string;
  disabled?: boolean;
}) {
  const min = minDate ?? startOfWeekISO();
  const max = maxDate ?? todayISO();
  const h = Math.floor(Math.max(0, durationMin) / 60);
  const m = Math.max(0, durationMin) % 60;
  const hourOptions = Array.from({ length: 25 }, (_, i) => i); // 0..24h

  const minuteChoices = Array.from(new Set([...Array.from({ length: 12 }, (_, i) => i * 5), m])).sort((a, b) => a - b);

  const setH = (newH: number) => onChange({ date, durationMin: newH * 60 + m });
  const setM = (newM: number) => onChange({ date, durationMin: h * 60 + newM });
  const setDate = (newDate: string) => onChange({ date: newDate, durationMin });

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <DatePopover
        value={date}
        onChange={(v) => setDate(v || todayISO())}
        min={min}
        max={max}
        disabled={disabled}
      />
      <div className="flex items-center gap-1">
        <Select value={String(h)} onValueChange={(v) => setH(Number(v))} disabled={disabled}>
          <SelectTrigger className="h-9 w-[82px] text-sm font-mono tabular-nums"><SelectValue /></SelectTrigger>
          <SelectContent className="max-h-[280px]">
            {hourOptions.map((hr) => (
              <SelectItem key={hr} value={String(hr)} className="font-mono">{hr} h</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(m)} onValueChange={(v) => setM(Number(v))} disabled={disabled}>
          <SelectTrigger className="h-9 w-[94px] text-sm font-mono tabular-nums"><SelectValue /></SelectTrigger>
          <SelectContent className="max-h-[280px]">
            {minuteChoices.map((mn) => (
              <SelectItem key={mn} value={String(mn)} className="font-mono">{pad(mn)} min</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
