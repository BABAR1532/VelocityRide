import { useEffect, useState } from 'react';
import { PageContainer } from '../components/layout/PageContainer';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { rideAPI } from '../services/api';
import { formatInr } from '../utils/currency';
import { Loader, RefreshCw, AlertCircle, CheckCircle, Play, Flag } from 'lucide-react';

function statusLabel(s) {
  const map = {
    pending: 'Pending',
    accepted: 'Accepted — pick up rider',
    in_progress: 'En route',
    completed: 'Completed',
    cancelled: 'Cancelled',
  };
  return map[s] || s;
}

export function DriverRides() {
  const [pending, setPending] = useState([]);
  const [active, setActive] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  const load = async () => {
    setError('');
    setLoading(true);
    try {
      const data = await rideAPI.getDriverJobs();
      setPending(data.pending || []);
      setActive(data.active || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  const run = async (id, fn) => {
    setBusyId(id);
    setError('');
    try {
      await fn(id);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId('');
    }
  };

  return (
    <PageContainer title="Ride jobs" subtitle="Accept new requests and move trips through pickup → drop-off">
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

      {loading && pending.length === 0 && active.length === 0 ? (
        <div className="flex justify-center py-12 text-muted-foreground gap-2">
          <Loader className="w-6 h-6 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="space-y-8">
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold">Pending — open to accept</h3>
            </CardHeader>
            <CardBody className="space-y-3">
              {pending.length === 0 ? (
                <p className="text-sm text-muted-foreground">No pending rides right now.</p>
              ) : (
                pending.map((r) => (
                  <div
                    key={r._id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-xl border border-border"
                  >
                    <div>
                      <p className="font-medium text-foreground capitalize">{r.type} · {formatInr(r.fare)}</p>
                      <p className="text-sm text-muted-foreground">
                        {r.from} → {r.to}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      disabled={busyId === r._id}
                      onClick={() => run(r._id, rideAPI.acceptRide)}
                    >
                      {busyId === r._id ? <Loader className="w-4 h-4 animate-spin" /> : 'Accept ride'}
                    </Button>
                  </div>
                ))
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold">Your active trips</h3>
            </CardHeader>
            <CardBody className="space-y-3">
              {active.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active trips. Accept one from the list above.</p>
              ) : (
                active.map((r) => (
                  <div
                    key={r._id}
                    className="p-4 rounded-xl border border-border space-y-3"
                  >
                    <div className="flex flex-wrap justify-between gap-2">
                      <div>
                        <p className="font-medium text-foreground capitalize">{r.type} · {formatInr(r.fare)}</p>
                        <p className="text-sm text-muted-foreground">
                          {r.from} → {r.to}
                        </p>
                      </div>
                      <span className="text-xs font-medium px-2 py-1 rounded-full bg-secondary text-foreground">
                        {statusLabel(r.status)}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {r.status === 'accepted' && (
                        <Button
                          size="sm"
                          variant="primary"
                          disabled={busyId === r._id}
                          onClick={() => run(r._id, rideAPI.startRide)}
                        >
                          <Play className="w-4 h-4 mr-1" /> Start trip (picked up)
                        </Button>
                      )}
                      {r.status === 'in_progress' && (
                        <Button
                          size="sm"
                          variant="primary"
                          disabled={busyId === r._id}
                          onClick={() => run(r._id, rideAPI.completeRide)}
              >
                          <CheckCircle className="w-4 h-4 mr-1" /> Complete trip
                        </Button>
                      )}
                      {(r.status === 'accepted' || r.status === 'in_progress') && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive border-destructive/40"
                          disabled={busyId === r._id}
                          onClick={() => run(r._id, rideAPI.cancelRide)}
                        >
                          <Flag className="w-4 h-4 mr-1" /> Cancel as driver
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardBody>
          </Card>
        </div>
      )}
    </PageContainer>
  );
}
