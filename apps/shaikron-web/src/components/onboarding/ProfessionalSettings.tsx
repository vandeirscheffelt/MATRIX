import { useState } from "react";
import { useProfessionals } from "@/hooks/api/useProfessionals";
import { useServices } from "@/hooks/api/useServices";
import type { Professional, ProfessionalSchedule, BreakPeriod, DayScheduleOverride } from "@/hooks/api/types";
import { Users, Clock, Briefcase, Plus, Pencil, Trash2, Check, Coffee, Bot, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/LanguageContext";

const DAY_KEYS = ["pro.days.sun", "pro.days.mon", "pro.days.tue", "pro.days.wed", "pro.days.thu", "pro.days.fri", "pro.days.sat"];
const COLORS = [
  "217 91% 60%", "142 71% 45%", "32 95% 55%", "280 65% 60%",
  "350 80% 55%", "190 80% 45%", "45 90% 50%", "160 60% 45%",
];

interface DayConfig {
  working: boolean;
  customHours: boolean;
  start: string;
  end: string;
}

interface EditForm {
  name: string;
  phone: string;
  aiAccess: boolean;
  color: string;
  workingHoursStart: string;
  workingHoursEnd: string;
  days: DayConfig[];
  customPerDay: boolean;
  breakEnabled: boolean;
  breakStart: string;
  breakEnd: string;
  selectedServices: string[];
}

function emptyForm(): EditForm {
  return {
    name: "",
    phone: "",
    aiAccess: false,
    color: COLORS[0],
    workingHoursStart: "08:00",
    workingHoursEnd: "18:00",
    days: DAY_KEYS.map((_, i) => ({
      working: i >= 1 && i <= 5,
      customHours: false,
      start: "08:00",
      end: "18:00",
    })),
    customPerDay: false,
    breakEnabled: false,
    breakStart: "12:00",
    breakEnd: "13:00",
    selectedServices: [],
  };
}

function proToForm(pro: Professional): EditForm {
  const hasOverrides = pro.schedule.dayOverrides && Object.keys(pro.schedule.dayOverrides).length > 0;
  const days = DAY_KEYS.map((_, i) => {
    const isOff = pro.schedule.daysOff.includes(i);
    const override = pro.schedule.dayOverrides?.[i];
    return {
      working: !isOff && !override?.isOff,
      customHours: !!override && !override.isOff,
      start: override?.workingHoursStart ?? pro.schedule.workingHoursStart,
      end: override?.workingHoursEnd ?? pro.schedule.workingHoursEnd,
    };
  });

  return {
    name: pro.name,
    phone: pro.phone ?? "",
    aiAccess: pro.aiAccess ?? false,
    color: pro.color,
    workingHoursStart: pro.schedule.workingHoursStart,
    workingHoursEnd: pro.schedule.workingHoursEnd,
    days,
    customPerDay: !!hasOverrides,
    breakEnabled: pro.schedule.breakPeriod?.enabled ?? false,
    breakStart: pro.schedule.breakPeriod?.start ?? "12:00",
    breakEnd: pro.schedule.breakPeriod?.end ?? "13:00",
    selectedServices: [...pro.services],
  };
}

function formToSchedule(form: EditForm): ProfessionalSchedule {
  const daysOff: number[] = [];
  const dayOverrides: Record<number, DayScheduleOverride> = {};

  form.days.forEach((day, i) => {
    if (!day.working) {
      daysOff.push(i);
    } else if (form.customPerDay && day.customHours) {
      dayOverrides[i] = { workingHoursStart: day.start, workingHoursEnd: day.end };
    }
  });

  const breakPeriod: BreakPeriod = {
    enabled: form.breakEnabled,
    start: form.breakStart,
    end: form.breakEnd,
  };

  return {
    workingHoursStart: form.workingHoursStart,
    workingHoursEnd: form.workingHoursEnd,
    daysOff,
    breakPeriod,
    dayOverrides: Object.keys(dayOverrides).length > 0 ? dayOverrides : undefined,
  };
}

/* ─── Professional Card ─────────────────────────────────────────────── */
function ProfessionalCard({
  pro,
  services,
  onEdit,
  onRemove,
  canRemove,
}: {
  pro: Professional;
  services: { id: string; name: string; duration: number }[];
  onEdit: () => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const { t } = useLanguage();
  const proServices = services.filter((s) => pro.services.includes(s.id));
  return (
    <div className={`rounded-lg border bg-secondary p-4 space-y-3 ${pro.aiAccess ? "border-primary/40 ring-1 ring-primary/20" : "border-border"}`}>
      <div className="flex items-center gap-3">
        <div
          className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-primary-foreground"
          style={{ background: `hsl(${pro.color})` }}
        >
          {pro.name.charAt(0)}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">{pro.name}</span>
            {pro.aiAccess && (
              <Badge variant="default" className="text-[9px] px-1.5 py-0 h-4 gap-0.5">
                <Bot className="h-2.5 w-2.5" />
                AI
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {pro.schedule.workingHoursStart} – {pro.schedule.workingHoursEnd}
            {pro.schedule.breakPeriod?.enabled && (
              <span className="inline-flex items-center gap-0.5 text-muted-foreground">
                <Coffee className="h-3 w-3" />
                {pro.schedule.breakPeriod.start}–{pro.schedule.breakPeriod.end}
              </span>
            )}
          </div>
          {pro.phone && (
            <div className="flex items-center gap-1 mt-0.5 text-[10px] text-muted-foreground">
              <Phone className="h-2.5 w-2.5" />
              {pro.phone}
            </div>
          )}
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          {canRemove && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onRemove}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Days */}
      <div className="flex gap-1">
        {DAY_KEYS.map((dayKey, idx) => {
          const isOff = pro.schedule.daysOff.includes(idx) || pro.schedule.dayOverrides?.[idx]?.isOff;
          const override = !isOff && pro.schedule.dayOverrides?.[idx];
          return (
            <span
              key={dayKey}
              className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                isOff
                  ? "bg-muted text-muted-foreground/40 line-through"
                  : override
                  ? "bg-accent text-accent-foreground"
                  : "bg-primary/10 text-primary"
              }`}
              title={override ? `${override.workingHoursStart}–${override.workingHoursEnd}` : undefined}
            >
              {t(dayKey)}
            </span>
          );
        })}
      </div>

      {/* Services */}
      <div className="flex flex-wrap gap-1.5">
        {proServices.map((svc) => (
          <span
            key={svc.id}
            className="inline-flex items-center gap-1 text-[10px] font-medium rounded-full px-2 py-0.5 bg-muted text-muted-foreground"
          >
            <Briefcase className="h-2.5 w-2.5" />
            {svc.name}
            <span className="text-muted-foreground/60">({svc.duration}m)</span>
          </span>
        ))}
        {proServices.length === 0 && (
          <span className="text-[10px] text-muted-foreground/50 italic">{t("pro.noServices")}</span>
        )}
      </div>
    </div>
  );
}

/* ─── Edit Modal ────────────────────────────────────────────────────── */
function EditModal({
  open,
  isNew,
  form,
  setForm,
  services,
  onSave,
  onClose,
}: {
  open: boolean;
  isNew: boolean;
  form: EditForm;
  setForm: React.Dispatch<React.SetStateAction<EditForm>>;
  services: { id: string; name: string; duration: number }[];
  onSave: () => void;
  onClose: () => void;
}) {
  const { t } = useLanguage();

  const toggleService = (svcId: string) => {
    setForm(prev => ({
      ...prev,
      selectedServices: prev.selectedServices.includes(svcId)
        ? prev.selectedServices.filter(s => s !== svcId)
        : [...prev.selectedServices, svcId],
    }));
  };

  const toggleDay = (idx: number) => {
    setForm(prev => ({
      ...prev,
      days: prev.days.map((d, i) => i === idx ? { ...d, working: !d.working } : d),
    }));
  };

  const setDayHours = (idx: number, field: "start" | "end", value: string) => {
    setForm(prev => ({
      ...prev,
      days: prev.days.map((d, i) => i === idx ? { ...d, [field]: value, customHours: true } : d),
    }));
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? t("pro.addProfessional") : t("pro.editProfessional")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 pt-2">
          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">{t("pro.name")}</label>
            <Input
              value={form.name}
              onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder={t("pro.namePlaceholder")}
              className="h-9"
            />
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
              {t("pro.whatsappNumber")}
            </label>
            <Input
              value={form.phone}
              onChange={e => setForm(prev => ({ ...prev, phone: e.target.value }))}
              placeholder="+55 11 99999-9999"
              className="h-9"
            />
            <p className="text-[10px] text-muted-foreground">{t("pro.phoneOptional") ?? "Obrigatório — usado como identificador único pelo WhatsApp"}</p>
          </div>

          {/* AI Access */}
          <div className="rounded-lg border border-border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <Bot className="h-3.5 w-3.5 text-muted-foreground" />
                {t("pro.enableAiAccess")}
              </label>
              <Switch
                checked={form.aiAccess}
                onCheckedChange={v => setForm(prev => ({ ...prev, aiAccess: v }))}
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              {t("pro.aiAccessDesc")}
            </p>
            {form.aiAccess && (
              <Badge variant="secondary" className="text-[10px] font-medium">
                {t("pro.perMonth")}
              </Badge>
            )}
          </div>

          {/* Color */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">{t("pro.color")}</label>
            <div className="flex gap-2">
              {COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  className={`h-7 w-7 rounded-full border-2 transition-all ${form.color === c ? "border-foreground scale-110" : "border-transparent"}`}
                  style={{ background: `hsl(${c})` }}
                  onClick={() => setForm(prev => ({ ...prev, color: c }))}
                />
              ))}
            </div>
          </div>

          {/* Default Working Hours */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">{t("pro.defaultHours")}</label>
            <div className="flex items-center gap-2">
              <Input
                type="time"
                value={form.workingHoursStart}
                onChange={e => setForm(prev => ({ ...prev, workingHoursStart: e.target.value }))}
                className="h-9 w-28"
              />
              <span className="text-xs text-muted-foreground">{t("pro.to")}</span>
              <Input
                type="time"
                value={form.workingHoursEnd}
                onChange={e => setForm(prev => ({ ...prev, workingHoursEnd: e.target.value }))}
                className="h-9 w-28"
              />
            </div>
          </div>

          {/* Break */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <Coffee className="h-3.5 w-3.5 text-muted-foreground" />
                {t("pro.breakLunch")}
              </label>
              <Switch
                checked={form.breakEnabled}
                onCheckedChange={v => setForm(prev => ({ ...prev, breakEnabled: v }))}
              />
            </div>
            {form.breakEnabled && (
              <div className="flex items-center gap-2 pl-5">
                <Input
                  type="time"
                  value={form.breakStart}
                  onChange={e => setForm(prev => ({ ...prev, breakStart: e.target.value }))}
                  className="h-8 w-28 text-xs"
                />
                <span className="text-xs text-muted-foreground">{t("pro.to")}</span>
                <Input
                  type="time"
                  value={form.breakEnd}
                  onChange={e => setForm(prev => ({ ...prev, breakEnd: e.target.value }))}
                  className="h-8 w-28 text-xs"
                />
              </div>
            )}
          </div>

          {/* Working Days */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-foreground">{t("pro.workingDays")}</label>
              <button
                type="button"
                className="text-[10px] text-primary hover:underline"
                onClick={() => setForm(prev => ({ ...prev, customPerDay: !prev.customPerDay }))}
              >
                {form.customPerDay ? t("pro.useDefaultHours") : t("pro.customizePerDay")}
              </button>
            </div>
            <div className="space-y-1.5">
              {DAY_KEYS.map((dayKey, idx) => (
                <div key={dayKey} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleDay(idx)}
                    className={`text-xs font-medium w-10 py-1 rounded-md border transition-colors text-center ${
                      form.days[idx].working
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted text-muted-foreground border-border"
                    }`}
                  >
                    {t(dayKey)}
                  </button>
                  {form.customPerDay && form.days[idx].working && (
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="time"
                        value={form.days[idx].start}
                        onChange={e => setDayHours(idx, "start", e.target.value)}
                        className="h-7 w-24 text-xs"
                      />
                      <span className="text-[10px] text-muted-foreground">–</span>
                      <Input
                        type="time"
                        value={form.days[idx].end}
                        onChange={e => setDayHours(idx, "end", e.target.value)}
                        className="h-7 w-24 text-xs"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Services */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">{t("pro.services")}</label>
            <div className="space-y-2">
              {services.map(svc => (
                <label key={svc.id} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={form.selectedServices.includes(svc.id)}
                    onCheckedChange={() => toggleService(svc.id)}
                  />
                  <span className="text-sm text-foreground">{svc.name}</span>
                  <span className="text-xs text-muted-foreground">({svc.duration}m)</span>
                </label>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={onClose}>{t("pro.cancel")}</Button>
            <Button size="sm" onClick={onSave} disabled={!form.name.trim()}>
              <Check className="h-3.5 w-3.5 mr-1" />
              {isNew ? t("pro.add") : t("pro.save")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Main Component ────────────────────────────────────────────────── */
export default function ProfessionalSettings() {
  const { professionals, addProfessional, updateProfessional, removeProfessional } = useProfessionals();
  const { services } = useServices();
  const { t } = useLanguage();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EditForm>(emptyForm());

  const openAdd = () => {
    setForm({ ...emptyForm(), color: COLORS[professionals.length % COLORS.length] });
    setEditingId("new");
  };

  const openEdit = (pro: Professional) => {
    setForm(proToForm(pro));
    setEditingId(pro.id);
  };

  const save = () => {
    if (!form.name.trim()) return;
    const data = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      aiAccess: form.aiAccess,
      color: form.color,
      services: form.selectedServices,
      schedule: formToSchedule(form),
    };
    if (editingId === "new") {
      addProfessional(data);
    } else if (editingId) {
      updateProfessional(editingId, data);
    }
    console.log("Saved professionals:", editingId, data);
    setEditingId(null);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            {t("pro.title")}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("pro.subtitle")}
          </p>
        </div>
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={openAdd}>
          <Plus className="h-3.5 w-3.5" /> {t("pro.add")}
        </Button>
      </div>

      <div className="space-y-3">
        {professionals.map((pro) => (
          <ProfessionalCard
            key={pro.id}
            pro={pro}
            services={services}
            onEdit={() => openEdit(pro)}
            onRemove={() => removeProfessional(pro.id)}
            canRemove={professionals.length > 1}
          />
        ))}
      </div>

      <EditModal
        open={editingId !== null}
        isNew={editingId === "new"}
        form={form}
        setForm={setForm}
        services={services}
        onSave={save}
        onClose={() => setEditingId(null)}
      />
    </div>
  );
}
