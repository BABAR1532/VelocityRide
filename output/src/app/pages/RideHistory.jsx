import { useState, useEffect } from 'react';
import { PageContainer } from '../components/layout/PageContainer';
import { Card, CardBody } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Download, Search, Loader, AlertCircle, RefreshCw } from 'lucide-react';
import { rideAPI, carpoolAPI } from '../services/api';
import { usdToInr, formatInr } from '../utils/currency';

function rideStatusLabel(status) {
  const s = String(status || '');
  const map = {
    pending: 'Finding driver',
    accepted: 'Driver assigned',
    in_progress: 'En route',
    completed: 'Completed',
    cancelled: 'Cancelled',
  };
  return map[s] || s.charAt(0).toUpperCase() + s.slice(1);
}

export function RideHistory() {
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');

  const fetchRides = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    setError('');
    try {
      const [rideData, carpoolData] = await Promise.all([
        rideAPI.getRideHistory().catch(() => ({ rides: [] })),
        carpoolAPI.getMyCarpoolHistory().catch(() => ({ history: [] }))
      ]);
      
      const mappedCarpools = (carpoolData.history || []).map(p => ({
        ...p,
        type: 'carpool',
        fare: p.farePerPerson,
        createdAt: p.createdAt || p.departureTime
      }));
      
      const combined = [...(rideData.rides || []), ...mappedCarpools]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
      setRides(combined);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    fetchRides(true); 
    const t = setInterval(() => fetchRides(false), 3000);
    return () => clearInterval(t);
  }, []);

  const filteredRides = rides.filter((ride) => {
    const matchesSearch =
      ride.from?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ride.to?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ride.type?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterType === 'all' || ride.type?.toLowerCase() === filterType;
    return matchesSearch && matchesFilter;
  });

  const completedRides = rides.filter(r => r.status === 'completed');
  const totalSpent = completedRides.reduce((sum, r) => sum + usdToInr(r.fare || 0), 0);

  return (
    <PageContainer title="Ride History" subtitle="View your past rides">
      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardBody>
            <p className="text-sm text-muted-foreground mb-1">Total Rides</p>
            <p className="text-2xl font-bold text-foreground">{rides.length}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-sm text-muted-foreground mb-1">Completed</p>
            <p className="text-2xl font-bold text-primary">{completedRides.length}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-sm text-muted-foreground mb-1">Total Spent</p>
            <p className="text-2xl font-bold text-foreground">Rs {totalSpent.toFixed(2)}</p>
          </CardBody>
        </Card>
      </div>

      <Card className="mb-6">
        <CardBody>
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="flex-grow relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by location or ride type..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-input-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-4 py-3 bg-input-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">All Types</option>
              <option value="car">Car Rides</option>
              <option value="bike">Bike Rides</option>
              <option value="carpool">Carpool</option>
            </select>
            <Button variant="outline" onClick={() => fetchRides(true)} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardBody>
      </Card>

      {loading ? (
        <Card>
          <CardBody className="flex items-center justify-center py-12 gap-3 text-muted-foreground">
            <Loader className="w-6 h-6 animate-spin" /> Loading ride history…
          </CardBody>
        </Card>
      ) : error ? (
        <Card>
          <CardBody className="flex items-center gap-2 py-8 text-destructive">
            <AlertCircle className="w-5 h-5" />{error}
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredRides.map((ride) => (
            <Card key={ride._id}>
              <CardBody>
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex-grow grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Date</p>
                      <p className="font-medium text-foreground">
                        {new Date(ride.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Type</p>
                      <p className="font-medium text-foreground capitalize">{ride.type}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Route</p>
                      <p className="font-medium text-foreground">{ride.from} → {ride.to}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Status</p>
                      <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                        ride.status === 'completed' ? 'bg-primary/10 text-primary' :
                        ride.status === 'cancelled' ? 'bg-destructive/10 text-destructive' :
                        'bg-yellow-500/10 text-yellow-500'
                      }`}>
                        {rideStatusLabel(ride.status)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 lg:flex-col lg:items-end">
                    <div className="text-right">
                      <p className="text-2xl font-bold text-foreground">{formatInr(ride.fare)}</p>
                      {ride.driverName && <p className="text-sm text-muted-foreground">{ride.driverName}</p>}
                    </div>
                    {ride.status === 'completed' && (
                      <Button variant="outline" size="sm">
                        <Download className="w-4 h-4 mr-2" /> Receipt
                      </Button>
                    )}
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}

          {filteredRides.length === 0 && (
            <Card>
              <CardBody className="text-center py-12">
                <p className="text-muted-foreground">
                  {rides.length === 0 ? "You haven't taken any rides yet." : "No rides match your search."}
                </p>
              </CardBody>
            </Card>
          )}
        </div>
      )}
    </PageContainer>
  );
}
