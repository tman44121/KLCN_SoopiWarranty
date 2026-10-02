export const legacyRoutes: Record<string, string> = {
  '/login.html': '/login',
  '/index.html': '/dispatch',
  '/pages/receptionist.html': '/receptionist',
  '/pages/technician.html': '/technician',
  '/pages/warehouse.html': '/warehouse',
  '/pages/cashier.html': '/cashier',
  '/pages/tickets.html': '/tickets',
  '/pages/reports.html': '/reports',
  '/pages/admin.html': '/admin',
  '/pages/customer-portal.html': '/portal',
  '/Account/Register': '/register',
  '/Account/Profile': '/account',
};

export function internalRoute(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value, location.origin + '/');
    if (url.origin !== location.origin) return null;
    const route = legacyRoutes[url.pathname] || url.pathname;
    if (!Object.values(legacyRoutes).includes(route)) return null;
    return route + url.search + url.hash;
  } catch {
    return null;
  }
}
