/**
 * Centralized API configuration for EduVerify.
 * Automatically resolves the live backend URL in production when deployed on Render,
 * while allowing local development on localhost or overrides via VITE_API_URL.
 */
export const API_BASE_URL: string = (
  import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname.endsWith('onrender.com')
    ? 'https://eduverify-e5nw.onrender.com'
    : 'http://localhost:5001')
).replace(/\/+$/, '');
