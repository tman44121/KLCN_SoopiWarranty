import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter/foundation.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'router/app_router.dart';
import 'theme/app_theme.dart';
import 'viewmodels/auth_viewmodel.dart';
import 'viewmodels/request_viewmodel.dart';
import 'viewmodels/ticket_viewmodel.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  GoogleFonts.config.allowRuntimeFetching = false;
  LicenseRegistry.addLicense(() async* {
    for (final font in const {
      'Inter': 'inter-LICENSE.txt',
      'Plus Jakarta Sans': 'plus-jakarta-sans-LICENSE.txt',
      'JetBrains Mono': 'jetbrains-mono-LICENSE.txt',
    }.entries) {
      yield LicenseEntryWithLineBreaks([
        font.key,
      ], await rootBundle.loadString('assets/fonts/${font.value}'));
    }
  });

  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
      statusBarBrightness: Brightness.light,
    ),
  );

  runApp(const WarrantSafeApp());
}

class WarrantSafeApp extends StatefulWidget {
  const WarrantSafeApp({super.key});

  @override
  State<WarrantSafeApp> createState() => _WarrantSafeAppState();
}

class _WarrantSafeAppState extends State<WarrantSafeApp> {
  // Create ViewModel + Router once at the top level.
  // AppRouter needs the ViewModel as its refreshListenable, so both must be
  // created before build() — StatefulWidget initState is the right place.
  late final AuthViewModel _authViewModel;
  late final RequestViewModel _requestViewModel;
  late final TicketViewModel _ticketViewModel;
  late final AppRouter _appRouter;

  @override
  void initState() {
    super.initState();
    _authViewModel = AuthViewModel();
    _requestViewModel = RequestViewModel(_authViewModel);
    _ticketViewModel = TicketViewModel(_authViewModel);
    _appRouter = AppRouter(_authViewModel);
    // Kick off the auto-login check. GoRouter will react via
    // refreshListenable and redirect to /login or /profile once done.
    _authViewModel.initialize();
  }

  @override
  void dispose() {
    _requestViewModel.dispose();
    _ticketViewModel.dispose();
    _authViewModel.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        // Expose the ViewModel to every screen via context.read / context.watch.
        ChangeNotifierProvider<AuthViewModel>.value(value: _authViewModel),
        ChangeNotifierProvider<RequestViewModel>.value(
          value: _requestViewModel,
        ),
        ChangeNotifierProvider<TicketViewModel>.value(value: _ticketViewModel),
      ],
      child: MaterialApp.router(
        title: 'Soopi',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.lightTheme,
        routerConfig: _appRouter.router,
      ),
    );
  }
}
