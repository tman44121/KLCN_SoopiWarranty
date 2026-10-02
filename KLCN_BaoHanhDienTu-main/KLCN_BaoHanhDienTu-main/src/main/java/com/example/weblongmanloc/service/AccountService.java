package com.example.weblongmanloc.service;

import com.example.weblongmanloc.entity.KhachHang;
import com.example.weblongmanloc.entity.TaiKhoan;
import com.example.weblongmanloc.entity.VaiTro;
import com.example.weblongmanloc.model.ChangePasswordModel;
import com.example.weblongmanloc.model.ProfileModel;
import com.example.weblongmanloc.model.RegisterModel;
import com.example.weblongmanloc.repository.KhachHangRepository;
import com.example.weblongmanloc.repository.TaiKhoanRepository;
import com.example.weblongmanloc.repository.VaiTroRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

@Service
public class AccountService {

    private final TaiKhoanRepository taiKhoanRepository;
    private final KhachHangRepository khachHangRepository;
    private final VaiTroRepository vaiTroRepository;
    private final PasswordEncoder passwordEncoder;

    @PersistenceContext
    private EntityManager entityManager;

    @Autowired
    public AccountService(TaiKhoanRepository taiKhoanRepository,
                          KhachHangRepository khachHangRepository,
                          VaiTroRepository vaiTroRepository,
                          PasswordEncoder passwordEncoder) {
        this.taiKhoanRepository = taiKhoanRepository;
        this.khachHangRepository = khachHangRepository;
        this.vaiTroRepository = vaiTroRepository;
        this.passwordEncoder = passwordEncoder;
    }

    public boolean isPhoneExists(String phone) {
        String cleanPhone = normalizePhone(phone);
        return khachHangRepository.existsBySdt(cleanPhone) || taiKhoanRepository.existsByTenDangNhap(cleanPhone);
    }

    public boolean isEmailExists(String email) {
        if (email == null || email.trim().isEmpty()) {
            return false;
        }
        return khachHangRepository.existsByEmail(email.trim().toLowerCase());
    }

    @Transactional
    public KhachHang registerCustomer(RegisterModel registerModel) {
        String cleanPhone = normalizePhone(registerModel.getPhone());
        String email = registerModel.getEmail() != null ? registerModel.getEmail().trim().toLowerCase() : null;

        if (isPhoneExists(cleanPhone)) {
            throw new IllegalArgumentException("Số điện thoại này đã được đăng ký tài khoản.");
        }

        if (email != null && !email.isEmpty() && isEmailExists(email)) {
            throw new IllegalArgumentException("Email này đã được sử dụng.");
        }

        // 1. Tạo TaiKhoan
        TaiKhoan taiKhoan = new TaiKhoan();
        taiKhoan.setTenDangNhap(cleanPhone);
        taiKhoan.setMatKhauHash(passwordEncoder.encode(registerModel.getPassword()));
        taiKhoan.setLoaiChuThe("CUSTOMER");
        taiKhoan.setTrangThai("ACTIVE");
        taiKhoan.setNgayTao(LocalDateTime.now());

        // Gán vai trò CUSTOMER
        VaiTro customerRole = vaiTroRepository.findByMaVaiTro("CUSTOMER")
            .orElseGet(() -> vaiTroRepository.save(new VaiTro("CUSTOMER", "Khách hàng", "/")));
        
        Set<VaiTro> roles = new HashSet<>();
        roles.add(customerRole);
        taiKhoan.setVaiTros(roles);

        TaiKhoan savedTaiKhoan = taiKhoanRepository.save(taiKhoan);

        // 2. Tạo mã KhachHang mới (Format KH-XXXXXX)
        String maKH = generateMaKH();

        // 3. Tạo KhachHang
        KhachHang khachHang = new KhachHang();
        khachHang.setMaKH(maKH);
        khachHang.setHoTen(registerModel.getFullName().trim());
        khachHang.setSdt(cleanPhone);
        khachHang.setEmail(email);
        khachHang.setTaiKhoan(savedTaiKhoan);
        khachHang.setTrangThai("ACTIVE");
        khachHang.setNgayTao(LocalDateTime.now());

        return khachHangRepository.save(khachHang);
    }

    // =========================================================================
    // GET PROFILE
    // =========================================================================
    @Transactional(readOnly = true)
    public ProfileModel getProfile(String username) {
        ProfileModel profile = new ProfileModel();
        profile.setTenDangNhap(username);
        profile.setHoTen(username);
        profile.setSdt(username);
        profile.setNgayThamGia(LocalDateTime.now().format(DateTimeFormatter.ofPattern("dd/MM/yyyy")));

        if (username == null || username.trim().isEmpty()) {
            return profile;
        }

        try {
            // Tìm trong KhachHang
            String sqlKh = "SELECT k.MaKH, k.HoTen, k.SDT, k.Email, k.DiaChi, DATE_FORMAT(k.NgayTao, '%d/%m/%Y'), t.TenDangNhap " +
                           "FROM KhachHang k " +
                           "LEFT JOIN TaiKhoan t ON k.MaTaiKhoan = t.MaTaiKhoan " +
                           "WHERE LOWER(t.TenDangNhap) = LOWER(:user) OR k.SDT = :user OR LOWER(k.Email) = LOWER(:user) " +
                           "LIMIT 1";
            @SuppressWarnings("unchecked")
            List<Object[]> rows = entityManager.createNativeQuery(sqlKh)
                                               .setParameter("user", username.trim())
                                               .getResultList();

            if (!rows.isEmpty()) {
                Object[] row = rows.get(0);
                profile.setMaKH(row[0] != null ? row[0].toString() : "KH-000001");
                profile.setHoTen(row[1] != null ? row[1].toString() : username);
                profile.setSdt(row[2] != null ? row[2].toString() : username);
                profile.setEmail(row[3] != null ? row[3].toString() : "");
                profile.setDiaChi(row[4] != null ? row[4].toString() : "");
                profile.setNgayThamGia(row[5] != null ? row[5].toString() : "01/09/2026");
                profile.setTenDangNhap(row[6] != null ? row[6].toString() : username);

                // Đếm số thiết bị và phiếu bảo hành
                try {
                    Object countTb = entityManager.createNativeQuery("SELECT COUNT(*) FROM ThietBi WHERE MaKH = :maKH")
                                                 .setParameter("maKH", profile.getMaKH())
                                                 .getSingleResult();
                    profile.setSoThietBi(((Number) countTb).longValue());

                    Object countPhieu = entityManager.createNativeQuery("SELECT COUNT(*) FROM PhieuTiepNhan WHERE MaKH = :maKH")
                                                     .setParameter("maKH", profile.getMaKH())
                                                     .getSingleResult();
                    profile.setSoPhieuBaoHanh(((Number) countPhieu).longValue());
                } catch (Exception ignored) {
                }
                return profile;
            }

            // Tìm trong NhanVien
            String sqlNv = "SELECT n.MaNV, n.HoTen, n.SDT, n.Email, '', '01/01/2026', t.TenDangNhap " +
                           "FROM NhanVien n " +
                           "LEFT JOIN TaiKhoan t ON n.MaTaiKhoan = t.MaTaiKhoan " +
                           "WHERE LOWER(t.TenDangNhap) = LOWER(:user) OR n.SDT = :user OR LOWER(n.Email) = LOWER(:user) " +
                           "LIMIT 1";
            @SuppressWarnings("unchecked")
            List<Object[]> nvRows = entityManager.createNativeQuery(sqlNv)
                                                 .setParameter("user", username.trim())
                                                 .getResultList();
            if (!nvRows.isEmpty()) {
                Object[] row = nvRows.get(0);
                profile.setMaKH(row[0] != null ? row[0].toString() : "NV-001");
                profile.setHoTen(row[1] != null ? row[1].toString() : username);
                profile.setSdt(row[2] != null ? row[2].toString() : username);
                profile.setEmail(row[3] != null ? row[3].toString() : "");
                profile.setDiaChi("Trung Tâm Bảo Hành & Sửa Chữa LongManLoc");
                profile.setNgayThamGia("01/01/2026");
                profile.setTenDangNhap(row[6] != null ? row[6].toString() : username);
            }
        } catch (Exception ignored) {
        }

        return profile;
    }

    // =========================================================================
    // UPDATE PROFILE
    // =========================================================================
    @Transactional
    public void updateProfile(String username, ProfileModel model) {
        if (username == null || username.trim().isEmpty()) {
            throw new IllegalArgumentException("Không xác định được danh tính người dùng.");
        }

        String sqlKh = "SELECT k.MaKH FROM KhachHang k " +
                       "LEFT JOIN TaiKhoan t ON k.MaTaiKhoan = t.MaTaiKhoan " +
                       "WHERE LOWER(t.TenDangNhap) = LOWER(:user) OR k.SDT = :user OR LOWER(k.Email) = LOWER(:user) " +
                       "LIMIT 1";

        @SuppressWarnings("unchecked")
        List<Object> rows = entityManager.createNativeQuery(sqlKh)
                                         .setParameter("user", username.trim())
                                         .getResultList();

        if (!rows.isEmpty() && rows.get(0) != null) {
            String maKH = rows.get(0).toString();
            String updateSql = "UPDATE KhachHang SET HoTen = :hoTen, Email = :email, DiaChi = :diaChi WHERE MaKH = :maKH";
            entityManager.createNativeQuery(updateSql)
                         .setParameter("hoTen", model.getHoTen().trim())
                         .setParameter("email", model.getEmail() != null ? model.getEmail().trim() : null)
                         .setParameter("diaChi", model.getDiaChi() != null ? model.getDiaChi().trim() : null)
                         .setParameter("maKH", maKH)
                         .executeUpdate();
            return;
        }

        // Cập nhật Nhân viên nếu là NV
        String sqlNv = "SELECT n.MaNV FROM NhanVien n " +
                       "LEFT JOIN TaiKhoan t ON n.MaTaiKhoan = t.MaTaiKhoan " +
                       "WHERE LOWER(t.TenDangNhap) = LOWER(:user) OR n.SDT = :user OR LOWER(n.Email) = LOWER(:user) " +
                       "LIMIT 1";
        @SuppressWarnings("unchecked")
        List<Object> nvRows = entityManager.createNativeQuery(sqlNv)
                                           .setParameter("user", username.trim())
                                           .getResultList();

        if (!nvRows.isEmpty() && nvRows.get(0) != null) {
            String maNV = nvRows.get(0).toString();
            String updateSql = "UPDATE NhanVien SET HoTen = :hoTen, Email = :email WHERE MaNV = :maNV";
            entityManager.createNativeQuery(updateSql)
                         .setParameter("hoTen", model.getHoTen().trim())
                         .setParameter("email", model.getEmail() != null ? model.getEmail().trim() : null)
                         .setParameter("maNV", maNV)
                         .executeUpdate();
        }
    }

    // =========================================================================
    // CHANGE PASSWORD
    // =========================================================================
    @Transactional
    public void changePassword(String username, ChangePasswordModel model) {
        if (!model.getNewPassword().equals(model.getConfirmPassword())) {
            throw new IllegalArgumentException("Mật khẩu mới và xác nhận mật khẩu không khớp.");
        }

        Optional<TaiKhoan> taiKhoanOpt = taiKhoanRepository.findByTenDangNhapIgnoreCase(username);
        if (taiKhoanOpt.isEmpty()) {
            taiKhoanOpt = taiKhoanRepository.findByKhachHangContactInfo(username);
        }
        if (taiKhoanOpt.isEmpty()) {
            taiKhoanOpt = taiKhoanRepository.findByNhanVienContactInfo(username);
        }

        if (taiKhoanOpt.isEmpty()) {
            throw new IllegalArgumentException("Không tìm thấy thông tin tài khoản.");
        }

        TaiKhoan taiKhoan = taiKhoanOpt.get();

        // Kiểm tra mật khẩu hiện tại
        if (!passwordEncoder.matches(model.getCurrentPassword(), taiKhoan.getMatKhauHash())) {
            throw new IllegalArgumentException("Mật khẩu hiện tại không chính xác.");
        }

        // Cập nhật mật khẩu mới
        taiKhoan.setMatKhauHash(passwordEncoder.encode(model.getNewPassword()));
        taiKhoan.setNgayDoiMatKhau(LocalDateTime.now());
        taiKhoan.setBatBuocDoiMatKhau(false);
        taiKhoan.setPhienBanBaoMat(taiKhoan.getPhienBanBaoMat() + 1);

        taiKhoanRepository.save(taiKhoan);
    }

    private String generateMaKH() {
        long count = khachHangRepository.countAllKhachHang();
        long nextId = count + 1;
        String candidate;
        do {
            candidate = String.format("KH-%06d", nextId);
            nextId++;
        } while (khachHangRepository.existsById(candidate));
        return candidate;
    }

    private String normalizePhone(String phone) {
        if (phone == null) return "";
        String cleaned = phone.replaceAll("[^0-9]", "");
        if (cleaned.startsWith("84") && cleaned.length() == 11) {
            cleaned = "0" + cleaned.substring(2);
        }
        return cleaned;
    }
}
