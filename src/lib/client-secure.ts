// Client-side utilities for secure API calls
// Comprehensive security with fingerprinting, session tracking, and CSRF protection

// Types
interface SecurityPayload {
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

interface BrowserFingerprint {
  userAgent: string;
  language: string;
  languages: string;
  platform: string;
  screenResolution: string;
  colorDepth: number;
  timezone: string;
  timezoneOffset: number;
  viewportSize: string;
  deviceMemory?: number;
  hardwareConcurrency?: number;
  touchSupport: boolean;
  cookieEnabled: boolean;
  doNotTrack: string;
  webglVendor?: string;
  webglRenderer?: string;
}

// Get or create a persistent device ID (stored in localStorage)
function getDeviceId(): string {
  if (typeof window === 'undefined') return '';

  const STORAGE_KEY = 'purompto_device_id';
  let deviceId = localStorage.getItem(STORAGE_KEY);

  if (!deviceId) {
    deviceId = `dev_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    localStorage.setItem(STORAGE_KEY, deviceId);
  }

  return deviceId;
}

// Get or create session ID (stored in sessionStorage)
function getSessionId(): string {
  if (typeof window === 'undefined') return '';

  const STORAGE_KEY = 'purompto_session_id';
  let sessionId = sessionStorage.getItem(STORAGE_KEY);

  if (!sessionId) {
    sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    sessionStorage.setItem(STORAGE_KEY, sessionId);
  }

  return sessionId;
}

// Generate browser fingerprint
function getBrowserFingerprint(): BrowserFingerprint {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      userAgent: '',
      language: '',
      languages: '',
      platform: '',
      screenResolution: '',
      colorDepth: 0,
      timezone: '',
      timezoneOffset: 0,
      viewportSize: '',
      touchSupport: false,
      cookieEnabled: false,
      doNotTrack: '',
    };
  }

  // Get WebGL info for additional fingerprinting
  let webglVendor = '';
  let webglRenderer = '';
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl) {
      const debugInfo = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        webglVendor = (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_VENDOR_WEBGL || 0);
        webglRenderer = (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL || 0);
      }
    }
  } catch {
    // WebGL not supported
  }

  return {
    userAgent: navigator.userAgent,
    language: navigator.language,
    languages: navigator.languages?.join(',') || '',
    platform: navigator.platform,
    screenResolution: `${screen.width}x${screen.height}`,
    colorDepth: screen.colorDepth,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timezoneOffset: new Date().getTimezoneOffset(),
    viewportSize: `${window.innerWidth}x${window.innerHeight}`,
    deviceMemory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
    hardwareConcurrency: navigator.hardwareConcurrency,
    touchSupport: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
    cookieEnabled: navigator.cookieEnabled,
    doNotTrack: navigator.doNotTrack || '',
    webglVendor,
    webglRenderer,
  };
}

// Simple hash function for fingerprinting
async function hashFingerprint(data: string): Promise<string> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    // Fallback for non-HTTPS
    return btoa(data).substring(0, 32);
  }

  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32);
}

// Generate fingerprint hash
async function generateFingerprintHash(): Promise<string> {
  const fp = getBrowserFingerprint();
  const fpString = JSON.stringify(fp);
  return hashFingerprint(fpString);
}

// Generate CSRF token
function generateCSRFToken(): string {
  const random = Math.random().toString(36).substring(2, 15);
  const timestamp = Date.now().toString(36);
  return `csrf_${timestamp}_${random}`;
}

// Get RSC token from URL or generate one
function getRSCToken(): string {
  if (typeof window === 'undefined') return '';

  const urlParams = new URLSearchParams(window.location.search);
  const rscParam = urlParams.get('_rsc');

  if (rscParam) {
    return rscParam;
  }

  // Generate a new one if not present
  return `rsc_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
}

// Generate a unique request ID
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

// Generate a nonce for replay attack prevention
export function generateNonce(): string {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
}

// Generate comprehensive security payload for API calls
export async function generateSecurityPayload(userId: string): Promise<SecurityPayload> {
  const timestamp = Date.now();
  const nonce = generateNonce();
  const requestId = generateRequestId();
  const deviceId = getDeviceId();
  const sessionId = getSessionId();
  const csrfToken = generateCSRFToken();
  const rscToken = getRSCToken();
  const fingerprintHash = await generateFingerprintHash();
  const fingerprint = getBrowserFingerprint();

  // Security headers
  const headers: Record<string, string> = {
    'X-User-Id': userId,
    'X-Timestamp': timestamp.toString(),
    'X-Nonce': nonce,
    'X-Request-Id': requestId,
    'X-Device-Id': deviceId,
    'X-Session-Id': sessionId,
    'X-CSRF-Token': csrfToken,
    'X-RSC-Token': rscToken,
    'X-Fingerprint-Hash': fingerprintHash,
    'X-Security-Version': '2.0',
    'X-Client-Timezone': fingerprint.timezone,
    'X-Client-Language': fingerprint.language,
  };

  // Security body payload (additional verification data)
  const body: Record<string, unknown> = {
    _security: {
      deviceId,
      sessionId,
      requestId,
      timestamp,
      nonce,
      csrfToken,
      rscToken,
      fingerprintHash,
      clientInfo: {
        timezone: fingerprint.timezone,
        timezoneOffset: fingerprint.timezoneOffset,
        language: fingerprint.language,
        screenResolution: fingerprint.screenResolution,
        viewportSize: fingerprint.viewportSize,
        platform: fingerprint.platform,
        touchSupport: fingerprint.touchSupport,
        hardwareConcurrency: fingerprint.hardwareConcurrency,
      },
    },
  };

  return { headers, body };
}

// Legacy function for backward compatibility
export function generateSecurityHeaders(userId: string): Record<string, string> {
  const timestamp = Date.now();
  const nonce = generateNonce();
  const requestId = generateRequestId();
  const deviceId = getDeviceId();
  const sessionId = getSessionId();

  return {
    'X-User-Id': userId,
    'X-Timestamp': timestamp.toString(),
    'X-Nonce': nonce,
    'X-Request-Id': requestId,
    'X-Device-Id': deviceId,
    'X-Session-Id': sessionId,
  };
}

// Export utilities for external use
export { getDeviceId, getSessionId, getBrowserFingerprint, generateFingerprintHash };
