import { useState, useEffect } from 'react';
import { PageContainer } from '../components/layout/PageContainer';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Bell, Moon, Globe, Lock, CreditCard, Shield } from 'lucide-react';

export function Settings() {
  const [settings, setSettings] = useState({
    pushNotifications: true,
    emailNotifications: true,
    smsNotifications: false,
    darkMode: document.documentElement.classList.contains('dark'),
    language: 'en',
    twoFactor: false });

  // Apply or remove the dark class on the root element whenever darkMode changes
  useEffect(() => {
    if (settings.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.darkMode]);

  const handleToggle = (key) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSaveSettings = () => {
    alert('Settings saved successfully!');
  };

  return (
    <PageContainer
      title="Settings"
      subtitle="Manage your preferences and account settings"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Bell className="w-6 h-6 text-primary" />
              <h3 className="text-[22px] font-semibold">Notifications</h3>
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            {[
              { key: 'pushNotifications', label: 'Push Notifications', desc: 'Receive push notifications on your device' },
              { key: 'emailNotifications', label: 'Email Notifications', desc: 'Receive updates via email' },
              { key: 'smsNotifications', label: 'SMS Notifications', desc: 'Receive text messages for ride updates' },
            ].map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">{label}</p>
                  <p className="text-sm text-muted-foreground">{desc}</p>
                </div>
                <Toggle active={settings[key]} onToggle={() => handleToggle(key)} />
              </div>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Globe className="w-6 h-6 text-primary" />
              <h3 className="text-[22px] font-semibold">Preferences</h3>
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Dark Mode</p>
                <p className="text-sm text-muted-foreground">Use dark theme across the app</p>
              </div>
              <Toggle active={settings.darkMode} onToggle={() => handleToggle('darkMode')} />
            </div>

            <div>
              <label className="block mb-2 font-medium text-foreground">Language</label>
              <select
                value={settings.language}
                onChange={(e) => setSettings(prev => ({ ...prev, language: e.target.value }))}
                className="w-full px-4 py-3 bg-input-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
                <option value="zh">Chinese</option>
              </select>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Shield className="w-6 h-6 text-primary" />
              <h3 className="text-[22px] font-semibold">Security</h3>
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Two-Factor Authentication</p>
                <p className="text-sm text-muted-foreground">Add an extra layer of security</p>
              </div>
              <Toggle active={settings.twoFactor} onToggle={() => handleToggle('twoFactor')} />
            </div>

            <Button variant="outline" fullWidth>
              <Lock className="w-4 h-4 mr-2" />
              Change Password
            </Button>

            <Button variant="outline" fullWidth>
              <CreditCard className="w-4 h-4 mr-2" />
              Manage Payment Methods
            </Button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-[22px] font-semibold">Account Actions</h3>
          </CardHeader>
          <CardBody className="space-y-4">
            <Button variant="outline" fullWidth>Download My Data</Button>
            <Button variant="outline" fullWidth>Export Ride History</Button>
            <Button variant="outline" fullWidth className="text-destructive border-destructive hover:bg-destructive/10">
              Delete Account
            </Button>
            <div className="pt-4 border-t border-border">
              <p className="text-sm text-muted-foreground">
                Deleting your account will permanently remove all your data. This action cannot be undone.
              </p>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 flex justify-end">
        <Button onClick={handleSaveSettings}>Save Settings</Button>
      </div>
    </PageContainer>
  );
}

// Extracted reusable Toggle to avoid repeating the same JSX
function Toggle({ active, onToggle }) {
  return (
    <button
      onClick={onToggle}
      role="switch"
      aria-checked={active}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
        active ? 'bg-primary' : 'bg-gray-300'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          active ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}
