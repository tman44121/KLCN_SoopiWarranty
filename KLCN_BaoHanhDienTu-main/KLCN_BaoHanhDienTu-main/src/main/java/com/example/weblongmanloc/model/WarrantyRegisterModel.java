package com.example.weblongmanloc.model;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class WarrantyRegisterModel {

    // Tab / Mode: "ACTIVATE" (Kích hoạt thiết bị) or "ONLINE_REQUEST" (Yêu cầu sửa chữa/bảo hành)
    private String formMode = "ACTIVATE";

    // 1. Thông tin thiết bị
    @NotBlank(message = "Số Serial / IMEI không được để trống")
    @Size(min = 4, max = 50, message = "Số Serial / IMEI từ 4 đến 50 ký tự")
    private String serialNumber;

    private String productName;
    private String maSP;
    private String maHang;
    private String maNhom;
    private String maLoai;
    private String purchaseDate; // YYYY-MM-DD
    private String dealerName;

    // 2. Thông tin yêu cầu bảo hành/sửa chữa (khi formMode = ONLINE_REQUEST)
    private String moTaLoi;
    private String maTram;
    private String thoiGianMongMuon;

    // 3. Thông tin chủ sở hữu / người gửi
    private String fullName;
    private String phone;
    private String email;
    private String address;

    public WarrantyRegisterModel() {
    }

    public String getFormMode() {
        return formMode;
    }

    public void setFormMode(String formMode) {
        this.formMode = formMode;
    }

    public String getSerialNumber() {
        return serialNumber;
    }

    public void setSerialNumber(String serialNumber) {
        this.serialNumber = serialNumber;
    }

    public String getProductName() {
        return productName;
    }

    public void setProductName(String productName) {
        this.productName = productName;
    }

    public String getMaSP() {
        return maSP;
    }

    public void setMaSP(String maSP) {
        this.maSP = maSP;
    }

    public String getMaHang() {
        return maHang;
    }

    public void setMaHang(String maHang) {
        this.maHang = maHang;
    }

    public String getMaNhom() {
        return maNhom;
    }

    public void setMaNhom(String maNhom) {
        this.maNhom = maNhom;
    }

    public String getMaLoai() {
        return maLoai;
    }

    public void setMaLoai(String maLoai) {
        this.maLoai = maLoai;
    }

    public String getPurchaseDate() {
        return purchaseDate;
    }

    public void setPurchaseDate(String purchaseDate) {
        this.purchaseDate = purchaseDate;
    }

    public String getDealerName() {
        return dealerName;
    }

    public void setDealerName(String dealerName) {
        this.dealerName = dealerName;
    }

    public String getMoTaLoi() {
        return moTaLoi;
    }

    public void setMoTaLoi(String moTaLoi) {
        this.moTaLoi = moTaLoi;
    }

    public String getMaTram() {
        return maTram;
    }

    public void setMaTram(String maTram) {
        this.maTram = maTram;
    }

    public String getThoiGianMongMuon() {
        return thoiGianMongMuon;
    }

    public void setThoiGianMongMuon(String thoiGianMongMuon) {
        this.thoiGianMongMuon = thoiGianMongMuon;
    }

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getAddress() {
        return address;
    }

    public void setAddress(String address) {
        this.address = address;
    }
}
