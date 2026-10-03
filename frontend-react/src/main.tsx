import { lazy, Suspense } from 'react';
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

function LegacyRedirect({ to }: { to: string }) {
  const { search, hash } = useLocation();
  return <Navigate to={to + search + hash} replace />;
}

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <Suspense fallback={null}>
      <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
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
      <Route path="*" element={<main><p role="alert">Không tìm thấy trang.</p><Link to="/login" reloadDocument>Đăng nhập</Link></main>} />
    </Routes>
    </Suspense>
  </BrowserRouter>,
);
