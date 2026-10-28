import RoleLayout from '@/Layouts/RoleLayout';
import { Head } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import {
  AlertCircle, Calendar, CalendarDays, CalendarX, CheckCircle2, ChevronDown,
  ChevronLeft, ChevronRight, Clock, FileText, Loader2, Mail, Plus, RefreshCw, Search, TrendingUp,
  X, XCircle,
} from 'lucide-react';
import { api, ApiError, STATUS_OPTIONS, PAYMENT_OPTIONS } from '@/lib/dashboardApi';

const PAGE_SIZE = 10;

/* ───────── Gaya bersama (memakai token brand dari tailwind.config) ───────── */
const inputCls =
  'w-full rounded-lg border border-brand-border bg-brand-primary px-3.5 py-2.5 text-[14px] text-brand-text placeholder:text-brand-text-muted transition focus:border-brand-accent focus:outline-none focus:ring-2 focus:ring-brand-accent/30';
const card = 'rounded-2xl border border-brand-border bg-brand-secondary';
const btnGhost =
  'rounded-xl border border-brand-border px-4 py-2.5 text-[13px] font-semibold text-brand-text transition hover:border-brand-accent/50 hover:bg-brand-accent/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent';
const btnPrimary =
  'rounded-xl bg-brand-accent px-5 py-2.5 text-[13px] font-bold text-brand-primary transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-white';

const orderTone = {
  Diproses: 'bg-brand-accent/15 text-brand-accent',
  Pending: 'bg-amber-400/10 text-amber-300',
  Selesai: 'bg-brand-muted/30 text-brand-text-muted',
};
const scheduleTone = {
  Terjadwal: 'bg-amber-400/10 text-amber-300',
  Proses: 'bg-emerald-400/10 text-emerald-300',
  Siap: 'bg-brand-accent2/15 text-brand-accent2',
  Pending: 'bg-rose-400/10 text-rose-300',
};
const dueTone = (t = '') =>
  t.toLowerCase().includes('terlambat') ? 'text-rose-400' : /hari ini|besok/i.test(t) ? 'text-brand-accent' : 'text-brand-text-muted';

function useDebounced(value, ms = 400) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/* ───────── Elemen dasar ───────── */
const Pill = ({ children, className = '' }) => (
  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-semibold ${className}`}>{children}</span>
);
const Skeleton = ({ className = '' }) => <div className={`animate-pulse rounded bg-brand-muted/30 ${className}`} />;

function Field({ label, error, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-brand-text">{label}</span>
      {children}
      {error && <span className="mt-1 block text-[12px] text-rose-400">{error}</span>}
    </label>
  );
}

function Select({ value, onChange, options, label }) {
  return (
    <div className="relative">
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputCls} appearance-none pr-9`}
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-text-muted" />
    </div>
  );
}

function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [toast, onClose]);
  if (!toast) return null;
  const ok = toast.type === 'success';
  return (
    <div role="status" className="fixed bottom-5 right-5 z-[60] flex max-w-sm items-start gap-2.5 rounded-xl border border-brand-border bg-brand-secondary px-4 py-3 text-[14px] text-brand-white shadow-xl">
      {ok ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" /> : <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" />}
      <span>{toast.message}</span>
    </div>
  );
}

function Modal({ title, subtitle, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        role="dialog" aria-modal="true" aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-brand-border bg-brand-secondary p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[20px] font-semibold tracking-tight text-brand-white">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[13px] text-brand-text-muted">{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Tutup" className="rounded-full p-1 text-brand-text-muted hover:bg-brand-muted/30 hover:text-brand-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}

const ErrorBox = ({ children }) => (
  <p className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-[13px] text-rose-300">
    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {children}
  </p>
);

/* ───────── Modal: Add Project ───────── */
const EMPTY = { customer: '', service: '', value: '', team: '', date: '', time: '', notes: '' };

function AddProjectModal({ onClose, onDone }) {
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fieldErr, setFieldErr] = useState({});
  const [suggest, setSuggest] = useState([]);
  const [options, setOptions] = useState({ customers: [], services: [], teams: [] });
  const q = useDebounced(form.customer, 300);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    const ac = new AbortController();
    api.getOrderOptions(ac.signal)
      .then(setOptions)
      .catch((err) => err.name !== 'AbortError' && setError(err.message));
    return () => ac.abort();
  }, []);

  useEffect(() => {
    if (q.trim().length < 2) { setSuggest([]); return undefined; }
    const ac = new AbortController();
    api.getCustomers(q, ac.signal)
      .then(setSuggest)
      .catch((err) => err.name !== 'AbortError' && setError(err.message));
    return () => ac.abort();
  }, [q]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError(''); setFieldErr({});
    try {
      await api.createOrder(form, options);
      onDone('Project berhasil ditambahkan.');
    } catch (err) {
      setError(err.message || 'Project gagal disimpan.');
      setFieldErr(err.details || {});
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Tambah Project" subtitle="Gunakan customer dan layanan yang sudah terdaftar." onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {error && <ErrorBox>{error}</ErrorBox>}
        <Field label="Nama customer" error={fieldErr.customer || fieldErr.customerName}>
          <input list="customer-list" className={inputCls} value={form.customer} onChange={set('customer')} placeholder="Cari customer terdaftar" required autoFocus />
          <datalist id="customer-list">{suggest.map((n) => <option key={n} value={n} />)}</datalist>
        </Field>
        <Field label="Layanan" error={fieldErr.service || fieldErr.serviceName}>
          <input list="service-list" className={inputCls} value={form.service} onChange={set('service')} placeholder="Pilih layanan aktif" required />
          <datalist id="service-list">{options.services.map((service) => <option key={service.id} value={service.name} />)}</datalist>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nilai project (Rp)" error={fieldErr.value || fieldErr.amount}>
            <input type="number" min="0" className={inputCls} value={form.value} onChange={set('value')} placeholder="0" />
          </Field>
          <Field label="Tim" error={fieldErr.team || fieldErr.teamName}>
            <input list="team-list" className={inputCls} value={form.team} onChange={set('team')} placeholder="Pilih tim aktif" />
            <datalist id="team-list">{options.teams.map((team) => <option key={team.id} value={team.name} />)}</datalist>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tanggal" error={fieldErr.date || fieldErr.scheduledAt}>
            <input type="date" className={inputCls} value={form.date} onChange={set('date')} />
          </Field>
          <Field label="Jam">
            <input type="time" className={inputCls} value={form.time} onChange={set('time')} />
          </Field>
        </div>
        <Field label="Catatan" error={fieldErr.notes}>
          <textarea rows={3} className={inputCls} value={form.notes} onChange={set('notes')} placeholder="Opsional" />
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className={btnGhost}>Batal</button>
          <button disabled={busy} className={btnPrimary}>
            {busy ? <span className="inline-flex items-center gap-1.5"><Loader2 className="h-4 w-4 animate-spin" /> Menyimpan</span> : 'Simpan project'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ───────── Statistik ───────── */
function StatCard({ title, value, note, icon: Icon, accent, featured, loading }) {
  return (
    <div className={`group relative overflow-hidden rounded-xl border p-4 transition duration-200 hover:-translate-y-0.5 ${featured ? 'border-brand-accent bg-brand-accent text-brand-primary shadow-lg shadow-brand-accent/25' : 'border-brand-border bg-brand-secondary'}`}>
      {!featured && <div className={`absolute inset-x-0 top-0 h-1 ${accent.strip}`} />}
      <div className="flex items-start justify-between">
        <h3 className={`text-[15px] font-semibold leading-tight ${featured ? 'text-brand-primary' : 'text-brand-text'}`}>{title}</h3>
        <span className={`grid h-9 w-9 place-items-center rounded-lg ${featured ? 'bg-brand-primary/10 text-brand-primary' : `${accent.bg} ring-1 ring-inset ring-brand-border`}`}>
          <Icon className={`h-5 w-5 ${featured ? 'text-brand-primary' : accent.icon}`} strokeWidth={2} />
        </span>
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        {loading ? <Skeleton className="mb-1 h-11 w-20" /> : <span className={`text-[44px] font-semibold leading-none tracking-tight tabular-nums ${featured ? 'text-brand-primary' : 'text-brand-white'}`}>{value}</span>}
        <Icon className={`mb-1 h-9 w-9 ${featured ? 'text-brand-primary/35' : `${accent.icon} opacity-70`}`} strokeWidth={1.6} />
      </div>
      <p className={`mt-3 truncate text-[12px] ${featured ? 'text-brand-primary/75' : 'text-brand-text-muted'}`}>{note}</p>
    </div>
  );
}

function ProjectChart({ data, loading }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const peak = Math.max(...data.map((d) => d.value), 0);
  const bars = data.length ? data : Array.from({ length: 7 }, () => ({ label: '·', value: 0 }));
  const tones = ['bg-brand-accent2', 'bg-brand-accent2/70', 'bg-brand-accent/60', 'bg-brand-accent2/50'];
  return (
    <div className="flex h-full min-h-[240px] flex-col rounded-xl border border-brand-border bg-brand-secondary p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[16px] font-semibold text-brand-white">Analisis Project</h2>
        <span className="rounded-full bg-brand-tertiary px-3 py-1 text-[12px] font-medium text-brand-text-muted">7 hari terakhir</span>
      </div>
      <div className="mt-3 flex flex-1 items-end justify-between gap-2" style={{ minHeight: 150 }}>
        {bars.map((d, i) => {
          const pct = d.value === 0 ? 12 : Math.max((d.value / max) * 100, 14);
          const barTone = peak > 0 && d.value === peak ? 'bg-brand-accent' : tones[i % tones.length];
          return (
            <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5" title={`${d.label}: ${d.value} order`}>
              <span className="text-[12px] font-medium tabular-nums text-brand-text-muted">{loading ? '' : d.value}</span>
              <div className="flex w-full max-w-[34px] flex-1 items-end overflow-hidden rounded-full bg-brand-tertiary">
                <div className={`w-full rounded-full transition-all duration-500 ${barTone}`} style={{ height: `${pct}%` }} />
              </div>
              <span className="text-[12px] font-medium text-brand-text-muted">{d.label}</span>
            </div>
          );
        })}
      </div>
      {!loading && peak === 0 && <p className="mt-2 text-center text-[12px] text-brand-text-muted">Belum ada order dalam 7 hari terakhir.</p>}
    </div>
  );
}

function Upcoming({ items, loading }) {
  const shown = items.slice(0, 3);
  return (
    <div className="flex h-full min-h-[240px] flex-col rounded-xl border border-brand-accent/60 bg-brand-accent p-4 text-brand-primary shadow-lg shadow-brand-accent/25">
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-primary/10 text-brand-primary"><Calendar className="h-5 w-5" /></span>
        <div>
          <h2 className="text-[16px] font-bold">Jadwal Terdekat</h2>
          <p className="text-[12px] text-brand-primary/70">Agenda pengerjaan berikutnya</p>
        </div>
      </div>
      <div className="mt-3 grid flex-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {loading && [0, 1, 2].map((i) => <div key={i} className="min-h-[140px] animate-pulse rounded-lg bg-brand-primary/15" />)}
        {!loading && shown.map((s, index) => (
          <div key={s.id ?? s.title} className={`flex min-h-[140px] flex-col rounded-lg border border-brand-primary/10 border-l-2 border-l-brand-accent p-3.5 text-brand-white transition-colors hover:border-brand-accent ${index === 0 ? 'bg-brand-secondary' : 'bg-brand-primary'}`}>
            <div className="flex items-center justify-between gap-2 text-[12px]">
              <span className="font-medium text-brand-text">{s.time}</span>
              <Pill className={scheduleTone[s.status] || 'bg-brand-muted/30 text-brand-text-muted'}>{s.status}</Pill>
            </div>
            <p className="mt-2.5 text-[15px] font-semibold leading-tight">{s.title}</p>
            <p className="mt-0.5 text-[13px] text-brand-text-muted">{s.client}</p>
            <p className="mt-auto pt-2 text-[12px] font-medium text-brand-text">{s.team}</p>
          </div>
        ))}
        {!loading && shown.length === 0 && (
          <div className="col-span-full grid place-items-center rounded-lg border border-dashed border-brand-primary/30 bg-brand-primary/10 py-7 text-center">
            <div><CalendarX className="mx-auto h-7 w-7 opacity-60" /><p className="mt-1 text-[14px] font-semibold">Belum ada jadwal</p><p className="text-[12px] opacity-70">Tambah project untuk mengisi jadwal pengerjaan.</p></div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ───────── Tabel ───────── */
const Th = ({ children }) => <th className="px-3 py-3 text-left text-[12px] font-semibold uppercase tracking-wide text-brand-text-muted">{children}</th>;
const SkeletonRows = ({ cols }) =>
  Array.from({ length: 6 }).map((_, r) => (
    <tr key={r} className="border-t border-brand-border">{Array.from({ length: cols }).map((__, c) => <td key={c} className="px-3 py-3"><Skeleton className="h-3.5 w-full" /></td>)}</tr>
  ));

function OrdersTable({ data, loading, error, page, setPage, onRetry }) {
  return (
    <section className={`${card} flex flex-col p-5`}>
      <h3 className="text-[17px] font-semibold text-brand-white">Order Aktif</h3>
      <p className="text-[13px] text-brand-text-muted">{loading ? 'Memuat…' : `${data.items.length} dari ${data.total} order`}</p>
      <div className="mt-3 flex-1 overflow-x-auto">
        <table className="w-full min-w-[560px] text-[13px]">
          <thead className="bg-brand-tertiary/60"><tr><Th>Order &amp; Klien</Th><Th>Layanan</Th><Th>Nilai</Th><Th>Status</Th><Th>Aksi</Th></tr></thead>
          <tbody>
            {loading && <SkeletonRows cols={5} />}
            {!loading && !error && data.items.map((o) => (
              <tr key={o.id ?? o.no} className="border-t border-brand-border transition hover:bg-brand-accent/[0.06]">
                <td className="whitespace-nowrap px-3 py-3"><span className="mr-2 font-mono text-[12px] text-brand-accent">{o.no}</span><span className="font-medium text-brand-white">{o.client}</span></td>
                <td className="px-3 text-brand-text-muted">{o.service}</td>
                <td className="px-3 font-medium tabular-nums text-brand-white">{o.value}</td>
                <td className="px-3"><Pill className={orderTone[o.status] || 'bg-brand-muted/30 text-brand-text-muted'}>{o.status}</Pill></td>
                <td className="px-3">{o.status === 'Pending' && !o.hasTeam ? <button className="rounded-md border border-brand-border px-2.5 py-1 text-[12px] text-brand-text hover:bg-brand-accent/5">Tugaskan</button> : <ChevronRight className="h-4 w-4 text-brand-text-muted" />}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {error && !loading && (
          <div className="grid place-items-center gap-2 py-10 text-center text-[14px] text-brand-text">
            <p>{error}</p>
            <button onClick={onRetry} className={`${btnGhost} inline-flex items-center gap-1.5`}><RefreshCw className="h-4 w-4" /> Coba lagi</button>
          </div>
        )}
        {!error && !loading && data.items.length === 0 && <p className="py-10 text-center text-[14px] text-brand-text-muted">Tidak ada order yang cocok dengan filter.</p>}
      </div>
      <div className="mt-3 flex items-center justify-between text-[13px] text-brand-text-muted">
        <span>Total {data.total} order</span>
        <div className="flex items-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Halaman sebelumnya" className="rounded p-1 hover:bg-brand-muted/30 disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
          <span className="rounded-md bg-brand-accent px-2.5 py-1 font-bold text-brand-primary">{page}</span>
          <span>/ {data.pages}</span>
          <button disabled={page >= data.pages} onClick={() => setPage(page + 1)} aria-label="Halaman berikutnya" className="rounded p-1 hover:bg-brand-muted/30 disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>
    </section>
  );
}

function InvoicesTable({ items, loading, onRemind, onRemindAll, busyId, busyAll }) {
  return (
    <section className={`${card} flex flex-col p-5`}>
      <div className="flex items-start justify-between gap-3">
        <div><h3 className="text-[17px] font-semibold text-brand-white">Faktur &amp; Penagihan</h3><p className="text-[13px] text-brand-text-muted">Status tagihan pending dan jatuh tempo</p></div>
        <button onClick={onRemindAll} disabled={busyAll || !items.length} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-tertiary px-3.5 py-2 text-[12px] font-medium text-brand-text transition hover:bg-brand-muted/40 disabled:opacity-50">
          {busyAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />} Remind All
        </button>
      </div>
      <div className="mt-3 flex-1 overflow-x-auto">
        <table className="w-full min-w-[560px] text-[13px]">
          <thead className="bg-brand-tertiary/60"><tr><Th>Faktur &amp; Klien</Th><Th>Nominal</Th><Th>Jatuh Tempo</Th><Th>Status</Th><Th>Aksi</Th></tr></thead>
          <tbody>
            {loading && <SkeletonRows cols={5} />}
            {!loading && items.map((v) => (
              <tr key={v.id ?? v.no} className="border-t border-brand-border transition hover:bg-brand-accent/[0.06]">
                <td className="whitespace-nowrap px-3 py-3"><span className="mr-2 font-mono text-[12px] text-brand-accent">{v.no}</span><span className="font-medium text-brand-white">{v.client}</span></td>
                <td className={`px-3 font-semibold tabular-nums ${v.status === 'Overdue' ? 'text-rose-400' : 'text-brand-white'}`}>{v.amount}</td>
                <td className={`px-3 ${dueTone(v.due)}`}>{v.due}</td>
                <td className="px-3"><Pill className={v.status === 'Overdue' ? 'bg-rose-500/20 text-rose-300' : 'bg-brand-muted/30 text-brand-text-muted'}>{v.status}</Pill></td>
                <td className="px-3">
                  {v.status === 'Overdue'
                    ? <button onClick={() => onRemind(v)} disabled={busyId === v.id} className="rounded-md bg-rose-500/90 px-2.5 py-1 text-[12px] font-medium text-white hover:bg-rose-500 disabled:opacity-60">{busyId === v.id ? '…' : 'Ingatkan'}</button>
                    : <FileText className="h-4 w-4 text-brand-text-muted" />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && items.length === 0 && <p className="py-10 text-center text-[14px] text-brand-text-muted">Tidak ada tagihan pending.</p>}
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-[13px] text-brand-text-muted"><span className="h-1.5 w-1.5 rounded-full bg-brand-accent" /> Auto-reminder aktif</p>
    </section>
  );
}

/* ───────── Halaman ───────── */
export default function Page() {
  const [summary, setSummary] = useState(null);
  const [summaryErr, setSummaryErr] = useState('');
  const [orders, setOrders] = useState({ items: [], total: 0, pages: 1 });
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersErr, setOrdersErr] = useState('');
  const [filters, setFilters] = useState({ search: '', status: '', payment: '', date: '' });
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [busyAll, setBusyAll] = useState(false);
  const search = useDebounced(filters.search);

  const refresh = () => setReload((n) => n + 1);
  const notify = (message, type = 'success') => setToast({ message, type, k: Date.now() });
  const setFilter = (k) => (v) => { setFilters((f) => ({ ...f, [k]: v })); setPage(1); };

  /* Ringkasan dashboard */
  useEffect(() => {
    const ac = new AbortController();
    setSummaryErr('');
    api.getSummary(ac.signal).then(setSummary).catch((e) => e.name !== 'AbortError' && setSummaryErr(e.message));
    return () => ac.abort();
  }, [reload]);

  /* Order aktif: search + filter + paginasi */
  useEffect(() => {
    const ac = new AbortController();
    setOrdersLoading(true);
    api
      .getOrders({ search, status: filters.status, payment: filters.payment, date: filters.date, page, limit: PAGE_SIZE }, ac.signal)
      .then((r) => { setOrders(r); setOrdersErr(''); })
      .catch((e) => e.name !== 'AbortError' && setOrdersErr(e instanceof ApiError ? e.message : 'Gagal memuat order.'))
      .finally(() => !ac.signal.aborted && setOrdersLoading(false));
    return () => ac.abort();
  }, [search, filters.status, filters.payment, filters.date, page, reload]);

  const done = (msg) => { setModal(null); notify(msg); setPage(1); refresh(); };

  const remind = async (inv) => {
    setBusyId(inv.id);
    try { await api.remindInvoice(inv.id); notify(`Pengingat dikirim ke ${inv.client}.`); }
    catch (e) { notify(e.message, 'error'); }
    finally { setBusyId(null); }
  };
  const remindAll = async () => {
    setBusyAll(true);
    try {
      const count = await api.remindAll(summary?.invoices || []);
      notify(`${count} pengingat berhasil dikirim.`);
    }
    catch (e) { notify(e.message, 'error'); }
    finally { setBusyAll(false); }
  };

  const loading = !summary && !summaryErr;
  const s = summary?.stats || {};
  const cards = [
    { title: 'Order Pending', value: s.orderPending ?? 0, note: 'Menunggu diproses', icon: TrendingUp, featured: true, accent: {} },
    { title: 'Jadwal Hari Ini', value: s.jadwalHariIni ?? 0, note: 'Jadwal aktif hari ini', icon: CalendarDays, accent: { bg: 'bg-brand-accent2/15', icon: 'text-brand-accent2', strip: 'bg-brand-accent2' } },
    { title: 'Order Deadline', value: s.orderDeadline ?? 0, note: 'Batas pengerjaan hari ini', icon: Clock, accent: { bg: 'bg-brand-accent/15', icon: 'text-brand-accent', strip: 'bg-brand-accent/70' } },
    { title: 'Payment Pending', value: s.paymentPending ?? 0, note: 'Tagihan belum lunas', icon: AlertCircle, accent: { bg: 'bg-brand-accent2/15', icon: 'text-brand-accent2', strip: 'bg-brand-accent2/70' } },
  ];
  return (
    <RoleLayout>
      <Head title="Dashboard Admin" />
      <div className="rounded-2xl border border-brand-border bg-brand-primary p-5 text-brand-text shadow-2xl sm:p-6 lg:p-7">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-accent">Operations overview</p>
            <h1 className="text-[26px] font-bold tracking-tight text-brand-white">Dashboard Operasional Admin</h1>
            <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-brand-text-muted">Pusat kendali untuk memantau verifikasi order, jadwal, penagihan invoice, dan progres teknis.</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setModal('add')} className="flex items-center gap-2 rounded-xl bg-brand-accent px-5 py-3 text-[14px] font-semibold text-brand-primary shadow-lg shadow-brand-accent/25 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2 focus-visible:ring-offset-brand-primary">
              <Plus className="h-4 w-4" /> Tambah Project
            </button>
            <button
              type="button"
              disabled
              title="Fitur import belum tersedia karena endpoint backend belum dibuat."
              className="cursor-not-allowed rounded-xl border border-brand-border bg-brand-secondary px-5 py-3 text-[14px] font-medium text-brand-text-muted"
            >
              Import Data
            </button>
          </div>
        </div>

        {summaryErr && (
          <div className="mt-4 flex items-center justify-between gap-3"><ErrorBox>{summaryErr}</ErrorBox>
            <button onClick={refresh} className={`${btnGhost} inline-flex shrink-0 items-center gap-1.5`}><RefreshCw className="h-4 w-4" /> Coba lagi</button></div>
        )}

        {/* Statistik */}
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((c) => <StatCard key={c.title} {...c} loading={loading} />)}
        </div>

        {/* Analisis + Jadwal */}
        <div className="mt-4 grid items-stretch gap-4 lg:grid-cols-[minmax(280px,0.9fr)_2.1fr]">
          <ProjectChart data={summary?.chart || []} loading={loading} />
          <Upcoming items={summary?.schedules || []} loading={loading} />
        </div>

        {/* Pencarian & filter */}
        <div className="mt-4 grid gap-2.5 rounded-xl border border-brand-accent/40 bg-brand-secondary p-3 sm:grid-cols-2 lg:grid-cols-[1fr_180px_180px_180px]">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-text-muted" />
            <input
              value={filters.search}
              onChange={(e) => setFilter('search')(e.target.value)}
              placeholder="Cari No Order atau Customer..."
              aria-label="Cari order"
              className={`${inputCls} pl-10 pr-9`}
            />
            {filters.search && <button onClick={() => setFilter('search')('')} aria-label="Hapus pencarian" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-brand-text-muted hover:text-brand-white"><X className="h-4 w-4" /></button>}
          </div>
          <Select label="Filter status" value={filters.status} onChange={setFilter('status')} options={STATUS_OPTIONS} />
          <Select label="Filter payment" value={filters.payment} onChange={setFilter('payment')} options={PAYMENT_OPTIONS} />
          <input type="date" aria-label="Pilih tanggal" value={filters.date} onChange={(e) => setFilter('date')(e.target.value)} className={inputCls} />
        </div>

        {/* Tabel */}
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <OrdersTable data={orders} loading={ordersLoading} error={ordersErr} page={page} setPage={setPage} onRetry={refresh} />
          <InvoicesTable items={summary?.invoices || []} loading={loading} onRemind={remind} onRemindAll={remindAll} busyId={busyId} busyAll={busyAll} />
        </div>
      </div>

      {modal === 'add' && <AddProjectModal onClose={() => setModal(null)} onDone={done} />}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </RoleLayout>
  );
}