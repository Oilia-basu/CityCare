// Loads Razorpay Checkout and runs the order -> checkout -> server-side verification flow.
import api from '../api/axios';

let loading;
const loadScript = () => {
  if (window.Razorpay) return Promise.resolve(true);
  if (!loading) {
    loading = new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = 'https://checkout.razorpay.com/v1/checkout.js';
      s.onload = () => resolve(true);
      s.onerror = () => { loading = null; resolve(false); };
      document.body.appendChild(s);
    });
  }
  return loading;
};

/** Resolves with the verified appointment, rejects with Error('dismissed') if the user closed checkout. */
export async function payForAppointment(appointmentId, hospitalName = 'Hospital') {
  if (!(await loadScript())) throw new Error('Could not load the payment window. Check your internet connection.');
  const { data } = await api.post('/payments/create-order', { appointmentId });
  const order = data.data;
  return new Promise((resolve, reject) => {
    const rz = new window.Razorpay({
      key: order.keyId || import.meta.env.VITE_RAZORPAY_KEY_ID,
      amount: order.amount,
      currency: order.currency,
      order_id: order.orderId,
      name: hospitalName,
      description: 'Consultation fee',
      prefill: order.prefill,
      theme: { color: '#0e6ba8' },
      handler: async (response) => {
        try {
          // Never trust the browser: the backend verifies the signature before confirming anything.
          const res = await api.post('/payments/verify', response);
          resolve(res.data.data.appointment);
        } catch (e) { reject(e); }
      },
      modal: { ondismiss: () => reject(new Error('dismissed')) },
    });
    rz.on('payment.failed', (r) => reject(new Error(r.error?.description || 'Payment failed')));
    rz.open();
  });
}
