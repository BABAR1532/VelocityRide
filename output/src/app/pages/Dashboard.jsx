import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { PageContainer } from '../components/layout/PageContainer';
import { ServiceCard } from '../components/cards/ServiceCard';
import { Card, CardBody } from '../components/ui/Card';
import { Car, Bike, Users, Package, CreditCard, History, Loader } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { DriverHome } from './DriverHome';
import { rideAPI, parcelAPI } from '../services/api';
import { usdToInr } from '../utils/currency';

export function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rideSpendUsd, setRideSpendUsd] = useState(null);
  const [parcelSpendUsd, setParcelSpendUsd] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    if (user?.role === 'driver') {
      setStatsLoading(false);
      return;
    }
    (async () => {
      try {
        const [r, p] = await Promise.all([rideAPI.getRideHistory(), parcelAPI.listParcels()]);
        const rides = r.rides || [];
        const parcels = p.parcels || [];
        const rideSum = rides.filter((x) => x.status === 'completed').reduce((s, x) => s + Number(x.fare || 0), 0);
        const parcelSum = parcels.filter((x) => x.status === 'delivered').reduce((s, x) => s + Number(x.fare || 0), 0);
        setRideSpendUsd(rideSum);
        setParcelSpendUsd(parcelSum);
      } catch {
        setRideSpendUsd(0);
        setParcelSpendUsd(0);
      } finally {
        setStatsLoading(false);
      }
    })();
  }, [user?.role]);

  const totalSpentInr = useMemo(
    () => usdToInr(Number(rideSpendUsd || 0) + Number(parcelSpendUsd || 0)),
    [rideSpendUsd, parcelSpendUsd],
  );

  if (user?.role === 'driver') {
    return <DriverHome />;
  }

  const services = [
    {
      icon: Car,
      title: 'Car Ride',
      description: 'Book a comfortable car ride to your destination',
      path: '/car-ride' },
    {
      icon: Bike,
      title: 'Bike Ride',
      description: 'Quick and affordable bike rides for short distances',
      path: '/bike-ride' },
    {
      icon: Users,
      title: 'Carpool',
      description: 'Share rides and save money with carpooling',
      path: '/carpool' },
    {
      icon: Package,
      title: 'Parcel Delivery',
      description: 'Send packages quickly and securely',
      path: '/parcel' },
    {
      icon: CreditCard,
      title: 'Subscription Plans',
      description: 'Save more with our exclusive subscription plans',
      path: '/subscription' },
    {
      icon: History,
      title: 'Ride History',
      description: 'View your past rides and download receipts',
      path: '/ride-history' },
  ];

  return (
    <PageContainer
      title="Dashboard"
      subtitle="Choose a service to get started"
    >
      {statsLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground mb-6">
          <Loader className="w-5 h-5 animate-spin" /> Loading your spend summary…
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardBody>
              <p className="text-sm text-muted-foreground mb-1">Total spent (rides + parcels)</p>
              <p className="text-2xl font-bold text-foreground">Rs {totalSpentInr.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Completed rides &amp; delivered parcels only
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <p className="text-sm text-muted-foreground mb-1">Ride spend</p>
              <p className="text-xl font-semibold">Rs {usdToInr(rideSpendUsd).toFixed(2)}</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <p className="text-sm text-muted-foreground mb-1">Parcel spend</p>
              <p className="text-xl font-semibold">Rs {usdToInr(parcelSpendUsd).toFixed(2)}</p>
            </CardBody>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {services.map((service) => (
          <ServiceCard
            key={service.path}
            icon={service.icon}
            title={service.title}
            description={service.description}
            onClick={() => navigate(service.path)}
          />
        ))}
      </div>
    </PageContainer>
  );
}
