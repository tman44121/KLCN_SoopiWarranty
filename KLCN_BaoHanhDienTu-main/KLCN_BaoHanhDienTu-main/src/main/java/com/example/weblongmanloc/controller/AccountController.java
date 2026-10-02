package com.example.weblongmanloc.controller;

import com.example.weblongmanloc.dto.CustomerDeviceDto;
import com.example.weblongmanloc.model.ChangePasswordModel;
import com.example.weblongmanloc.model.LoginModel;
import com.example.weblongmanloc.model.ProfileModel;
import com.example.weblongmanloc.model.RegisterModel;
import com.example.weblongmanloc.service.AccountService;
import com.example.weblongmanloc.service.DashboardService;
import com.example.weblongmanloc.service.WarrantyService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

import java.util.List;

@Controller
@RequestMapping("/Account")
public class AccountController {

    private final AccountService accountService;
    private final DashboardService dashboardService;
    private final WarrantyService warrantyService;

    @Autowired
    public AccountController(AccountService accountService,
                             DashboardService dashboardService,
                             WarrantyService warrantyService) {
        this.accountService = accountService;
        this.dashboardService = dashboardService;
        this.warrantyService = warrantyService;
    }

    // =========================================================================
    // 1. LOGIN & REGISTER
    // =========================================================================

    @GetMapping("/Login")
    public String login(Model model, Authentication authentication) {
        if (authentication != null && authentication.isAuthenticated() && !authentication.getName().equals("anonymousUser")) {
            return "redirect:/";
        }
        if (!model.containsAttribute("loginModel")) {
            model.addAttribute("loginModel", new LoginModel());
        }
        return "account/login";
    }

    @GetMapping("/Register")
    public String register(Model model, Authentication authentication) {
        if (authentication != null && authentication.isAuthenticated() && !authentication.getName().equals("anonymousUser")) {
            return "redirect:/";
        }
        if (!model.containsAttribute("registerModel")) {
            model.addAttribute("registerModel", new RegisterModel());
        }
        return "account/register";
    }

    @PostMapping("/Register")
    public String processRegister(@Valid @ModelAttribute("registerModel") RegisterModel registerModel,
                                  BindingResult bindingResult,
                                  RedirectAttributes redirectAttributes,
                                  Model model) {
        if (registerModel.getPassword() != null && !registerModel.getPassword().equals(registerModel.getConfirmPassword())) {
            bindingResult.rejectValue("confirmPassword", "error.registerModel", "Mật khẩu xác nhận không khớp");
        }

        if (bindingResult.hasErrors()) {
            return "account/register";
        }

        try {
            accountService.registerCustomer(registerModel);
            redirectAttributes.addFlashAttribute("successMessage", "Đăng ký tài khoản thành công! Vui lòng đăng nhập.");
            return "redirect:/Account/Login";
        } catch (IllegalArgumentException e) {
            model.addAttribute("errorMessage", e.getMessage());
            return "account/register";
        } catch (Exception e) {
            model.addAttribute("errorMessage", "Đã có lỗi xảy ra trong quá trình đăng ký: " + e.getMessage());
            return "account/register";
        }
    }

    // =========================================================================
    // 2. PROFILE / THÔNG TIN CÁ NHÂN
    // =========================================================================

    @GetMapping("/Profile")
    public String showProfile(Model model, Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated() || authentication.getName().equals("anonymousUser")) {
            return "redirect:/Account/Login";
        }

        String username = authentication.getName();
        String userFullName = dashboardService.getUserFullName(username);
        model.addAttribute("userFullName", userFullName);

        ProfileModel profileModel = accountService.getProfile(username);
        model.addAttribute("profileModel", profileModel);

        List<CustomerDeviceDto> customerDevices = warrantyService.getCustomerDevices(username);
        model.addAttribute("customerDevices", customerDevices);

        return "account/profile";
    }

    @PostMapping("/Profile")
    public String updateProfile(@Valid @ModelAttribute("profileModel") ProfileModel profileModel,
                                BindingResult bindingResult,
                                Authentication authentication,
                                RedirectAttributes redirectAttributes,
                                Model model) {
        if (authentication == null || !authentication.isAuthenticated() || authentication.getName().equals("anonymousUser")) {
            return "redirect:/Account/Login";
        }

        String username = authentication.getName();
        String userFullName = dashboardService.getUserFullName(username);
        model.addAttribute("userFullName", userFullName);

        if (bindingResult.hasErrors()) {
            List<CustomerDeviceDto> customerDevices = warrantyService.getCustomerDevices(username);
            model.addAttribute("customerDevices", customerDevices);
            return "account/profile";
        }

        try {
            accountService.updateProfile(username, profileModel);
            redirectAttributes.addFlashAttribute("successMessage", "Cập nhật thông tin cá nhân thành công!");
            return "redirect:/Account/Profile";
        } catch (Exception e) {
            model.addAttribute("errorMessage", "Không thể cập nhật thông tin: " + e.getMessage());
            List<CustomerDeviceDto> customerDevices = warrantyService.getCustomerDevices(username);
            model.addAttribute("customerDevices", customerDevices);
            return "account/profile";
        }
    }

    // =========================================================================
    // 3. CHANGE PASSWORD / ĐỔI MẬT KHẨU
    // =========================================================================

    @GetMapping("/ChangePassword")
    public String showChangePassword(Model model, Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated() || authentication.getName().equals("anonymousUser")) {
            return "redirect:/Account/Login";
        }

        String username = authentication.getName();
        String userFullName = dashboardService.getUserFullName(username);
        model.addAttribute("userFullName", userFullName);

        if (!model.containsAttribute("changePasswordModel")) {
            model.addAttribute("changePasswordModel", new ChangePasswordModel());
        }

        return "account/change-password";
    }

    @PostMapping("/ChangePassword")
    public String processChangePassword(@Valid @ModelAttribute("changePasswordModel") ChangePasswordModel changePasswordModel,
                                        BindingResult bindingResult,
                                        Authentication authentication,
                                        RedirectAttributes redirectAttributes,
                                        Model model) {
        if (authentication == null || !authentication.isAuthenticated() || authentication.getName().equals("anonymousUser")) {
            return "redirect:/Account/Login";
        }

        String username = authentication.getName();
        String userFullName = dashboardService.getUserFullName(username);
        model.addAttribute("userFullName", userFullName);

        if (changePasswordModel.getNewPassword() != null && !changePasswordModel.getNewPassword().equals(changePasswordModel.getConfirmPassword())) {
            bindingResult.rejectValue("confirmPassword", "error.changePasswordModel", "Mật khẩu xác nhận không khớp");
        }

        if (bindingResult.hasErrors()) {
            return "account/change-password";
        }

        try {
            accountService.changePassword(username, changePasswordModel);
            redirectAttributes.addFlashAttribute("successMessage", "Đổi mật khẩu thành công! Hãy ghi nhớ mật khẩu mới của bạn.");
            return "redirect:/Account/ChangePassword";
        } catch (IllegalArgumentException e) {
            model.addAttribute("errorMessage", e.getMessage());
            return "account/change-password";
        } catch (Exception e) {
            model.addAttribute("errorMessage", "Đã có lỗi xảy ra: " + e.getMessage());
            return "account/change-password";
        }
    }
}
