import React, { useEffect, useState } from 'react';
import { supabase } from '@/supabaseClient';
import { Clock, List, CheckCircle, Play } from 'lucide-react';

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

const ProfilePage: React.FC = () => {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(20);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const uid = session?.user?.id;
        if (!uid) return;

        const { data, error } = await supabase
          .from('user_history')
          .select('*')
          .eq('user_id', uid)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (error) {
          console.error('Failed to fetch user history:', error);
          return;
        }
        if (mounted) setHistory(data || []);
      } catch (e) {
        console.error('Profile load error:', e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, [limit]);

  const renderCard = (h: any) => {
    const action = h.action ?? 'activity';
    const area = h.area ?? '—';
    const time = formatDate(h.created_at);
    const payload = h.payload ?? {};

    if (action === 'recommendation') {
      const chore = payload.chore ?? payload.recommendation?.chore ?? '—';
      const volume = payload.volume_liters ?? payload.volume ?? '—';
      const ideal = payload.recommendation?.ideal_hardness_mg_l ?? payload.recommendation?.ideal_hardness_mg_l ?? '—';
      return (
        <div key={h.id} className="p-4 bg-white rounded-lg shadow-sm border">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <List className="w-5 h-5 text-indigo-600" />
              <div>
                <div className="text-sm font-semibold">Recommendation requested</div>
                <div className="text-xs text-gray-500">{time}</div>
              </div>
            </div>
            <div className="text-xs text-gray-500">{area}</div>
          </div>
          <SummaryRow label="Chore" value={chore} />
          <SummaryRow label="Volume (L)" value={volume} />
          <SummaryRow label="Ideal Hardness (mg/L)" value={ideal} />
        </div>
      );
    }

    if (action === 'start_treatment') {
      const jobId = payload.job_id ?? payload?.job?.id ?? '—';
      const device = payload.device ?? payload?.device_name ?? '—';
      return (
        <div key={h.id} className="p-4 bg-white rounded-lg shadow-sm border">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <Play className="w-5 h-5 text-yellow-600" />
              <div>
                <div className="text-sm font-semibold">Treatment started</div>
                <div className="text-xs text-gray-500">{time}</div>
              </div>
            </div>
            <div className="text-xs text-gray-500">{area}</div>
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
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div>
                <div className="text-sm font-semibold">Treatment complete</div>
                <div className="text-xs text-gray-500">{time}</div>
              </div>
            </div>
            <div className="text-xs text-gray-500">{area}</div>
          </div>
          <SummaryRow label="Final Hardness (mg/L)" value={final} />
          <SummaryRow label="Status" value={statusNote} />
        </div>
      );
    }

    // Fallback: generic card with small payload preview
    return (
      <div key={h.id} className="p-4 bg-white rounded-lg shadow-sm border">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <Clock className="w-5 h-5 text-gray-500" />
            <div>
              <div className="text-sm font-semibold">{action}</div>
              <div className="text-xs text-gray-500">{time}</div>
            </div>
          </div>
          <div className="text-xs text-gray-500">{area}</div>
        </div>
        <div className="mt-2 text-xs text-gray-700">{JSON.stringify(payload, null, 2)}</div>
      </div>
    );
  };

  return (
    <div className="min-h-screen p-6">
      <h2 className="text-2xl font-semibold mb-4">My Activity</h2>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="space-y-4">
          {history.length === 0 && <p className="text-sm text-gray-500">No activity recorded yet.</p>}
          {history.map(h => renderCard(h))}
          {history.length >= limit && (
            <div className="pt-4 text-center">
              <button onClick={() => setLimit(l => l + 20)} className="px-4 py-2 bg-indigo-600 text-white rounded">Load more</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
