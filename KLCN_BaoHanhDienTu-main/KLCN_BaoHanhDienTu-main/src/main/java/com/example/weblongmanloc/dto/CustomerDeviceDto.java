package com.example.weblongmanloc.dto;

public class CustomerDeviceDto {

    private String maThietBi;
    private String soSerial;
    private String tenSP;
    private String hangSanXuat;
    private String loaiThietBi;
    private String ngayKichHoatStr;
    private String ngayHetHanStr;
    private String nhaPhanPhoi;
    private String trangThaiBaoHanh; // "CON_HAN", "SAP_HET_HAN", "HET_HAN"
    private String trangThaiBadgeText;
    private String trangThaiBadgeClass;

    public CustomerDeviceDto() {
    }

    public CustomerDeviceDto(String maThietBi, String soSerial, String tenSP, String hangSanXuat, String loaiThietBi, String ngayKichHoatStr, String ngayHetHanStr, String nhaPhanPhoi, String trangThaiBaoHanh, String trangThaiBadgeText, String trangThaiBadgeClass) {
        this.maThietBi = maThietBi;
        this.soSerial = soSerial;
        this.tenSP = tenSP;
        this.hangSanXuat = hangSanXuat;
        this.loaiThietBi = loaiThietBi;
        this.ngayKichHoatStr = ngayKichHoatStr;
        this.ngayHetHanStr = ngayHetHanStr;
        this.nhaPhanPhoi = nhaPhanPhoi;
        this.trangThaiBaoHanh = trangThaiBaoHanh;
        this.trangThaiBadgeText = trangThaiBadgeText;
        this.trangThaiBadgeClass = trangThaiBadgeClass;
    }

    public String getMaThietBi() {
        return maThietBi;
    }

    public void setMaThietBi(String maThietBi) {
        this.maThietBi = maThietBi;
    }

    public String getSoSerial() {
        return soSerial;
    }

    public void setSoSerial(String soSerial) {
        this.soSerial = soSerial;
    }

    public String getTenSP() {
        return tenSP;
    }

    public void setTenSP(String tenSP) {
        this.tenSP = tenSP;
    }

    public String getHangSanXuat() {
        return hangSanXuat;
    }

    public void setHangSanXuat(String hangSanXuat) {
        this.hangSanXuat = hangSanXuat;
    }

    public String getLoaiThietBi() {
        return loaiThietBi;
    }

    public void setLoaiThietBi(String loaiThietBi) {
        this.loaiThietBi = loaiThietBi;
    }

    public String getNgayKichHoatStr() {
        return ngayKichHoatStr;
    }

    public void setNgayKichHoatStr(String ngayKichHoatStr) {
        this.ngayKichHoatStr = ngayKichHoatStr;
    }

    public String getNgayHetHanStr() {
        return ngayHetHanStr;
    }

    public void setNgayHetHanStr(String ngayHetHanStr) {
        this.ngayHetHanStr = ngayHetHanStr;
    }

    public String getNhaPhanPhoi() {
        return nhaPhanPhoi;
    }

    public void setNhaPhanPhoi(String nhaPhanPhoi) {
        this.nhaPhanPhoi = nhaPhanPhoi;
    }

    public String getTrangThaiBaoHanh() {
        return trangThaiBaoHanh;
    }

    public void setTrangThaiBaoHanh(String trangThaiBaoHanh) {
        this.trangThaiBaoHanh = trangThaiBaoHanh;
    }

    public String getTrangThaiBadgeText() {
        return trangThaiBadgeText;
    }

    public void setTrangThaiBadgeText(String trangThaiBadgeText) {
        this.trangThaiBadgeText = trangThaiBadgeText;
    }

    public String getTrangThaiBadgeClass() {
        return trangThaiBadgeClass;
    }

    public void setTrangThaiBadgeClass(String trangThaiBadgeClass) {
        this.trangThaiBadgeClass = trangThaiBadgeClass;
    }
}
