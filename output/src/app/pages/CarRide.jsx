import { useState, useEffect } from 'react';
import { PageContainer } from '../components/layout/PageContainer';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { MapPin, Clock, DollarSign, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { rideAPI } from '../services/api';
import { addLocalNotification } from '../services/localNotifications';
import { formatInr } from '../utils/currency';
import { MapSelector } from '../components/ui/MapSelector';
import { MemberDiscountCallout } from '../components/MemberDiscountCallout';

export function CarRide() {
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [estimate, setEstimate] = useState(null);
  const [bookedRide, setBookedRide] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!bookedRide || ['completed', 'cancelled'].includes(bookedRide.status)) return;
    const interval = setInterval(async () => {
      try {
        const { ride } = await rideAPI.getRide(bookedRide._id);
        if (ride && ride.status !== bookedRide.status) {
          setBookedRide(ride);
        }
      } catch (e) {
        // ignore polling errors
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [bookedRide]);

  const handleEstimate = async () => {
    if (!pickup || !dropoff) return;
    setError('');
    setLoading(true);
    try {
      const data = await rideAPI.getEstimate(pickup, dropoff, 'car');
      setEstimate(data);
      setBookedRide(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBookRide = async () => {
    if (!estimate) return;
    setError('');
    setLoading(true);
    try {
      const data = await rideAPI.bookRide(pickup, dropoff, 'car');
      setBookedRide(data.ride);
      setEstimate(null);
      const paid = data.ride?.fare ?? estimate.fare;
      addLocalNotification({
        type: 'ride',
        title: 'Ride Confirmed!',
        message: `Your car ride from ${pickup} to ${dropoff} is booked. Fare: ${formatInr(paid)}.`,
        meta: { rideId: data.ride?._id, rideType: 'car' },
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer
      title="Book a Car Ride"
      subtitle="Enter your pickup and drop-off locations"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <h3 className="text-xl">Trip Details</h3>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="mt-3 w-2 h-2 bg-primary rounded-full flex-shrink-0" />
                <Input
                  placeholder="Enter pickup location"
                  value={pickup}
                  onChange={(e) => setPickup(e.target.value)}
                  fullWidth
                />
              </div>

              <div className="flex items-start gap-3">
                <div className="mt-3 w-2 h-2 bg-destructive rounded-full flex-shrink-0" />
                <Input
                  placeholder="Enter drop-off location"
                  value={dropoff}
                  onChange={(e) => setDropoff(e.target.value)}
                  fullWidth
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <Button
                onClick={handleEstimate}
                disabled={!pickup || !dropoff || loading}
                fullWidth
                variant="secondary"
              >
                {loading ? <><Loader className="w-4 h-4 mr-2 animate-spin" />Calculating…</> : 'Get Fare Estimate'}
              </Button>
            </CardBody>
          </Card>

          {estimate && (
            <Card className="border-primary/20">
              <CardHeader>
                <h3 className="text-xl">Fare Estimate</h3>
              </CardHeader>
              <CardBody className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <DollarSign className="w-5 h-5 text-primary" />
                    <span className="text-muted-foreground">Estimated Fare</span>
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

                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  <span>{estimate.duration} · {estimate.distance}</span>
                </div>

                {!estimate.velocityMember && (
                  <div className="bg-muted/40 p-3 rounded-xl text-sm text-muted-foreground border border-border">
                    Car trips are priced at about ₹10/km (bike is about ₹5/km). Member tier discount applies on top when you subscribe.
                  </div>
                )}

                <Button onClick={handleBookRide} fullWidth disabled={loading}>
                  {loading ? <><Loader className="w-4 h-4 mr-2 animate-spin" />Booking…</> : 'Book Car Ride'}
                </Button>
              </CardBody>
            </Card>
          )}

          {bookedRide && (
            <Card className="border-primary/30 bg-primary/5">
              <CardBody className="space-y-3">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-6 h-6 text-primary" />
                  <h3 className="text-lg font-semibold text-foreground">Ride Confirmed!</h3>
                </div>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p><span className="font-medium text-foreground">Driver:</span> {bookedRide.driverName}</p>
                  <p><span className="font-medium text-foreground">Route:</span> {bookedRide.from} → {bookedRide.to}</p>
                  <p><span className="font-medium text-foreground">Fare:</span> {formatInr(bookedRide.fare)}</p>
                  <p><span className="font-medium text-foreground">Status:</span> {bookedRide.status}</p>
                </div>
                <Button variant="outline" fullWidth onClick={() => { setBookedRide(null); setPickup(''); setDropoff(''); }}>
                  Book Another Ride
                </Button>
              </CardBody>
            </Card>
          )}
        </div>

        <Card>
          <CardHeader>
            <h3 className="text-xl">Map Preview</h3>
          </CardHeader>
          <CardBody>
            <MapSelector pickup={pickup} dropoff={dropoff} />
          </CardBody>
        </Card>
      </div>
    </PageContainer>
  );
}
