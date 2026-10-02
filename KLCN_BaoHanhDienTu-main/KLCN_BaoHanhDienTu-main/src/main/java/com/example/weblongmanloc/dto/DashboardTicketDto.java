package com.example.weblongmanloc.dto;

public class DashboardTicketDto {

    private String maPhieu;
    private String tenThietBi;
    private String soSerial;
    private String tenTram;
    private String ngayTiepNhanStr;
    private String ngayHenTraStr;
    private String moTaLoi;
    private String trangThai;
    private String trangThaiBadgeText;
    private String trangThaiClass;

    public DashboardTicketDto() {
    }

    public DashboardTicketDto(String maPhieu, String tenThietBi, String soSerial, String tenTram, String ngayTiepNhanStr, String ngayHenTraStr, String moTaLoi, String trangThai, String trangThaiBadgeText, String trangThaiClass) {
        this.maPhieu = maPhieu;
        this.tenThietBi = tenThietBi;
        this.soSerial = soSerial;
        this.tenTram = tenTram;
        this.ngayTiepNhanStr = ngayTiepNhanStr;
        this.ngayHenTraStr = ngayHenTraStr;
        this.moTaLoi = moTaLoi;
        this.trangThai = trangThai;
        this.trangThaiBadgeText = trangThaiBadgeText;
        this.trangThaiClass = trangThaiClass;
    }

    public String getMaPhieu() {
        return maPhieu;
    }

    public void setMaPhieu(String maPhieu) {
        this.maPhieu = maPhieu;
    }

    public String getTenThietBi() {
        return tenThietBi;
    }

    public void setTenThietBi(String tenThietBi) {
        this.tenThietBi = tenThietBi;
    }

    public String getSoSerial() {
        return soSerial;
    }

    public void setSoSerial(String soSerial) {
        this.soSerial = soSerial;
    }

    public String getTenTram() {
        return tenTram;
    }

    public void setTenTram(String tenTram) {
        this.tenTram = tenTram;
    }

    public String getNgayTiepNhanStr() {
        return ngayTiepNhanStr;
    }

    public void setNgayTiepNhanStr(String ngayTiepNhanStr) {
        this.ngayTiepNhanStr = ngayTiepNhanStr;
    }

    public String getNgayHenTraStr() {
        return ngayHenTraStr;
    }

    public void setNgayHenTraStr(String ngayHenTraStr) {
        this.ngayHenTraStr = ngayHenTraStr;
    }

    public String getMoTaLoi() {
        return moTaLoi;
    }

    public void setMoTaLoi(String moTaLoi) {
        this.moTaLoi = moTaLoi;
    }

    public String getTrangThai() {
        return trangThai;
    }

    public void setTrangThai(String trangThai) {
        this.trangThai = trangThai;
    }

    public String getTrangThaiBadgeText() {
        return trangThaiBadgeText;
    }

    public void setTrangThaiBadgeText(String trangThaiBadgeText) {
        this.trangThaiBadgeText = trangThaiBadgeText;
    }

    public String getTrangThaiClass() {
        return trangThaiClass;
    }

    public void setTrangThaiClass(String trangThaiClass) {
        this.trangThaiClass = trangThaiClass;
    }
}
