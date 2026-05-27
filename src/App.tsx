import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Building2,
  ChevronRight,
  Clock3,
  Hourglass,
  Mail,
  Package,
  Phone,
  RotateCcw,
  Sparkles,
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

type Screen = "welcome" | "options" | "inquiry" | "delivery";
type EnquiryType = "General Enquiry" | "Tenant Enquiry";
type DeliveryStep = 1 | 2 | 3 | 4;
type PackageType = "Parcel" | "Envelope" | "Food Delivery" | "Large Delivery" | "Other";
type tenantsLookupStatus = "loading" | "ready" | "empty" | "error";
type DeliveryEmailStatus = "idle" | "sending" | "sent" | "error";

type tenants = {
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  rawValues: string[];
};

type DeliveryForm = {
  courierCompany: string;
  courierName: string;
  recipientBusiness: string;
  recipientFullName: string;
  recipientEmail: string;
  packageType: PackageType;
};

type DeliverySlip = {
  reference: string;
  recordedAt: string;
};

type GeneralInquiryTopic = {
  id: string;
  label: string;
  keywords: string[];
  answer: string;
  handoff?: string;
};

/* -------------------------------------------------------------------------- */
/* Configuration                                                              */
/* -------------------------------------------------------------------------- */

const CONFIG = {
  businessName: "Scarborough Business Centre",
  heroImage:
    "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1800&q=80",
  subheading: "Professional Office Suites and Business Lounge",
  website: "scarboroughbusinesscentre.com.au",
  phone: "07 3880 4440",
  mobile: "0408 792 959",
  receptionEmail: "hello@scarboroughbusinesscentre.com.au",
  // Paste your Google Apps Script Web App URL below. It must end with /exec.
  googleDeliveryScriptUrl: "https://script.google.com/macros/s/AKfycbwn2pWPtcgVwP4ZpmmPOInIbzb9tRtz-9qiIgWBPaLDbAwnO2F3HOtiik-ONlXdNQO2/exec",
  greeting: "Welcome to Scarborough Business Centre, how can I help you today?",
  deliveryGreeting:
    "I'll just collect some information about the delivery and we'll advise reception.",
  speechRate: 1.0,
  speechPitch: 1.16,
  timeoutSeconds: 15,
} as const;

const OPTIONS = [
  {
    title: "General Enquiry",
    description:
      "Help with directions, facilities, bookings, visitor questions, and general assistance.",
  },
  {
    title: "Tenant Enquiry",
    description:
      "Contact a Tenant | Appointments & Meetings | General Tenant Enquiries.",
  },
  {
    title: "Delivery",
    description: "Register a delivery for a Tenant or recipient.",
  },
] as const;

const COURIERS = [
  "Other / Individual",
  "Australia Post",
  "StarTrack",
  "CouriersPlease",
  "Aramex",
  "TNT",
  "FedEx",
  "DHL Express",
  "UPS",
  "Team Global Express",
  "Direct Freight Express",
  
] as const;

const PACKAGE_TYPES: PackageType[] = [
  "Parcel",
  "Envelope",
  "Food Delivery",
  "Large Delivery",
  "Other",
];

const EMPTY_FORM: DeliveryForm = {
  courierCompany: "",
  courierName: "",
  recipientBusiness: "",
  recipientFullName: "",
  recipientEmail: "",
  packageType: "Parcel",
};

const GENERAL_INQUIRY_TOPICS: GeneralInquiryTopic[] = [
  {
    id: "bookings",
    label: "Business Lounge",
    keywords: ["booking", "book", "meeting", "room", "private office", "desk", "cube", "appointment"],
    answer:
      "You can book meeting rooms, private offices and workspace options. The meeting room is suitable for client meetings, presentations and video calls, with high-speed secure internet and display/casting options available.",
    handoff: "For availability or a specific booking time, the team should confirm that directly.",
  },
  {
    id: "leasing",
    label: "Office Space",
    keywords: ["lease", "leasing", "office suite", "space", "rent", "available", "availability", "price", "pricing"],
    answer:
      "Scarborough Business Centre offers office suites, private offices, desk cubicles and flexible workspace options. Office suites are designed for teams that need a professional workspace with essential services and Business Lounge facilities already in place.",
    handoff: "For current availability, pricing, inspections or lease terms, it is best to speak with the leasing team.",
  },
  {
    id: "facilities",
    label: "Facilities",
    keywords: ["facility", "facilities", "kitchen", "coffee", "printing", "scanning", "internet", "wifi", "nbn", "locker", "access"],
    answer:
      "Facilities include high-speed secure internet, shared kitchen facilities, coffee, printing and scanning, meeting room access, reception areas and secure access options for members.",
  },
  {
    id: "virtual-office",
    label: "Virtual Office",
    keywords: ["virtual", "mail", "mailing", "registered address", "business address", "asic", "address"],
    answer:
      "The Virtual Office service can provide a professional business address, mail handling options, business directory presence and access to Business Lounge services such as meeting rooms and workspace bookings.",
    handoff: "For setup requirements, pricing or application questions, the team can help directly.",
  },
  {
    id: "membership",
    label: "Membership",
    keywords: ["membership", "member", "business lounge", "join", "access", "rates"],
    answer:
      "Business Lounge membership gives access to services and facilities such as meeting rooms, private offices, dedicated cubes, virtual office services, printing and scanning, shared kitchen facilities and reception areas.",
  },
  {
    id: "consultation-room",
    label: "Consultation Room",
    keywords: ["consultation", "psychologist", "counsellor", "counselor", "therapy", "soundproof"],
    answer:
      "The consultation room is a private, soundproof space suited to psychologists, counsellors and professional consultations. It includes comfortable seating, controlled lighting, a work desk, high-speed internet and kitchen access.",
    handoff: "For flexible rental options or to arrange a tour, the team can assist.",
  },
];



const TENANT_CSV_PATHS = ["/tenants.csv", "/Tenant.csv", "/tenant.csv"] as const;

const FIELD_ALIASES = {
  businessName: [
    "tenants Name",
    "tenants",
    "Business",
    "Business Name",
    "Company",
    "Company Name",
    "Organisation",
    "Organization",
    "Store",
    "Shop",
  ],
  contactName: ["Contact", "Contact Name", "Full Name", "Name", "Recipient", "Person"],
  email: ["Email", "Email Address", "E-mail", "Contact Email"],
  phone: ["Phone", "Mobile", "Mobile Phone", "Phone Number", "Contact Number", "Telephone"],
} as const;

/* -------------------------------------------------------------------------- */
/* Utility helpers                                                            */
/* -------------------------------------------------------------------------- */

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function normaliseKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normaliseSearch(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function buildReference(seed = Math.random()) {
  const safe = Math.max(0, Math.min(0.9999, seed));
  return `DLV-${Math.floor(1000 + safe * 9000)}`;
}

function buildTimestamp(date = new Date()) {
  return date.toLocaleString("en-AU", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function findValue(record: Record<string, string>, aliases: readonly string[]) {
  const normalisedRecord = new Map<string, string>();

  Object.entries(record).forEach(([key, value]) => {
    normalisedRecord.set(normaliseKey(key), value);
  });

  for (const alias of aliases) {
    const value = normalisedRecord.get(normaliseKey(alias));
    if (value) return value.trim();
  }

  return "";
}

/* -------------------------------------------------------------------------- */
/* CSV and voice helpers                                                      */
/* -------------------------------------------------------------------------- */

function parseCsvRows(text: string) {
  const clean = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < clean.length; i += 1) {
    const char = clean[i];
    const next = clean[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      row.push(field.trim());
      field = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(field.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);

  return rows;
}

function parsetenantssCsv(text: string): tenants[] {
  const rows = parseCsvRows(text);
  const [headers = [], ...dataRows] = rows;
  const trimmedHeaders = headers.map((header) => header.replace(/^\uFEFF/, "").trim());

  return dataRows
    .map((dataRow) => {
      const record = trimmedHeaders.reduce<Record<string, string>>((acc, header, index) => {
        acc[header] = dataRow[index]?.trim() ?? "";
        return acc;
      }, {});

      const rawValues = Object.values(record).filter(Boolean);

      return {
        businessName: findValue(record, FIELD_ALIASES.businessName),
        contactName: findValue(record, FIELD_ALIASES.contactName),
        email: findValue(record, FIELD_ALIASES.email),
        phone: findValue(record, FIELD_ALIASES.phone),
        rawValues,
      };
    })
    .filter((tenants) => tenants.businessName || tenants.contactName);
}

function chooseVoice(voices: SpeechSynthesisVoice[]) {
  if (!voices.length) return null;

  return voices
    .map((voice) => {
      const name = voice.name.toLowerCase();
      const lang = (voice.lang || "").toLowerCase();
      let score = 0;

      if (lang === "en-au") score += 1000;
      if (lang.startsWith("en-au")) score += 900;
      if (name.includes("siri")) score += 420;
      if (name.includes("apple")) score += 260;
      if (["olivia", "ava", "zoe", "samantha", "victoria", "natasha", "karen", "susan"].some((n) => name.includes(n))) {
        score += 260;
      }
      if (["premium", "enhanced", "neural"].some((n) => name.includes(n))) score += 180;
      if (name.includes("female")) score += 160;
      if (name.includes("male")) score -= 200;
      if (voice.default) score += 25;

      return { voice, score };
    })
    .sort((a, b) => b.score - a.score)[0]?.voice ?? null;
}

function phoneHref(phoneNumber: string) {
  return `tel:${phoneNumber.replace(/[^+\d]/g, "")}`;
}

function inquiryEmailHref(subject: string, body = "") {
  return `mailto:${CONFIG.receptionEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}


function buildDeliveryPayload(form: DeliveryForm, slip: DeliverySlip, courierDisplayName: string) {
  return {
    reference: slip.reference,
    recordedAt: slip.recordedAt,
    recordedAtIso: new Date().toISOString(),
    courier: courierDisplayName,
    courierCompany: form.courierCompany,
    courierName: form.courierName,
    recipientBusiness: form.recipientBusiness,
    recipientFullName: form.recipientFullName,
    recipientEmail: form.recipientEmail,
    packageType: form.packageType,
    parcelBoxInstructions:
      `Please place the ${(form.packageType || "item").toLowerCase()} in the parcel box just in front of you. If the parcel is too large, leave it at the base of the Parcel Bin.`,
  };
}

function buildDeliveryEmailBody(form: DeliveryForm, slip: DeliverySlip, courierDisplayName: string) {
  const delivery = buildDeliveryPayload(form, slip, courierDisplayName);

  return [
    "A delivery has been registered from the reception kiosk.",
    "",
    `Registration Number: ${delivery.reference}`,
    `Time of Delivery: ${delivery.recordedAt}`,
    `Courier / Full Name: ${delivery.courier}`,
    `Recipient Business: ${delivery.recipientBusiness || "—"}`,
    `Recipient Full Name: ${delivery.recipientFullName || "—"}`,
    `Recipient Email from tenants list: ${delivery.recipientEmail || "—"}`,
    `Item Type: ${delivery.packageType || "—"}`,
    "",
    "Parcel Box Instructions:",
    delivery.parcelBoxInstructions,
  ].join("\n");
}

/* -------------------------------------------------------------------------- */
/* Shared UI components                                                       */
/* -------------------------------------------------------------------------- */

function InfoPill({
  icon: Icon,
  label,
  value,
  href,
  ariaLabel,
  primary = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  href?: string;
  ariaLabel?: string;
  primary?: boolean;
}) {
  const content = (
    <>
      <div
        className={cx(
          "rounded-2xl border p-3",
          primary ? "border-slate-950/10 bg-slate-950/10" : "border-sky-200/70 bg-white/80"
        )}
      >
        <Icon className={cx("h-5 w-5", primary ? "text-slate-950" : "text-slate-950")} />
      </div>
      <div className="min-w-0 text-left">
        <div className={cx("text-[11px] uppercase tracking-[0.28em]", primary ? "text-slate-900/70" : "text-slate-500")}>
          {label}
        </div>
        <div className={cx("mt-1 break-all text-base font-extrabold", primary ? "text-slate-950" : "text-slate-900")}>{value}</div>
      </div>
    </>
  );

  const className = cx(
    "flex items-center gap-4 rounded-3xl border px-5 py-4 shadow-2xl backdrop-blur-xl transition active:scale-[0.99]",
    primary
      ? "border-emerald-200/80 bg-emerald-400 text-slate-950 shadow-emerald-400/30 ring-2 ring-emerald-200/80 hover:bg-emerald-300"
      : "border-sky-200/80 bg-white/80 text-slate-950 hover:bg-sky-100/80"
  );

  if (href) {
    return (
      <a className={className} href={href} aria-label={ariaLabel ?? `${label}: ${value}`}>
        {content}
      </a>
    );
  }

  return <div className={className}>{content}</div>;
}
function StepBadge({ step, current, label }: { step: DeliveryStep; current: DeliveryStep; label: string }) {
  return (
    <div
      className={cx(
        "rounded-full border px-4 py-2 text-sm",
        current === step && "border-sky-400/70 bg-sky-100/85 text-slate-950",
        current > step && "border-emerald-300/70 bg-emerald-50 text-emerald-700",
        current < step && "border-sky-200/70 bg-white/60 text-slate-500"
      )}
    >
      {step}. {label}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.5rem] border border-sky-200/70 bg-white/60 p-5">
      <p className="text-sm uppercase tracking-[0.28em] text-slate-500">{label}</p>
      <p className="mt-3 text-xl font-semibold text-slate-950">{value || "—"}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <div className="text-sm font-medium text-slate-800">{label}</div>
      {children}
    </label>
  );
}

function PrimaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className, ...rest } = props;
  return (
    <button
      className={cx(
        "inline-flex min-h-[3.75rem] items-center justify-center rounded-2xl bg-sky-500 px-6 text-base font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:bg-sky-400 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...rest}
    />
  );
}

function SecondaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className, ...rest } = props;
  return (
    <button
      className={cx(
        "inline-flex min-h-[3.75rem] items-center justify-center rounded-2xl border border-sky-200/70 bg-white/80 px-6 text-base font-medium text-slate-950 transition hover:bg-sky-100/85 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...rest}
    />
  );
}

function HomeButton({ onHome }: { onHome: () => void }) {
  return (
    <SecondaryButton onClick={onHome}>
      <span className="mr-2 flex h-6 w-6 items-center justify-center rounded-full bg-white/80">
        <RotateCcw className="h-3.5 w-3.5" />
      </span>
      Home
    </SecondaryButton>
  );
}

const TextInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function TextInput(props, ref) {
    const { className, ...rest } = props;
    return (
      <input
        ref={ref}
        className={cx(
          "min-h-[3.75rem] w-full rounded-2xl border border-sky-200/70 bg-white/80 px-4 text-base text-slate-950 outline-none placeholder:text-slate-400 md:text-lg",
          className
        )}
        {...rest}
      />
    );
  }
);

function SelectInput({
  value,
  onChange,
  options,
  placeholder,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  placeholder: string;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={`min-h-[3.75rem] w-full rounded-2xl border border-sky-200/70 bg-white/80 px-4 text-base text-slate-950 outline-none md:text-lg ${className}`}
    >
      <option value="" style={{ color: "black" }}>
        {placeholder}
      </option>
      {options.map((option) => (
        <option key={option} value={option} style={{ color: "black" }}>
          {option}
        </option>
      ))}
    </select>
  );
}

/* -------------------------------------------------------------------------- */
/* Main app                                                                   */
/* -------------------------------------------------------------------------- */

export default function App() {
  const [screen, setScreen] = useState<Screen>("welcome");
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [enquiryType, setEnquiryType] = useState<EnquiryType | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const [deliveryStep, setDeliveryStep] = useState<DeliveryStep>(1);
  const [deliveryForm, setDeliveryForm] = useState<DeliveryForm>(EMPTY_FORM);
  const [deliverySlip, setDeliverySlip] = useState<DeliverySlip | null>(null);
  const [deliveryEmailStatus, setDeliveryEmailStatus] = useState<DeliveryEmailStatus>("idle");
  const [deliveryEmailError, setDeliveryEmailError] = useState("");
  const [confirmTimeoutActive, setConfirmTimeoutActive] = useState(false);
  const [confirmTimeoutRemaining, setConfirmTimeoutRemaining] = useState<number>(CONFIG.timeoutSeconds);

  const [currentDateTime, setCurrentDateTime] = useState("");
  const [tenantss, settenantss] = useState<tenants[]>([]);
  const [tenantsSearchResults, settenantsSearchResults] = useState<tenants[]>([]);
  const [tenantsLookupStatus, settenantsLookupStatus] = useState<tenantsLookupStatus>("loading");
  const [recipientKeyboardLocked, setRecipientKeyboardLocked] = useState(false);
  const [tenantsInquiryQuery, settenantsInquiryQuery] = useState("");
  const [tenantsInquiryResults, settenantsInquiryResults] = useState<tenants[]>([]);
  const [selectedtenantsInquiry, setSelectedtenantsInquiry] = useState<tenants | null>(null);
  const [tenantsInquiryKeyboardLocked, settenantsInquiryKeyboardLocked] = useState(false);

  const [generalInquiryTopicId, setGeneralInquiryTopicId] = useState("bookings");

  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const recipientSearchInputRef = useRef<HTMLInputElement>(null);
  const tenantsInquiryInputRef = useRef<HTMLInputElement>(null);
  const tenantsInquiryPointerStartYRef = useRef<number | null>(null);

  const updateField = useCallback(<K extends keyof DeliveryForm>(field: K, value: DeliveryForm[K]) => {
    setDeliveryForm((current) => ({ ...current, [field]: value }));
  }, []);

  const resetDelivery = useCallback(() => {
    setDeliveryStep(1);
    setDeliveryForm(EMPTY_FORM);
    setDeliverySlip(null);
    setDeliveryEmailStatus("idle");
    setDeliveryEmailError("");
    setConfirmTimeoutActive(false);
    setConfirmTimeoutRemaining(CONFIG.timeoutSeconds);
    settenantsSearchResults([]);
    setRecipientKeyboardLocked(false);
  }, []);

  const resetGeneralInquiry = useCallback(() => {
    setGeneralInquiryTopicId("bookings");
  }, []);

  const resetToWelcome = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    setIsSpeaking(false);
    setSelectedOption(null);
    setEnquiryType(null);
    resetGeneralInquiry();
    settenantsInquiryQuery("");
    settenantsInquiryResults([]);
    setSelectedtenantsInquiry(null);
    settenantsInquiryKeyboardLocked(false);
    resetDelivery();
    setScreen("welcome");
  }, [resetDelivery, resetGeneralInquiry]);

  /* Effects ---------------------------------------------------------------- */

  useEffect(() => {
    const formatNow = () => setCurrentDateTime(buildTimestamp());
    formatNow();

    const timerId = window.setInterval(formatNow, 1000);
    return () => window.clearInterval(timerId);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadtenantss() {
      settenantsLookupStatus("loading");

      for (const path of tenants_CSV_PATHS) {
        try {
          const response = await fetch(`${path}?v=${Date.now()}`, { cache: "no-store" });
          if (!response.ok) continue;

          const text = await response.text();
          const parsedtenantss = parsetenantssCsv(text);

          if (!cancelled) {
            settenantss(parsedtenantss);
            settenantsLookupStatus(parsedtenantss.length ? "ready" : "empty");
          }
          return;
        } catch {
          // Try the next supported CSV filename.
        }
      }

      if (!cancelled) {
        settenantss([]);
        settenantsLookupStatus("error");
      }
    }

    loadtenantss();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const loadVoices = () => {
      voicesRef.current = window.speechSynthesis.getVoices();
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.cancel();
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  useEffect(() => {
    if (screen !== "inquiry" || enquiryType !== "General Enquiry") return;

    // General Inquiry should stay open until the visitor chooses Start Over, Home,
    // or another action. Do not let it inherit the delivery receipt timeout.
    setConfirmTimeoutActive(false);
    setConfirmTimeoutRemaining(CONFIG.timeoutSeconds);
  }, [enquiryType, screen]);

  useEffect(() => {
    if (screen !== "inquiry" || enquiryType !== "tenants Enquiry") return;

    // tenants Inquiry should not inherit the delivery receipt timeout.
    // The app-wide idle timeout below handles returning to the welcome screen.
    setConfirmTimeoutActive(false);
    setConfirmTimeoutRemaining(CONFIG.timeoutSeconds);
  }, [enquiryType, screen]);

  useEffect(() => {
    if (screen === "welcome") return;

    // App-wide kiosk idle timeout. Any page left untouched for 30 seconds
    // returns to the front welcome screen. The delivery receipt has its own
    // shorter countdown, so leave that special case alone.
    if (screen === "delivery" && deliveryStep === 4 && confirmTimeoutActive) return;

    let timeoutId: number | undefined;

    const resetIdleTimer = () => {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }

      timeoutId = window.setTimeout(resetToWelcome, 30000);
    };

    // Give the newly opened page a brief grace period so the same tap that
    // navigated here cannot accidentally trigger an old/stale idle reset.
    const startDelayId = window.setTimeout(resetIdleTimer, 500);

    window.addEventListener("pointerdown", resetIdleTimer, true);
    window.addEventListener("touchstart", resetIdleTimer, true);
    window.addEventListener("keydown", resetIdleTimer, true);
    window.addEventListener("wheel", resetIdleTimer, true);
    window.addEventListener("scroll", resetIdleTimer, true);

    return () => {
      window.clearTimeout(startDelayId);
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
      window.removeEventListener("pointerdown", resetIdleTimer, true);
      window.removeEventListener("touchstart", resetIdleTimer, true);
      window.removeEventListener("keydown", resetIdleTimer, true);
      window.removeEventListener("wheel", resetIdleTimer, true);
      window.removeEventListener("scroll", resetIdleTimer, true);
    };
  }, [confirmTimeoutActive, deliveryStep, resetToWelcome, screen]);

  useEffect(() => {
    if (screen !== "delivery" || deliveryStep !== 4 || !confirmTimeoutActive) return;

    const resetTimer = () => setConfirmTimeoutRemaining(CONFIG.timeoutSeconds);
    const intervalId = window.setInterval(() => {
      setConfirmTimeoutRemaining((current) => {
        if (current <= 1) {
          window.clearInterval(intervalId);
          setConfirmTimeoutActive(false);
          resetToWelcome();
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    window.addEventListener("pointerdown", resetTimer, true);
    window.addEventListener("touchstart", resetTimer, true);
    window.addEventListener("keydown", resetTimer, true);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("pointerdown", resetTimer, true);
      window.removeEventListener("touchstart", resetTimer, true);
      window.removeEventListener("keydown", resetTimer, true);
    };
  }, [confirmTimeoutActive, deliveryStep, resetToWelcome, screen]);

  /* Derived values --------------------------------------------------------- */

  const displayCourierName = useMemo(() => {
    return deliveryForm.courierCompany === "Other / Individual"
      ? deliveryForm.courierName || "Individual courier"
      : deliveryForm.courierCompany;
  }, [deliveryForm.courierCompany, deliveryForm.courierName]);

  const canStep1 =
    deliveryForm.courierCompany !== "" &&
    (deliveryForm.courierCompany !== "Other / Individual" || deliveryForm.courierName.trim().length > 0);

  const canStep2 =
    deliveryForm.recipientBusiness.trim().length > 0 && deliveryForm.recipientFullName.trim().length > 0;

  const canStep3 = Boolean(deliveryForm.packageType);

  /* Event handlers -------------------------------------------------------- */

  const speak = useCallback((text: string, onStart?: () => void, onFinish?: () => void) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      onFinish?.();
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const voice = chooseVoice(voicesRef.current);

    utterance.lang = voice?.lang ?? "en-AU";
    if (voice) utterance.voice = voice;
    utterance.rate = CONFIG.speechRate;
    utterance.pitch = CONFIG.speechPitch;
    utterance.volume = 1;
    utterance.onstart = () => {
      setIsSpeaking(true);
      onStart?.();
    };
    utterance.onend = () => {
      setIsSpeaking(false);
      onFinish?.();
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      onFinish?.();
    };

    window.speechSynthesis.speak(utterance);
  }, []);

  const speakGreeting = useCallback(() => {
    // Open the options page immediately, but do not send the app back to
    // options when the welcome voice finishes. Otherwise, if a visitor taps
    // General Enquiry or tenants Enquiry while the greeting is still speaking,
    // the speech onFinish callback can close that enquiry page a few seconds later.
    setScreen("options");
    speak(CONFIG.greeting);
  }, [speak]);

  const speakDeliveryGreeting = useCallback(() => {
    speak(CONFIG.deliveryGreeting, () => setScreen("delivery"), () => setScreen("delivery"));
  }, [speak]);

  const speakConfirmPrompt = useCallback(() => {
    speak(
      `All done". Press the Delivery Receipt button to display a confirmation note and I'll pop an email off to reception letting them know of the delivery. Please place the ${deliveryForm.packageType.toLowerCase()} in the Parcel Bin in front of you. If the parcel is too large, then leave it at the base of the Parcel Bin. Thank you! and Have a Great Day!`,

    );
  }, [deliveryForm.packageType, speak]);

  const handleRecipientSearch = useCallback(
    (value: string) => {
      setRecipientKeyboardLocked(false);
      updateField("recipientBusiness", value);

      const query = normaliseSearch(value);
      if (!query) {
        settenantsSearchResults([]);
        return;
      }

      const matches = tenantss.filter((tenants) => {
        const haystack = normaliseSearch(
          [tenants.businessName, tenants.contactName, tenants.email, tenants.phone, ...tenants.rawValues].join(" ")
        );
        return haystack.includes(query);
      });

      settenantsSearchResults(matches.slice(0, 30));
    },
    [tenantss, updateField]
  );

  const hideRecipientKeyboard = useCallback(() => {
    const input = recipientSearchInputRef.current;

    // iPad Safari is more reliable if the input is temporarily made read-only
    // before blurring. The field is unlocked again the next time the user taps it.
    input?.setAttribute("readonly", "readonly");
    input?.setAttribute("inputmode", "none");
    input?.blur();

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    [40, 120, 260].forEach((delay) => {
      window.setTimeout(() => {
        input?.blur();
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      }, delay);
    });
  }, []);

  const selecttenants = useCallback(
    (tenants: tenants) => {
      setRecipientKeyboardLocked(true);
      setDeliveryForm((current) => ({
        ...current,
        recipientBusiness: tenants.businessName,
        recipientFullName: tenants.contactName,
        recipientEmail: tenants.email,
      }));
      settenantsSearchResults([]);
      hideRecipientKeyboard();
    },
    [hideRecipientKeyboard]
  );

  const goToPreviousDeliveryStep = useCallback(() => {
    if (deliveryStep === 2) {
      setDeliveryForm((current) => ({
        ...current,
        recipientBusiness: "",
        recipientFullName: "",
        recipientEmail: "",
      }));
      settenantsSearchResults([]);
      setRecipientKeyboardLocked(false);
      setDeliveryStep(1);
      return;
    }

    setDeliveryStep((current) => Math.max(1, current - 1) as DeliveryStep);
  }, [deliveryStep]);

  const confirmDelivery = useCallback(async () => {
    const slip = { reference: buildReference(), recordedAt: buildTimestamp() };
    setDeliverySlip(slip);
    setDeliveryEmailStatus("sending");
    setDeliveryEmailError("");
    setConfirmTimeoutRemaining(CONFIG.timeoutSeconds);
    setConfirmTimeoutActive(true);

    const subject = `Delivery registered ${slip.reference} - ${deliveryForm.recipientBusiness || deliveryForm.recipientFullName || "Reception Kiosk"}`;
    const body = buildDeliveryEmailBody(deliveryForm, slip, displayCourierName);
    const delivery = buildDeliveryPayload(deliveryForm, slip, displayCourierName);
    const scriptUrl = CONFIG.googleDeliveryScriptUrl.trim();

    if (!scriptUrl || scriptUrl.includes("PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE")) {
      setDeliveryEmailStatus("error");
      setDeliveryEmailError("Delivery receipt displayed, but the Google Apps Script Web App URL has not been added to App.tsx yet.");
      return;
    }

    try {
      // Apps Script does the real work: it appends the Google Sheet log row and sends the reception email.
      // no-cors avoids browser preflight issues with Google Apps Script web app URLs.
      await fetch(scriptUrl, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          to: CONFIG.receptionEmail,
          subject,
          body,
          delivery,
        }),
      });

      setDeliveryEmailStatus("sent");
    } catch (error) {
      console.error("Delivery log/email advice failed", error);
      setDeliveryEmailStatus("error");
      setDeliveryEmailError("Delivery receipt displayed, but the Google delivery log and reception email request could not be sent.");
    }
  }, [deliveryForm, displayCourierName]);

  const finishDelivery = useCallback(() => {
    resetToWelcome();
  }, [resetToWelcome]);

  const receiveAnotherDelivery = useCallback(() => {
    resetDelivery();
    setScreen("delivery");
  }, [resetDelivery]);

  const handletenantsInquirySearch = useCallback(
    (value: string) => {
      settenantsInquiryKeyboardLocked(false);
      settenantsInquiryQuery(value);
      setSelectedtenantsInquiry(null);

      const query = normaliseSearch(value);
      if (query.length < 3) {
        settenantsInquiryResults([]);
        return;
      }

      const matches = tenantss.filter((tenants) => {
        const haystack = normaliseSearch(
          [tenants.businessName, tenants.contactName, tenants.email, tenants.phone, ...tenants.rawValues].join(" ")
        );
        return haystack.includes(query);
      });

      settenantsInquiryResults(matches.slice(0, 30));
    },
    [tenantss]
  );

  const hidetenantsInquiryKeyboard = useCallback(() => {
    const input = tenantsInquiryInputRef.current;

    // iPad Safari is more reliable when the input is temporarily made read-only
    // before blurring. It unlocks again when the visitor taps inside the field.
    input?.setAttribute("readonly", "readonly");
    input?.setAttribute("inputmode", "none");
    input?.blur();

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    [40, 120, 260].forEach((delay) => {
      window.setTimeout(() => {
        input?.blur();
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      }, delay);
    });
  }, []);

  const selecttenantsInquiry = useCallback(
    (tenants: tenants) => {
      settenantsInquiryKeyboardLocked(true);
      setSelectedtenantsInquiry(tenants);
      settenantsInquiryQuery(tenants.businessName || tenants.contactName);
      settenantsInquiryResults([]);
      hidetenantsInquiryKeyboard();
    },
    [hidetenantsInquiryKeyboard]
  );

  const resettenantsInquiry = useCallback(() => {
    settenantsInquiryQuery("");
    settenantsInquiryResults([]);
    setSelectedtenantsInquiry(null);
    settenantsInquiryKeyboardLocked(false);
  }, []);

  /* Screen renderers ------------------------------------------------------ */

  const renderWelcomeScreen = () => (
    <motion.section
      key="welcome"
      initial={{ opacity: 0, scale: 1.02 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.985 }}
      transition={{ duration: 0.45 }}
      className="relative flex min-h-[100dvh] w-full items-center justify-center py-[max(2rem,env(safe-area-inset-top))]"
    >
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${CONFIG.heroImage})` }} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.65),transparent_36%),linear-gradient(135deg,rgba(248,250,252,0.92),rgba(224,242,254,0.78),rgba(255,255,255,0.92))]" />

      <div className="absolute left-[max(1rem,env(safe-area-inset-left))] top-[max(1rem,env(safe-area-inset-top))] flex items-center gap-3 rounded-full border border-sky-200/80 bg-white/80 px-5 py-3 shadow-2xl backdrop-blur-xl">
        <Building2 className="h-6 w-6" />
        <div>
          <p className="text-xs uppercase tracking-[0.34em] text-slate-500">Reception Kiosk</p>
          <p className="text-sm font-semibold text-slate-950">{CONFIG.businessName}</p>
        </div>
      </div>

      <div className="absolute right-[max(1rem,env(safe-area-inset-right))] top-[max(1rem,env(safe-area-inset-top))] hidden items-center gap-2 rounded-full border border-sky-200/80 bg-white/80 px-4 py-3 text-sm text-slate-800 shadow-2xl backdrop-blur-xl sm:flex">
        <Clock3 className="h-4 w-4" />
        <span>{currentDateTime}</span>
      </div>

      <div className="relative z-10 mx-auto flex max-w-6xl flex-col items-center gap-8 px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.45 }}
          className="space-y-4"
        >
          <p className="text-sm uppercase tracking-[0.42em] text-slate-500">Welcome</p>
          <h1 className="max-w-4xl text-2xl font-medium text-slate-800 md:text-3xl">{CONFIG.subheading}</h1>
        </motion.div>

        <motion.button
          onClick={speakGreeting}
          whileTap={{ scale: 0.97 }}
          animate={{ scale: [1, 1.05, 1], opacity: [0.92, 1, 0.92] }}
          transition={{ duration: 1.9, repeat: Infinity, ease: "easeInOut" }}
          className="rounded-full border border-sky-300/70 bg-white/80 px-16 py-10 text-slate-950 shadow-2xl backdrop-blur-xl md:px-24 md:py-14"
        >
          <div className="flex flex-col items-center gap-2">
            <span className="text-3xl font-medium md:text-4xl">Welcome</span>
            <span className="text-6xl font-semibold tracking-wide md:text-8xl">Check-in</span>
          </div>
        </motion.button>

        <p className="max-w-2xl text-lg text-slate-600 md:text-xl">
          Tap the welcome button to hear the receptionist assistant and continue.
          {isSpeaking ? " Speaking now..." : ""}
        </p>

        <div className="grid w-full max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2">
          <InfoPill
            icon={Phone}
            label="General Enquiries"
            value={CONFIG.phone}
            href={phoneHref(CONFIG.phone)}
            ariaLabel={`Call General Enquiries on ${CONFIG.phone}`}
          />
          <InfoPill
            icon={Phone}
            label="Leasing Enquiries"
            value={CONFIG.mobile}
            href={phoneHref(CONFIG.mobile)}
            ariaLabel={`Call Leasing Enquiries on ${CONFIG.mobile}`}
          />
        </div>
      </div>
    </motion.section>
  );

  const renderOptionsScreen = () => (
    <motion.section
      key="options"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -18 }}
      transition={{ duration: 0.35 }}
      className="relative flex min-h-[100dvh] w-full flex-col bg-[linear-gradient(180deg,#f8fafc_0%,#e0f2fe_100%)]"
    >
      <div className="absolute inset-0 bg-cover bg-center opacity-10" style={{ backgroundImage: `url(${CONFIG.heroImage})` }} />

      <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 border-b border-sky-200/70 px-6 py-5 md:px-8 md:py-6">
        <div className="flex items-center gap-4">
          <div className="rounded-2xl border border-sky-200/70 bg-white/80 p-3 backdrop-blur-md">
            <Building2 className="h-8 w-8" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.34em] text-slate-500">{CONFIG.businessName}</p>
            <h2 className="text-2xl font-semibold text-slate-950">How can I assist you today?</h2>
          </div>
        </div>

        <SecondaryButton onClick={resetToWelcome}>
          <RotateCcw className="mr-2 h-4 w-4" />
          Start Over
        </SecondaryButton>
      </div>

      <div className="relative z-10 flex flex-1 flex-col justify-between px-8 py-8">
        <div className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-3">
          {OPTIONS.map((option, index) => (
            <motion.button
              key={option.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 * index, duration: 0.32 }}
              whileTap={{ scale: 0.985 }}
              onClick={() => {
                setSelectedOption(option.title);
                if (option.title === "Delivery") {
                  resetDelivery();
                  speakDeliveryGreeting();
                } else {
                  // Stop the welcome voice before opening enquiry workflows, so
                  // no pending speech callback can return the app to the options page.
                  if (typeof window !== "undefined" && "speechSynthesis" in window) {
                    window.speechSynthesis.cancel();
                  }
                  setIsSpeaking(false);

                  if (option.title === "tenants Enquiry") {
                    settenantsInquiryQuery("");
                    settenantsInquiryResults([]);
                    setSelectedtenantsInquiry(null);
                    settenantsInquiryKeyboardLocked(false);
                  }

                  setEnquiryType(option.title as EnquiryType);
                  setScreen("inquiry");
                }
              }}
              className="text-left"
            >
              <div
                className={cx(
                  "h-full rounded-[2rem] border bg-white/80 p-8 text-slate-950 shadow-2xl backdrop-blur-xl transition-all duration-200",
                  selectedOption === option.title
                    ? "border-sky-400/70 ring-2 ring-sky-300/40"
                    : "border-sky-200/70 hover:border-sky-300/70 hover:bg-sky-100/80"
                )}
              >
                <div className="flex h-full flex-col justify-between gap-8">
                  <div>
                    <div className="mb-8 inline-flex rounded-2xl border border-sky-200/70 bg-white/80 p-4">
                      {option.title === "Delivery" ? <Package className="h-9 w-9" /> : <Building2 className="h-9 w-9" />}
                    </div>
                    <h3 className="text-4xl font-semibold tracking-tight">{option.title}</h3>
                    <p className="mt-5 text-lg leading-8 text-slate-600">{option.description}</p>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="text-sm uppercase tracking-[0.28em]">Select</span>
                    <ChevronRight className="h-7 w-7" />
                  </div>
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </motion.section>
  );

  const selectedGeneralInquiryTopic = useMemo(
    () => GENERAL_INQUIRY_TOPICS.find((topic) => topic.id === generalInquiryTopicId) ?? GENERAL_INQUIRY_TOPICS[0],
    [generalInquiryTopicId]
  );


  const renderInquiryScreen = () => {
    if (enquiryType === "tenants Enquiry") {
      return (
        <motion.section
          key="tenants-inquiry"
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.35 }}
          className="relative flex min-h-[100dvh] w-full flex-col bg-[linear-gradient(180deg,#f8fafc_0%,#e0f2fe_100%)]"
        >
          <div className="absolute inset-0 bg-cover bg-center opacity-10" style={{ backgroundImage: `url(${CONFIG.heroImage})` }} />

          <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 border-b border-sky-200/70 px-6 py-5 md:px-8 md:py-6">
            <div>
              <p className="text-xs uppercase tracking-[0.34em] text-slate-500">{CONFIG.businessName}</p>
              <h2 className="text-2xl font-semibold text-slate-950">Tenant Inquiry</h2>
            </div>
            <HomeButton onHome={resetToWelcome} />
          </div>

          <div className="relative z-10 flex flex-1 items-start justify-center px-6 py-6 md:px-8 md:py-8">
            <div className="grid w-full max-w-6xl grid-cols-1 gap-6 lg:grid-cols-[1fr_0.95fr]">
              <div className="rounded-[2rem] border border-sky-200/70 bg-white/80 p-8 text-slate-950 shadow-2xl backdrop-blur-xl">
                <p className="text-sm uppercase tracking-[0.34em] text-slate-500">Tenant lookup</p>
                <h3 className="mt-3 text-4xl font-semibold tracking-tight">Find a Tenant</h3>
                <p className="mt-4 text-xl leading-8 text-slate-600">
                  Type at least three letters of the business name or contact name, then select the tenant from the list.
                </p>

                <div className="mt-8 space-y-4">
                  <Field label="Business Name or Contact Name">
                    <div className="relative">
                      <TextInput
                        ref={tenantsInquiryInputRef}
                        value={tenantsInquiryQuery}
                        onChange={(event) => {
                          const value = event.target.value;
                          handletenantsInquirySearch(value);

                          if (value.trim().length >= 3) {
                            settenantsInquiryKeyboardLocked(true);
                            hidetenantsInquiryKeyboard();
                          }
                        }}
                        onPointerDownCapture={(event) => {
                          if (tenantsInquiryKeyboardLocked) {
                            settenantsInquiryKeyboardLocked(false);
                            event.currentTarget.removeAttribute("readonly");
                            event.currentTarget.setAttribute("inputmode", "text");
                            window.setTimeout(() => event.currentTarget.focus(), 0);
                          }
                        }}
                        onFocus={(event) => {
                          settenantsInquiryKeyboardLocked(false);
                          handletenantsInquirySearch(event.currentTarget.value);
                        }}
                        placeholder="Start typing business or contact name"
                        autoComplete="off"
                        readOnly={tenantsInquiryKeyboardLocked}
                        inputMode={tenantsInquiryKeyboardLocked ? "none" : "text"}
                        className="min-h-[5rem] px-6 text-2xl md:text-3xl"
                      />

                      {tenantsInquiryResults.length > 0 && (
                        <div className="absolute z-30 mt-3 max-h-[22rem] w-full overflow-y-scroll rounded-3xl border border-sky-200/80 bg-white/95 p-2 shadow-2xl backdrop-blur-xl touch-pan-y overscroll-contain [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:w-3 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/30 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-white/80">
                          {tenantsInquiryResults.map((tenants, index) => (
                            <button
                              key={`${tenants.businessName}-${tenants.contactName}-${index}`}
                              type="button"
                              onPointerDown={(event) => {
                                tenantsInquiryPointerStartYRef.current = event.clientY;
                              }}
                              onPointerUp={(event) => {
                                const startY = tenantsInquiryPointerStartYRef.current;
                                tenantsInquiryPointerStartYRef.current = null;

                                if (startY === null || Math.abs(event.clientY - startY) <= 12) {
                                  event.preventDefault();
                                  selecttenantsInquiry(tenants);
                                }
                              }}
                              className="w-full rounded-2xl px-4 py-4 text-left transition hover:bg-white/80 active:bg-sky-100/80"
                            >
                              <div className="text-lg font-semibold text-slate-950">{tenants.businessName || "Unnamed business"}</div>
                              <div className="mt-1 text-base text-slate-500">{tenants.contactName || "No contact name listed"}</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </Field>

                  {tenantsLookupStatus === "loading" && <p className="text-slate-500">Loading tenants list…</p>}
                  {tenantsLookupStatus === "empty" && <p className="text-amber-700">tenants CSV loaded, but no usable tenants rows were found.</p>}
                  {tenantsLookupStatus === "error" && <p className="text-rose-700">tenants CSV not found. Put tenantss.csv in the public folder.</p>}
                  {tenantsLookupStatus === "ready" && tenantsInquiryQuery.trim().length > 0 && tenantsInquiryQuery.trim().length < 3 && (
                    <p className="text-slate-500">Type at least 3 letters to search the tenants list.</p>
                  )}
                  {tenantsLookupStatus === "ready" && tenantsInquiryQuery.trim().length >= 3 && tenantsInquiryResults.length === 0 && !selectedtenantsInquiry && (
                    <p className="text-slate-500">No matching tenantss found. Try a different business or contact name.</p>
                  )}
                </div>
              </div>

              <div className="rounded-[2rem] border border-sky-200/70 bg-white/80 p-8 text-slate-950 shadow-2xl backdrop-blur-xl">
                <p className="text-sm uppercase tracking-[0.34em] text-slate-500">tenants contact details</p>

                {selectedtenantsInquiry ? (
                  <div className="mt-6 space-y-6">
                    <div className="rounded-3xl border border-sky-200/70 bg-white/80 p-6">
                      <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Business</p>
                      <h3 className="mt-3 text-3xl font-semibold text-slate-950">{selectedtenantsInquiry.businessName || "—"}</h3>
                      <p className="mt-2 text-xl text-slate-600">{selectedtenantsInquiry.contactName || "No contact name listed"}</p>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      {selectedtenantsInquiry.phone ? (
                        <InfoPill
                          icon={Phone}
                          label="Call"
                          value={selectedtenantsInquiry.phone}
                          href={phoneHref(selectedtenantsInquiry.phone)}
                          ariaLabel={`Call ${selectedtenantsInquiry.businessName || selectedtenantsInquiry.contactName} on ${selectedtenantsInquiry.phone}`}
                          primary
                        />
                      ) : (
                        <SummaryCard label="Phone" value="No phone number listed" />
                      )}

                      {selectedtenantsInquiry.email ? (
                        <InfoPill
                          icon={Mail}
                          label="Email"
                          value={selectedtenantsInquiry.email}
                        />
                      ) : (
                        <SummaryCard label="Email" value="No email address listed" />
                      )}
                    </div>

                    <SecondaryButton className="w-full" onClick={resettenantsInquiry}>
                      Search for Another tenants
                    </SecondaryButton>
                  </div>
                ) : (
                  <div className="mt-6 rounded-3xl border border-sky-200/70 bg-white/60 p-6 text-slate-600">
                    <p className="text-xl leading-8">tenants contact details will appear here after you select a tenants.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.section>
      );
    }

    return (
      <motion.section
        key="general-inquiry"
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -24 }}
        transition={{ duration: 0.35 }}
        className="relative flex min-h-[100dvh] w-full flex-col bg-[linear-gradient(180deg,#f8fafc_0%,#e0f2fe_100%)]"
      >
        <div className="absolute inset-0 bg-cover bg-center opacity-10" style={{ backgroundImage: `url(${CONFIG.heroImage})` }} />

        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 border-b border-sky-200/70 px-6 py-5 md:px-8 md:py-6">
          <div>
            <p className="text-xs uppercase tracking-[0.34em] text-slate-500">{CONFIG.businessName}</p>
            <h2 className="text-2xl font-semibold text-slate-950">General Inquiry</h2>
          </div>

          <SecondaryButton
            onClick={() => {
              resetGeneralInquiry();
              resetToWelcome();
            }}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Home
          </SecondaryButton>
        </div>

        <div className="relative z-10 flex flex-1 flex-col gap-6 px-6 py-6 md:px-8 md:py-8">
          <div className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[2rem] border border-sky-200/70 bg-white/80 p-8 text-slate-950 shadow-2xl backdrop-blur-xl">
            <p className="inline-flex items-center rounded-full border border-cyan-300/70 bg-cyan-100/80 px-4 py-2 text-sm font-semibold text-cyan-800">
              <Sparkles className="mr-2 h-4 w-4" />
              General Inquiry Assistant
            </p>
            <h3 className="mt-5 text-4xl font-semibold tracking-tight">How can I help today?</h3>
            <p className="mt-4 text-xl leading-8 text-slate-600">
              Ask about bookings, office space, facilities, virtual office services, membership, or consultation rooms.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {GENERAL_INQUIRY_TOPICS.map((topic) => (
                <button
                  key={topic.id}
                  type="button"
                  onClick={() => {
                    setGeneralInquiryTopicId(topic.id);
                                  }}
                  className={cx(
                    "rounded-2xl border px-5 py-4 text-left text-base font-semibold shadow-lg transition active:scale-[0.99]",
                    topic.id === generalInquiryTopicId
                      ? "border-cyan-400 bg-cyan-300 text-slate-950"
                      : "border-sky-200/80 bg-white/80 text-slate-950 hover:bg-sky-100/80"
                  )}
                >
                  {topic.label}
                </button>
              ))}
            </div>

          </div>

          <div className="flex flex-col rounded-[2rem] border border-sky-200/70 bg-white/80 p-8 text-slate-950 shadow-2xl backdrop-blur-xl">
            <div className="mb-5 flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-300 text-slate-950">
                <Building2 className="h-7 w-7" />
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-800">Suggested answer</p>
                <h3 className="text-2xl font-semibold text-slate-950">{selectedGeneralInquiryTopic.label}</h3>
              </div>
            </div>

            <div className="rounded-3xl border border-sky-200/70 bg-white/70 p-6 text-xl leading-9 text-slate-800">
              <p>{selectedGeneralInquiryTopic.answer}</p>
              {selectedGeneralInquiryTopic.handoff && (
                <p className="mt-4 text-slate-500">{selectedGeneralInquiryTopic.handoff}</p>
              )}
            </div>

          </div>
          </div>

          <div className="rounded-[2rem] border border-sky-200/70 bg-white/80 p-5 text-slate-950 shadow-2xl backdrop-blur-xl">
            <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
              <InfoPill
                icon={Phone}
                label="General Enquiries"
                value={CONFIG.phone}
                href={phoneHref(CONFIG.phone)}
                ariaLabel={`Call General Enquiries on ${CONFIG.phone}`}
              />
              <InfoPill
                icon={Mail}
                label="Email the Team"
                value={CONFIG.receptionEmail}
                href={inquiryEmailHref("General inquiry from reception kiosk", `I have a general inquiry about ${selectedGeneralInquiryTopic.label}.`)}
                ariaLabel="Email the team"
              />
            </div>
          </div>
        </div>
      </motion.section>
    );
  };
  const renderDeliveryStep = () => {
    if (deliveryStep === 1) {
      return (
        <div className="space-y-8">
          <div>
            <p className="text-sm uppercase tracking-[0.34em] text-slate-500">Step 1</p>
            <h3 className="mt-2 text-3xl font-semibold">Courier Details</h3>
            <p className="mt-3 text-lg text-slate-600">Select a courier company, or enter an individual courier name.</p>
          </div>

          <div className="rounded-[2rem] border-2 border-sky-300/80 bg-sky-50/90 p-5 shadow-xl shadow-sky-200/60 ring-4 ring-sky-100">
            <Field label="Choose a Courier Company">
              <div className="grid grid-cols-3 gap-3">
                {COURIERS.map((courier) => (
                  <button
                    key={courier}
                    type="button"
                    onClick={() => {
                      updateField("courierCompany", courier);
                      updateField("courierName", courier === "Other / Individual" ? "" : courier);
                    }}
                    className={cx(
                      "rounded-2xl border-2 px-3 py-4 text-center text-sm font-semibold transition active:scale-[0.98]",
                      deliveryForm.courierCompany === courier
                        ? "border-sky-500 bg-sky-400 text-slate-950 shadow-lg shadow-sky-300/50"
                        : "border-sky-200/70 bg-white/80 text-slate-950 hover:bg-sky-100/80"
                    )}
                  >
                    {courier}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">
                Start here — tap to select courier
              </p>
            </Field>
          </div>

        </div>
      );
    }

    if (deliveryStep === 2) {
      return (
        <div className="space-y-8">
          <div>
            <p className="text-sm uppercase tracking-[0.34em] text-slate-500">Step 2</p>
            <h3 className="mt-2 text-3xl font-semibold">Recipient Details</h3>
            <p className="mt-3 text-lg text-slate-600">Search by business name or contact name. Select a match to autofill the recipient.</p>
          </div>

          <Field label="Business Name or Contact Name">
            <div className="relative">
              <TextInput
                ref={recipientSearchInputRef}
                value={deliveryForm.recipientBusiness}
                onChange={(event) => {
                  const value = event.target.value;
                  handleRecipientSearch(value);

                  if (value.trim().length >= 3) {
                    event.currentTarget.blur();
                  }
                }}
                onPointerDownCapture={(event) => {
                  if (recipientKeyboardLocked) {
                    setRecipientKeyboardLocked(false);
                    event.currentTarget.removeAttribute("readonly");
                    event.currentTarget.setAttribute("inputmode", "text");
                    window.setTimeout(() => event.currentTarget.focus(), 0);
                  }
                }}
                onFocus={(event) => {
                  setRecipientKeyboardLocked(false);
                  handleRecipientSearch(event.currentTarget.value);
                }}
                placeholder="Start typing business or contact name"
                autoComplete="off"
                readOnly={recipientKeyboardLocked}
                inputMode={recipientKeyboardLocked ? "none" : "text"}
              />

              {tenantsSearchResults.length > 0 && (
                <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-30 max-h-[22rem] touch-pan-y overflow-y-scroll overscroll-contain rounded-3xl border border-sky-200/80 bg-white/95 p-2 pr-4 shadow-2xl backdrop-blur-xl [-webkit-overflow-scrolling:touch] [scrollbar-gutter:stable] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/35 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-white/80 [&::-webkit-scrollbar]:w-3">
                  {tenantsSearchResults.map((tenants, index) => (
                    <button
                      key={`${tenants.businessName}-${tenants.contactName}-${index}`}
                      type="button"
                      onClick={() => selecttenants(tenants)}
                      onTouchEnd={() => window.setTimeout(hideRecipientKeyboard, 0)}
                      className="block w-full rounded-2xl px-4 py-4 text-left transition hover:bg-white/80 active:bg-sky-100/80"
                    >
                      <div className="text-lg font-semibold text-slate-950">{tenants.businessName || tenants.contactName}</div>
                      {tenants.businessName && tenants.contactName && <div className="mt-1 text-base text-slate-600">{tenants.contactName}</div>}
                      {(tenants.email || tenants.phone) && (
                        <div className="mt-2 text-sm text-slate-400">{[tenants.email, tenants.phone].filter(Boolean).join(" · ")}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Field>

          {tenantsLookupStatus === "loading" && <p className="text-sm text-slate-500">Loading tenants list…</p>}
          {tenantsLookupStatus === "ready" && <p className="text-sm text-slate-500">tenants list loaded: {tenantss.length} records.</p>}
          {tenantsLookupStatus === "empty" && <p className="text-sm text-amber-700">tenants CSV loaded, but no usable tenants rows were found.</p>}
          {tenantsLookupStatus === "error" && <p className="text-sm text-amber-700">tenants CSV not found. Put tenants.csv or tenantss.csv in the public folder.</p>}
          {tenantsLookupStatus === "ready" && deliveryForm.recipientBusiness && tenantsSearchResults.length === 0 && !deliveryForm.recipientFullName && (
            <p className="text-sm text-slate-500">No matching tenants selected yet. You can still enter details manually.</p>
          )}

          <Field label="Full Name">
            <TextInput
              value={deliveryForm.recipientFullName}
              onChange={(event) => updateField("recipientFullName", event.target.value)}
              placeholder="Enter recipient full name"
            />
          </Field>
        </div>
      );
    }

    if (deliveryStep === 3) {
      return (
        <div className="space-y-8">
          <div>
            <p className="text-sm uppercase tracking-[0.34em] text-slate-500">Step 3</p>
            <h3 className="mt-2 text-3xl font-semibold">Delivery Details</h3>
            <p className="mt-3 text-lg text-slate-600">Select the item type for this delivery.</p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {PACKAGE_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => updateField("packageType", type)}
                className={cx(
                  "rounded-[1.5rem] border px-5 py-6 text-left transition",
                  deliveryForm.packageType === type
                    ? "border-sky-400/70 bg-sky-100/85"
                    : "border-sky-200/70 bg-white/60 hover:bg-white/80"
                )}
              >
                <p className="text-lg font-semibold text-slate-950">{type}</p>
              </button>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-5 lg:space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.34em] text-slate-500">Step 4</p>
            <h3 className="mt-2 text-3xl font-semibold lg:text-2xl">Confirm Delivery</h3>
            <p className="mt-2 text-base text-slate-600 lg:text-sm">Review the details, then display the confirmation and notify reception.</p>
          </div>

          <SecondaryButton type="button" onClick={() => setDeliveryStep(3)} className="min-h-[3.25rem] shrink-0 px-5">
            <span className="mr-2 text-xl leading-none">←</span>
            Previous Step
          </SecondaryButton>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <SummaryCard label="Courier" value={displayCourierName} />
          <SummaryCard label="Business" value={deliveryForm.recipientBusiness} />
          <SummaryCard label="Full Name" value={deliveryForm.recipientFullName} />
          <SummaryCard label="Item Type" value={deliveryForm.packageType} />
        </div>

        <PrimaryButton className="w-full" onClick={confirmDelivery} disabled={Boolean(deliverySlip)}>
          {deliverySlip ? "Confirmation Displayed" : "Delivery Receipt"}
        </PrimaryButton>

        <div className="rounded-[1.5rem] border border-sky-200/70 bg-white/60 p-5 text-center">
          <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Parcel Box Instructions</p>
          <p className="mt-3 text-lg font-semibold leading-7 text-slate-950 lg:text-base">
            Please place it in the Parcel Bin in front of you.
            <br />
            If the parcel is too large, then leave it at the base of the Parcel Bin.
          </p>
        </div>

      </div>
    );
  };

  const renderWorkflowActions = () => {
    if (deliveryStep === 4) return null;

    return (
      <div className="space-y-6">
        <div className="rounded-[2rem] border border-sky-200/70 bg-white/80 p-6 text-slate-950 shadow-2xl backdrop-blur-xl">
          <p className="text-sm uppercase tracking-[0.34em] text-slate-500">Workflow Actions</p>
          <div className="mt-4 space-y-4">
            {deliveryStep > 1 && (
              <SecondaryButton className="w-full" onClick={goToPreviousDeliveryStep}>
                Previous Step
              </SecondaryButton>
            )}

            {deliveryStep === 1 && (
              <>
                {deliveryForm.courierCompany === "Other / Individual" && (
                  <Field label="Individual Name">
                    <TextInput
                      value={deliveryForm.courierName}
                      onChange={(event) => updateField("courierName", event.target.value)}
                      placeholder="e.g. John Smith"
                    />
                  </Field>
                )}
                <PrimaryButton className="w-full" onClick={() => setDeliveryStep(2)} disabled={!canStep1}>
                  Continue to Recipient
                </PrimaryButton>
              </>
            )}

            {deliveryStep === 2 && (
              <PrimaryButton className="w-full" onClick={() => setDeliveryStep(3)} disabled={!canStep2}>
                Continue to Delivery Details
              </PrimaryButton>
            )}

            {deliveryStep === 3 && (
              <PrimaryButton
                className="w-full"
                onClick={() => {
                  setDeliveryStep(4);
                  speakConfirmPrompt();
                }}
                disabled={!canStep3}
              >
                Continue to Confirm
              </PrimaryButton>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderDeliveryScreen = () => (
    <motion.section
      key="delivery"
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -24 }}
      transition={{ duration: 0.35 }}
      className="relative flex min-h-[100dvh] w-full flex-col bg-[linear-gradient(180deg,#f8fafc_0%,#e0f2fe_100%)]"
    >
      <div className="absolute inset-0 bg-cover bg-center opacity-10" style={{ backgroundImage: `url(${CONFIG.heroImage})` }} />

      <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 border-b border-sky-200/70 px-6 py-5 md:px-8 md:py-6">
        <div className="flex items-center gap-4">
          <HomeButton onHome={resetToWelcome} />
          <div>
            <p className="text-xs uppercase tracking-[0.34em] text-slate-500">Delivery Registration</p>
            <h2 className="text-2xl font-semibold text-slate-950">Delivery Workflow</h2>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <StepBadge step={1} current={deliveryStep} label="Courier" />
          <StepBadge step={2} current={deliveryStep} label="Recipient" />
          <StepBadge step={3} current={deliveryStep} label="Details" />
          <StepBadge step={4} current={deliveryStep} label="Confirm" />
        </div>
      </div>

      <div
        className={cx(
          "relative z-10 grid flex-1 grid-cols-1 gap-6 px-6 py-6 md:px-8 md:py-8",
          deliveryStep !== 4 && "lg:grid-cols-[1.35fr_0.75fr]"
        )}
      >
        <div className="rounded-[2rem] border border-sky-200/70 bg-white/80 p-8 text-slate-950 shadow-2xl backdrop-blur-xl">
          {renderDeliveryStep()}
        </div>

        {renderWorkflowActions()}
      </div>

      {deliveryStep === 4 && deliverySlip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-sky-950/35 px-6 py-8 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.22 }}
            className="w-full max-w-3xl rounded-[2rem] border border-emerald-300/25 bg-white/95 p-7 text-slate-950 shadow-[0_32px_120px_rgba(14,165,233,0.22)]"
          >
            <div className="text-center">
              <p className="text-sm uppercase tracking-[0.34em] text-emerald-700">Delivery Registered</p>
              <h3 className="mt-3 text-3xl font-semibold">Delivery receipt</h3>
            </div>

            <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <SummaryCard label="Courier / Full Name" value={displayCourierName} />
              <SummaryCard label="Item Type" value={deliveryForm.packageType} />
              <SummaryCard label="Registration Number" value={deliverySlip.reference} />
              <SummaryCard label="Time of Delivery" value={deliverySlip.recordedAt} />
            </div>

            <p className="mt-7 rounded-2xl border border-sky-200/70 bg-white/80 px-5 py-4 text-center text-lg font-medium leading-relaxed text-slate-800">
              Please place the {(deliveryForm.packageType || "item").toLowerCase()} in the parcel box just in front of you. Thank you and have a great day.
            </p>

            <div
              className={cx(
                "mt-4 rounded-2xl border px-5 py-4 text-center text-base font-semibold",
                deliveryEmailStatus === "sent" && "border-emerald-300/70 bg-emerald-50 text-emerald-700",
                deliveryEmailStatus === "sending" && "border-sky-300/70 bg-sky-50 text-sky-700",
                deliveryEmailStatus === "error" && "border-rose-300/70 bg-rose-50 text-rose-700",
                deliveryEmailStatus === "idle" && "border-sky-200/70 bg-white/70 text-slate-600"
              )}
            >
              {deliveryEmailStatus === "sending" && `Sending delivery log and reception email through Google...`}
              {deliveryEmailStatus === "sent" && `Delivery log and reception email request sent to Google.`}
              {deliveryEmailStatus === "error" && deliveryEmailError}
              {deliveryEmailStatus === "idle" && "Delivery will be logged and advice will be sent to reception."}
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <SecondaryButton className="w-full" onClick={receiveAnotherDelivery}>
                Receive another delivery
              </SecondaryButton>
              <PrimaryButton className="w-full" onClick={finishDelivery}>
                Done
              </PrimaryButton>
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9, x: 20, y: -20 }}
              animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="absolute top-6 right-6 rounded-2xl border border-sky-200/70 bg-white/90 shadow-lg overflow-hidden"
              style={{ height: '3cm' }}
            >
              <img 
                src="/Parcel%20Bin.jpg" 
                alt="Parcel bin placement example" 
                className="w-full h-full object-cover"
              />
            </motion.div>
          </motion.div>
        </div>
      )}

      {deliveryStep === 4 && confirmTimeoutActive && confirmTimeoutRemaining < CONFIG.timeoutSeconds && (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border border-amber-300/30 bg-white/90 px-5 py-3 text-amber-700 shadow-2xl backdrop-blur-xl">
          <Hourglass className="h-5 w-5" />
          <span className="text-sm font-medium">Returning to Home in {confirmTimeoutRemaining} seconds. Tap the screen to reset the timer.</span>
        </div>
      )}
    </motion.section>
  );

  return (
    <div
      className="min-h-[100dvh] w-full overflow-x-hidden bg-sky-50 text-slate-950 [font-family:Inter,system-ui,sans-serif]"
      style={{ WebkitTapHighlightColor: "transparent", WebkitUserSelect: "none", userSelect: "none", touchAction: "manipulation" }}
    >
      <AnimatePresence mode="wait">
        {screen === "welcome" && renderWelcomeScreen()}
        {screen === "options" && renderOptionsScreen()}
        {screen === "inquiry" && renderInquiryScreen()}
        {screen === "delivery" && renderDeliveryScreen()}
      </AnimatePresence>
    </div>
  );
}