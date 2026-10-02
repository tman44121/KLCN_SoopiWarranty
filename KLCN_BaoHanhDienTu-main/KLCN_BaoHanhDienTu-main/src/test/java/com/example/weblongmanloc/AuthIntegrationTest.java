package com.example.weblongmanloc;

import com.example.weblongmanloc.entity.KhachHang;
import com.example.weblongmanloc.entity.TaiKhoan;
import com.example.weblongmanloc.model.RegisterModel;
import com.example.weblongmanloc.repository.KhachHangRepository;
import com.example.weblongmanloc.repository.TaiKhoanRepository;
import com.example.weblongmanloc.service.AccountService;
import com.example.weblongmanloc.service.CustomUserDetailsService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@Transactional
public class AuthIntegrationTest {

    @Autowired
    private CustomUserDetailsService userDetailsService;

    @Autowired
    private AccountService accountService;

    @Autowired
    private TaiKhoanRepository taiKhoanRepository;

    @Autowired
    private KhachHangRepository khachHangRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Test
    void testLoadExistingUserFromDatabase() {
        // 'admin' is a seeded user in csdl.txt
        UserDetails userDetails = userDetailsService.loadUserByUsername("admin");
        assertNotNull(userDetails);
        assertEquals("admin", userDetails.getUsername());
        assertTrue(userDetails.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN")));
    }

    @Test
    void testRegisterNewCustomerAndLogin() {
        String testPhone = "0987654321";
        String testEmail = "testuser@gmail.com";
        String rawPassword = "password123";

        RegisterModel model = new RegisterModel();
        model.setFullName("Nguyễn Văn Test");
        model.setPhone(testPhone);
        model.setEmail(testEmail);
        model.setPassword(rawPassword);
        model.setConfirmPassword(rawPassword);

        KhachHang createdCustomer = accountService.registerCustomer(model);
        assertNotNull(createdCustomer);
        assertNotNull(createdCustomer.getMaKH());
        assertEquals(testPhone, createdCustomer.getSdt());
        assertEquals(testEmail, createdCustomer.getEmail());

        TaiKhoan linkedAccount = createdCustomer.getTaiKhoan();
        assertNotNull(linkedAccount);
        assertEquals(testPhone, linkedAccount.getTenDangNhap());
        assertTrue(passwordEncoder.matches(rawPassword, linkedAccount.getMatKhauHash()));

        // Test loading by phone number
        UserDetails userDetailsByPhone = userDetailsService.loadUserByUsername(testPhone);
        assertNotNull(userDetailsByPhone);
        assertEquals(testPhone, userDetailsByPhone.getUsername());

        // Test loading by email
        UserDetails userDetailsByEmail = userDetailsService.loadUserByUsername(testEmail);
        assertNotNull(userDetailsByEmail);
        assertEquals(testPhone, userDetailsByEmail.getUsername());
    }
}
