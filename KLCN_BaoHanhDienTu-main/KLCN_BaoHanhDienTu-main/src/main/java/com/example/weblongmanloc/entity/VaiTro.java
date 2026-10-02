package com.example.weblongmanloc.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "VaiTro")
public class VaiTro {

    @Id
    @Column(name = "MaVaiTro", length = 30)
    private String maVaiTro;

    @Column(name = "TenHienThi", length = 60, nullable = false, unique = true)
    private String tenHienThi;

    @Column(name = "TenCuV1", length = 50)
    private String tenCuV1;

    @Column(name = "TrangDich", length = 100, nullable = false)
    private String trangDich;

    @Column(name = "MoTa", length = 255)
    private String moTa;

    public VaiTro() {
    }

    public VaiTro(String maVaiTro, String tenHienThi, String trangDich) {
        this.maVaiTro = maVaiTro;
        this.tenHienThi = tenHienThi;
        this.trangDich = trangDich;
    }

    public String getMaVaiTro() {
        return maVaiTro;
    }

    public void setMaVaiTro(String maVaiTro) {
        this.maVaiTro = maVaiTro;
    }

    public String getTenHienThi() {
        return tenHienThi;
    }

    public void setTenHienThi(String tenHienThi) {
        this.tenHienThi = tenHienThi;
    }

    public String getTenCuV1() {
        return tenCuV1;
    }

    public void setTenCuV1(String tenCuV1) {
        this.tenCuV1 = tenCuV1;
    }

    public String getTrangDich() {
        return trangDich;
    }

    public void setTrangDich(String trangDich) {
        this.trangDich = trangDich;
    }

    public String getMoTa() {
        return moTa;
    }

    public void setMoTa(String moTa) {
        this.moTa = moTa;
    }
}
