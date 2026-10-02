package com.example.weblongmanloc.controller;

import com.example.weblongmanloc.dto.CustomerDeviceDto;
import com.example.weblongmanloc.dto.LookupResultDto;
import com.example.weblongmanloc.dto.WarrantyTicketDetailDto;
import com.example.weblongmanloc.model.ProfileModel;
import com.example.weblongmanloc.model.WarrantyRegisterModel;
import com.example.weblongmanloc.service.AccountService;
import com.example.weblongmanloc.service.DashboardService;
import com.example.weblongmanloc.service.WarrantyService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

import java.util.List;

@Controller
@RequestMapping("/Warranty")
public class WarrantyController {

    private final DashboardService dashboardService;
    private final WarrantyService warrantyService;
    private final AccountService accountService;

    @Autowired
    public WarrantyController(DashboardService dashboardService,
                              WarrantyService warrantyService,
                              AccountService accountService) {
        this.dashboardService = dashboardService;
        this.warrantyService = warrantyService;
        this.accountService = accountService;
    }

    // =========================================================================
    // 1. ĐĂNG KÝ / KÍCH HOẠT BẢO HÀNH (REGISTER)
    // =========================================================================

    @GetMapping("/Register")
    public String showRegisterPage(@RequestParam(value = "mode", required = false, defaultValue = "ACTIVATE") String mode,
                                   @RequestParam(value = "serial", required = false) String serial,
                                   Model model,
                                   Authentication authentication) {
        String username = (authentication != null && authentication.isAuthenticated() && !authentication.getName().equals("anonymousUser"))
                ? authentication.getName()
                : null;

        String userFullName = dashboardService.getUserFullName(username);
        model.addAttribute("userFullName", userFullName);

        // Pre-populate form with user details if logged in
        WarrantyRegisterModel registerModel = new WarrantyRegisterModel();
        registerModel.setFormMode(mode);
        if (serial != null && !serial.trim().isEmpty()) {
            registerModel.setSerialNumber(serial.trim());
        }

        if (username != null) {
            ProfileModel profile = accountService.getProfile(username);
            registerModel.setFullName(profile.getHoTen());
            registerModel.setPhone(profile.getSdt());
            registerModel.setEmail(profile.getEmail());
            registerModel.setAddress(profile.getDiaChi());
        }

        model.addAttribute("warrantyRegisterModel", registerModel);

        // Dropdown selection data
        model.addAttribute("tramList", warrantyService.getTramDichVuList());
        model.addAttribute("hangList", warrantyService.getHangSanXuatList());
        model.addAttribute("nhomList", warrantyService.getNhomThietBiList());
        model.addAttribute("loaiList", warrantyService.getLoaiThietBiList());

        // Danh sách thiết bị đã đăng ký của khách hàng để hiển thị tham khảo
        if (username != null) {
            List<CustomerDeviceDto> customerDevices = warrantyService.getCustomerDevices(username);
            model.addAttribute("customerDevices", customerDevices);
        }

        return "warranty/register";
    }

    @PostMapping("/Register")
    public String processWarrantyRegister(@Valid @ModelAttribute("warrantyRegisterModel") WarrantyRegisterModel registerModel,
                                          BindingResult bindingResult,
                                          Authentication authentication,
                                          RedirectAttributes redirectAttributes,
                                          Model model) {
        String username = (authentication != null && authentication.isAuthenticated() && !authentication.getName().equals("anonymousUser"))
                ? authentication.getName()
                : null;

        String userFullName = dashboardService.getUserFullName(username);
        model.addAttribute("userFullName", userFullName);

        if (bindingResult.hasErrors()) {
            model.addAttribute("tramList", warrantyService.getTramDichVuList());
            model.addAttribute("hangList", warrantyService.getHangSanXuatList());
            model.addAttribute("nhomList", warrantyService.getNhomThietBiList());
            model.addAttribute("loaiList", warrantyService.getLoaiThietBiList());
            if (username != null) {
                model.addAttribute("customerDevices", warrantyService.getCustomerDevices(username));
            }
            return "warranty/register";
        }

        try {
            if ("ONLINE_REQUEST".equalsIgnoreCase(registerModel.getFormMode())) {
                String maYeuCau = warrantyService.createOnlineWarrantyRequest(registerModel, username);
                redirectAttributes.addFlashAttribute("successMessage",
                    "Gửi yêu cầu bảo hành / sửa chữa trực tuyến thành công! Mã yêu cầu: " + maYeuCau + ". Chúng tôi sẽ liên hệ quý khách sớm nhất.");
                return "redirect:/Warranty/History";
            } else {
                String maThietBi = warrantyService.registerOrActivateWarranty(registerModel, username);
                redirectAttributes.addFlashAttribute("successMessage",
                    "Kích hoạt bảo hành điện tử thành công! Mã thiết bị: " + maThietBi + " (Serial: " + registerModel.getSerialNumber() + ")");
                return "redirect:/Warranty/Register?success=true";
            }
        } catch (Exception e) {
            model.addAttribute("errorMessage", "Không thể hoàn tất đăng ký: " + e.getMessage());
            model.addAttribute("tramList", warrantyService.getTramDichVuList());
            model.addAttribute("hangList", warrantyService.getHangSanXuatList());
            model.addAttribute("nhomList", warrantyService.getNhomThietBiList());
            model.addAttribute("loaiList", warrantyService.getLoaiThietBiList());
            if (username != null) {
                model.addAttribute("customerDevices", warrantyService.getCustomerDevices(username));
            }
            return "warranty/register";
        }
    }

    // =========================================================================
    // 2. QUẢN LÝ LỊCH SỬ BẢO HÀNH (HISTORY / TICKETS)
    // =========================================================================

    @GetMapping("/History")
    public String showWarrantyHistory(@RequestParam(value = "status", required = false, defaultValue = "ALL") String status,
                                      @RequestParam(value = "search", required = false) String search,
                                      Model model,
                                      Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated() || authentication.getName().equals("anonymousUser")) {
            return "redirect:/Account/Login";
        }

        String username = authentication.getName();
        String userFullName = dashboardService.getUserFullName(username);
        model.addAttribute("userFullName", userFullName);

        List<WarrantyTicketDetailDto> tickets = warrantyService.getCustomerWarrantyHistory(username, status, search);
        model.addAttribute("tickets", tickets);
        model.addAttribute("currentStatus", status);
        model.addAttribute("currentSearch", search != null ? search : "");

        // Thống kê nhanh
        long totalTickets = tickets.size();
        long repairingCount = tickets.stream().filter(t -> "REPAIRING".equalsIgnoreCase(t.getTrangThai()) || "INSPECTING".equalsIgnoreCase(t.getTrangThai()) || "RECEIVED".equalsIgnoreCase(t.getTrangThai())).count();
        long completedCount = tickets.stream().filter(t -> "COMPLETED".equalsIgnoreCase(t.getTrangThai()) || "DELIVERED".equalsIgnoreCase(t.getTrangThai())).count();
        long waitingCount = tickets.stream().filter(t -> "AWAITING_PARTS".equalsIgnoreCase(t.getTrangThai()) || "AWAITING_QUOTE_APPROVAL".equalsIgnoreCase(t.getTrangThai())).count();

        model.addAttribute("totalTickets", totalTickets);
        model.addAttribute("repairingCount", repairingCount);
        model.addAttribute("completedCount", completedCount);
        model.addAttribute("waitingCount", waitingCount);

        return "warranty/history";
    }

    @GetMapping("/Detail/{maPhieu}")
    public String showTicketDetail(@PathVariable("maPhieu") String maPhieu,
                                   Model model,
                                   Authentication authentication) {
        String username = (authentication != null && authentication.isAuthenticated() && !authentication.getName().equals("anonymousUser"))
                ? authentication.getName()
                : null;

        String userFullName = dashboardService.getUserFullName(username);
        model.addAttribute("userFullName", userFullName);

        WarrantyTicketDetailDto ticket = warrantyService.getTicketDetail(maPhieu);
        if (ticket == null) {
            return "redirect:/Warranty/History";
        }

        model.addAttribute("ticket", ticket);
        return "warranty/detail";
    }

    // =========================================================================
    // 3. TRA CỨU BẢO HÀNH (LOOKUP)
    // =========================================================================

    @GetMapping("/Lookup")
    public String lookupWarranty(@RequestParam(value = "keyword", required = false) String keyword,
                                 Model model,
                                 Authentication authentication) {
        String username = (authentication != null && authentication.isAuthenticated() && !authentication.getName().equals("anonymousUser"))
                ? authentication.getName()
                : null;

        String userFullName = dashboardService.getUserFullName(username);
        model.addAttribute("userFullName", userFullName);
        model.addAttribute("keyword", keyword);

        if (keyword != null && !keyword.trim().isEmpty()) {
            LookupResultDto lookupResult = warrantyService.lookupWarranty(keyword);
            model.addAttribute("lookupResult", lookupResult);
        }

        return "warranty/lookup";
    }

    @PostMapping("/Lookup")
    public String processLookup(@RequestParam("keyword") String keyword,
                                RedirectAttributes redirectAttributes) {
        if (keyword == null || keyword.trim().isEmpty()) {
            redirectAttributes.addFlashAttribute("errorMessage", "Vui lòng nhập Serial, IMEI hoặc Mã phiếu");
            return "redirect:/Warranty/Lookup";
        }
        return "redirect:/Warranty/Lookup?keyword=" + keyword.trim();
    }
}
