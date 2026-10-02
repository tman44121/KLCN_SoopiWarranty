import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Login from './pages/login';
import Dispatch from './pages/dispatch';
import Receptionist from './pages/receptionist';
import Technician from './pages/technician';
import Warehouse from './pages/warehouse';
import Cashier from './pages/cashier';
import Tickets from './pages/tickets';
import Reports from './pages/reports';
import Admin from './pages/admin';
import Portal from './pages/portal';
import Register from './pages/register';
import Account from './pages/account';
import { legacyRoutes } from './navigation';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/brand.css';
import './styles/customer.css';

function LegacyRedirect({ to }: { to: string }) {
  const { search, hash } = useLocation();
  return <Navigate to={to + search + hash} replace />;
}

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
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
      <Route path="/account" element={<Account />} />
      {Object.entries(legacyRoutes).map(([from, to]) =>
        <Route key={from} path={from} element={<LegacyRedirect to={to} />} />)}
      <Route path="*" element={<main><p role="alert">Không tìm thấy trang.</p><Link to="/login" reloadDocument>Đăng nhập</Link></main>} />
    </Routes>
  </BrowserRouter>,
);
