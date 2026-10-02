package com.example.weblongmanloc.controller;

import com.example.weblongmanloc.service.DashboardService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;

import java.util.Map;

@Controller
public class HomeController {

    private final DashboardService dashboardService;

    @Autowired
    public HomeController(DashboardService dashboardService) {
        this.dashboardService = dashboardService;
    }

    @GetMapping("/")
    public String index(Model model, Authentication authentication) {
        String username = (authentication != null && authentication.isAuthenticated() && !authentication.getName().equals("anonymousUser"))
                ? authentication.getName()
                : null;

        Map<String, Object> stats = dashboardService.getDashboardStats(username);
        model.addAllAttributes(stats);
        return "home/index";
    }
}
