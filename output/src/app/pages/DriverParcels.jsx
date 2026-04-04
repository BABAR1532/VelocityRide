import { useEffect, useState, useMemo } from 'react';
import { PageContainer } from '../components/layout/PageContainer';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { parcelAPI } from '../services/api';
import { formatInr } from '../utils/currency';
import { Loader, RefreshCw, AlertCircle } from 'lucide-react';

const DRIVER_NEXT = [
  { id: 'picked_up', label: 'Picked up' },
  { id: 'in_transit', label: 'In transit' },
  { id: 'out_for_delivery', label: 'Out for delivery' },
  { id: 'delivered', label: 'Delivered' },
];

function formatStatus(s) {
  return (s || '').replaceAll('_', ' ');
}

export function DriverParcels() {
  const [available, setAvailable] = useState([]);
  const [mine, setMine] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [nextStatus, setNextStatus] = useState('picked_up');

  const selected = useMemo(
    () => mine.find((p) => p._id === selectedId) || null,
    [mine, selectedId],
  );

  const load = async () => {
    setError('');
    setLoading(true);
    try {
      const [a, m] = await Promise.all([
        parcelAPI.listAvailableParcels(),
        parcelAPI.listDriverParcels(),
      ]);
      setAvailable(a.parcels || []);
      setMine(m.parcels || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 12000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!selected) return;
    setNextStatus(DRIVER_NEXT[0].id);
  }, [selected]);

  const run = async (fn) => {
    if (!selected) return;
    const sid = selected._id;
    setBusyId(sid);
    setError('');
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId('');
    }
  };

  return (
    <PageContainer title="Parcel jobs" subtitle="Claim open parcels and update delivery status">
      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 bg-destructive/10 text-destructive rounded-lg text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="flex justify-end mb-4">
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {loading && available.length === 0 && mine.length === 0 ? (
        <div className="flex justify-center py-12 text-muted-foreground gap-2">
          <Loader className="w-6 h-6 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold">Available to claim</h3>
            </CardHeader>
            <CardBody className="space-y-2">
              {available.length === 0 ? (
                <p className="text-sm text-muted-foreground">No scheduled parcels waiting for a driver.</p>
              ) : (
                available.map((p) => (
                  <div
                    key={p._id}
                    className="p-3 rounded-xl border border-border flex justify-between gap-3 flex-wrap items-center"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{p.trackingCode}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {p.pickupAddress} → {p.dropoffAddress}
                      </p>
                      <p className="text-sm font-medium">{formatInr(p.fare)}</p>
                    </div>
                    <Button
                      size="sm"
                      disabled={busyId === p._id}
                      onClick={async () => {
                        setBusyId(p._id);
                        setError('');
                        try {
                          await parcelAPI.claimParcel(p._id);
                          await load();
                          setSelectedId(p._id);
                        } catch (e) {
                          setError(e.message);
                        } finally {
                          setBusyId('');
                        }
                      }}
                    >
                      {busyId === p._id ? <Loader className="w-4 h-4 animate-spin" /> : 'Claim'}
                    </Button>
                  </div>
                ))
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold">My parcels</h3>
            </CardHeader>
            <CardBody className="space-y-3">
              {mine.length === 0 ? (
                <p className="text-sm text-muted-foreground">You have not claimed any parcels yet.</p>
              ) : (
                mine.map((p) => (
                  <button
                    key={p._id}
                    type="button"
                    onClick={() => setSelectedId(p._id)}
                    className={`w-full text-left p-3 rounded-xl border transition-colors ${
                      selectedId === p._id ? 'border-primary bg-primary/5' : 'border-border hover:bg-secondary'
                    }`}
                  >
                    <div className="flex justify-between gap-2">
                      <span className="font-medium">{p.trackingCode}</span>
                      <span className="text-xs capitalize text-muted-foreground">{formatStatus(p.status)}</span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {p.pickupAddress} → {p.dropoffAddress}
                    </p>
                    {p.status === 'cancelled' && (
                      <p className="text-xs text-destructive mt-1">Cancelled — customer removed this job.</p>
                    )}
                  </button>
                ))
              )}

              {selected && selected.status !== 'cancelled' && selected.status !== 'delivered' && (
                <div className="pt-4 border-t border-border space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Current status: <span className="font-medium text-foreground capitalize">{formatStatus(selected.status)}</span>
                  </p>
                  <label className="block text-sm text-foreground">Update status</label>
                  <select
                    value={nextStatus}
                    onChange={(e) => setNextStatus(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background"
                  >
                    {DRIVER_NEXT.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <Button
                    fullWidth
                    disabled={busyId === selected._id || selected.status === nextStatus}
                    onClick={() =>
                      run(async () => {
                        await parcelAPI.updateStatus(selected._id, nextStatus);
                      })
                    }
                  >
                    {busyId === selected._id ? <Loader className="w-4 h-4 animate-spin" /> : 'Update status'}
                  </Button>
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      )}
    </PageContainer>
  );
}
