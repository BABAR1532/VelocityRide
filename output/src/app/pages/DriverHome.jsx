import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { PageContainer } from '../components/layout/PageContainer';
import { Card, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Car, Package, Loader, ArrowRight } from 'lucide-react';
import { rideAPI, parcelAPI } from '../services/api';
import { usdToInr } from '../utils/currency';

export function DriverHome() {
  const navigate = useNavigate();
  const [rideEarnUsd, setRideEarnUsd] = useState(null);
  const [parcelEarnUsd, setParcelEarnUsd] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [r, p] = await Promise.all([
          rideAPI.getDriverRideEarnings(),
          parcelAPI.getDriverParcelEarnings(),
        ]);
        setRideEarnUsd(r.totalFareUsd ?? 0);
        setParcelEarnUsd(p.totalFareUsd ?? 0);
      } catch {
        setRideEarnUsd(0);
        setParcelEarnUsd(0);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const totalInr = usdToInr(Number(rideEarnUsd || 0) + Number(parcelEarnUsd || 0));

  return (
    <PageContainer
      title="Driver hub"
      subtitle="Track your earnings and open ride or parcel jobs"
    >
      {loading ? (
        <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
          <Loader className="w-6 h-6 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="border-primary/25">
            <CardBody>
              <p className="text-sm text-muted-foreground mb-1">Total earned (rides + parcels)</p>
              <p className="text-3xl font-bold text-foreground">Rs {totalInr.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground mt-2">
                Completed rides: Rs {usdToInr(rideEarnUsd).toFixed(2)} · Delivered parcels: Rs{' '}
                {usdToInr(parcelEarnUsd).toFixed(2)}
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <p className="text-sm text-muted-foreground mb-1">Ride jobs</p>
              <p className="text-lg font-semibold text-foreground">Accept pending requests</p>
              <Button className="mt-4" variant="primary" onClick={() => navigate('/driver/rides')}>
                Open ride board <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <p className="text-sm text-muted-foreground mb-1">Parcel jobs</p>
              <p className="text-lg font-semibold text-foreground">Claim scheduled deliveries</p>
              <Button className="mt-4" variant="outline" onClick={() => navigate('/driver/parcels')}>
                Open parcels <Package className="w-4 h-4 mr-2" />
              </Button>
            </CardBody>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="hover:border-primary/40 transition-colors cursor-pointer" onClick={() => navigate('/driver/rides')}>
          <CardBody className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/10">
              <Car className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Ride board</h3>
              <p className="text-sm text-muted-foreground">Pending trips, your active trips, start & complete</p>
            </div>
          </CardBody>
        </Card>
        <Card className="hover:border-primary/40 transition-colors cursor-pointer" onClick={() => navigate('/driver/parcels')}>
          <CardBody className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/10">
              <Package className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Parcel deliveries</h3>
              <p className="text-sm text-muted-foreground">Available parcels, claim, then update status to delivered</p>
            </div>
          </CardBody>
        </Card>
      </div>
    </PageContainer>
  );
}
