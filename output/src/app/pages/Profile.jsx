import { useState, useEffect } from 'react';
import { PageContainer } from '../components/layout/PageContainer';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { User, Mail, Phone, MapPin, Edit2, Loader, AlertCircle, CheckCircle } from 'lucide-react';
import { userAPI, authAPI, subscriptionAPI, driverAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

export function Profile() {
  const { user: authUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [profile, setProfile] = useState(null);
  const [editedProfile, setEditedProfile] = useState({});
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [driverProfile, setDriverProfile] = useState(null);

  const fetchProfile = async () => {
    setLoading(true);
    setError('');
    try {
      const isDriver = authUser?.role === 'driver';
      const [profileData, locData, subData, dProfileRes] = await Promise.all([
        userAPI.getProfile(),
        userAPI.getLocations(),
        subscriptionAPI.getMySubscription().catch(() => ({ subscription: null })),
        isDriver ? driverAPI.getProfile().catch(() => null) : Promise.resolve(null),
      ]);
      const u = profileData.user;
      setProfile(u);
      setEditedProfile({ name: u.name || '', phone: u.phone || '', address: u.address || '' });
      setLocations(locData.locations || []);
      setIsSubscribed(subData.subscription && subData.subscription.status === 'active');
      if (isDriver && dProfileRes) setDriverProfile(dProfileRes);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProfile(); }, []);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const data = await userAPI.updateProfile(editedProfile);
      setProfile(data.user);
      setIsEditing(false);
      setSuccess('Profile updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <PageContainer title="Profile" subtitle="Loading…">
        <div className="flex items-center justify-center py-20 gap-3 text-muted-foreground">
          <Loader className="w-6 h-6 animate-spin" /> Loading profile…
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Profile"
      subtitle="Manage your account information"
      action={
        !isEditing ? (
          <Button onClick={() => setIsEditing(true)}>
            <Edit2 className="w-4 h-4 mr-2" />
            Edit Profile
          </Button>
        ) : null
      }
    >
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <h3 className="text-[22px] font-semibold">Personal Information</h3>
                {isSubscribed && profile && (
                  <span className="px-3 py-1 bg-primary/20 text-primary rounded-full text-xs font-bold uppercase tracking-wider">
                    Velocity Member
                  </span>
                )}
              </div>
            </CardHeader>
            <CardBody className="space-y-4">
              {isEditing ? (
                <>
                  <Input
                    label="Full Name"
                    value={editedProfile.name}
                    onChange={(e) => setEditedProfile({ ...editedProfile, name: e.target.value })}
                    fullWidth
                  />
                  <Input
                    label="Email"
                    type="email"
                    value={profile?.email || ''}
                    disabled
                    fullWidth
                  />
                  <Input
                    label="Phone"
                    type="tel"
                    value={editedProfile.phone}
                    onChange={(e) => setEditedProfile({ ...editedProfile, phone: e.target.value })}
                    fullWidth
                  />
                  <Input
                    label="Address"
                    value={editedProfile.address}
                    onChange={(e) => setEditedProfile({ ...editedProfile, address: e.target.value })}
                    fullWidth
                  />
                  <div className="flex gap-3">
                    <Button onClick={handleSave} fullWidth disabled={saving}>
                      {saving ? <><Loader className="w-4 h-4 mr-2 animate-spin" />Saving…</> : 'Save Changes'}
                    </Button>
                    <Button onClick={() => { setIsEditing(false); setError(''); }} variant="outline" fullWidth>
                      Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  {[
                    { Icon: User,   label: 'Name',    value: profile?.name || '—' },
                    { Icon: Mail,   label: 'Email',   value: profile?.email || '—' },
                    { Icon: Phone,  label: 'Phone',   value: profile?.phone || 'Not set' },
                    { Icon: MapPin, label: 'Address', value: profile?.address || 'Not set' },
                  ].map(({ Icon, label, value }) => (
                    <div key={label} className="flex items-center gap-4 p-4 bg-secondary rounded-lg">
                      <Icon className="w-5 h-5 text-primary" />
                      <div>
                        <p className="text-sm text-muted-foreground">{label}</p>
                        <p className="font-medium text-foreground">{value}</p>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-[22px] font-semibold">Saved Locations</h3>
            </CardHeader>
            <CardBody className="space-y-3">
              {locations.length === 0 ? (
                <p className="text-muted-foreground text-sm">No saved locations yet.</p>
              ) : (
                locations.map((loc) => (
                  <div key={loc._id} className="flex items-center justify-between p-4 bg-secondary rounded-lg">
                    <div className="flex items-center gap-4">
                      <MapPin className="w-5 h-5 text-primary" />
                      <div>
                        <p className="font-medium text-foreground">{loc.label}</p>
                        <p className="text-sm text-muted-foreground">{loc.address}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
              <Button variant="outline" fullWidth>Add New Location</Button>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <h3 className="text-[22px] font-semibold">Account Stats</h3>
            </CardHeader>
            <CardBody className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Member Since</p>
                <p className="text-lg font-semibold text-foreground">
                  {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '—'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Role</p>
                <p className="text-lg font-semibold text-foreground capitalize">{profile?.role || 'user'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Account Status</p>
                <p className="text-lg font-semibold text-primary">Active ✓</p>
              </div>
              {authUser?.role === 'driver' && driverProfile && (
                <div className="pt-4 border-t border-border mt-4">
                  <p className="text-sm text-muted-foreground mb-2">Driver Settings</p>
                  <div className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                    <div>
                      <p className="font-medium">Vehicle Type</p>
                      <p className="text-sm text-muted-foreground capitalize">{driverProfile.vehicleType || 'car'}</p>
                    </div>
                    <Button 
                      size="sm" 
                      onClick={async () => {
                        try {
                          const newType = driverProfile.vehicleType === 'car' ? 'bike' : 'car';
                          const res = await driverAPI.updateProfile({ vehicleType: newType });
                          setDriverProfile(res.profile);
                          setSuccess(`Vehicle changed to ${newType}`);
                          setTimeout(() => setSuccess(''), 3000);
                        } catch (e) {
                          setError(e.message);
                        }
                      }}
                    >
                      Switch to {driverProfile.vehicleType === 'car' ? 'Bike' : 'Car'}
                    </Button>
                  </div>
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-[22px] font-semibold">Quick Actions</h3>
            </CardHeader>
            <CardBody className="space-y-3">
              {isChangingPassword ? (
                <div className="space-y-3 mb-4 p-4 border border-border rounded-lg bg-secondary/50">
                  <h4 className="text-sm font-semibold">Update Password</h4>
                  <Input type="password" placeholder="Current Password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} fullWidth />
                  <Input type="password" placeholder="New Password" value={newPassword} onChange={e => setNewPassword(e.target.value)} fullWidth />
                  <div className="flex gap-2 pt-2">
                    <Button fullWidth onClick={async () => {
                      if (!currentPassword || !newPassword) return setError('Please fill all password fields');
                      if (newPassword.length < 6) return setError('New password must be at least 6 characters');
                      try {
                        setSaving(true);
                        setError('');
                        await authAPI.changePassword(currentPassword, newPassword);
                        setSuccess('Password changed successfully');
                        setIsChangingPassword(false);
                        setCurrentPassword(''); setNewPassword('');
                      } catch(e) { setError(e.message); }
                      finally { setSaving(false); }
                    }} disabled={saving}>
                      {saving ? 'Updating...' : 'Confirm'}
                    </Button>
                    <Button variant="outline" fullWidth onClick={() => {
                        setIsChangingPassword(false);
                        setCurrentPassword(''); setNewPassword('');
                    }}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <Button variant="outline" fullWidth onClick={() => setIsChangingPassword(true)}>Change Password</Button>
              )}
              <Button variant="outline" fullWidth>Payment Methods</Button>
              <Button variant="outline" fullWidth>Privacy Settings</Button>
            </CardBody>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
