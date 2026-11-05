import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Soopi design tokens — đồng bộ với Web Soopi (customer.css / tokens.css)
/// Thẻ bảo hành: Nền kem sữa ấm áp, chữ xanh chim cánh cụt, một màu hành động xanh rừng.
class AppColors {
  AppColors._();

  // ── Bảng màu Soopi ───────────────────────────────────────────────
  static const Color forest = Color(0xFF244C43); // màu hành động duy nhất
  static const Color forestDeep = Color(0xFF1B3C35); // nút khi nhấn / hover
  static const Color mintSoft = Color(
    0xFFDDEFE4,
  ); // trạng thái tốt, mục đang chọn
  static const Color mintBorder = Color(0xFFB9D5C3);
  static const Color mintWash = Color(0xFFF4FAF6);
  static const Color penguinNavy = Color(0xFF29354A); // tiêu đề, số liệu
  static const Color navyBody = Color(0xFF364257); // đoạn văn, nhãn trường
  static const Color slateQuiet = Color(0xFF4A5853); // chữ phụ cần đọc kỹ
  static const Color sageMuted = Color(0xFF62716C); // meta, gợi ý
  static const Color sageFaint = Color(0xFF8A968F); // chỉ cho icon trang trí
  static const Color milkCream = Color(0xFFF8F7F2); // nền trang
  static const Color paperWhite = Color(0xFFFFFFFF);
  static const Color sageBorder = Color(0xFFD9E3DB);
  static const Color controlBorder = Color(0xFF798980);
  static const Color sageDivider = Color(0xFFEAEFE9);
  static const Color honey = Color(0xFFEFB952);
  static const Color mistLilac = Color(0xFFDCD8ED);
  static const Color lilacBorder = Color(0xFFC9C3E2);
  static const Color peach = Color(0xFFF2C5BF);
  static const Color expiredWine = Color(0xFF8B4248);
  static const Color expiredWineDeep = Color(0xFF6F3439);
  static const Color expiredTint = Color(0xFFFBE7E8);
  static const Color honeyText = Color(0xFF795B18);
  static const Color honeyTint = Color(0xFFFFF1CE);
  static const Color honeyBorder = Color(0xFFF3D58A);
  static const Color successBorder = Color(0xFFC3E2CF);

  // ── Tên cũ (WarrantSafe) trỏ sang bảng màu Soopi ─────────────────
  static const Color primaryBlue = forest;
  static const Color primaryDark = forestDeep;
  static const Color primaryLight = mintSoft;

  static const Color white = paperWhite;
  static const Color background = milkCream;
  static const Color cardGrey = milkCream;
  static const Color inputFill = paperWhite;
  static const Color border = sageBorder;
  static const Color divider = sageDivider;

  static const Color textPrimary = penguinNavy;
  static const Color textSecondary = sageMuted;
  static const Color textHint = sageMuted;
  static const Color textLabel = navyBody;

  static const Color success = forest;
  static const Color error = expiredWine;
  static const Color warning = honeyText;
  static const Color logout = expiredWine;
  static const Color google = Color(0xFF4285F4);

  static const Color avatarBg = forest;
}

/// Bo góc hiện đại mềm mại theo tiêu chuẩn Mobile:
/// Control: 12px | Container: 16px | Card: 20px | Pill: 999px.
class AppRadius {
  AppRadius._();

  static const double control = 12.0;
  static const double container = 16.0;
  static const double card = 20.0;
  static const double pill = 999.0;
}

/// Đổ bóng cao cấp mượt mà cho mobile card và button.
class AppShadows {
  AppShadows._();

  static const List<BoxShadow> card = [
    BoxShadow(color: Color(0x0D29354A), blurRadius: 16, offset: Offset(0, 4)),
    BoxShadow(color: Color(0x05000000), blurRadius: 4, offset: Offset(0, 1)),
  ];

  static const List<BoxShadow> smoothCard = [
    BoxShadow(color: Color(0x0A244C43), blurRadius: 20, offset: Offset(0, 6)),
    BoxShadow(color: Color(0x06000000), blurRadius: 6, offset: Offset(0, 2)),
  ];

  static const List<BoxShadow> hero = [
    BoxShadow(color: Color(0x1F29354A), blurRadius: 32, offset: Offset(0, 16)),
  ];

  static const List<BoxShadow> primaryButton = [
    BoxShadow(color: Color(0x38244C43), blurRadius: 14, offset: Offset(0, 4)),
  ];
}

/// Typography hệ thống:
/// - Tiêu đề & Nhãn thương hiệu: Plus Jakarta Sans (nổi bật, hiện đại)
/// - Nội dung & Thân bài: Inter (chuẩn công thái học, đọc rõ ở mọi kích thước)
/// - Mã nghiệp vụ & số liệu: JetBrains Mono (cân cột đều đặn)
class AppText {
  AppText._();

  static TextStyle display = GoogleFonts.plusJakartaSans(
    fontSize: 28,
    fontWeight: FontWeight.w800,
    color: AppColors.penguinNavy,
    height: 1.2,
    letterSpacing: -0.6,
  );

  static TextStyle pageTitle = GoogleFonts.plusJakartaSans(
    fontSize: 24,
    fontWeight: FontWeight.w800,
    color: AppColors.penguinNavy,
    height: 1.25,
    letterSpacing: -0.4,
  );

  static TextStyle sectionTitle = GoogleFonts.plusJakartaSans(
    fontSize: 18,
    fontWeight: FontWeight.w700,
    color: AppColors.penguinNavy,
    height: 1.3,
    letterSpacing: -0.2,
  );

  static TextStyle cardTitle = GoogleFonts.plusJakartaSans(
    fontSize: 16,
    fontWeight: FontWeight.w700,
    color: AppColors.penguinNavy,
    height: 1.3,
  );

  static TextStyle cardDesc = GoogleFonts.inter(
    fontSize: 13.5,
    color: AppColors.sageMuted,
    height: 1.45,
  );

  static TextStyle body = GoogleFonts.inter(
    fontSize: 14,
    color: AppColors.navyBody,
    height: 1.45,
  );

  static TextStyle bodyMedium = GoogleFonts.inter(
    fontSize: 14,
    fontWeight: FontWeight.w500,
    color: AppColors.navyBody,
    height: 1.45,
  );

  static TextStyle meta = GoogleFonts.inter(
    fontSize: 12,
    color: AppColors.sageMuted,
    height: 1.35,
  );

  static TextStyle label = GoogleFonts.plusJakartaSans(
    fontSize: 12,
    fontWeight: FontWeight.w600,
    color: AppColors.navyBody,
    letterSpacing: 0.2,
  );

  static TextStyle mono = GoogleFonts.jetBrainsMono(
    fontSize: 13,
    fontWeight: FontWeight.w600,
    color: AppColors.penguinNavy,
    fontFeatures: const [FontFeature.tabularFigures()],
  );
}

/// Tông trạng thái: mỗi trạng thái là một cặp nền nhạt + chữ đậm cùng sắc ("Stamp Pair Rule").
enum StatusTone {
  success(AppColors.mintSoft, AppColors.forest, AppColors.successBorder),
  warning(AppColors.honeyTint, AppColors.honeyText, AppColors.honeyBorder),
  danger(AppColors.expiredTint, AppColors.expiredWine, AppColors.peach),
  processing(AppColors.mistLilac, AppColors.penguinNavy, AppColors.lilacBorder),
  neutral(AppColors.milkCream, AppColors.sageMuted, AppColors.sageBorder);

  const StatusTone(this.background, this.foreground, this.border);
  final Color background;
  final Color foreground;
  final Color border;
}

/// Tông theo mã trạng thái phiếu, cùng bảng TICKET_STATUS_CUSTOMER của web (labels.js).
StatusTone ticketStatusTone(String status) => switch (status) {
  'INSPECTING' || 'DIAGNOSED' || 'REPAIRING' => StatusTone.processing,
  'AWAITING_QUOTE_APPROVAL' ||
  'AWAITING_CUSTOMER_CONFIRMATION' ||
  'AWAITING_PARTS' ||
  'AWAITING_RETURN' => StatusTone.warning,
  'COMPLETED' || 'DELIVERED' => StatusTone.success,
  _ => StatusTone.neutral,
};

/// Tông theo mã trạng thái yêu cầu trực tuyến (WARRANTY_REQUEST_STATUS).
StatusTone requestStatusTone(String status) => switch (status) {
  'PENDING_INTAKE' => StatusTone.warning,
  'CONVERTED' => StatusTone.success,
  _ => StatusTone.neutral,
};

class AppTheme {
  AppTheme._();

  static ThemeData get lightTheme {
    final controlShape = RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(AppRadius.control),
    );

    OutlineInputBorder inputBorder(Color color, [double width = 1]) =>
        OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.control),
          borderSide: BorderSide(color: color, width: width),
        );

    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      scaffoldBackgroundColor: AppColors.milkCream,
      colorScheme: ColorScheme.fromSeed(
        seedColor: AppColors.forest,
        primary: AppColors.forest,
        onPrimary: AppColors.paperWhite,
        primaryContainer: AppColors.mintSoft,
        onPrimaryContainer: AppColors.forest,
        secondary: AppColors.honey,
        surface: AppColors.paperWhite,
        onSurface: AppColors.penguinNavy,
        error: AppColors.expiredWine,
        outline: AppColors.sageBorder,
        outlineVariant: AppColors.sageDivider,
        brightness: Brightness.light,
      ),
      fontFamily: GoogleFonts.inter().fontFamily,
      // fontFamily ở trên đã đặt Inter cho mọi kiểu chữ; ở đây chỉ ghi đè các cấp tiêu đề/nội dung.
      textTheme: TextTheme(
        displayLarge: GoogleFonts.plusJakartaSans(
          fontSize: 32,
          fontWeight: FontWeight.w800,
          color: AppColors.penguinNavy,
          letterSpacing: -0.6,
        ),
        displayMedium: GoogleFonts.plusJakartaSans(
          fontSize: 26,
          fontWeight: FontWeight.w800,
          color: AppColors.penguinNavy,
          letterSpacing: -0.5,
        ),
        headlineLarge: GoogleFonts.plusJakartaSans(
          fontSize: 22,
          fontWeight: FontWeight.w700,
          color: AppColors.penguinNavy,
          letterSpacing: -0.3,
        ),
        headlineMedium: GoogleFonts.plusJakartaSans(
          fontSize: 18,
          fontWeight: FontWeight.w700,
          color: AppColors.penguinNavy,
        ),
        titleLarge: GoogleFonts.plusJakartaSans(
          fontSize: 16,
          fontWeight: FontWeight.w700,
          color: AppColors.penguinNavy,
        ),
        titleMedium: GoogleFonts.plusJakartaSans(
          fontSize: 14,
          fontWeight: FontWeight.w600,
          color: AppColors.navyBody,
        ),
        bodyLarge: GoogleFonts.inter(
          fontSize: 15,
          fontWeight: FontWeight.w400,
          color: AppColors.navyBody,
          height: 1.5,
        ),
        bodyMedium: GoogleFonts.inter(
          fontSize: 14,
          fontWeight: FontWeight.w400,
          color: AppColors.navyBody,
          height: 1.45,
        ),
        bodySmall: GoogleFonts.inter(
          fontSize: 12.5,
          fontWeight: FontWeight.w400,
          color: AppColors.sageMuted,
          height: 1.35,
        ),
        labelLarge: GoogleFonts.plusJakartaSans(
          fontSize: 14,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.2,
        ),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: AppColors.paperWhite,
        foregroundColor: AppColors.penguinNavy,
        elevation: 0,
        scrolledUnderElevation: 0.5,
        centerTitle: true,
        titleTextStyle: GoogleFonts.plusJakartaSans(
          fontSize: 17,
          fontWeight: FontWeight.w700,
          color: AppColors.penguinNavy,
        ),
      ),
      // Nút gửi chuẩn mobile: cao 48px, bo 12px, font Plus Jakarta Sans đậm nét
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.forest,
          foregroundColor: AppColors.paperWhite,
          disabledBackgroundColor: AppColors.sageBorder,
          disabledForegroundColor: AppColors.sageMuted,
          minimumSize: const Size(double.infinity, 48),
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 13),
          shape: controlShape,
          textStyle: GoogleFonts.plusJakartaSans(
            fontSize: 15,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.2,
          ),
          elevation: 0,
          shadowColor: AppColors.forest.withValues(alpha: 0.2),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: AppColors.forest,
          foregroundColor: AppColors.paperWhite,
          minimumSize: const Size(double.infinity, 48),
          shape: controlShape,
          textStyle: GoogleFonts.plusJakartaSans(
            fontSize: 14,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.penguinNavy,
          backgroundColor: AppColors.paperWhite,
          minimumSize: const Size(double.infinity, 48),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
          side: const BorderSide(color: AppColors.sageBorder, width: 1.2),
          shape: controlShape,
          textStyle: GoogleFonts.plusJakartaSans(
            fontSize: 14.5,
            fontWeight: FontWeight.w600,
          ),
          elevation: 0,
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: AppColors.forest,
          shape: controlShape,
          textStyle: GoogleFonts.plusJakartaSans(
            fontSize: 14,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      floatingActionButtonTheme: FloatingActionButtonThemeData(
        backgroundColor: AppColors.forest,
        foregroundColor: AppColors.paperWhite,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.container),
        ),
        elevation: 3,
      ),
      // Ô nhập trang khách (input-customer): bo góc 12px, nền trắng, viền sage, focus xanh rừng 1.5px
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.paperWhite,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 14,
        ),
        border: inputBorder(AppColors.controlBorder),
        enabledBorder: inputBorder(AppColors.controlBorder),
        focusedBorder: inputBorder(AppColors.forest, 1.5),
        errorBorder: inputBorder(AppColors.expiredWine, 1.2),
        focusedErrorBorder: inputBorder(AppColors.expiredWine, 1.5),
        hintStyle: GoogleFonts.inter(
          color: AppColors.sageMuted,
          fontSize: 14,
          fontWeight: FontWeight.w400,
        ),
        labelStyle: GoogleFonts.plusJakartaSans(
          color: AppColors.navyBody,
          fontSize: 13,
          fontWeight: FontWeight.w600,
        ),
        errorStyle: GoogleFonts.inter(
          color: AppColors.expiredWine,
          fontSize: 12,
        ),
      ),
      cardTheme: CardThemeData(
        color: AppColors.paperWhite,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.container),
          side: const BorderSide(color: AppColors.sageBorder, width: 1),
        ),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: AppColors.paperWhite,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.card),
        ),
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: AppColors.penguinNavy,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.control),
        ),
        contentTextStyle: GoogleFonts.inter(
          color: AppColors.paperWhite,
          fontSize: 13.5,
        ),
      ),
      progressIndicatorTheme: const ProgressIndicatorThemeData(
        color: AppColors.forest,
      ),
      checkboxTheme: CheckboxThemeData(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(5)),
        checkColor: WidgetStateProperty.all(AppColors.paperWhite),
        fillColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) return AppColors.forest;
          return null;
        }),
      ),
      dividerTheme: const DividerThemeData(
        color: AppColors.sageDivider,
        thickness: 1,
      ),
    );
  }
}
