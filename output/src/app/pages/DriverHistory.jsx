import { useEffect, useState } from 'react';
import { PageContainer } from '../components/layout/PageContainer';
import { Card, CardBody } from '../components/ui/Card';
import { driverAPI } from '../services/api';
import { formatInr } from '../utils/currency';
import { Loader, AlertCircle } from 'lucide-react';

export function DriverHistory() {
  const [rides, setRides] = useState([]);
  const [parcels, setParcels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('rides');

  useEffect(() => {
    const load = async () => {
      setError('');
      try {
        const res = await driverAPI.getHistory();
        setRides(res.rides || []);
        setParcels(res.parcels || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <PageContainer title="History" subtitle="Past completed and cancelled jobs">
      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 bg-destructive/10 text-destructive rounded-lg text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="flex bg-secondary p-1 rounded-xl mb-6 inline-flex mx-auto">
        <button
          className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${
            tab === 'rides' ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setTab('rides')}
        >
          Rides
        </button>
        <button
          className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${
            tab === 'parcels' ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setTab('parcels')}
        >
          Parcels
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12 text-muted-foreground gap-2">
          <Loader className="w-6 h-6 animate-spin" /> Loading history…
        </div>
      ) : tab === 'rides' ? (
        <div className="space-y-4">
          {rides.length === 0 ? (
            <p className="text-muted-foreground text-center py-12 text-sm border border-dashed rounded-xl border-border">No ride history available.</p>
          ) : (
            rides.map((r) => (
              <Card key={r._id}>
                <CardBody className="flex justify-between items-center flex-wrap gap-4">
                  <div>
                    <h4 className="font-semibold">{r.type.toUpperCase()} · {formatInr(r.fare)}</h4>
                    <p className="text-sm text-muted-foreground">{r.from} → {r.to}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(r.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    r.status === 'completed' ? 'bg-primary/20 text-primary' : 'bg-destructive/20 text-destructive'
                  }`}>
                    {r.status}
                  </span>
                </CardBody>
              </Card>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {parcels.length === 0 ? (
            <p className="text-muted-foreground text-center py-12 text-sm border border-dashed rounded-xl border-border">No parcel history available.</p>
          ) : (
            parcels.map((p) => (
              <Card key={p._id}>
                <CardBody className="flex justify-between items-center flex-wrap gap-4">
                  <div>
                    <h4 className="font-semibold">Parcel · {formatInr(p.fare)}</h4>
                    <p className="text-xs text-muted-foreground">ID: {p.trackingCode}</p>
                    <p className="text-sm text-muted-foreground mt-1">{p.pickupAddress} → {p.dropoffAddress}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(p.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    p.status === 'delivered' ? 'bg-primary/20 text-primary' : 'bg-destructive/20 text-destructive'
                  }`}>
                    {p.status}
                  </span>
                </CardBody>
              </Card>
            ))
          )}
        </div>
      )}
    </PageContainer>
  );
}
