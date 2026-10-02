package com.example.weblongmanloc.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "TaiKhoan")
public class TaiKhoan {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "MaTaiKhoan")
    private Long maTaiKhoan;

    @Column(name = "TenDangNhap", length = 50, nullable = false)
    private String tenDangNhap;

    @Column(name = "MatKhauHash", length = 255, nullable = false)
    private String matKhauHash;

    @Column(name = "LoaiChuThe", length = 20, nullable = false)
    private String loaiChuThe = "CUSTOMER";

    @Column(name = "TrangThai", length = 20, nullable = false)
    private String trangThai = "ACTIVE";

    @Column(name = "SoLanSaiLienTiep", nullable = false)
    private Integer soLanSaiLienTiep = 0;

    @Column(name = "KhoaTamDen")
    private LocalDateTime khoaTamDen;

    @Column(name = "BatBuocDoiMatKhau", nullable = false)
    private Boolean batBuocDoiMatKhau = false;

    @Column(name = "PhienBanBaoMat", nullable = false)
    private Integer phienBanBaoMat = 1;

    @Column(name = "LanDangNhapCuoi")
    private LocalDateTime lanDangNhapCuoi;

    @Column(name = "NgayDoiMatKhau")
    private LocalDateTime ngayDoiMatKhau;

    @Column(name = "NgayTao", nullable = false, updatable = false)
    private LocalDateTime ngayTao = LocalDateTime.now();

    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(
        name = "TaiKhoan_VaiTro",
        joinColumns = @JoinColumn(name = "MaTaiKhoan"),
        inverseJoinColumns = @JoinColumn(name = "MaVaiTro")
    )
    private Set<VaiTro> vaiTros = new HashSet<>();

    public TaiKhoan() {
    }

    public Long getMaTaiKhoan() {
        return maTaiKhoan;
    }

    public void setMaTaiKhoan(Long maTaiKhoan) {
        this.maTaiKhoan = maTaiKhoan;
    }

    public String getTenDangNhap() {
        return tenDangNhap;
    }

    public void setTenDangNhap(String tenDangNhap) {
        this.tenDangNhap = tenDangNhap;
    }

    public String getMatKhauHash() {
        return matKhauHash;
    }

    public void setMatKhauHash(String matKhauHash) {
        this.matKhauHash = matKhauHash;
    }

    public String getLoaiChuThe() {
        return loaiChuThe;
    }

    public void setLoaiChuThe(String loaiChuThe) {
        this.loaiChuThe = loaiChuThe;
    }

    public String getTrangThai() {
        return trangThai;
    }

    public void setTrangThai(String trangThai) {
        this.trangThai = trangThai;
    }

    public Integer getSoLanSaiLienTiep() {
        return soLanSaiLienTiep;
    }

    public void setSoLanSaiLienTiep(Integer soLanSaiLienTiep) {
        this.soLanSaiLienTiep = soLanSaiLienTiep;
    }

    public LocalDateTime getKhoaTamDen() {
        return khoaTamDen;
    }

    public void setKhoaTamDen(LocalDateTime khoaTamDen) {
        this.khoaTamDen = khoaTamDen;
    }

    public Boolean getBatBuocDoiMatKhau() {
        return batBuocDoiMatKhau;
    }

    public void setBatBuocDoiMatKhau(Boolean batBuocDoiMatKhau) {
        this.batBuocDoiMatKhau = batBuocDoiMatKhau;
    }

    public Integer getPhienBanBaoMat() {
        return phienBanBaoMat;
    }

    public void setPhienBanBaoMat(Integer phienBanBaoMat) {
        this.phienBanBaoMat = phienBanBaoMat;
    }

    public LocalDateTime getLanDangNhapCuoi() {
        return lanDangNhapCuoi;
    }

    public void setLanDangNhapCuoi(LocalDateTime lanDangNhapCuoi) {
        this.lanDangNhapCuoi = lanDangNhapCuoi;
    }

    public LocalDateTime getNgayDoiMatKhau() {
        return ngayDoiMatKhau;
    }

    public void setNgayDoiMatKhau(LocalDateTime ngayDoiMatKhau) {
        this.ngayDoiMatKhau = ngayDoiMatKhau;
    }

    public LocalDateTime getNgayTao() {
        return ngayTao;
    }

    public void setNgayTao(LocalDateTime ngayTao) {
        this.ngayTao = ngayTao;
    }

    public Set<VaiTro> getVaiTros() {
        return vaiTros;
    }

    public void setVaiTros(Set<VaiTro> vaiTros) {
        this.vaiTros = vaiTros;
    }
}
