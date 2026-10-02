package com.example.weblongmanloc.dto;

import java.util.ArrayList;
import java.util.List;

public class WarrantyTicketDetailDto {

    private String maPhieu;
    private String loaiPhieu; // "PHIEU_TIEP_NHAN" or "YEU_CAU_ONLINE"
    private String maThietBi;
    private String tenThietBi;
    private String soSerial;
    private String hangSanXuat;
    private String loaiThietBi;
    private String ngayTiepNhanStr;
    private String ngayHenTraStr;
    private String tenTram;
    private String diaChiTram;
    private String tenNVTiepNhan;
    private String tenKTVPhuTrach;
    private String moTaLoi;
    private String tinhTrangNgoaiQuan;
    private String phuKienKemTheo;
    private String mucSLA;
    private String hanSLAStr;
    private String loaiYeuCau;
    private String chiPhiDuKienStr;
    private String trangThai;
    private String trangThaiBadgeText;
    private String trangThaiClass;

    // Timeline events
    private List<TicketTimelineEventDto> timeline = new ArrayList<>();

    public WarrantyTicketDetailDto() {
    }

    public String getMaPhieu() {
        return maPhieu;
    }

    public void setMaPhieu(String maPhieu) {
        this.maPhieu = maPhieu;
    }

    public String getLoaiPhieu() {
        return loaiPhieu;
    }

    public void setLoaiPhieu(String loaiPhieu) {
        this.loaiPhieu = loaiPhieu;
    }

    public String getMaThietBi() {
        return maThietBi;
    }

    public void setMaThietBi(String maThietBi) {
        this.maThietBi = maThietBi;
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

    public String getTenTram() {
        return tenTram;
    }

    public void setTenTram(String tenTram) {
        this.tenTram = tenTram;
    }

    public String getDiaChiTram() {
        return diaChiTram;
    }

    public void setDiaChiTram(String diaChiTram) {
        this.diaChiTram = diaChiTram;
    }

    public String getTenNVTiepNhan() {
        return tenNVTiepNhan;
    }

    public void setTenNVTiepNhan(String tenNVTiepNhan) {
        this.tenNVTiepNhan = tenNVTiepNhan;
    }

    public String getTenKTVPhuTrach() {
        return tenKTVPhuTrach;
    }

    public void setTenKTVPhuTrach(String tenKTVPhuTrach) {
        this.tenKTVPhuTrach = tenKTVPhuTrach;
    }

    public String getMoTaLoi() {
        return moTaLoi;
    }

    public void setMoTaLoi(String moTaLoi) {
        this.moTaLoi = moTaLoi;
    }

    public String getTinhTrangNgoaiQuan() {
        return tinhTrangNgoaiQuan;
    }

    public void setTinhTrangNgoaiQuan(String tinhTrangNgoaiQuan) {
        this.tinhTrangNgoaiQuan = tinhTrangNgoaiQuan;
    }

    public String getPhuKienKemTheo() {
        return phuKienKemTheo;
    }

    public void setPhuKienKemTheo(String phuKienKemTheo) {
        this.phuKienKemTheo = phuKienKemTheo;
    }

    public String getMucSLA() {
        return mucSLA;
    }

    public void setMucSLA(String mucSLA) {
        this.mucSLA = mucSLA;
    }

    public String getHanSLAStr() {
        return hanSLAStr;
    }

    public void setHanSLAStr(String hanSLAStr) {
        this.hanSLAStr = hanSLAStr;
    }

    public String getLoaiYeuCau() {
        return loaiYeuCau;
    }

    public void setLoaiYeuCau(String loaiYeuCau) {
        this.loaiYeuCau = loaiYeuCau;
    }

    public String getChiPhiDuKienStr() {
        return chiPhiDuKienStr;
    }

    public void setChiPhiDuKienStr(String chiPhiDuKienStr) {
        this.chiPhiDuKienStr = chiPhiDuKienStr;
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

    public List<TicketTimelineEventDto> getTimeline() {
        return timeline;
    }

    public void setTimeline(List<TicketTimelineEventDto> timeline) {
        this.timeline = timeline;
    }
}
