// Initial defaults only; the admin form loads the persisted settings from its protected endpoint.
export const DEFAULT_PROTECTION_SETTINGS = {
  loginMaxFailedAttempts: 5, loginLockMinutes: 15,
  otpValidityMinutes: 5, otpResendSeconds: 60, otpMaxFailedAttempts: 5,
  accessTokenMinutes: 15, refreshTokenHours: 12, rememberTokenDays: 30, portalTokenMinutes: 30,
  loginIp: { limit: 10, windowMinutes: 1 }, loginAccount: { limit: 5, windowMinutes: 1 },
  otpIp: { limit: 20, windowMinutes: 60 }, otpEmail: { limit: 5, windowMinutes: 60 },
  warrantyCheckIp: { limit: 10, windowMinutes: 1 }, lookupIp: { limit: 5, windowMinutes: 1 }, lookupCode: { limit: 10, windowMinutes: 60 },
  publicRequestsIp: { limit: 3, windowMinutes: 60 }, customerRequests: { limit: 5, windowMinutes: 60 },
};
