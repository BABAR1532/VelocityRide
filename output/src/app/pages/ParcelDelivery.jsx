import { useEffect, useMemo, useState } from 'react';
import { PageContainer } from '../components/layout/PageContainer';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Package, Clock, DollarSign, CheckCircle, AlertCircle, Loader, RefreshCw } from 'lucide-react';
import { parcelAPI } from '../services/api';
import { formatInr } from '../utils/currency';
import { MapSelector } from '../components/ui/MapSelector';
import { MemberDiscountCallout } from '../components/MemberDiscountCallout';

export function ParcelDelivery() {
  const [activeTab, setActiveTab] = useState('book'); // 'book' | 'my-parcels'

  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [weight, setWeight] = useState('');
  const [packageType, setPackageType] = useState('');
  const [estimate, setEstimate] = useState(null);
  const [bookedParcel, setBookedParcel] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [parcels, setParcels] = useState([]);
  const [parcelsLoading, setParcelsLoading] = useState(false);
  const [parcelsError, setParcelsError] = useState('');
  const [selectedParcelId, setSelectedParcelId] = useState(null);
  const [statusUpdating, setStatusUpdating] = useState(false);

  const selectedParcel = useMemo(
    () => parcels.find(p => p._id === selectedParcelId) || null,
    [parcels, selectedParcelId],
  );

  const fetchParcels = async (showLoader = true) => {
    if (showLoader) setParcelsLoading(true);
    setParcelsError('');
    try {
      const data = await parcelAPI.listParcels();
      const list = data.parcels || [];
      setParcels(list);
      if (selectedParcelId && !list.some(p => p._id === selectedParcelId)) {
        setSelectedParcelId(null);
      }
    } catch (err) {
      setParcelsError(err.message);
    } finally {
      setParcelsLoading(false);
    }
  };

  useEffect(() => {
    let t;
    if (activeTab === 'my-parcels') {
      fetchParcels(true);
      t = setInterval(() => fetchParcels(false), 3000);
    }
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const handleEstimate = async () => {
    if (!pickup || !dropoff || !weight) {
      setError('Enter pickup address, drop-off address, and weight.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const data = await parcelAPI.getEstimate(pickup, dropoff, Number(weight));
      setEstimate(data);
      setBookedParcel(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBookDelivery = async () => {
    if (!estimate || !pickup || !dropoff || !packageType) {
      setError('Please fill in all required fields.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const data = await parcelAPI.book(pickup, dropoff, Number(weight), packageType);
      setBookedParcel(data.parcel);
      setEstimate(null);
      // If user is on My Parcels tab, refresh to show the newly created parcel.
      if (activeTab === 'my-parcels') fetchParcels(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelParcel = async () => {
    if (!selectedParcel) return;
    if (!window.confirm('Cancel this parcel delivery?')) return;
    setParcelsError('');
    setStatusUpdating(true);
    try {
      await parcelAPI.updateStatus(selectedParcel._id, 'cancelled');
      await fetchParcels(true);
    } catch (err) {
      setParcelsError(err.message);
    } finally {
      setStatusUpdating(false);
    }
  };

  return (
    <PageContainer title="Parcel Delivery" subtitle="Send packages quickly and securely">
      <div className="mb-6">
        <div className="inline-flex rounded-xl border border-border bg-white p-1 shadow-sm">
          <button
            onClick={() => { setActiveTab('book'); setError(''); setParcelsError(''); }}
            className={`px-6 py-2 rounded-lg transition-all duration-200 ${activeTab === 'book' ? 'bg-primary text-primary-foreground shadow-md' : 'text-foreground hover:bg-secondary'}`}
          >
            Book Delivery
          </button>
          <button
            onClick={() => { setActiveTab('my-parcels'); setError(''); setParcelsError(''); }}
            className={`px-6 py-2 rounded-lg transition-all duration-200 ${activeTab === 'my-parcels' ? 'bg-primary text-primary-foreground shadow-md' : 'text-foreground hover:bg-secondary'}`}
          >
            My Parcels
          </button>
        </div>
      </div>

      {activeTab === 'book' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <h3 className="text-xl">Delivery Details</h3>
              </CardHeader>
              <CardBody className="space-y-4">
                <Input
                  label="Pickup Address"
                  placeholder="Enter pickup address"
                  value={pickup}
                  onChange={(e) => setPickup(e.target.value)}
                  fullWidth
                />
                <Input
                  label="Drop-off Address"
                  placeholder="Enter drop-off address"
                  value={dropoff}
                  onChange={(e) => setDropoff(e.target.value)}
                  fullWidth
                />
                <Input
                  label="Package Weight (kg)"
                  type="number"
                  placeholder="Enter weight in kg"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  fullWidth
                />
                <div>
                  <label className="block mb-2 text-sm text-foreground">Package Type</label>
                  <select
                    value={packageType}
                    onChange={(e) => setPackageType(e.target.value)}
                    className="w-full px-4 py-3 bg-input-background border border-input rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Select package type</option>
                    <option value="documents">Documents</option>
                    <option value="electronics">Electronics</option>
                    <option value="food">Food Items</option>
                    <option value="clothing">Clothing</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                {error && (
                  <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
                  </div>
                )}

                <Button
                  onClick={handleEstimate}
                  disabled={!pickup || !dropoff || !weight || loading}
                  fullWidth
                  variant="secondary"
                >
                  {loading && !estimate ? <><Loader className="w-4 h-4 mr-2 animate-spin" />Calculating…</> : 'Calculate Delivery Cost'}
                </Button>
              </CardBody>
            </Card>

            {estimate && (
              <Card className="border-primary/20">
                <CardHeader>
                  <h3 className="text-xl">Delivery Estimate</h3>
                </CardHeader>
                <CardBody className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <DollarSign className="w-5 h-5 text-primary" />
                      <span className="text-muted-foreground">Delivery Cost</span>
                    </div>
                    <span className="text-2xl font-bold text-foreground">{formatInr(estimate.fare)}</span>
                  </div>
                  <MemberDiscountCallout
                    velocityMember={estimate.velocityMember}
                    memberDiscountPercent={estimate.memberDiscountPercent}
                    memberPlanName={estimate.memberPlanName}
                    originalFare={estimate.originalFare}
                    fare={estimate.fare}
                  />
                  {estimate.distance && (
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <Package className="w-4 h-4" />
                      <span>Route distance: {estimate.distance}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span>Estimated delivery time: {estimate.estimatedTime}</span>
                  </div>
                  <Button onClick={handleBookDelivery} fullWidth disabled={loading}>
                    {loading ? <><Loader className="w-4 h-4 mr-2 animate-spin" />Booking…</> : 'Book Delivery'}
                  </Button>
                </CardBody>
              </Card>
            )}

            {bookedParcel && (
              <Card className="border-primary/30 bg-primary/5">
                <CardBody className="space-y-3">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-6 h-6 text-primary" />
                    <h3 className="text-lg font-semibold text-foreground">Delivery Scheduled!</h3>
                  </div>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p><span className="font-medium text-foreground">Tracking Code:</span> {bookedParcel.trackingCode}</p>
                    <p><span className="font-medium text-foreground">From:</span> {bookedParcel.pickupAddress}</p>
                    <p><span className="font-medium text-foreground">To:</span> {bookedParcel.dropoffAddress}</p>
                    <p><span className="font-medium text-foreground">Cost:</span> {formatInr(bookedParcel.fare)}</p>
                    <p><span className="font-medium text-foreground">Status:</span> {bookedParcel.status}</p>
                  </div>
                  <Button variant="outline" fullWidth onClick={() => { setBookedParcel(null); setPickup(''); setDropoff(''); setWeight(''); setPackageType(''); }}>
                    Send Another Package
                  </Button>
                </CardBody>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <h3 className="text-xl">Map Preview</h3>
              </CardHeader>
              <CardBody>
                <MapSelector pickup={pickup} dropoff={dropoff} />
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <h3 className="text-xl">Delivery Guidelines</h3>
              </CardHeader>
              <CardBody className="space-y-4">
                <div className="flex items-start gap-3">
                  <Package className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="text-foreground mb-1">Package safely</h4>
                    <p className="text-sm text-muted-foreground">Ensure your items are securely packed to prevent damage during transit.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Package className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="text-foreground mb-1">Label clearly</h4>
                    <p className="text-sm text-muted-foreground">Write recipient's contact information clearly on the package.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Package className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="text-foreground mb-1">Track your delivery</h4>
                    <p className="text-sm text-muted-foreground">You can update and view parcel status from the “My Parcels” tab.</p>
                  </div>
                </div>
                <div className="bg-gradient-to-r from-destructive/10 to-destructive/5 p-4 rounded-xl border border-destructive/20">
                  <h4 className="text-foreground mb-2">Prohibited Items</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Hazardous materials</li>
                    <li>• Illegal substances</li>
                    <li>• Perishable food items without proper packaging</li>
                    <li>• Weapons and explosives</li>
                  </ul>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-xl">My Parcels</h3>
                <Button variant="outline" size="sm" onClick={() => fetchParcels(true)} disabled={parcelsLoading}>
                  <RefreshCw className={`w-4 h-4 mr-2 ${parcelsLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardBody className="space-y-3">
              {parcelsError && (
                <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />{parcelsError}
                </div>
              )}

              {parcelsLoading ? (
                <div className="flex items-center justify-center py-10 gap-3 text-muted-foreground">
                  <Loader className="w-6 h-6 animate-spin" /> Loading parcels…
                </div>
              ) : parcels.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-muted-foreground">No parcels yet.</p>
                  <p className="text-sm text-muted-foreground mt-1">Use “Book Delivery” to create one.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {parcels.map((p) => (
                    <button
                      key={p._id}
                      type="button"
                      onClick={() => setSelectedParcelId(p._id)}
                      className={`w-full text-left p-4 rounded-xl border transition-all ${
                        selectedParcelId === p._id ? 'border-primary bg-primary/5' : 'border-border hover:bg-secondary'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="font-semibold text-foreground truncate">
                            {p.trackingCode || p._id}
                          </div>
                          <div className="text-sm text-muted-foreground truncate">
                            {p.pickupAddress} → {p.dropoffAddress}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-sm font-semibold text-foreground">{formatInr(p.fare)}</div>
                          <div className="text-xs text-muted-foreground capitalize">{(p.status || 'scheduled').replaceAll('_', ' ')}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-xl">Parcel Status</h3>
            </CardHeader>
            <CardBody className="space-y-4">
              {!selectedParcel ? (
                <div className="text-center py-10 text-muted-foreground">
                  Select a parcel from the list to view and update its status.
                </div>
              ) : (
                <>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p><span className="font-medium text-foreground">Tracking Code:</span> {selectedParcel.trackingCode}</p>
                    <p><span className="font-medium text-foreground">From:</span> {selectedParcel.pickupAddress}</p>
                    <p><span className="font-medium text-foreground">To:</span> {selectedParcel.dropoffAddress}</p>
                    <p><span className="font-medium text-foreground">Status:</span> {(selectedParcel.status || 'scheduled').replaceAll('_', ' ')}</p>
                    {selectedParcel.driverName ? (
                      <p><span className="font-medium text-foreground">Courier:</span> {selectedParcel.driverName}</p>
                    ) : (
                      <p className="text-xs">A driver will appear here once someone claims your parcel.</p>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Progress (picked up → delivered) is updated by your assigned driver. Pull to refresh with the button on the list.
                  </p>

                  {selectedParcel.status !== 'delivered' && selectedParcel.status !== 'cancelled' && (
                    <Button
                      variant="outline"
                      fullWidth
                      className="border-destructive/50 text-destructive hover:bg-destructive/10"
                      onClick={handleCancelParcel}
                      disabled={statusUpdating}
                    >
                      {statusUpdating ? <><Loader className="w-4 h-4 mr-2 animate-spin" />Cancelling…</> : 'Cancel parcel'}
                    </Button>
                  )}
                </>
              )}
            </CardBody>
          </Card>
        </div>
      )}
    </PageContainer>
  );
}
