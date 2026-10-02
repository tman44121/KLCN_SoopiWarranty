package com.example.weblongmanloc.dto;

public class TicketTimelineEventDto {

    private String trangThai;
    private String trangThaiText;
    private String thoiGianStr;
    private String moTa;
    private String nguoiCapNhat;
    private String vaiTro;
    private boolean isCompleted;
    private boolean isCurrent;

    public TicketTimelineEventDto() {
    }

    public TicketTimelineEventDto(String trangThai, String trangThaiText, String thoiGianStr, String moTa, String nguoiCapNhat, String vaiTro, boolean isCompleted, boolean isCurrent) {
        this.trangThai = trangThai;
        this.trangThaiText = trangThaiText;
        this.thoiGianStr = thoiGianStr;
        this.moTa = moTa;
        this.nguoiCapNhat = nguoiCapNhat;
        this.vaiTro = vaiTro;
        this.isCompleted = isCompleted;
        this.isCurrent = isCurrent;
    }

    public String getTrangThai() {
        return trangThai;
    }

    public void setTrangThai(String trangThai) {
        this.trangThai = trangThai;
    }

    public String getTrangThaiText() {
        return trangThaiText;
    }

    public void setTrangThaiText(String trangThaiText) {
        this.trangThaiText = trangThaiText;
    }

    public String getThoiGianStr() {
        return thoiGianStr;
    }

    public void setThoiGianStr(String thoiGianStr) {
        this.thoiGianStr = thoiGianStr;
    }

    public String getMoTa() {
        return moTa;
    }

    public void setMoTa(String moTa) {
        this.moTa = moTa;
    }

    public String getNguoiCapNhat() {
        return nguoiCapNhat;
    }

    public void setNguoiCapNhat(String nguoiCapNhat) {
        this.nguoiCapNhat = nguoiCapNhat;
    }

    public String getVaiTro() {
        return vaiTro;
    }

    public void setVaiTro(String vaiTro) {
        this.vaiTro = vaiTro;
    }

    public boolean isCompleted() {
        return isCompleted;
    }

    public void setCompleted(boolean completed) {
        isCompleted = completed;
    }

    public boolean isCurrent() {
        return isCurrent;
    }

    public void setCurrent(boolean current) {
        isCurrent = current;
    }
}
