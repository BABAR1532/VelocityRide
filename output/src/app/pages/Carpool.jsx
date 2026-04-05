import { useState, useEffect, useRef, useCallback } from 'react';
import { PageContainer } from '../components/layout/PageContainer';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import {
  Users, MapPin, Clock, DollarSign, User, AlertCircle, Loader,
  CheckCircle, RefreshCw, Sparkles, Car, XCircle, Navigation, History,
  ChevronRight, LogOut
} from 'lucide-react';
import { carpoolAPI } from '../services/api';
import { formatInr } from '../utils/currency';
import { MapSelector } from '../components/ui/MapSelector';

function getUserId() {
  try {
    const token = localStorage.getItem('velocity_access_token');
    if (!token) return null;
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.sub;
  } catch {
    return null;
  }
}

// ── Status helpers ─────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  open:        { label: 'Open',           color: 'bg-blue-500/10 text-blue-600',    icon: Users },
  full:        { label: 'Full',           color: 'bg-amber-500/10 text-amber-600',  icon: Users },
  scheduled:   { label: 'Finding Driver', color: 'bg-purple-500/10 text-purple-600',icon: Car },
  in_progress: { label: 'En Route',      color: 'bg-primary/10 text-primary',       icon: Navigation },
  completed:   { label: 'Completed',     color: 'bg-emerald-500/10 text-emerald-700',icon: CheckCircle },
  cancelled:   { label: 'Cancelled',     color: 'bg-destructive/10 text-destructive',icon: XCircle },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status, color: 'bg-secondary text-foreground', icon: User };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${cfg.color}`}>
      <Icon className="w-3.5 h-3.5" />{cfg.label}
    </span>
  );
}

// ── Active Pool Card ──────────────────────────────────────────────────────────

function ActivePoolCard({ pool, isCreator, onStartPool, onDeletePool, onLeavePool, busy, leavingPool }) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const canStart   = isCreator && pool.seatsAvailable === 0 && ['open', 'full'].includes(pool.status);
  const canDelete  = isCreator;
  const canLeave   = !isCreator && ['open', 'full'].includes(pool.status);
  const showMap    = isCreator && ['open', 'full'].includes(pool.status);
  const showLiveMap = ['in_progress'].includes(pool.status);

  return (
    <Card className="border-primary/40 bg-primary/5 mb-8">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h3 className="text-xl font-bold text-primary">
            {isCreator ? 'Your Pool' : 'Your Active Carpool'}
          </h3>
          <StatusBadge status={pool.status} />
        </div>
      </CardHeader>
      <CardBody className="space-y-4">
        {/* Route info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-foreground">{pool.from}</p>
              <p className="text-muted-foreground">→ {pool.to}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Clock className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-foreground">Departure</p>
              <p className="text-muted-foreground">{new Date(pool.departureTime).toLocaleString()}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-foreground">
              <span className="font-semibold">{pool.seatsAvailable}</span>
              <span className="text-muted-foreground"> / {pool.totalSeats} seats available</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="font-semibold text-foreground">{formatInr(pool.farePerPerson)}</span>
            <span className="text-muted-foreground text-xs">per seat</span>
          </div>
        </div>

        {/* Driver info — shown when scheduled / in_progress */}
        {['scheduled', 'in_progress'].includes(pool.status) && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-background border border-border">
            <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
              <Car className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground">{pool.driverName || 'Driver assigned'}</p>
              <p className="text-sm text-muted-foreground">
                {pool.status === 'scheduled' ? 'On the way to pick you up' : 'En route to your destination'}
              </p>
            </div>
          </div>
        )}

        {/* Map — creator sees it while open/full; everyone sees it during in_progress */}
        {(showMap || showLiveMap) && (
          <div className="mt-2 pt-4 border-t border-primary/10">
            <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">
              {showLiveMap ? 'Live Route' : 'Route Preview'}
            </p>
            <MapSelector pickup={pool.from} dropoff={pool.to} height="250px" />
          </div>
        )}

        {/* Creator controls */}
        {isCreator && (
          <div className="flex flex-wrap gap-2 pt-3 border-t border-primary/10">
            {confirmDelete ? (
              /* ── Inline confirm step — avoids window.confirm blocking the event loop — */
              <>
                <p className="text-sm text-destructive font-semibold self-center flex-1">
                  Delete this pool? All participants will be notified and it cannot be undone.
                </p>
                <Button
                  onClick={() => { setConfirmDelete(false); onDeletePool(); }}
                  size="sm"
                  disabled={busy}
                  className="bg-destructive text-white hover:bg-destructive/90"
                >
                  {busy ? <><Loader className="w-4 h-4 mr-2 animate-spin" />Deleting…</> : 'Yes, Delete'}
                </Button>
                <Button
                  onClick={() => setConfirmDelete(false)}
                  variant="outline"
                  size="sm"
                  disabled={busy}
                >
                  Keep Pool
                </Button>
              </>
            ) : (
              <>
                <Button
                  onClick={onStartPool}
                  disabled={busy || !canStart}
                  size="sm"
                  className={canStart ? '' : 'opacity-50'}
                >
                  {busy
                    ? <><Loader className="w-4 h-4 mr-2 animate-spin" />Sending…</>
                    : <><Car className="w-4 h-4 mr-2" />Start Pool</>}
                </Button>
                {!canStart && pool.seatsAvailable > 0 && (
                  <p className="text-xs text-muted-foreground self-center">
                    {pool.seatsAvailable} seat{pool.seatsAvailable !== 1 ? 's' : ''} still available
                  </p>
                )}
                <div className="flex-1" />
                {canDelete && (
                  <Button
                    onClick={() => setConfirmDelete(true)}
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    className="border-destructive/50 text-destructive hover:bg-destructive/10"
                  >
                    Delete Pool
                  </Button>
                )}
              </>
            )}
          </div>
        )}

        {/* Passenger Leave button */}
        {canLeave && (
          <div className="pt-3 border-t border-primary/10 flex justify-end">
            <Button
              onClick={onLeavePool}
              variant="outline"
              size="sm"
              disabled={busy || leavingPool}
              className="border-destructive/40 text-destructive hover:bg-destructive/10"
            >
              {(busy || leavingPool) ? <Loader className="w-4 h-4 mr-2 animate-spin" /> : <LogOut className="w-4 h-4 mr-2" />}
              Leave Pool
            </Button>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

// ── History Card ──────────────────────────────────────────────────────────────

function HistoryCard({ pool }) {
  const cfg = STATUS_CONFIG[pool.status] || { label: pool.status, color: 'bg-secondary text-foreground' };
  return (
    <Card>
      <CardBody>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary shrink-0" />
              <span className="font-semibold text-foreground">{pool.from}</span>
              <ChevronRight className="w-3 h-3 text-muted-foreground" />
              <span className="text-foreground">{pool.to}</span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span><Clock className="inline w-3.5 h-3.5 mr-1" />{new Date(pool.departureTime).toLocaleDateString()}</span>
              <span><Users className="inline w-3.5 h-3.5 mr-1" />{pool.totalSeats} seats</span>
              <span>{formatInr(pool.farePerPerson)}/seat</span>
            </div>
          </div>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${cfg.color}`}>
            {cfg.label}
          </span>
        </div>
      </CardBody>
    </Card>
  );
}

// ── Main Carpool Page ──────────────────────────────────────────────────────────

export function Carpool() {
  const [activeTab, setActiveTab] = useState('join');
  const [pools, setPools] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [poolsLoaded, setPoolsLoaded] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const [joiningPoolId, setJoiningPoolId] = useState(null);
  const [leavingPool, setLeavingPool] = useState(false);

  // Active pool state — null means no active pool
  const [activePool, setActivePool] = useState(null);
  
  // Dynamically evaluated on every render: ensuring map shows ONLY to true creator
  const currentUserId = getUserId();
  const isActiveCreator = Boolean(activePool && currentUserId && activePool.creatorId === currentUserId);

  // Create form state
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [departureDate, setDepartureDate] = useState('');
  const [departureTime, setDepartureTime] = useState('');
  const [totalSeats, setTotalSeats] = useState('');
  const [farePerPerson, setFarePerPerson] = useState('');
  const [creating, setCreating] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestHint, setSuggestHint] = useState('');
  const [memberInfo, setMemberInfo] = useState(null);

  // Stable ref to current poolId for the polling loop
  const activePoolIdRef = useRef(null);
  activePoolIdRef.current = activePool?._id || null;

  // IDs explicitly deleted by user — polling loop must never restore these
  const deletedPoolIds = useRef(new Set());

  // ── Dismiss/clear helper
  const clearActivePool = useCallback(() => {
    setActivePool(null);
    activePoolIdRef.current = null;
  }, []);

  const pollingTimeoutRef = useRef(null);

  // ── Unified polling loop
  useEffect(() => {
    let stopped = false;

    const loadAll = async () => {
      try {
        // 1. Fetch available open pools when on join tab
        if (activeTab === 'join' || activeTab === 'history') {
          const data = await carpoolAPI.listPools();
          if (!stopped) {
            setPools(data.pools || []);
            setPoolsLoaded(true);
            if (!memberInfo) {
              setMemberInfo({
                velocityMember: Boolean(data.velocityMember),
                memberDiscountPercent: data.memberDiscountPercent || 0,
                memberPlanName: data.memberPlanName || null,
              });
            }
          }
        }

        // 2. Refresh active pool — use ref so we always have the latest ID
        const poolId = activePoolIdRef.current;
        if (poolId && !deletedPoolIds.current.has(poolId)) {
          try {
            const res = await carpoolAPI.getPool(poolId);
            if (!stopped && res.pool) {
              // Double check against deleted just in case it changed mid-flight
              if (deletedPoolIds.current.has(poolId)) return;
              
              if (['completed', 'cancelled'].includes(res.pool.status)) {
                setActivePool(null);
                activePoolIdRef.current = null;
              } else {
                setActivePool(res.pool);
              }
            }
          } catch {
            // 404 or network error — pool is gone
            if (!stopped) {
              setActivePool(null);
              activePoolIdRef.current = null;
            }
          }
        } else if (!poolId) {
          // No known pool — check if user has one on the server
          const res = await carpoolAPI.getMyActivePool();
          if (!stopped && res.pool) {
            const id = res.pool._id?.toString();
            if (id && deletedPoolIds.current.has(id)) return;
            setActivePool(res.pool);
          }
        }

        // 3. Load history when on history tab
        if (activeTab === 'history') {
          const hRes = await carpoolAPI.getMyCarpoolHistory();
          if (!stopped) setHistory(hRes.history || []);
        }
      } catch {
        // Ignore polling errors silently
      }
    };

    const runPoll = async () => {
      setLoading(true);
      await loadAll();
      if (!stopped) setLoading(false);
      
      const poll = async () => {
        if (stopped) return;
        await loadAll();
        if (!stopped) pollingTimeoutRef.current = setTimeout(poll, 3000);
      };
      
      pollingTimeoutRef.current = setTimeout(poll, 3000);
    };
    
    // Reset deleted IDs when switching tabs naturally ? No, keep deleted pools deleted forever.
    runPoll();

    return () => {
      stopped = true;
      if (pollingTimeoutRef.current) clearTimeout(pollingTimeoutRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleJoinPool = async (poolId) => {
    if (joiningPoolId === poolId || busy) return;
    setError(''); setSuccess('');
    setJoiningPoolId(poolId);
    setBusy(true);
    try {
      const data = await carpoolAPI.joinPool(poolId);
      if (data.pool) {
        setActivePool(data.pool);
      }
      const mp = data.memberPricing;
      if (mp?.velocityMember && mp.memberDiscountAmount > 0) {
        setSuccess(`Joined! Member price ${formatInr(mp.fare)} (saved ${formatInr(mp.memberDiscountAmount)}). Check notifications.`);
      } else {
        setSuccess('Successfully joined the carpool! Check notifications for details.');
      }
      const listData = await carpoolAPI.listPools();
      setPools(listData.pools || []);
    } catch (err) {
      setError(err.message || 'Failed to join pool');
    } finally {
      setBusy(false);
      setJoiningPoolId(null);
    }
  };

  const handleLeavePool = async () => {
    if (!activePool || leavingPool) return;
    setError(''); setSuccess('');
    setLeavingPool(true);
    setBusy(true);
    try {
      await carpoolAPI.leavePool(activePool._id);
      setSuccess('You have left the pool.');
      clearActivePool();
      const listData = await carpoolAPI.listPools();
      setPools(listData.pools || []);
    } catch (err) {
      setError(err.message || 'Failed to leave pool');
    } finally {
      setBusy(false);
      setLeavingPool(false);
    }
  };

  const handleCreatePool = async () => {
    if (!from || !to || !departureDate || !departureTime || !totalSeats || !farePerPerson) {
      setError('Please fill in all fields.');
      return;
    }
    setError('');
    setCreating(true);
    try {
      const departure = new Date(`${departureDate}T${departureTime}:00`);
      if (Number.isNaN(departure.getTime())) {
        setError('Please choose a valid departure date and time.');
        return;
      }
      if (departure.getTime() <= Date.now()) {
        setError('Departure time must be in the future.');
        return;
      }
      const departureISO = departure.toISOString();
      const data = await carpoolAPI.createPool(from, to, departureISO, Number(totalSeats), Number(farePerPerson) / 100);
      // Immediately show the new pool — fresh state
      if (data.pool) {
        setActivePool(data.pool);
      }
      setSuccess('Carpool created! Fill seats and then tap "Start Pool".');
      setFrom(''); setTo(''); setDepartureDate(''); setDepartureTime('');
      setTotalSeats(''); setFarePerPerson(''); setSuggestHint('');
      setActiveTab('join'); // switch to join view to see pool status
    } catch (err) {
      setError(err.message || 'Failed to create pool');
    } finally {
      setCreating(false);
    }
  };

  const handleStartPool = async () => {
    if (!activePool?._id) return;
    // Snapshot the ID immediately — pool state may update mid-flight via polling
    const poolId = activePool._id;
    setBusy(true);
    setError('');
    try {
      await carpoolAPI.requestCarpoolDriver(poolId);
      setSuccess('Driver requested! Waiting for a driver to accept your pool.');
      const res = await carpoolAPI.getPool(poolId);
      if (res.pool) setActivePool(res.pool);
    } catch (err) {
      setError(err.message || 'Failed to request driver');
    } finally {
      setBusy(false);
    }
  };

  const handleDeletePool = async () => {
    if (!activePool?._id) return;
    // Snapshot poolId immediately — never rely on state that may have been updated
    // by the background polling loop between the button click and the API call.
    const poolId = activePool._id;
    setBusy(true);
    setError('');
    try {
      if (pollingTimeoutRef.current) clearTimeout(pollingTimeoutRef.current);
      // Mark this ID as deleted BEFORE the API call so no in-flight poll can restore it
      deletedPoolIds.current.add(poolId);
      // Eagerly clear from UI without waiting for the API round-trip
      clearActivePool();
      await carpoolAPI.deletePool(poolId);
      setSuccess('Pool deleted successfully. All participants have been notified.');
      const listData = await carpoolAPI.listPools();
      setPools(listData.pools || []);
      
      // Restart polling safely
      const poll = async () => {
        try {
          const d = await carpoolAPI.listPools();
          setPools(d.pools || []);
        } catch { /* ignore */ }
        pollingTimeoutRef.current = setTimeout(poll, 3000);
      };
      pollingTimeoutRef.current = setTimeout(poll, 3000);
    } catch (err) {
      // On failure, remove from deleted set and restore pool so user can retry
      deletedPoolIds.current.delete(poolId);
      setError(err.message || 'Failed to delete pool');
    } finally {
      setBusy(false);
    }
  };

  const handleSuggestFare = async () => {
    if (!from || !to || !totalSeats) {
      setError('Enter from, to, and seats to suggest a fare.');
      return;
    }
    setError('');
    setSuggestLoading(true);
    try {
      const data = await carpoolAPI.routeEstimate(from, to, Number(totalSeats));
      setFarePerPerson(String(Math.round(Number(data.suggestedFarePerPerson) * 100)));
      if (data.velocityMember && data.memberPreviewFarePerPerson != null) {
        setSuggestHint(
          `As a member you pay ${formatInr(data.memberPreviewFarePerPerson)}/seat when joining (${data.memberDiscountPercent}% off the listed price).`
        );
      } else {
        setSuggestHint('');
      }
    } catch (err) {
      setError(err.message || 'Could not get fare estimate');
    } finally {
      setSuggestLoading(false);
    }
  };

  // ── Derived ──────────────────────────────────────────────────────────────────

  const hasActiveCreatorPool = isActiveCreator && activePool && !['completed', 'cancelled'].includes(activePool.status);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <PageContainer title="Carpool" subtitle="Share rides and save money">

      {/* Velocity member banner */}
      {memberInfo?.velocityMember && (
        <div className="mb-4 flex gap-2 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-900">
          <Sparkles className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
          <p>
            Velocity member{memberInfo.memberPlanName ? ` (${memberInfo.memberPlanName} plan)` : ''}:{' '}
            <strong>{memberInfo.memberDiscountPercent}%</strong> off listed seat price when you join.
          </p>
        </div>
      )}

      {/* Active Pool Panel */}
      {activePool && (
        <ActivePoolCard
          pool={activePool}
          isCreator={isActiveCreator}
          onStartPool={handleStartPool}
          onDeletePool={handleDeletePool}
          onLeavePool={handleLeavePool}
          busy={busy}
          leavingPool={leavingPool}
        />
      )}

      {/* Tabs */}
      <div className="mb-6">
        <div className="inline-flex rounded-xl border border-border bg-white p-1 shadow-sm">
          {[
            { key: 'join',    label: 'Join Pool' },
            { key: 'create',  label: 'Create Pool' },
            { key: 'history', label: <><History className="inline w-3.5 h-3.5 mr-1" />History</> },
          ].map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => { setActiveTab(key); setError(''); setSuccess(''); }}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeTab === key
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'text-foreground hover:bg-secondary'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Error / success */}
      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 bg-destructive/10 text-destructive rounded-lg text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-3 mb-4 bg-primary/10 text-primary rounded-lg text-sm">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />{success}
        </div>
      )}

      {/* ── JOIN TAB ─────────────────────────────────────────────────────────── */}
      {activeTab === 'join' && (
        <div className="space-y-4">
          <div className="flex justify-end mb-2">
            <Button variant="outline" size="sm" onClick={async () => {
              setLoading(true);
              try { const d = await carpoolAPI.listPools(); setPools(d.pools || []); } catch { /* ignore */ }
              setLoading(false);
            }} disabled={loading || busy}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />Refresh
            </Button>
          </div>

          {!poolsLoaded ? (
            <Card><CardBody className="flex items-center justify-center py-12 gap-3 text-muted-foreground">
              <Loader className="w-6 h-6 animate-spin" /> Loading available pools…
            </CardBody></Card>
          ) : pools.filter(p => p.status === 'open').length === 0 ? (
            <Card><CardBody className="text-center py-12">
              <p className="text-muted-foreground">No open carpool pools available right now.</p>
              <p className="text-sm text-muted-foreground mt-1">Be the first — create one!</p>
            </CardBody></Card>
          ) : (
            pools.filter(p => p.status === 'open').map((pool) => {
              const alreadyInThisPool = activePool?._id === pool._id;
              return (
                <Card key={pool._id} hover>
                  <CardBody>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-grow space-y-3">
                        <div className="flex items-start gap-3">
                          <MapPin className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-semibold text-foreground">{pool.from}</p>
                            <p className="text-sm text-muted-foreground">→ {pool.to}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            <span>{new Date(pool.departureTime).toLocaleString()}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            <span>{pool.seatsAvailable} of {pool.totalSeats} seats available</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 md:flex-col md:items-end">
                        <div className="text-right">
                          {pool.velocityMember && pool.discountedFarePerPerson != null ? (
                            <>
                              <div className="text-sm text-muted-foreground line-through">{formatInr(pool.farePerPerson)}</div>
                              <div className="text-2xl font-bold text-foreground">{formatInr(pool.discountedFarePerPerson)}</div>
                              <div className="text-xs font-medium text-emerald-700">Member ({pool.memberDiscountPercent}% off)</div>
                              <div className="text-sm text-muted-foreground">per seat</div>
                            </>
                          ) : (
                            <>
                              <div className="text-2xl font-bold text-foreground">{formatInr(pool.farePerPerson)}</div>
                              <div className="text-sm text-muted-foreground">per seat</div>
                            </>
                          )}
                        </div>
                        {alreadyInThisPool ? (
                          <span className="text-sm text-primary font-semibold px-3 py-1 bg-primary/10 rounded-full">Joined ✓</span>
                        ) : (
                          <Button
                            onClick={() => handleJoinPool(pool._id)}
                            disabled={busy || Boolean(activePool) || pool.seatsAvailable === 0 || joiningPoolId === pool._id}
                            size="sm"
                          >
                            {joiningPoolId === pool._id ? <><Loader className="w-4 h-4 mr-2 animate-spin" />Joining…</> : 'Join Pool'}
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardBody>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* ── CREATE TAB ───────────────────────────────────────────────────────── */}
      {activeTab === 'create' && (
        <Card>
          <CardHeader>
            <h3 className="text-xl">Create a Carpool</h3>
          </CardHeader>
          <CardBody>
            {/* Block create if user already has an active pool as creator */}
            {hasActiveCreatorPool ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <AlertCircle className="w-10 h-10 text-amber-500" />
                <p className="font-semibold text-foreground">You already have an active pool.</p>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Complete or delete your current pool before creating a new one.
                </p>
                <Button variant="outline" size="sm" onClick={() => setActiveTab('join')}>
                  View Active Pool
                </Button>
              </div>
            ) : (
              <form
                className="space-y-4"
                onSubmit={(e) => { e.preventDefault(); handleCreatePool(); }}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input placeholder="From location" value={from} onChange={e => setFrom(e.target.value)} />
                  <Input placeholder="To location" value={to} onChange={e => setTo(e.target.value)} />
                </div>
                <div className="flex justify-end">
                  <Button type="button" variant="outline" size="sm"
                    onClick={() => { setFrom(to); setTo(from); }}
                    disabled={!from && !to}
                  >
                    Swap From ↔ To
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input
                    type="date"
                    value={departureDate}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={e => setDepartureDate(e.target.value)}
                    onClick={e => e.currentTarget.showPicker?.()}
                    className="w-full px-4 py-3 bg-input-background border border-input rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <input
                    type="time"
                    value={departureTime}
                    onChange={e => setDepartureTime(e.target.value)}
                    onClick={e => e.currentTarget.showPicker?.()}
                    className="w-full px-4 py-3 bg-input-background border border-input rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <Input
                    type="number"
                    placeholder="Available seats (1-6)"
                    min="1" max="6"
                    value={totalSeats}
                    onChange={e => setTotalSeats(e.target.value)}
                  />
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-2">
                    <div className="flex-1">
                      <Input
                        type="number"
                        placeholder="Fare per person (Rs)"
                        min="1"
                        value={farePerPerson}
                        onChange={e => setFarePerPerson(e.target.value)}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={handleSuggestFare}
                      disabled={suggestLoading || !from || !to || !totalSeats}
                    >
                      {suggestLoading
                        ? <><Loader className="w-4 h-4 mr-2 animate-spin" />Calculating…</>
                        : 'Suggest fare'}
                    </Button>
                  </div>
                  {suggestHint && (
                    <p className="text-sm text-emerald-800 bg-emerald-500/10 border border-emerald-500/25 rounded-lg px-3 py-2 col-span-full">
                      {suggestHint}
                    </p>
                  )}
                </div>

                {/* Map preview — only for creator on the create form */}
                {(from || to) && (
                  <div className="mb-2">
                    <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">Route Preview</p>
                    <MapSelector pickup={from} dropoff={to} height="250px" />
                  </div>
                )}

                <Button type="submit" fullWidth disabled={creating}>
                  {creating ? <><Loader className="w-4 h-4 mr-2 animate-spin" />Creating…</> : 'Create Carpool'}
                </Button>
              </form>
            )}
          </CardBody>
        </Card>
      )}

      {/* ── HISTORY TAB ──────────────────────────────────────────────────────── */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {history.length === 0 ? (
            <Card><CardBody className="text-center py-12">
              <History className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No past carpools yet.</p>
              <p className="text-sm text-muted-foreground mt-1">Your completed and cancelled pools will appear here.</p>
            </CardBody></Card>
          ) : (
            history.map(pool => <HistoryCard key={pool._id} pool={pool} />)
          )}
        </div>
      )}
    </PageContainer>
  );
}
