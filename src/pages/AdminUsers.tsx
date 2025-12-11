import React, { useEffect, useState } from 'react';
import { supabase } from '@/supabaseClient';
import { Clock, List, CheckCircle, Play, Search, Download } from 'lucide-react';

const formatDate = (iso?: string) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
};

const SummaryRow = ({ label, value }: { label: string, value?: string | number | null }) => (
  <div className="flex justify-between text-sm text-gray-700">
    <div className="font-medium text-gray-600">{label}</div>
    <div className="text-right text-gray-800">{value ?? '—'}</div>
  </div>
);

const initials = (name?: string) => {
  if (!name) return '?';
  return name.split(' ').map(s => s[0]).slice(0,2).join('').toUpperCase();
};

  const toCSV = (arr: any[]) => {
  if (!arr || arr.length === 0) return '';
  const headers = ['id','user_id','username','action','area','created_at','payload'];
  const rows = arr.map(r => [
    r.id,
    r.user_id,
    r.username ?? '',
    r.action ?? '',
    r.area ?? '',
    r.created_at ?? '',
    JSON.stringify(r.payload ?? {})
  ].map(cell => `"${String(cell).replace(/"/g,'""')}"`).join(','));
  return `${headers.join(',')}\n${rows.join('\n')}`;
};

const AdminUsers: React.FC = () => {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(30);
  const [cursor, setCursor] = useState<string | null>(null); // created_at cursor for pagination
  const [profilesMap, setProfilesMap] = useState<Record<string, string>>({});

  // Filters
  const [actionFilter, setActionFilter] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  const buildQuery = (base: any) => {
    let q = base;
    if (actionFilter) q = q.eq('action', actionFilter);
    if (dateFrom) q = q.gte('created_at', new Date(dateFrom).toISOString());
    if (dateTo) q = q.lte('created_at', new Date(dateTo + 'T23:59:59').toISOString());
    return q;
  };

  const fetchProfilesMap = async () => {
    try {
      const { data, error } = await supabase.from('profiles').select('user_id,username');
      if (error) throw error;
      const map: Record<string,string> = {};
      (data || []).forEach((p: any) => { map[p.user_id] = p.username ?? ''; });
      setProfilesMap(map);
    } catch (e) {
      console.warn('Failed to load profiles map:', e);
    }
  };

  const fetchHistory = async (reset = false) => {
    setLoading(true);
    try {
      // Ensure profiles map loaded for username mapping
      await fetchProfilesMap();

      let q = supabase.from('user_history').select('*').order('created_at', { ascending: false });
      q = buildQuery(q);

      if (reset) {
        // load first page
        q = q.limit(limit);
      } else if (cursor) {
        // load next page older than cursor
        q = q.lt('created_at', cursor).limit(limit);
      } else {
        q = q.limit(limit);
      }

      const { data, error } = await q;
      if (error) throw error;

      const rows = data || [];
      if (reset) {
        setHistory(rows);
      } else {
        setHistory(prev => [...prev, ...rows]);
      }

      if (rows.length > 0) {
        setCursor(rows[rows.length-1].created_at);
      }
    } catch (e) {
      console.error('Failed to fetch user history (admin):', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // initial load
    fetchHistory(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionFilter, dateFrom, dateTo]);

  const renderCard = (h: any) => {
    const action = h.action ?? 'activity';
    const time = formatDate(h.created_at);
    const payload = h.payload ?? {};
    const userId = h.user_id ?? '—';
    const username = profilesMap[userId] ?? '';

    const avatar = <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-semibold">{initials(username || userId)}</div>;

    if (action === 'recommendation') {
      const chore = payload.chore ?? payload.recommendation?.chore ?? '—';
      const volume = payload.volume_liters ?? payload.volume ?? '—';
      return (
        <div key={h.id} className="p-4 bg-white rounded-lg shadow-sm border">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-3">
              {avatar}
              <div>
                <div className="text-sm font-semibold">Recommendation</div>
                <div className="text-xs text-gray-500">{time} • {username || userId}</div>
              </div>
            </div>
            <div className="text-xs text-gray-500">{h.area ?? '—'}</div>
          </div>
          <SummaryRow label="Chore" value={chore} />
          <SummaryRow label="Volume (L)" value={volume} />
        </div>
      );
    }

    if (action === 'start_treatment') {
      const jobId = payload.job_id ?? payload?.job?.id ?? '—';
      const device = payload.device ?? payload?.device_name ?? '—';
      return (
        <div key={h.id} className="p-4 bg-white rounded-lg shadow-sm border">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-3">
              {avatar}
              <div>
                <div className="text-sm font-semibold">Treatment started</div>
                <div className="text-xs text-gray-500">{time} • {username || userId}</div>
              </div>
            </div>
            <div className="text-xs text-gray-500">{h.area ?? '—'}</div>
          </div>
          <SummaryRow label="Device" value={device} />
          <SummaryRow label="Job ID" value={jobId} />
        </div>
      );
    }

    if (action === 'treatment_completed') {
      const final = payload.result?.final_hardness_mg_l ?? payload.final_hardness_mg_l ?? '—';
      const statusNote = payload.status ?? 'completed';
      return (
        <div key={h.id} className="p-4 bg-white rounded-lg shadow-sm border">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-3">
              {avatar}
              <div>
                <div className="text-sm font-semibold">Treatment complete</div>
                <div className="text-xs text-gray-500">{time} • {username || userId}</div>
              </div>
            </div>
            <div className="text-xs text-gray-500">{h.area ?? '—'}</div>
          </div>
          <SummaryRow label="Final Hardness (mg/L)" value={final} />
          <SummaryRow label="Status" value={statusNote} />
        </div>
      );
    }

    return (
      <div key={h.id} className="p-4 bg-white rounded-lg shadow-sm border">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-3">
            {avatar}
            <div>
              <div className="text-sm font-semibold">{action}</div>
              <div className="text-xs text-gray-500">{time} • {username || userId}</div>
            </div>
          </div>
          <div className="text-xs text-gray-500">{h.area ?? '—'}</div>
        </div>
        <div className="mt-2 text-xs text-gray-700">{JSON.stringify(payload, null, 2)}</div>
      </div>
    );
  };

  const handleExport = async () => {
    setLoading(true);
    try {
      // Fetch all matching rows (no limit)
      let q = supabase.from('user_history').select('*').order('created_at', { ascending: false });
      q = buildQuery(q);
      const { data, error } = await q;
      if (error) throw error;
      const rows = data || [];

      // Attach username where possible
      const enhanced = rows.map(r => ({ ...r, username: profilesMap[r.user_id] ?? '' }));
      const csv = toCSV(enhanced);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `user_history_export_${new Date().toISOString()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Export failed:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold">All Users Activity</h2>
        <div className="flex items-center space-x-2">
          <button onClick={handleExport} className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded">
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-gray-600">Action</label>
          <input placeholder="e.g. recommendation" value={actionFilter} onChange={e => setActionFilter(e.target.value)} className="mt-1 px-3 py-2 border rounded" />
        </div>
        <div>
          <label className="block text-xs text-gray-600">From</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="mt-1 px-3 py-2 border rounded" />
        </div>
        <div>
          <label className="block text-xs text-gray-600">To</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="mt-1 px-3 py-2 border rounded" />
        </div>
        <div>
          <button onClick={() => { setCursor(null); setHistory([]); fetchHistory(true); }} className="px-3 py-2 bg-indigo-600 text-white rounded flex items-center gap-2"><Search className="w-4 h-4" /> Apply</button>
        </div>
        <div>
          <button onClick={() => { setActionFilter(''); setDateFrom(''); setDateTo(''); setCursor(null); setHistory([]); fetchHistory(true); }} className="px-3 py-2 bg-gray-200 rounded">Reset</button>
        </div>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="space-y-4">
          {history.length === 0 && <p className="text-sm text-gray-500">No activity recorded yet.</p>}
          {history.map(h => renderCard(h))}
          {history.length >= limit && (
            <div className="pt-4 text-center">
              <button onClick={() => fetchHistory(false)} className="px-4 py-2 bg-indigo-600 text-white rounded">Load more</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminUsers;
