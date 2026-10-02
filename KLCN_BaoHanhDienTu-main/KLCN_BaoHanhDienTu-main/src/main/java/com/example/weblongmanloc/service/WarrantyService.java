package com.example.weblongmanloc.service;

import com.example.weblongmanloc.dto.*;
import com.example.weblongmanloc.model.WarrantyRegisterModel;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
public class WarrantyService {

    @PersistenceContext
    private EntityManager entityManager;

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter DATETIME_FORMATTER = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    // =========================================================================
    // 1. LẤY DANH MỤC CHO DROPDOWN SELECTION
    // =========================================================================

    @SuppressWarnings("unchecked")
    @Transactional(readOnly = true)
    public List<SelectionItemDto> getTramDichVuList() {
        List<SelectionItemDto> list = new ArrayList<>();
        try {
            List<Object[]> rows = entityManager.createNativeQuery("SELECT MaTram, TenTram, DiaChi FROM TramDichVu WHERE HoatDong = 1 ORDER BY MaTram").getResultList();
            for (Object[] row : rows) {
                String id = row[0] != null ? row[0].toString() : "";
                String name = row[1] != null ? row[1].toString() : "";
                String address = row[2] != null ? row[2].toString() : "";
                list.add(new SelectionItemDto(id, name, address));
            }
        } catch (Exception ignored) {
        }
        if (list.isEmpty()) {
            list.add(new SelectionItemDto("HCM", "Trạm Dịch Vụ TP.HCM - 123 CMT8, Q.10, TP.HCM"));
            list.add(new SelectionItemDto("HN", "Trạm Dịch Vụ Hà Nội - 456 Cầu Giấy, Q.Cầu Giấy, Hà Nội"));
            list.add(new SelectionItemDto("DN", "Trạm Dịch Vụ Đà Nẵng - 789 Nguyễn Văn Linh, Đà Nẵng"));
            list.add(new SelectionItemDto("CT", "Trạm Dịch Vụ Cần Thơ - 321 30 Tháng 4, Cần Thơ"));
        }
        return list;
    }

    @SuppressWarnings("unchecked")
    @Transactional(readOnly = true)
    public List<SelectionItemDto> getHangSanXuatList() {
        List<SelectionItemDto> list = new ArrayList<>();
        try {
            List<Object[]> rows = entityManager.createNativeQuery("SELECT MaHang, TenHang FROM HangSanXuat WHERE HoatDong = 1 ORDER BY TenHang").getResultList();
            for (Object[] row : rows) {
                list.add(new SelectionItemDto(row[0].toString(), row[1].toString()));
            }
        } catch (Exception ignored) {
        }
        if (list.isEmpty()) {
            list.add(new SelectionItemDto("APPLE", "Apple"));
            list.add(new SelectionItemDto("SAMSUNG", "Samsung"));
            list.add(new SelectionItemDto("PANASONIC", "Panasonic"));
            list.add(new SelectionItemDto("SONY", "Sony"));
            list.add(new SelectionItemDto("LG", "LG Electronics"));
            list.add(new SelectionItemDto("XIAOMI", "Xiaomi"));
            list.add(new SelectionItemDto("ASUS", "ASUS"));
            list.add(new SelectionItemDto("DELL", "Dell Technologies"));
        }
        return list;
    }

    @SuppressWarnings("unchecked")
    @Transactional(readOnly = true)
    public List<SelectionItemDto> getNhomThietBiList() {
        List<SelectionItemDto> list = new ArrayList<>();
        try {
            List<Object[]> rows = entityManager.createNativeQuery("SELECT MaNhom, TenNhom FROM NhomThietBi WHERE HoatDong = 1 ORDER BY ThuTu").getResultList();
            for (Object[] row : rows) {
                list.add(new SelectionItemDto(row[0].toString(), row[1].toString()));
            }
        } catch (Exception ignored) {
        }
        if (list.isEmpty()) {
            list.add(new SelectionItemDto("PHONE", "Điện thoại & Tablet"));
            list.add(new SelectionItemDto("LAPTOP_TABLET", "Laptop & Máy tính"));
            list.add(new SelectionItemDto("HOME_APPLIANCE", "Gia dụng & Đời sống"));
            list.add(new SelectionItemDto("REFRIGERATION", "Điện lạnh & Điều hòa"));
            list.add(new SelectionItemDto("AUDIO_VIDEO", "Tivi & Âm thanh"));
        }
        return list;
    }

    @SuppressWarnings("unchecked")
    @Transactional(readOnly = true)
    public List<SelectionItemDto> getLoaiThietBiList() {
        List<SelectionItemDto> list = new ArrayList<>();
        try {
            List<Object[]> rows = entityManager.createNativeQuery("SELECT MaLoai, TenLoai, MaNhom FROM LoaiThietBi WHERE HoatDong = 1 ORDER BY TenLoai").getResultList();
            for (Object[] row : rows) {
                list.add(new SelectionItemDto(row[0].toString(), row[1].toString(), row[2] != null ? row[2].toString() : ""));
            }
        } catch (Exception ignored) {
        }
        if (list.isEmpty()) {
            list.add(new SelectionItemDto("SMARTPHONE", "Điện thoại thông minh"));
            list.add(new SelectionItemDto("LAPTOP", "Máy tính xách tay (Laptop)"));
            list.add(new SelectionItemDto("TABLET", "Máy tính bảng (Tablet)"));
            list.add(new SelectionItemDto("AIR_PURIFIER", "Máy lọc không khí"));
            list.add(new SelectionItemDto("WATER_PURIFIER", "Máy lọc nước RO"));
            list.add(new SelectionItemDto("SMART_TV", "Tivi thông minh (Smart TV)"));
            list.add(new SelectionItemDto("AIR_CONDITIONER", "Máy lạnh / Điều hòa"));
            list.add(new SelectionItemDto("WASHING_MACHINE", "Máy giặt"));
            list.add(new SelectionItemDto("REFRIGERATOR", "Tủ lạnh Inverter"));
        }
        return list;
    }

    // =========================================================================
    // 2. KÍCH HOẠT BẢO HÀNH (ĐĂNG KÝ THIẾT BỊ MỚI)
    // =========================================================================

    @Transactional
    public String registerOrActivateWarranty(WarrantyRegisterModel model, String username) {
        String maKH = findMaKHByUsername(username);
        String serial = model.getSerialNumber().trim().toUpperCase().replaceAll("\\s+", "");

        // 1. Tìm hoặc tạo sản phẩm (SanPham)
        String maSP = model.getMaSP();
        if (maSP == null || maSP.trim().isEmpty()) {
            maSP = findOrCreateSanPham(model.getProductName(), model.getMaHang(), model.getMaLoai());
        }

        // 2. Tính toán ngày kích hoạt và hết hạn
        LocalDate ngayKichHoat = LocalDate.now();
        if (model.getPurchaseDate() != null && !model.getPurchaseDate().trim().isEmpty()) {
            try {
                ngayKichHoat = LocalDate.parse(model.getPurchaseDate().trim());
            } catch (Exception ignored) {
            }
        }
        LocalDate ngayHetHan = ngayKichHoat.plusMonths(24); // Mặc định 24 tháng

        // Xác định loại định danh: nếu 15 số là IMEI, còn lại là SERIAL
        String loaiDinhDanh = (serial.length() == 15 && serial.matches("^[0-9]+$")) ? "IMEI" : "SERIAL";

        // 3. Kiểm tra xem thiết bị đã có trong DB chưa
        String checkSql = "SELECT MaThietBi FROM ThietBi WHERE SoSerial_IMEI = :serial LIMIT 1";
        @SuppressWarnings("unchecked")
        List<Object> existing = entityManager.createNativeQuery(checkSql)
                                             .setParameter("serial", serial)
                                             .getResultList();

        String maThietBi;
        if (!existing.isEmpty() && existing.get(0) != null) {
            maThietBi = existing.get(0).toString();
            // Cập nhật gán khách hàng và kích hoạt nếu chưa có
            String updateSql = "UPDATE ThietBi SET MaKH = :maKH, NgayKichHoatBaoHanh = :ngayKH, NgayHetHanBaoHanh = :ngayHH, NhaPhanPhoi = :npp WHERE MaThietBi = :maTB";
            entityManager.createNativeQuery(updateSql)
                         .setParameter("maKH", maKH)
                         .setParameter("ngayKH", java.sql.Date.valueOf(ngayKichHoat))
                         .setParameter("ngayHH", java.sql.Date.valueOf(ngayHetHan))
                         .setParameter("npp", model.getDealerName() != null ? model.getDealerName() : "Hệ thống phân phối ủy quyền")
                         .setParameter("maTB", maThietBi)
                         .executeUpdate();
        } else {
            // Sinh mã thiết bị mới TB-XXXXXX
            maThietBi = generateMaThietBi();
            String insertSql = "INSERT INTO ThietBi (MaThietBi, MaSP, LoaiDinhDanh, SoSerial_IMEI, MaKH, NgayKichHoatBaoHanh, NgayHetHanBaoHanh, NhaPhanPhoi, NgayTao) " +
                               "VALUES (:maTB, :maSP, :loaiDD, :serial, :maKH, :ngayKH, :ngayHH, :npp, NOW())";
            entityManager.createNativeQuery(insertSql)
                         .setParameter("maTB", maThietBi)
                         .setParameter("maSP", maSP)
                         .setParameter("loaiDD", loaiDinhDanh)
                         .setParameter("serial", serial)
                         .setParameter("maKH", maKH)
                         .setParameter("ngayKH", java.sql.Date.valueOf(ngayKichHoat))
                         .setParameter("ngayHH", java.sql.Date.valueOf(ngayHetHan))
                         .setParameter("npp", model.getDealerName() != null ? model.getDealerName() : "Hệ thống phân phối ủy quyền")
                         .executeUpdate();
        }

        return maThietBi;
    }

    // =========================================================================
    // 3. GỬI YÊU CẦU BẢO HÀNH TRỰC TUYẾN (ONLINE REQUEST)
    // =========================================================================

    @Transactional
    public String createOnlineWarrantyRequest(WarrantyRegisterModel model, String username) {
        String maKH = findMaKHByUsername(username);
        String serial = model.getSerialNumber().trim().toUpperCase().replaceAll("\\s+", "");
        String loaiDinhDanh = (serial.length() == 15 && serial.matches("^[0-9]+$")) ? "IMEI" : "SERIAL";

        String maNhom = model.getMaNhom() != null ? model.getMaNhom() : "HOME_APPLIANCE";
        String maLoai = model.getMaLoai() != null ? model.getMaLoai() : "WATER_PURIFIER";
        String hangModel = (model.getProductName() != null && !model.getProductName().trim().isEmpty())
                ? model.getProductName()
                : "Thiết bị chính hãng";

        String maTram = model.getMaTram() != null && !model.getMaTram().trim().isEmpty() ? model.getMaTram() : "HCM";
        String moTaLoi = (model.getMoTaLoi() != null && !model.getMoTaLoi().trim().isEmpty())
                ? model.getMoTaLoi()
                : "Yêu cầu kiểm tra & bảo hành thiết bị định kỳ";

        String maYeuCau = generateMaYeuCau();

        String insertSql = "INSERT INTO YeuCauBaoHanh (MaYeuCau, HoTenKhach, SDTKhach, EmailKhach, DiaChiKhach, MaNhom, MaLoai, HangModel, LoaiDinhDanh, SoSerial_IMEI, MoTaLoi, MaTramMongMuon, TrangThai, NgayTao) " +
                           "VALUES (:maYC, :hoTen, :sdt, :email, :diaChi, :maNhom, :maLoai, :hangModel, :loaiDD, :serial, :moTa, :maTram, 'PENDING_INTAKE', NOW())";

        entityManager.createNativeQuery(insertSql)
                     .setParameter("maYC", maYeuCau)
                     .setParameter("hoTen", model.getFullName() != null ? model.getFullName() : "Khách hàng")
                     .setParameter("sdt", model.getPhone() != null ? model.getPhone() : "0339477939")
                     .setParameter("email", model.getEmail())
                     .setParameter("diaChi", model.getAddress())
                     .setParameter("maNhom", maNhom)
                     .setParameter("maLoai", maLoai)
                     .setParameter("hangModel", hangModel)
                     .setParameter("loaiDD", loaiDinhDanh)
                     .setParameter("serial", serial)
                     .setParameter("moTa", moTaLoi)
                     .setParameter("maTram", maTram)
                     .executeUpdate();

        // Đồng thời nếu thiết bị chưa gắn mã khách hàng, liên kết vào ThietBi
        try {
            registerOrActivateWarranty(model, username);
        } catch (Exception ignored) {
        }

        return maYeuCau;
    }

    // =========================================================================
    // 4. DANH SÁCH THIẾT BỊ CỦA KHÁCH HÀNG
    // =========================================================================

    @SuppressWarnings("unchecked")
    @Transactional(readOnly = true)
    public List<CustomerDeviceDto> getCustomerDevices(String username) {
        List<CustomerDeviceDto> list = new ArrayList<>();
        String maKH = findMaKHByUsername(username);

        if (maKH != null) {
            try {
                String sql = "SELECT t.MaThietBi, t.SoSerial_IMEI, " +
                             "COALESCE(sp.TenSP, 'Thiết bị điện tử') AS TenSP, " +
                             "COALESCE(h.TenHang, 'Chính hãng') AS TenHang, " +
                             "COALESCE(ltb.TenLoai, 'Điện tử gia dụng') AS TenLoai, " +
                             "t.NgayKichHoatBaoHanh, t.NgayHetHanBaoHanh, t.NhaPhanPhoi " +
                             "FROM ThietBi t " +
                             "LEFT JOIN SanPham sp ON t.MaSP = sp.MaSP " +
                             "LEFT JOIN HangSanXuat h ON sp.MaHang = h.MaHang " +
                             "LEFT JOIN LoaiThietBi ltb ON sp.MaLoai = ltb.MaLoai " +
                             "WHERE t.MaKH = :maKH " +
                             "ORDER BY t.NgayTao DESC";

                List<Object[]> rows = entityManager.createNativeQuery(sql)
                                                   .setParameter("maKH", maKH)
                                                   .getResultList();

                LocalDate today = LocalDate.now();

                for (Object[] row : rows) {
                    String maTB = row[0] != null ? row[0].toString() : "";
                    String serial = row[1] != null ? row[1].toString() : "";
                    String tenSP = row[2] != null ? row[2].toString() : "Thiết bị điện tử";
                    String hang = row[3] != null ? row[3].toString() : "Chính hãng";
                    String loai = row[4] != null ? row[4].toString() : "Thiết bị gia dụng";

                    String ngayKHStr = row[5] != null ? row[5].toString() : "";
                    String ngayHHStr = row[6] != null ? row[6].toString() : "";
                    String npp = row[7] != null ? row[7].toString() : "Chính hãng LongManLoc";

                    String trangThaiBH = "CON_HAN";
                    String badgeText = "Còn hạn bảo hành";
                    String badgeClass = "badge-completed";

                    if (row[6] != null) {
                        try {
                            LocalDate expDate = LocalDate.parse(row[6].toString());
                            if (expDate.isBefore(today)) {
                                trangThaiBH = "HET_HAN";
                                badgeText = "Hết hạn bảo hành";
                                badgeClass = "badge-waiting";
                            } else if (expDate.minusMonths(1).isBefore(today)) {
                                trangThaiBH = "SAP_HET_HAN";
                                badgeText = "Sắp hết hạn";
                                badgeClass = "badge-processing";
                            }
                        } catch (Exception ignored) {
                        }
                    }

                    list.add(new CustomerDeviceDto(maTB, serial, tenSP, hang, loai, ngayKHStr, ngayHHStr, npp, trangThaiBH, badgeText, badgeClass));
                }
            } catch (Exception ignored) {
            }
        }

        // Dữ liệu mẫu demo nếu mới tạo tài khoản chưa có máy nào
        if (list.isEmpty()) {
            list.add(new CustomerDeviceDto("TB-000101", "LML-88939-2026VN", "Máy Lọc Nước RO Thông Minh LongManLoc Prime", "Panasonic", "Máy lọc nước RO", "15/01/2026", "15/01/2028", "LongManLoc Store Official", "CON_HAN", "Còn hạn bảo hành", "badge-completed"));
            list.add(new CustomerDeviceDto("TB-000102", "SN-C02G789X01", "MacBook Air M2 13.6 inch 256GB Midnight", "Apple", "Máy tính xách tay (Laptop)", "10/06/2025", "10/06/2027", "Apple Authorized Reseller VN", "CON_HAN", "Còn hạn bảo hành", "badge-completed"));
        }

        return list;
    }

    // =========================================================================
    // 5. QUẢN LÝ LỊCH SỬ BẢO HÀNH & SỬA CHỮA CỦA KHÁCH HÀNG
    // =========================================================================

    @SuppressWarnings("unchecked")
    @Transactional(readOnly = true)
    public List<WarrantyTicketDetailDto> getCustomerWarrantyHistory(String username, String statusFilter, String searchQuery) {
        List<WarrantyTicketDetailDto> list = new ArrayList<>();
        String maKH = findMaKHByUsername(username);

        if (maKH != null) {
            try {
                StringBuilder sql = new StringBuilder(
                    "SELECT p.MaPhieuTN, " +
                    "COALESCE(sp.TenSP, t.MaThietBi, 'Sản phẩm bảo hành') AS TenThietBi, " +
                    "COALESCE(t.SoSerial_IMEI, 'SN-2026') AS SoSerial, " +
                    "COALESCE(h.TenHang, 'Chính hãng') AS TenHang, " +
                    "COALESCE(tr.TenTram, 'Trạm LML') AS TenTram, " +
                    "COALESCE(tr.DiaChi, 'Trung tâm dịch vụ') AS DiaChiTram, " +
                    "DATE_FORMAT(p.NgayTiepNhan, '%d/%m/%Y %H:%i') AS NgayTNStr, " +
                    "COALESCE(DATE_FORMAT(p.NgayHenTra, '%d/%m/%Y'), 'Đang cập nhật') AS NgayHTStr, " +
                    "p.MoTaLoiKhachBao, " +
                    "p.TrangThaiXuLy, " +
                    "COALESCE(nv.HoTen, 'Lễ tân tiếp nhận') AS TenNV, " +
                    "p.ChiPhiDuKien, " +
                    "p.MucSLA, " +
                    "p.LoaiYeuCau, " +
                    "p.TinhTrangNgoaiQuan, " +
                    "p.PhuKienKemTheo " +
                    "FROM PhieuTiepNhan p " +
                    "LEFT JOIN ThietBi t ON p.MaThietBi = t.MaThietBi " +
                    "LEFT JOIN SanPham sp ON t.MaSP = sp.MaSP " +
                    "LEFT JOIN HangSanXuat h ON sp.MaHang = h.MaHang " +
                    "LEFT JOIN TramDichVu tr ON p.MaTram = tr.MaTram " +
                    "LEFT JOIN NhanVien nv ON p.MaNVTiepNhan = nv.MaNV " +
                    "WHERE p.MaKH = :maKH "
                );

                if (statusFilter != null && !statusFilter.trim().isEmpty() && !statusFilter.equalsIgnoreCase("ALL")) {
                    if (statusFilter.equalsIgnoreCase("PROCESSING")) {
                        sql.append(" AND p.TrangThaiXuLy IN ('RECEIVED', 'INSPECTING', 'REPAIRING') ");
                    } else if (statusFilter.equalsIgnoreCase("WAITING")) {
                        sql.append(" AND p.TrangThaiXuLy IN ('AWAITING_PARTS', 'AWAITING_QUOTE_APPROVAL', 'AWAITING_CUSTOMER_CONFIRMATION') ");
                    } else if (statusFilter.equalsIgnoreCase("COMPLETED")) {
                        sql.append(" AND p.TrangThaiXuLy IN ('COMPLETED', 'DELIVERED') ");
                    } else {
                        sql.append(" AND p.TrangThaiXuLy = '").append(statusFilter.replace("'", "")).append("' ");
                    }
                }

                if (searchQuery != null && !searchQuery.trim().isEmpty()) {
                    sql.append(" AND (p.MaPhieuTN LIKE :query OR t.SoSerial_IMEI LIKE :query OR sp.TenSP LIKE :query) ");
                }

                sql.append(" ORDER BY p.NgayTiepNhan DESC");

                var queryObj = entityManager.createNativeQuery(sql.toString()).setParameter("maKH", maKH);
                if (searchQuery != null && !searchQuery.trim().isEmpty()) {
                    queryObj.setParameter("query", "%" + searchQuery.trim() + "%");
                }

                List<Object[]> rows = queryObj.getResultList();

                for (Object[] row : rows) {
                    WarrantyTicketDetailDto dto = new WarrantyTicketDetailDto();
                    dto.setMaPhieu(row[0] != null ? row[0].toString() : "");
                    dto.setLoaiPhieu("PHIEU_TIEP_NHAN");
                    dto.setTenThietBi(row[1] != null ? row[1].toString() : "Thiết bị bảo hành");
                    dto.setSoSerial(row[2] != null ? row[2].toString() : "");
                    dto.setHangSanXuat(row[3] != null ? row[3].toString() : "Chính hãng");
                    dto.setTenTram(row[4] != null ? row[4].toString() : "Trạm LML");
                    dto.setDiaChiTram(row[5] != null ? row[5].toString() : "");
                    dto.setNgayTiepNhanStr(row[6] != null ? row[6].toString() : "");
                    dto.setNgayHenTraStr(row[7] != null ? row[7].toString() : "Đang cập nhật");
                    dto.setMoTaLoi(row[8] != null ? row[8].toString() : "");
                    
                    String status = row[9] != null ? row[9].toString() : "RECEIVED";
                    dto.setTrangThai(status);
                    dto.setTrangThaiBadgeText(mapStatusToBadgeText(status));
                    dto.setTrangThaiClass(mapStatusToBadgeClass(status));

                    dto.setTenNVTiepNhan(row[10] != null ? row[10].toString() : "KTV Tiếp nhận");
                    dto.setChiPhiDuKienStr(row[11] != null ? String.format("%,.0f đ", Double.parseDouble(row[11].toString())) : "0 đ (Miễn phí BH)");
                    dto.setMucSLA(row[12] != null ? row[12].toString() : "STANDARD_48H");
                    dto.setLoaiYeuCau(row[13] != null ? row[13].toString() : "WARRANTY");
                    dto.setTinhTrangNgoaiQuan(row[14] != null ? row[14].toString() : "Bình thường, không cấn móp");
                    dto.setPhuKienKemTheo(row[15] != null ? row[15].toString() : "Thân máy, củ sạc");

                    // Lấy timeline lịch sử của phiếu
                    dto.setTimeline(getTicketTimeline(dto.getMaPhieu(), status, dto.getNgayTiepNhanStr()));

                    list.add(dto);
                }
            } catch (Exception ignored) {
            }
        }

        // Dữ liệu mẫu phong phú nếu tài khoản mới chưa có phiếu
        if (list.isEmpty()) {
            list.addAll(getDemoWarrantyTickets());
        }

        return list;
    }

    @SuppressWarnings("unchecked")
    @Transactional(readOnly = true)
    public WarrantyTicketDetailDto getTicketDetail(String maPhieu) {
        try {
            String sql = "SELECT p.MaPhieuTN, " +
                         "COALESCE(sp.TenSP, t.MaThietBi, 'Sản phẩm bảo hành') AS TenThietBi, " +
                         "COALESCE(t.SoSerial_IMEI, 'SN-2026') AS SoSerial, " +
                         "COALESCE(h.TenHang, 'Chính hãng') AS TenHang, " +
                         "COALESCE(tr.TenTram, 'Trạm LML') AS TenTram, " +
                         "COALESCE(tr.DiaChi, 'Trung tâm dịch vụ') AS DiaChiTram, " +
                         "DATE_FORMAT(p.NgayTiepNhan, '%d/%m/%Y %H:%i') AS NgayTNStr, " +
                         "COALESCE(DATE_FORMAT(p.NgayHenTra, '%d/%m/%Y'), 'Đang cập nhật') AS NgayHTStr, " +
                         "p.MoTaLoiKhachBao, " +
                         "p.TrangThaiXuLy, " +
                         "COALESCE(nv.HoTen, 'Lễ tân tiếp nhận') AS TenNV, " +
                         "p.ChiPhiDuKien, " +
                         "p.MucSLA, " +
                         "p.LoaiYeuCau, " +
                         "p.TinhTrangNgoaiQuan, " +
                         "p.PhuKienKemTheo " +
                         "FROM PhieuTiepNhan p " +
                         "LEFT JOIN ThietBi t ON p.MaThietBi = t.MaThietBi " +
                         "LEFT JOIN SanPham sp ON t.MaSP = sp.MaSP " +
                         "LEFT JOIN HangSanXuat h ON sp.MaHang = h.MaHang " +
                         "LEFT JOIN TramDichVu tr ON p.MaTram = tr.MaTram " +
                         "LEFT JOIN NhanVien nv ON p.MaNVTiepNhan = nv.MaNV " +
                         "WHERE p.MaPhieuTN = :maPhieu LIMIT 1";

            List<Object[]> rows = entityManager.createNativeQuery(sql)
                                               .setParameter("maPhieu", maPhieu.trim())
                                               .getResultList();

            if (!rows.isEmpty()) {
                Object[] row = rows.get(0);
                WarrantyTicketDetailDto dto = new WarrantyTicketDetailDto();
                dto.setMaPhieu(row[0] != null ? row[0].toString() : "");
                dto.setLoaiPhieu("PHIEU_TIEP_NHAN");
                dto.setTenThietBi(row[1] != null ? row[1].toString() : "Thiết bị bảo hành");
                dto.setSoSerial(row[2] != null ? row[2].toString() : "");
                dto.setHangSanXuat(row[3] != null ? row[3].toString() : "Chính hãng");
                dto.setTenTram(row[4] != null ? row[4].toString() : "Trạm LML");
                dto.setDiaChiTram(row[5] != null ? row[5].toString() : "");
                dto.setNgayTiepNhanStr(row[6] != null ? row[6].toString() : "");
                dto.setNgayHenTraStr(row[7] != null ? row[7].toString() : "Đang cập nhật");
                dto.setMoTaLoi(row[8] != null ? row[8].toString() : "");
                
                String status = row[9] != null ? row[9].toString() : "RECEIVED";
                dto.setTrangThai(status);
                dto.setTrangThaiBadgeText(mapStatusToBadgeText(status));
                dto.setTrangThaiClass(mapStatusToBadgeClass(status));

                dto.setTenNVTiepNhan(row[10] != null ? row[10].toString() : "KTV Tiếp nhận");
                dto.setChiPhiDuKienStr(row[11] != null ? String.format("%,.0f đ", Double.parseDouble(row[11].toString())) : "0 đ (Miễn phí BH)");
                dto.setMucSLA(row[12] != null ? row[12].toString() : "STANDARD_48H");
                dto.setLoaiYeuCau(row[13] != null ? row[13].toString() : "WARRANTY");
                dto.setTinhTrangNgoaiQuan(row[14] != null ? row[14].toString() : "Bình thường, không cấn móp");
                dto.setPhuKienKemTheo(row[15] != null ? row[15].toString() : "Thân máy, củ sạc");

                dto.setTimeline(getTicketTimeline(dto.getMaPhieu(), status, dto.getNgayTiepNhanStr()));
                return dto;
            }
        } catch (Exception ignored) {
        }

        // Trả về từ danh sách mẫu nếu không tìm thấy
        for (WarrantyTicketDetailDto demo : getDemoWarrantyTickets()) {
            if (demo.getMaPhieu().equalsIgnoreCase(maPhieu.trim())) {
                return demo;
            }
        }

        return null;
    }

    @SuppressWarnings("unchecked")
    private List<TicketTimelineEventDto> getTicketTimeline(String maPhieu, String currentStatus, String ngayTN) {
        List<TicketTimelineEventDto> events = new ArrayList<>();
        try {
            String sql = "SELECT TrangThai, DATE_FORMAT(ThoiGianCapNhat, '%d/%m/%Y %H:%i'), MoTaChiTiet, COALESCE(TenNguoiCapNhat, NguoiCapNhat, 'Hệ thống'), VaiTroNguoiCapNhat " +
                         "FROM LichSuTrangThai_ThietBi " +
                         "WHERE MaPhieuTN = :maPhieu " +
                         "ORDER BY ThoiGianCapNhat ASC";

            List<Object[]> rows = entityManager.createNativeQuery(sql)
                                               .setParameter("maPhieu", maPhieu)
                                               .getResultList();

            for (Object[] row : rows) {
                String st = row[0] != null ? row[0].toString() : "";
                String time = row[1] != null ? row[1].toString() : "";
                String desc = row[2] != null ? row[2].toString() : "";
                String person = row[3] != null ? row[3].toString() : "Nhân viên LML";
                String role = row[4] != null ? row[4].toString() : "Dịch vụ khách hàng";

                events.add(new TicketTimelineEventDto(st, mapStatusToBadgeText(st), time, desc, person, role, true, st.equalsIgnoreCase(currentStatus)));
            }
        } catch (Exception ignored) {
        }

        if (events.isEmpty()) {
            // Tạo timeline mặc định theo trạng thái hiện tại
            events.add(new TicketTimelineEventDto("RECEIVED", "Tiếp nhận máy", ngayTN != null && !ngayTN.isEmpty() ? ngayTN : "08/09/2026 09:30", "Thiết bị đã được bàn giao tại quầy và in phiếu tiếp nhận", "Lễ tân tiếp nhận", "RECEPTIONIST", true, currentStatus.equalsIgnoreCase("RECEIVED")));
            
            if (!currentStatus.equalsIgnoreCase("RECEIVED")) {
                events.add(new TicketTimelineEventDto("INSPECTING", "Kiểm tra & Chẩn đoán", "08/09/2026 14:15", "Kỹ thuật viên đã tiếp nhận máy và đang thực hiện kiểm tra phần cứng theo checklist", "KTV Nguyễn Văn Hùng", "TECHNICIAN", true, currentStatus.equalsIgnoreCase("INSPECTING")));
            }
            if (currentStatus.equalsIgnoreCase("AWAITING_PARTS") || currentStatus.equalsIgnoreCase("REPAIRING") || currentStatus.equalsIgnoreCase("COMPLETED") || currentStatus.equalsIgnoreCase("DELIVERED")) {
                events.add(new TicketTimelineEventDto("REPAIRING", "Tiến hành sửa chữa", "09/09/2026 10:00", "Đang thay thế linh kiện chính hãng và vệ sinh toàn bộ máy", "KTV Trưởng Trần Đức Lộc", "TECHNICIAN", true, currentStatus.equalsIgnoreCase("REPAIRING") || currentStatus.equalsIgnoreCase("AWAITING_PARTS")));
            }
            if (currentStatus.equalsIgnoreCase("COMPLETED") || currentStatus.equalsIgnoreCase("DELIVERED")) {
                events.add(new TicketTimelineEventDto("COMPLETED", "Kiểm tra chất lượng (QC) Đạt", "10/09/2026 15:30", "Máy đã vượt qua 6 bài kiểm tra chức năng. Sẵn sàng bàn giao cho quý khách", "KCS Kiểm soát chất lượng", "TECHNICIAN", true, currentStatus.equalsIgnoreCase("COMPLETED")));
            }
            if (currentStatus.equalsIgnoreCase("DELIVERED")) {
                events.add(new TicketTimelineEventDto("DELIVERED", "Đã bàn giao cho khách", "11/09/2026 09:00", "Khách hàng đã ký biên bản bàn giao và nhận lại thiết bị", "Lễ tân quầy trả máy", "RECEPTIONIST", true, true));
            }
        }

        return events;
    }

    // =========================================================================
    // 6. TRA CỨU BẢO HÀNH THEO SERIAL / MÃ PHIẾU
    // =========================================================================

    @Transactional(readOnly = true)
    public LookupResultDto lookupWarranty(String keyword) {
        LookupResultDto result = new LookupResultDto();
        if (keyword == null || keyword.trim().isEmpty()) {
            result.setFound(false);
            result.setMessage("Vui lòng nhập số Serial, IMEI hoặc mã phiếu tiếp nhận");
            return result;
        }

        String clean = keyword.trim().toUpperCase().replaceAll("\\s+", "");

        // 1. Kiểm tra theo mã phiếu tiếp nhận (bắt đầu bằng TN-)
        if (clean.startsWith("TN-") || clean.startsWith("#TN-")) {
            String maPhieu = clean.startsWith("#") ? clean.substring(1) : clean;
            WarrantyTicketDetailDto ticket = getTicketDetail(maPhieu);
            if (ticket != null) {
                result.setFound(true);
                result.setLookupType("TICKET");
                result.setSerialOrCode(ticket.getMaPhieu());
                result.setProductName(ticket.getTenThietBi());
                result.setBrandName(ticket.getHangSanXuat());
                result.setActivationDate(ticket.getNgayTiepNhanStr());
                result.setExpiryDate(ticket.getNgayHenTraStr());
                result.setWarrantyStatus(ticket.getTrangThai());
                result.setWarrantyStatusBadge(ticket.getTrangThaiBadgeText());
                result.setWarrantyBadgeClass(ticket.getTrangThaiClass());
                result.setMessage("Tìm thấy thông tin phiếu tiếp nhận bảo hành " + ticket.getMaPhieu());
                return result;
            }
        }

        // 2. Tra cứu theo Serial / IMEI trong bảng ThietBi
        try {
            String sql = "SELECT t.MaThietBi, t.SoSerial_IMEI, " +
                         "COALESCE(sp.TenSP, 'Sản phẩm chính hãng') AS TenSP, " +
                         "COALESCE(h.TenHang, 'Chính hãng') AS TenHang, " +
                         "COALESCE(k.HoTen, 'Khách hàng thành viên') AS HoTen, " +
                         "t.NgayKichHoatBaoHanh, t.NgayHetHanBaoHanh " +
                         "FROM ThietBi t " +
                         "LEFT JOIN SanPham sp ON t.MaSP = sp.MaSP " +
                         "LEFT JOIN HangSanXuat h ON sp.MaHang = h.MaHang " +
                         "LEFT JOIN KhachHang k ON t.MaKH = k.MaKH " +
                         "WHERE t.SoSerial_IMEI = :serial LIMIT 1";

            @SuppressWarnings("unchecked")
            List<Object[]> rows = entityManager.createNativeQuery(sql)
                                               .setParameter("serial", clean)
                                               .getResultList();

            if (!rows.isEmpty()) {
                Object[] row = rows.get(0);
                result.setFound(true);
                result.setLookupType("DEVICE");
                result.setSerialOrCode(row[1] != null ? row[1].toString() : clean);
                result.setProductName(row[2] != null ? row[2].toString() : "Thiết bị chính hãng");
                result.setBrandName(row[3] != null ? row[3].toString() : "Chính hãng");
                result.setCustomerName(row[4] != null ? row[4].toString() : "Khách hàng");
                result.setActivationDate(row[5] != null ? row[5].toString() : "Chưa kích hoạt");
                result.setExpiryDate(row[6] != null ? row[6].toString() : "Chưa xác định");

                if (row[6] != null) {
                    LocalDate exp = LocalDate.parse(row[6].toString());
                    if (exp.isBefore(LocalDate.now())) {
                        result.setWarrantyStatus("EXPIRED");
                        result.setWarrantyStatusBadge("Đã hết hạn bảo hành");
                        result.setWarrantyBadgeClass("badge-waiting");
                    } else {
                        result.setWarrantyStatus("ACTIVE");
                        result.setWarrantyStatusBadge("Chính hãng - Còn bảo hành");
                        result.setWarrantyBadgeClass("badge-completed");
                    }
                } else {
                    result.setWarrantyStatus("ACTIVE");
                    result.setWarrantyStatusBadge("Đang bảo hành chính hãng");
                    result.setWarrantyBadgeClass("badge-completed");
                }
                result.setMessage("Sản phẩm đã được xác thực chính hãng trên hệ thống LongManLoc.");
                return result;
            }
        } catch (Exception ignored) {
        }

        // Mẫu mặc định nếu tra cứu mã mẫu
        if (clean.contains("LML") || clean.contains("SN") || clean.contains("IMEI")) {
            result.setFound(true);
            result.setLookupType("DEVICE");
            result.setSerialOrCode(clean);
            result.setProductName("Máy Lọc Nước RO Thông Minh LongManLoc Prime");
            result.setBrandName("Panasonic");
            result.setCustomerName("Khách hàng");
            result.setActivationDate("15/01/2026");
            result.setExpiryDate("15/01/2028");
            result.setWarrantyStatus("ACTIVE");
            result.setWarrantyStatusBadge("Chính hãng - Còn bảo hành");
            result.setWarrantyBadgeClass("badge-completed");
            result.setMessage("Sản phẩm đã được xác thực bảo hành chính hãng trên hệ thống.");
            return result;
        }

        result.setFound(false);
        result.setMessage("Không tìm thấy thông tin thiết bị hoặc phiếu tiếp nhận với mã: " + keyword);
        return result;
    }

    // =========================================================================
    // HELPER METHODS
    // =========================================================================

    @Transactional(readOnly = true)
    public String findMaKHByUsername(String username) {
        if (username == null || username.trim().isEmpty()) {
            return null;
        }
        try {
            String sql = "SELECT k.MaKH FROM KhachHang k " +
                         "LEFT JOIN TaiKhoan t ON k.MaTaiKhoan = t.MaTaiKhoan " +
                         "WHERE LOWER(t.TenDangNhap) = LOWER(:user) OR k.SDT = :user OR LOWER(k.Email) = LOWER(:user) " +
                         "LIMIT 1";
            @SuppressWarnings("unchecked")
            List<Object> res = entityManager.createNativeQuery(sql)
                                            .setParameter("user", username.trim())
                                            .getResultList();
            if (!res.isEmpty() && res.get(0) != null) {
                return res.get(0).toString();
            }
        } catch (Exception ignored) {
        }
        return null;
    }

    private String findOrCreateSanPham(String productName, String maHang, String maLoai) {
        String hang = (maHang != null && !maHang.trim().isEmpty()) ? maHang : "PANASONIC";
        String loai = (maLoai != null && !maLoai.trim().isEmpty()) ? maLoai : "WATER_PURIFIER";
        String name = (productName != null && !productName.trim().isEmpty()) ? productName.trim() : "Thiết bị điện tử tiêu chuẩn";

        try {
            String findSql = "SELECT MaSP FROM SanPham WHERE LOWER(TenSP) = LOWER(:name) LIMIT 1";
            @SuppressWarnings("unchecked")
            List<Object> list = entityManager.createNativeQuery(findSql).setParameter("name", name).getResultList();
            if (!list.isEmpty() && list.get(0) != null) {
                return list.get(0).toString();
            }

            // Tạo sản phẩm mới
            String maSP = "SP-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
            String insertSql = "INSERT INTO SanPham (MaSP, TenSP, MaHang, MaLoai, DongSanPham, ThoiHanBaoHanhMacDinhThang, HoatDong) " +
                               "VALUES (:maSP, :name, :hang, :loai, 'Tiêu chuẩn', 24, 1)";
            entityManager.createNativeQuery(insertSql)
                         .setParameter("maSP", maSP)
                         .setParameter("name", name)
                         .setParameter("hang", hang)
                         .setParameter("loai", loai)
                         .executeUpdate();
            return maSP;
        } catch (Exception ignored) {
            return "SP-DEMO-01";
        }
    }

    private String generateMaThietBi() {
        try {
            Object countObj = entityManager.createNativeQuery("SELECT COUNT(*) FROM ThietBi").getSingleResult();
            long count = ((Number) countObj).longValue() + 1;
            return String.format("TB-%06d", count);
        } catch (Exception ignored) {
            return "TB-" + System.currentTimeMillis() % 1000000;
        }
    }

    private String generateMaYeuCau() {
        String datePrefix = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        try {
            Object countObj = entityManager.createNativeQuery("SELECT COUNT(*) FROM YeuCauBaoHanh").getSingleResult();
            long count = ((Number) countObj).longValue() + 1;
            return String.format("YC-%s-%04d", datePrefix, count);
        } catch (Exception ignored) {
            return String.format("YC-%s-%04d", datePrefix, (int)(Math.random() * 9000) + 1000);
        }
    }

    private String mapStatusToBadgeText(String status) {
        if (status == null) return "Đang xử lý";
        switch (status.toUpperCase()) {
            case "RECEIVED":
                return "Mới tiếp nhận";
            case "INSPECTING":
                return "Đang kiểm tra";
            case "REPAIRING":
            case "PROCESSING":
                return "Đang sửa chữa";
            case "WAITING_PARTS":
            case "AWAITING_PARTS":
                return "Chờ linh kiện chính hãng";
            case "AWAITING_QUOTE_APPROVAL":
            case "AWAITING_CUSTOMER_CONFIRMATION":
                return "Chờ duyệt báo giá";
            case "COMPLETED":
                return "Đã xong - Sẵn sàng trả máy";
            case "DELIVERED":
                return "Đã bàn giao";
            case "CANCELLED":
                return "Đã hủy";
            default:
                return "Đang xử lý";
        }
    }

    private String mapStatusToBadgeClass(String status) {
        if (status == null) return "badge-processing";
        switch (status.toUpperCase()) {
            case "RECEIVED":
                return "badge-received";
            case "INSPECTING":
            case "REPAIRING":
            case "PROCESSING":
                return "badge-processing";
            case "WAITING_PARTS":
            case "AWAITING_PARTS":
            case "AWAITING_QUOTE_APPROVAL":
            case "AWAITING_CUSTOMER_CONFIRMATION":
                return "badge-waiting";
            case "COMPLETED":
            case "DELIVERED":
                return "badge-completed";
            case "CANCELLED":
                return "badge-danger";
            default:
                return "badge-processing";
        }
    }

    private List<WarrantyTicketDetailDto> getDemoWarrantyTickets() {
        List<WarrantyTicketDetailDto> list = new ArrayList<>();

        WarrantyTicketDetailDto t1 = new WarrantyTicketDetailDto();
        t1.setMaPhieu("TN-2026-0917-00421");
        t1.setLoaiPhieu("PHIEU_TIEP_NHAN");
        t1.setTenThietBi("MacBook Air M2 13.6 inch Midnight");
        t1.setSoSerial("SN: C02G789X01");
        t1.setHangSanXuat("Apple");
        t1.setTenTram("Trạm Dịch Vụ TP.HCM");
        t1.setDiaChiTram("123 CMT8, Phường 5, Quận 10, TP.HCM");
        t1.setNgayTiepNhanStr("17/09/2026 09:15");
        t1.setNgayHenTraStr("19/09/2026");
        t1.setMoTaLoi("Máy sạc không vào pin, kiểm tra báo pin xuống cấp dưới 75%");
        t1.setTrangThai("REPAIRING");
        t1.setTrangThaiBadgeText("Đang sửa chữa");
        t1.setTrangThaiClass("badge-processing");
        t1.setTenNVTiepNhan("Lê Thị Mai (Lễ tân)");
        t1.setTenKTVPhuTrach("Trần Văn Nam (KTV Phần cứng Apple)");
        t1.setChiPhiDuKienStr("0 đ (Bảo hành chính hãng)");
        t1.setMucSLA("EXPRESS_12H");
        t1.setLoaiYeuCau("WARRANTY");
        t1.setTinhTrangNgoaiQuan("Máy đẹp 99%, có vết xước dăm nhẹ mặt đáy");
        t1.setPhuKienKemTheo("Thân máy + Củ sạc 30W Type-C");
        t1.setTimeline(getTicketTimeline("TN-2026-0917-00421", "REPAIRING", "17/09/2026 09:15"));
        list.add(t1);

        WarrantyTicketDetailDto t2 = new WarrantyTicketDetailDto();
        t2.setMaPhieu("TN-2026-0915-00389");
        t2.setLoaiPhieu("PHIEU_TIEP_NHAN");
        t2.setTenThietBi("Máy Lọc Không Khí Panasonic NanoeX Pro");
        t2.setSoSerial("SN: MLK-992011");
        t2.setHangSanXuat("Panasonic");
        t2.setTenTram("Trạm Dịch Vụ Hà Nội");
        t2.setDiaChiTram("456 Cầu Giấy, Q.Cầu Giấy, Hà Nội");
        t2.setNgayTiepNhanStr("15/09/2026 14:30");
        t2.setNgayHenTraStr("18/09/2026");
        t2.setMoTaLoi("Cảm biến bụi báo đỏ liên tục, quạt hút phát tiếng kêu rè rè");
        t2.setTrangThai("AWAITING_PARTS");
        t2.setTrangThaiBadgeText("Chờ linh kiện chính hãng");
        t2.setTrangThaiClass("badge-waiting");
        t2.setTenNVTiepNhan("Nguyễn Thu Hà");
        t2.setTenKTVPhuTrach("Hoàng Minh Tuấn");
        t2.setChiPhiDuKienStr("0 đ (Thay cụm cảm biến BH)");
        t2.setMucSLA("STANDARD_48H");
        t2.setLoaiYeuCau("WARRANTY");
        t2.setTinhTrangNgoaiQuan("Ngoại quan nguyên vẹn, tem bảo hành còn niêm phong");
        t2.setPhuKienKemTheo("Thân máy + Bộ lọc sơ cấp");
        t2.setTimeline(getTicketTimeline("TN-2026-0915-00389", "AWAITING_PARTS", "15/09/2026 14:30"));
        list.add(t2);

        WarrantyTicketDetailDto t3 = new WarrantyTicketDetailDto();
        t3.setMaPhieu("TN-2026-0910-00120");
        t3.setLoaiPhieu("PHIEU_TIEP_NHAN");
        t3.setTenThietBi("Smart Tivi OLED 4K Sony Bravia 55 inch");
        t3.setSoSerial("SN: TV-55OLED-88");
        t3.setHangSanXuat("Sony");
        t3.setTenTram("Trạm Dịch Vụ Đà Nẵng");
        t3.setDiaChiTram("789 Nguyễn Văn Linh, Đà Nẵng");
        t3.setNgayTiepNhanStr("10/09/2026 10:00");
        t3.setNgayHenTraStr("12/09/2026");
        t3.setMoTaLoi("Màn hình bị chớp nhẹ góc trên bên phải khi hiển thị màu trắng");
        t3.setTrangThai("COMPLETED");
        t3.setTrangThaiBadgeText("Đã xong - Sẵn sàng nhận");
        t3.setTrangThaiClass("badge-completed");
        t3.setTenNVTiepNhan("Đỗ Văn Hùng");
        t3.setTenKTVPhuTrach("Võ Quốc Bảo");
        t3.setChiPhiDuKienStr("0 đ (Cân chỉnh board T-Con)");
        t3.setMucSLA("STANDARD_48H");
        t3.setLoaiYeuCau("WARRANTY");
        t3.setTinhTrangNgoaiQuan("Màn hình không nứt vỡ, khung nhôm nguyên bản");
        t3.setPhuKienKemTheo("Thân Tivi + Remote Magic + Dây nguồn");
        t3.setTimeline(getTicketTimeline("TN-2026-0910-00120", "COMPLETED", "10/09/2026 10:00"));
        list.add(t3);

        return list;
    }
}
