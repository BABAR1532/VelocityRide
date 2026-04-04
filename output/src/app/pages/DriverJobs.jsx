import { useEffect, useState } from 'react';
import { PageContainer } from '../components/layout/PageContainer';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { driverAPI } from '../services/api';
import { formatInr } from '../utils/currency';
import { Loader, AlertCircle, Play, CheckCircle, Flag, MapPin, DollarSign } from 'lucide-react';

export function DriverJobs() {
  const [pendingRides, setPendingRides] = useState([]);
  const [activeRides, setActiveRides] = useState([]);
  const [availableParcels, setAvailableParcels] = useState([]);
  const [activeParcels, setActiveParcels] = useState([]);
  const [pendingCarpools, setPendingCarpools] = useState([]);
  const [activeCarpools, setActiveCarpools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  const load = async () => {
    try {
      const { pending, active } = await driverAPI.getJobs();
      setPendingRides(pending.filter(j => j.jobType === 'ride'));
      setAvailableParcels(pending.filter(j => j.jobType === 'parcel'));
      setPendingCarpools(pending.filter(j => j.jobType === 'carpool'));
      setActiveRides(active.filter(j => j.jobType === 'ride'));
      setActiveParcels(active.filter(j => j.jobType === 'parcel' && !['delivered', 'cancelled'].includes(j.status)));
      setActiveCarpools(active.filter(j => j.jobType === 'carpool' && !['completed', 'cancelled'].includes(j.status)));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 3000);
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

  const hasActiveJob = activeRides.length > 0 || activeParcels.length > 0 || activeCarpools.length > 0;

  return (
    <PageContainer title="Available Jobs" subtitle="Accept rides and deliver parcels">
      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 bg-destructive/10 text-destructive rounded-lg text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {loading && !hasActiveJob && pendingRides.length === 0 && availableParcels.length === 0 && pendingCarpools.length === 0 ? (
        <div className="flex justify-center py-12 text-muted-foreground gap-2">
          <Loader className="w-6 h-6 animate-spin" /> Loading Jobs…
        </div>
      ) : (
        <div className="space-y-8">
          {/* Active Jobs Section */}
          {hasActiveJob && (
            <Card className="border-primary/40 bg-primary/5">
              <CardHeader>
                <h3 className="text-xl font-bold text-primary">Active Flow</h3>
              </CardHeader>
              <CardBody className="space-y-4">
                {activeRides.map((r) => (
                  <div key={r._id} className="p-4 rounded-xl border border-primary/20 bg-background space-y-4 shadow-sm">
                    <div className="flex justify-between flex-wrap gap-2">
                      <div>
                        <p className="font-bold text-lg">Ride · {formatInr(r.fare)}</p>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          <MapPin className="inline w-3 h-3 mr-1" />
                          <span className="font-medium text-foreground">Pickup:</span> {r.from}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          <MapPin className="inline w-3 h-3 mr-1" />
                          <span className="font-medium text-foreground">Dropoff:</span> {r.to}
                        </p>
                      </div>
                      <span className="text-sm font-semibold capitalize px-3 py-1 rounded-full bg-secondary">
                        {r.status.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                      {r.status === 'accepted' && (
                        <Button size="sm" onClick={() => run(r._id, id => driverAPI.startJob('ride', id))} disabled={busyId === r._id}>
                          {busyId === r._id ? <Loader className="w-4 h-4 animate-spin mr-1" /> : <Play className="w-4 h-4 mr-1" />} Mark as Picked Up
                        </Button>
                      )}
                      {r.status === 'in_progress' && (
                        <Button size="sm" onClick={() => run(r._id, id => driverAPI.completeJob('ride', id))} disabled={busyId === r._id}>
                          {busyId === r._id ? <Loader className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle className="w-4 h-4 mr-1" />} Mark as Completed
                        </Button>
                      )}
                      <Button size="sm" variant="outline" className="text-destructive border-destructive/30" onClick={() => run(r._id, id => driverAPI.cancelJob('ride', id))} disabled={busyId === r._id}>
                        <Flag className="w-4 h-4 mr-1" /> Cancel Ride
                      </Button>
                    </div>
                  </div>
                ))}

                {activeParcels.map((p) => (
                  <div key={p._id} className="p-4 rounded-xl border border-primary/20 bg-background space-y-4 shadow-sm">
                    <div className="flex justify-between flex-wrap gap-2">
                      <div>
                        <p className="font-bold text-lg">Parcel · {formatInr(p.fare)}</p>
                        {p.packageType && <p className="text-sm">Type: {p.packageType}</p>}
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          <MapPin className="inline w-3 h-3 mr-1" />
                          <span className="font-medium text-foreground">Pickup:</span> {p.pickupAddress}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          <MapPin className="inline w-3 h-3 mr-1" />
                          <span className="font-medium text-foreground">Dropoff:</span> {p.dropoffAddress}
                        </p>
                      </div>
                      <span className="text-sm font-semibold capitalize px-3 py-1 rounded-full bg-secondary">
                        {p.status.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                      {p.status === 'scheduled' && (
                        <Button size="sm" onClick={() => run(p._id, id => driverAPI.startJob('parcel', id))} disabled={busyId === p._id}>
                          {busyId === p._id ? <Loader className="w-4 h-4 animate-spin mr-1" /> : <Play className="w-4 h-4 mr-1" />} Mark as Picked Up
                        </Button>
                      )}
                      {(p.status === 'picked_up' || p.status === 'in_transit' || p.status === 'out_for_delivery') && (
                        <Button size="sm" onClick={() => run(p._id, id => driverAPI.completeJob('parcel', id))} disabled={busyId === p._id}>
                          {busyId === p._id ? <Loader className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle className="w-4 h-4 mr-1" />} Mark as Delivered
                        </Button>
                      )}
                    </div>
                  </div>
                ))}

                {activeCarpools.map((c) => (
                  <div key={c._id} className="p-4 rounded-xl border border-primary/20 bg-background space-y-4 shadow-sm">
                    <div className="flex justify-between flex-wrap gap-2">
                      <div>
                        <p className="font-bold text-lg">Carpool · {formatInr(c.farePerPerson)}/seat</p>
                        <p className="text-sm">Seats: {c.availableSeats}/{c.totalSeats}</p>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          <MapPin className="inline w-3 h-3 mr-1" />
                          <span className="font-medium text-foreground">Route:</span> {c.from} → {c.to}
                        </p>
                      </div>
                      <span className="text-sm font-semibold capitalize px-3 py-1 rounded-full bg-secondary">
                        {c.status.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                      {c.status === 'scheduled' && (
                        <Button size="sm" onClick={() => run(c._id, id => driverAPI.startJob('carpool', id))} disabled={busyId === c._id}>
                          {busyId === c._id ? <Loader className="w-4 h-4 animate-spin mr-1" /> : <Play className="w-4 h-4 mr-1" />} Start Carpool
                        </Button>
                      )}
                      {(c.status === 'in_progress') && (
                        <Button size="sm" onClick={() => run(c._id, id => driverAPI.completeJob('carpool', id))} disabled={busyId === c._id}>
                          {busyId === c._id ? <Loader className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle className="w-4 h-4 mr-1" />} Mark as Completed
                        </Button>
                      )}
                      <Button size="sm" variant="outline" className="text-destructive border-destructive/30" onClick={() => run(c._id, id => driverAPI.cancelJob('carpool', id))} disabled={busyId === c._id}>
                        <Flag className="w-4 h-4 mr-1" /> Cancel
                      </Button>
                    </div>
                  </div>
                ))}
              </CardBody>
            </Card>
          )}

          {/* Ride Requests Section */}
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold">Ride Requests</h3>
            </CardHeader>
            <CardBody className="space-y-3">
              {pendingRides.length === 0 ? (
                <p className="text-sm text-muted-foreground">No pending rides available right now.</p>
              ) : (
                pendingRides.map((r) => (
                  <div key={r._id} className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl border border-border">
                    <div className="flex-1">
                      <p className="font-medium text-foreground">Ride · {r.type} · {formatInr(r.fare)}</p>
                      <p className="text-sm text-muted-foreground line-clamp-1">{r.from} <span className="mx-1">→</span> {r.to}</p>
                    </div>
                    <Button size="sm" disabled={busyId === r._id} onClick={() => run(r._id, id => driverAPI.acceptJob('ride', id))}>
                      {busyId === r._id ? <Loader className="w-4 h-4 animate-spin" /> : 'Accept Ride'}
                    </Button>
                  </div>
                ))
              )}
            </CardBody>
          </Card>

          {/* Parcel Requests Section */}
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold">Parcel Requests</h3>
            </CardHeader>
            <CardBody className="space-y-3">
              {availableParcels.length === 0 ? (
                <p className="text-sm text-muted-foreground">No pending parcels available right now.</p>
              ) : (
                availableParcels.map((p) => (
                  <div key={p._id} className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl border border-border">
                    <div className="flex-1">
                      <p className="font-medium text-foreground">Parcel · {p.packageType || 'General'} · {formatInr(p.fare)}</p>
                      {p.trackingCode && <p className="text-xs text-muted-foreground mb-1">ID: {p.trackingCode}</p>}
                      <p className="text-sm text-muted-foreground line-clamp-1">{p.pickupAddress} <span className="mx-1">→</span> {p.dropoffAddress}</p>
                    </div>
                    <Button size="sm" disabled={busyId === p._id} onClick={() => run(p._id, id => driverAPI.acceptJob('parcel', id))}>
                      {busyId === p._id ? <Loader className="w-4 h-4 animate-spin" /> : 'Accept Parcel'}
                    </Button>
                  </div>
                ))
              )}
            </CardBody>
          </Card>

          {/* Carpool Requests Section */}
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold">Pool Requests</h3>
            </CardHeader>
            <CardBody className="space-y-3">
              {pendingCarpools.length === 0 ? (
                <p className="text-sm text-muted-foreground">No pending pool rides available right now.</p>
              ) : (
                pendingCarpools.map((c) => (
                  <div key={c._id} className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl border border-border">
                    <div className="flex-1">
                      <p className="font-medium text-foreground">Carpool · {c.totalSeats} seats · {formatInr(c.farePerPerson)}/seat</p>
                      <p className="text-sm text-muted-foreground line-clamp-1">{c.from} <span className="mx-1">→</span> {c.to}</p>
                    </div>
                    <Button size="sm" disabled={busyId === c._id} onClick={() => run(c._id, id => driverAPI.acceptJob('carpool', id))}>
                      {busyId === c._id ? <Loader className="w-4 h-4 animate-spin" /> : 'Accept Pool'}
                    </Button>
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
