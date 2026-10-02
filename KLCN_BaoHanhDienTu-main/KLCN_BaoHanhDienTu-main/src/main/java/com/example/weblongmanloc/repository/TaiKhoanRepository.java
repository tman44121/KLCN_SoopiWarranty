package com.example.weblongmanloc.repository;

import com.example.weblongmanloc.entity.TaiKhoan;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface TaiKhoanRepository extends JpaRepository<TaiKhoan, Long> {

    Optional<TaiKhoan> findByTenDangNhap(String tenDangNhap);

    boolean existsByTenDangNhap(String tenDangNhap);

    @Query("SELECT t FROM TaiKhoan t WHERE LOWER(t.tenDangNhap) = LOWER(:loginIdentifier)")
    Optional<TaiKhoan> findByTenDangNhapIgnoreCase(@Param("loginIdentifier") String loginIdentifier);

    @Query("SELECT k.taiKhoan FROM KhachHang k WHERE (k.sdt = :loginIdentifier OR LOWER(k.email) = LOWER(:loginIdentifier)) AND k.taiKhoan IS NOT NULL")
    Optional<TaiKhoan> findByKhachHangContactInfo(@Param("loginIdentifier") String loginIdentifier);

    @Query("SELECT n.taiKhoan FROM NhanVien n WHERE (n.sdt = :loginIdentifier OR LOWER(n.email) = LOWER(:loginIdentifier)) AND n.taiKhoan IS NOT NULL")
    Optional<TaiKhoan> findByNhanVienContactInfo(@Param("loginIdentifier") String loginIdentifier);
}
