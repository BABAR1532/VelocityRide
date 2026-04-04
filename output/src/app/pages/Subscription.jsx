import { useState, useEffect } from 'react';
import { PageContainer } from '../components/layout/PageContainer';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Check, Loader, AlertCircle, CheckCircle, Crown, CreditCard, Lock, Sparkles } from 'lucide-react';
import { subscriptionAPI } from '../services/api';
import { formatInr } from '../utils/currency';

export function Subscription() {
  const [plans, setPlans] = useState([]);
  const [mySubscription, setMySubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(null); // planId being subscribed
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Payment Modal state
  const [showPayment, setShowPayment] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState('idle'); // idle, processing, success

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [plansData, mySubData] = await Promise.all([
        subscriptionAPI.getPlans(),
        subscriptionAPI.getMySubscription(),
      ]);
      setPlans(plansData.plans || []);
      setMySubscription(mySubData.subscription);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSubscribe = async (planId, planName) => {
    setError('');
    setSuccess('');
    setSubscribing(planId);
    try {
      await subscriptionAPI.subscribe(planId);
      setSuccess(`Successfully subscribed to ${planName} plan!`);
      await fetchData(); // Refresh to show new subscription
    } catch (err) {
      setError(err.message);
    } finally {
      setSubscribing(null);
    }
  };

  const initiateSubscription = (planId, planName, planPrice) => {
    setSelectedPlan({ id: planId, name: planName, price: planPrice });
    setShowPayment(true);
    setPaymentStatus('idle');
  };

  const handlePay = async () => {
    setPaymentStatus('processing');
    try {
      // Simulate minimum payment processor delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      setPaymentStatus('success');
      
      // Keep success state for 1s, then actually subscribe
      setTimeout(async () => {
        await handleSubscribe(selectedPlan.id, selectedPlan.name);
        setShowPayment(false);
      }, 1000);
    } catch (err) {
      setPaymentStatus('idle');
      setError('Payment processing failed. Try again.');
      setShowPayment(false);
    }
  };

  const handleCancel = async () => {
    setError('');
    setSuccess('');
    try {
      await subscriptionAPI.cancel();
      setSuccess('Subscription cancelled. Benefits continue until end of billing period.');
      setMySubscription(null);
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <PageContainer title="Subscription Plans" subtitle="Loading…">
        <div className="flex items-center justify-center py-20 gap-3 text-muted-foreground">
          <Loader className="w-6 h-6 animate-spin" />Loading plans…
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer title="Subscription Plans" subtitle="Choose a plan that works best for you">
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

      <div className="flex items-start gap-3 p-4 mb-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-sm text-foreground">
        <Sparkles className="w-5 h-5 text-emerald-700 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-emerald-900 dark:text-emerald-100">Member savings on every trip</p>
          <p className="text-muted-foreground mt-1">
            Active Velocity subscribers save on car rides, bike rides, parcel delivery, and carpool seats by plan:{' '}
            <span className="font-medium text-foreground">Normal 10%</span>,{' '}
            <span className="font-medium text-foreground">Standard 20%</span>,{' '}
            <span className="font-medium text-foreground">Premium 30%</span>. Estimates and checkout show your member price when you are logged in.
          </p>
        </div>
      </div>

      {mySubscription && (
        <Card className="mb-6 border-primary/30 bg-primary/5">
          <CardBody>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <Crown className="w-6 h-6 text-primary" />
                <div>
                  <p className="font-semibold text-foreground">Active Plan: {mySubscription.planName}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatInr(mySubscription.price)}/month · Renews {new Date(mySubscription.endDate).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handleCancel}>Cancel Subscription</Button>
            </div>
          </CardBody>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const isActive = mySubscription?.planId === plan.id;
          return (
            <Card
              key={plan.id}
              className={plan.popular ? 'border-2 border-primary shadow-lg transform hover:scale-105 transition-transform duration-300' : ''}
            >
              {plan.popular && (
                <div className="bg-gradient-to-r from-primary to-[#05AA5A] text-primary-foreground text-center py-2 rounded-t-2xl">
                  Most Popular
                </div>
              )}
              <CardHeader className={plan.popular ? 'pt-4' : ''}>
                <h3 className="text-xl text-foreground">{plan.name}</h3>
                <div className="mt-4">
                  <span className="text-4xl font-bold text-foreground">{formatInr(plan.price)}</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
              </CardHeader>
              <CardBody className="space-y-6">
                <ul className="space-y-3">
                  {(plan.benefits || plan.features || []).map((feature, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
                {isActive ? (
                  <Button variant="outline" fullWidth disabled>
                    <CheckCircle className="w-4 h-4 mr-2" /> Current Plan
                  </Button>
                ) : (
                  <Button
                    onClick={() => initiateSubscription(plan.id, plan.name, plan.price)}
                    variant={plan.popular ? 'primary' : 'outline'}
                    fullWidth
                    disabled={subscribing === plan.id}
                  >
                    {subscribing === plan.id
                      ? <><Loader className="w-4 h-4 mr-2 animate-spin" />Activating…</>
                      : `Subscribe to ${plan.name}`}
                  </Button>
                )}
              </CardBody>
            </Card>
          );
        })}
      </div>

      <Card className="mt-8">
        <CardBody>
          <div className="text-center max-w-2xl mx-auto">
            <h3 className="text-xl text-foreground mb-4">Frequently Asked Questions</h3>
            <div className="space-y-4 text-left">
              <div>
                <h4 className="text-foreground mb-2">Can I cancel anytime?</h4>
                <p className="text-muted-foreground">Yes, all plans can be cancelled at any time. Your benefits will continue until the end of your billing period.</p>
              </div>
              <div>
                <h4 className="text-foreground mb-2">How do discounts work?</h4>
                <p className="text-muted-foreground">Your plan discount (10% / 20% / 30%) is applied automatically on rides, parcels, and carpools when your subscription is active. Estimates and booking screens show the reduced fare and how much you save.</p>
              </div>
              <div>
                <h4 className="text-foreground mb-2">Can I upgrade my plan?</h4>
                <p className="text-muted-foreground">Absolutely! You can upgrade at any time and we'll prorate the difference.</p>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Payment Gateway Simulator Overlay */}
      {showPayment && selectedPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="bg-card w-full max-w-md p-6 rounded-2xl shadow-2xl border border-border m-4 animate-in fade-in zoom-in duration-200">
            <h3 className="text-2xl font-bold flex items-center gap-2 mb-2">
              <CreditCard className="w-6 h-6 text-primary" /> Secure Checkout
            </h3>
            <p className="text-muted-foreground mb-6">Complete your subscription for the {selectedPlan.name} plan.</p>
            
            <div className="space-y-4 mb-6">
              <div className="flex justify-between items-center py-3 border-b border-border">
                <span className="font-medium text-foreground">Total Amount</span>
                <span className="text-3xl font-black text-primary">{formatInr(selectedPlan.price)}</span>
              </div>
              
              <div className="bg-secondary/30 p-4 rounded-xl space-y-3">
                 <div className="text-sm font-semibold flex items-center gap-2 text-foreground">
                   <Lock className="w-4 h-4 text-muted-foreground" /> Payment Details (Simulated)
                 </div>
                 <Input placeholder="Card Number" value="4242 4242 4242 4242" readOnly />
                 <div className="flex gap-2">
                   <Input placeholder="MM/YY" value="12/26" readOnly />
                   <Input placeholder="CVC" value="123" readOnly />
                 </div>
              </div>
            </div>

            {paymentStatus === 'idle' && (
              <div className="flex gap-3">
                <Button variant="outline" fullWidth onClick={() => setShowPayment(false)}>Cancel</Button>
                <Button fullWidth onClick={handlePay}>Pay Now</Button>
              </div>
            )}
            
            {paymentStatus === 'processing' && (
              <Button fullWidth disabled>
                <Loader className="w-5 h-5 mr-2 animate-spin" /> Processing Payment...
              </Button>
            )}
            
            {paymentStatus === 'success' && (
              <Button fullWidth className="bg-green-500 hover:bg-green-600 text-white border-green-500" disabled>
                <CheckCircle className="w-5 h-5 mr-2" /> Payment Successful!
              </Button>
            )}
          </div>
        </div>
      )}
    </PageContainer>
  );
}
