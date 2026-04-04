import { useEffect, useState } from 'react';
import { PageContainer } from '../components/layout/PageContainer';
import { Card, CardBody } from '../components/ui/Card';
import { driverAPI } from '../services/api';
import { formatInr, usdToInr } from '../utils/currency';
import { Loader } from 'lucide-react';

export function DriverDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const dRes = await driverAPI.getDashboard();
        setStats({
          ridesCompleted: dRes.completedRides || 0,
          parcelsDelivered: dRes.completedParcels || 0,
          totalEarnedUsd: dRes.totalEarned || 0,
        });
      } catch (err) {
        // Fallback silently if API errors
        setStats({ ridesCompleted: 0, parcelsDelivered: 0, totalEarnedUsd: 0 });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <PageContainer title="Dashboard" subtitle="Your earnings summary">
      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader className="w-5 h-5 animate-spin" /> Fetching summary…
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-primary/30">
            <CardBody>
              <p className="text-sm text-muted-foreground mb-1">Total Amount Earned</p>
              <p className="text-3xl font-bold text-foreground">
                {formatInr(usdToInr(stats?.totalEarnedUsd || 0))}
              </p>
              <p className="text-xs text-muted-foreground mt-2">Combined rides and parcels</p>
            </CardBody>
          </Card>
          
          <Card>
            <CardBody>
              <p className="text-sm text-muted-foreground mb-1">Total Rides Completed</p>
              <p className="text-2xl font-bold text-foreground">{stats?.ridesCompleted || 0}</p>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <p className="text-sm text-muted-foreground mb-1">Total Parcels Delivered</p>
              <p className="text-2xl font-bold text-foreground">{stats?.parcelsDelivered || 0}</p>
            </CardBody>
          </Card>
        </div>
      )}
    </PageContainer>
  );
}
