package com.example.weblongmanloc.service;

import com.example.weblongmanloc.entity.TaiKhoan;
import com.example.weblongmanloc.entity.VaiTro;
import com.example.weblongmanloc.repository.TaiKhoanRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
public class CustomUserDetailsService implements UserDetailsService {

    private final TaiKhoanRepository taiKhoanRepository;

    @Autowired
    public CustomUserDetailsService(TaiKhoanRepository taiKhoanRepository) {
        this.taiKhoanRepository = taiKhoanRepository;
    }

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        if (username == null || username.trim().isEmpty()) {
            throw new UsernameNotFoundException("Tên đăng nhập không được để trống");
        }

        String identifier = username.trim();

        // 1. Tìm theo TenDangNhap
        Optional<TaiKhoan> taiKhoanOpt = taiKhoanRepository.findByTenDangNhapIgnoreCase(identifier);

        // 2. Nếu không thấy, tìm theo SĐT hoặc Email của Khách hàng
        if (taiKhoanOpt.isEmpty()) {
            taiKhoanOpt = taiKhoanRepository.findByKhachHangContactInfo(identifier);
        }

        // 3. Nếu vẫn không thấy, tìm theo SĐT hoặc Email của Nhân viên
        if (taiKhoanOpt.isEmpty()) {
            taiKhoanOpt = taiKhoanRepository.findByNhanVienContactInfo(identifier);
        }

        TaiKhoan taiKhoan = taiKhoanOpt.orElseThrow(() ->
            new UsernameNotFoundException("Tài khoản hoặc thông tin đăng nhập không tồn tại: " + identifier));

        boolean isEnabled = !"LOCKED".equalsIgnoreCase(taiKhoan.getTrangThai());

        List<GrantedAuthority> authorities = new ArrayList<>();
        if (taiKhoan.getVaiTros() != null && !taiKhoan.getVaiTros().isEmpty()) {
            for (VaiTro vaiTro : taiKhoan.getVaiTros()) {
                authorities.add(new SimpleGrantedAuthority("ROLE_" + vaiTro.getMaVaiTro()));
            }
        } else {
            authorities.add(new SimpleGrantedAuthority("ROLE_CUSTOMER"));
        }

        return new User(
            taiKhoan.getTenDangNhap(),
            taiKhoan.getMatKhauHash(),
            isEnabled,
            true,
            true,
            isEnabled,
            authorities
        );
    }
}
