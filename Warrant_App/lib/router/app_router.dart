import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../models/user_model.dart';
import '../viewmodels/auth_viewmodel.dart';
import '../views/auth/login_screen.dart';
import '../views/auth/real_register_screen.dart';
import '../views/auth/real_forgot_password_screen.dart';
import '../views/splash/splash_screen.dart';
import '../views/shell/main_shell.dart';
import '../views/home/home_screen.dart';
import '../views/profile/profile_screen.dart';
import '../views/profile/account_settings_screens.dart';
import '../views/devices/device_list_screen.dart';
import '../views/devices/device_detail_screen.dart';
import '../views/devices/real_lookup_screen.dart';
import '../views/requests/real_create_request_screen.dart';
import '../views/requests/request_list_screen.dart';
import '../views/requests/real_request_detail_screen.dart';
import '../views/requests/real_ticket_detail_screen.dart';
import '../views/notifications/notification_screen.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Route path constants
// ─────────────────────────────────────────────────────────────────────────────

class AppRoutes {
  AppRoutes._();

  static const String splash = '/';
  static const String login = '/login';
  static const String register = '/register';
  static const String forgotPassword = '/forgot-password';

  static const String home = '/home';

  static const String devices = '/devices';
  static const String lookup = '/devices/lookup';

  static const String requests = '/requests';
  static const String createRequest = '/requests/create';
  static String realTicket(String code) =>
      '$requests/tickets/${Uri.encodeComponent(code)}';

  static const String notifications = '/notifications';
  static const String profile = '/profile';
  static const String editProfile = '/profile/edit';
  static const String changePassword = '/profile/password';
}

// ─────────────────────────────────────────────────────────────────────────────
// AppRouter
// ─────────────────────────────────────────────────────────────────────────────

class AppRouter {
  AppRouter(AuthViewModel authViewModel)
    : router = GoRouter(
        initialLocation: AppRoutes.splash,
        debugLogDiagnostics: false,
        refreshListenable: authViewModel,
        redirect: (BuildContext context, GoRouterState state) =>
            _redirect(authViewModel, state),
        routes: _routes,
      );
  final GoRouter router;

  // ── Redirect logic ───────────────────────────────────────────────────────

  static String? _redirect(AuthViewModel vm, GoRouterState state) {
    final location = state.matchedLocation;
    final isInitializing = vm.isInitializing;
    final isAuth = vm.isAuthenticated;

    // ① Still initializing → hold on splash.
    if (isInitializing) {
      return location == AppRoutes.splash ? null : AppRoutes.splash;
    }

    final isOnAuthScreen =
        location == AppRoutes.login ||
        location == AppRoutes.register ||
        location == AppRoutes.forgotPassword;

    // ② Not authenticated and trying to access protected route → login.
    if (!isAuth && !isOnAuthScreen) return AppRoutes.login;

    // ③ Authenticated but on auth/splash screen → home.
    if (isAuth && (isOnAuthScreen || location == AppRoutes.splash)) {
      return AppRoutes.home;
    }

    // ④ No redirect needed.
    return null;
  }

  // ── Route definitions ────────────────────────────────────────────────────

  static final List<RouteBase> _routes = [
    GoRoute(
      path: AppRoutes.splash,
      builder: (context, state) => const SplashScreen(),
    ),
    GoRoute(
      path: AppRoutes.login,
      builder: (context, state) => const LoginScreen(),
    ),
    GoRoute(
      path: AppRoutes.register,
      builder: (context, state) => const RealRegisterScreen(),
    ),
    GoRoute(
      path: AppRoutes.forgotPassword,
      builder: (context, state) => const RealForgotPasswordScreen(),
    ),

    // Stateful navigation shell for authenticated tabs
    StatefulShellRoute.indexedStack(
      builder: (context, state, navigationShell) =>
          MainShell(navigationShell: navigationShell),
      branches: [
        // Tab 0: Trang chủ
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: AppRoutes.home,
              builder: (context, state) => const HomeScreen(),
            ),
          ],
        ),
        // Tab 1: Thiết bị
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: AppRoutes.devices,
              builder: (context, state) => const DeviceListScreen(),
              routes: [
                GoRoute(
                  path: 'lookup',
                  builder: (context, state) => const RealLookupScreen(),
                ),
                GoRoute(
                  path: 'detail',
                  builder: (context, state) {
                    final deviceObj = state.extra;
                    return DeviceDetailScreen(deviceObj: deviceObj);
                  },
                ),
              ],
            ),
          ],
        ),
        // Tab 2: Yêu cầu
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: AppRoutes.requests,
              builder: (context, state) => const RequestListScreen(),
              routes: [
                GoRoute(
                  path: 'create',
                  builder: (context, state) {
                    final device = state.extra;
                    return RealCreateRequestScreen(
                      prefilledDevice: device is OwnedDevice ? device : null,
                    );
                  },
                ),
                GoRoute(
                  path: 'tickets/:code',
                  builder: (context, state) => RealTicketDetailScreen(
                    code: state.pathParameters['code']!,
                  ),
                ),
                GoRoute(
                  path: ':id',
                  builder: (context, state) => RealRequestDetailScreen(
                    code: state.pathParameters['id']!,
                  ),
                ),
              ],
            ),
          ],
        ),
        // Tab 3: Thông báo
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: AppRoutes.notifications,
              builder: (context, state) => const NotificationScreen(),
            ),
          ],
        ),
        // Tab 4: Hồ sơ
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: AppRoutes.profile,
              builder: (context, state) => const ProfileScreen(),
              routes: [
                GoRoute(
                  path: 'edit',
                  builder: (context, state) => const EditProfileScreen(),
                ),
                GoRoute(
                  path: 'password',
                  builder: (context, state) => const ChangePasswordScreen(),
                ),
              ],
            ),
          ],
        ),
      ],
    ),
  ];
}
