import { lazy, Suspense, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { legacyRoutes } from './navigation';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/brand.css';
import './styles/responsive.css';
import './styles/customer.css';

// Mỗi trang là một chunk riêng kèm controller của nó; mở /login không tải code kho, quản trị, báo cáo.
const Home = lazy(() => import('./pages/home'));
const Login = lazy(() => import('./pages/login'));
const Dispatch = lazy(() => import('./pages/dispatch'));
const Receptionist = lazy(() => import('./pages/receptionist'));
const Technician = lazy(() => import('./pages/technician'));
const Warehouse = lazy(() => import('./pages/warehouse'));
const Cashier = lazy(() => import('./pages/cashier'));
const Tickets = lazy(() => import('./pages/tickets'));
const Reports = lazy(() => import('./pages/reports'));
const Admin = lazy(() => import('./pages/admin'));
const Portal = lazy(() => import('./pages/portal'));
const Register = lazy(() => import('./pages/register'));
const ForgotPassword = lazy(() => import('./pages/forgot-password'));
const Account = lazy(() => import('./pages/account'));
const ChatBubble = lazy(() => import('./ChatBubble'));

function ChatEntry() {
  const { pathname } = useLocation();
  const [user, setUser] = useState<any>(null);
  const [launcherTarget, setLauncherTarget] = useState<HTMLElement | null>(null);
  const [ticketRequest, setTicketRequest] = useState<{ ticketCode: string } | null>(null);
  const publicPage = ['/', '/portal'].includes(pathname);
  const allowed = ['/account', '/dispatch', '/receptionist', '/technician', '/warehouse', '/cashier', '/tickets', '/reports', '/admin'].includes(pathname);
  useEffect(() => {
    let disposed = false;
    if (allowed) (window as any).LML_AUTH?.ready((value: any) => { if (!disposed) setUser(value); });
    else if (publicPage) {
      const api = (window as any).LML_API;
      const cached = api?.tokens.get() ? api.session.user() : null;
      setUser(cached?.roles?.some((role: any) => role.code === 'CUSTOMER') ? cached : null);
    } else setUser(null);
    return () => { disposed = true; };
  }, [allowed, publicPage, pathname]);
  useEffect(() => { setLauncherTarget(user ? document.querySelector<HTMLElement>('[data-chat-launcher]') : null); }, [user, pathname]);
  useEffect(() => {
    const openTicket = (event: Event) => {
      const ticketCode = (event as CustomEvent).detail?.ticketCode;
      if (typeof ticketCode === 'string' && ticketCode.length > 0 && ticketCode.length <= 30) setTicketRequest({ ticketCode });
    };
    window.addEventListener('soopi:open-ticket-chat', openTicket);
    return () => window.removeEventListener('soopi:open-ticket-chat', openTicket);
  }, []);
  return (allowed || publicPage) && user && !user.mustChangePassword && launcherTarget ? <Suspense fallback={null}><ChatBubble
    customer={user.roles.some((r: any) => r.code === 'CUSTOMER')} launcherTarget={launcherTarget} ticketRequest={ticketRequest} /></Suspense> : null;
}

function LegacyRedirect({ to }: { to: string }) {
  const { search, hash } = useLocation();
  return <Navigate to={to + search + hash} replace />;
}

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <Suspense fallback={null}>
      <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/dispatch" element={<Dispatch />} />
      <Route path="/receptionist" element={<Receptionist />} />
      <Route path="/technician" element={<Technician />} />
      <Route path="/warehouse" element={<Warehouse />} />
      <Route path="/cashier" element={<Cashier />} />
      <Route path="/tickets" element={<Tickets />} />
      <Route path="/reports" element={<Reports />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/portal" element={<Portal />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/account" element={<Account />} />
      {Object.entries(legacyRoutes).map(([from, to]) =>
        <Route key={from} path={from} element={<LegacyRedirect to={to} />} />)}
      <Route path="*" element={<main><p role="alert">Không tìm thấy trang.</p><Link to="/" reloadDocument>Về trang chủ</Link></main>} />
    </Routes>
    <ChatEntry />
    </Suspense>
  </BrowserRouter>,
);
