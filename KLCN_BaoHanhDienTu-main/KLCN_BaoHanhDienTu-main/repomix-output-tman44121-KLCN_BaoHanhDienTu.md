This file is a merged representation of the entire codebase, combined into a single document by Repomix.
The content has been processed where security check has been disabled.

# File Summary

## Purpose
This file contains a packed representation of the entire repository's contents.
It is designed to be easily consumable by AI systems for analysis, code review,
or other automated processes.

## File Format
The content is organized as follows:
1. This summary section
2. Repository information
3. Directory structure
4. Repository files (if enabled)
5. Multiple file entries, each consisting of:
  a. A header with the file path (## File: path/to/file)
  b. The full contents of the file in a code block

## Usage Guidelines
- This file should be treated as read-only. Any changes should be made to the
  original repository files, not this packed version.
- When processing this file, use the file path to distinguish
  between different files in the repository.
- Be aware that this file may contain sensitive information. Handle it with
  the same level of security as you would the original repository.

## Notes
- Some files may have been excluded based on .gitignore rules and Repomix's configuration
- Binary files are not included in this packed representation. Please refer to the Repository Structure section for a complete list of file paths, including binary files
- Files matching patterns in .gitignore are excluded
- Files matching default ignore patterns are excluded
- Security check has been disabled - content may contain sensitive information
- Files are sorted by Git change count (files with more changes are at the bottom)

# Directory Structure
```
Controllers/
  AccountController.cs
  HomeController.cs
Models/
  LoginModel.cs
  RegisterModel.cs
Properties/
  launchSettings.json
Views/
  Account/
    Login.cshtml
    Register.cshtml
  Home/
    Index.cshtml
  Shared/
    _Layout.cshtml
  _ViewImports.cshtml
  _ViewStart.cshtml
wwwroot/
  css/
    auth.css
    site.css
.gitignore
appsettings.json
LongManLoc.csproj
Program.cs
```

# Files

## File: Controllers/AccountController.cs
```csharp
using LongManLoc.Models;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace LongManLoc.Controllers
{
    public class AccountController : Controller
    {
        // GET: /Account/Login
        [HttpGet]
        public IActionResult Login()
        {
            // Nếu đã đăng nhập, chuyển thẳng vào trang chính
            if (User.Identity?.IsAuthenticated == true)
                return RedirectToAction("Index", "Home");

            return View();
        }

        // POST: /Account/Login
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Login(LoginModel model)
        {
            if (!ModelState.IsValid)
                return View(model);

            // TODO: Thay bằng kiểm tra tài khoản trong CSDL thực tế
            if (model.Username == "admin" && model.Password == "123456")
            {
                var claims = new List<Claim>
                {
                    new Claim(ClaimTypes.Name, model.Username),
                    new Claim(ClaimTypes.Role, "Admin")
                };

                var claimsIdentity = new ClaimsIdentity(
                    claims, CookieAuthenticationDefaults.AuthenticationScheme);

                var authProperties = new AuthenticationProperties
                {
                    IsPersistent = true,
                    ExpiresUtc = DateTimeOffset.UtcNow.AddMinutes(30)
                };

                await HttpContext.SignInAsync(
                    CookieAuthenticationDefaults.AuthenticationScheme,
                    new ClaimsPrincipal(claimsIdentity),
                    authProperties);

                return RedirectToAction("Index", "Home");
            }

            ModelState.AddModelError(string.Empty, "Tên đăng nhập hoặc mật khẩu không đúng.");
            return View(model);
        }

        // POST: /Account/Logout
        [Authorize]
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Logout()
        {
            await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            return RedirectToAction("Login", "Account");
        }

        // GET: /Account/Register
        [HttpGet]
        public IActionResult Register()
        {
            if (User.Identity?.IsAuthenticated == true)
                return RedirectToAction("Index", "Home");

            return View();
        }

        // POST: /Account/Register
        [HttpPost]
        [ValidateAntiForgeryToken]
        public IActionResult Register(RegisterModel model)
        {
            if (!ModelState.IsValid)
                return View(model);

            // TODO: Thêm logic lưu tài khoản vào CSDL
            
            TempData["SuccessMessage"] = "Đăng ký thành công! Vui lòng đăng nhập.";
            return RedirectToAction("Login", "Account");
        }

        // GET: /Account/AccessDenied
        public IActionResult AccessDenied()
        {
            return View();
        }
    }
}
```

## File: Controllers/HomeController.cs
```csharp
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LongManLoc.Controllers
{
    [Authorize] // Bảo vệ toàn bộ controller: chưa đăng nhập sẽ redirect về /Account/Login
    public class HomeController : Controller
    {
        // GET: /Home/Index
        public IActionResult Index()
        {
            return View();
        }
    }
}
```

## File: Models/LoginModel.cs
```csharp
using System.ComponentModel.DataAnnotations;

namespace LongManLoc.Models
{
    public class LoginModel
    {
        [Required(ErrorMessage = "Vui lòng nhập tên đăng nhập")]
        public string Username { get; set; } = string.Empty;

        [Required(ErrorMessage = "Vui lòng nhập mật khẩu")]
        [DataType(DataType.Password)]
        public string Password { get; set; } = string.Empty;
    }
}
```

## File: Models/RegisterModel.cs
```csharp
using System.ComponentModel.DataAnnotations;

namespace LongManLoc.Models
{
    public class RegisterModel
    {
        [Required(ErrorMessage = "Vui lòng nhập họ và tên")]
        [Display(Name = "Họ và Tên")]
        public string FullName { get; set; } = string.Empty;

        [Required(ErrorMessage = "Vui lòng nhập số điện thoại")]
        [Display(Name = "Số điện thoại")]
        public string Phone { get; set; } = string.Empty;

        [Required(ErrorMessage = "Vui lòng nhập email")]
        [EmailAddress(ErrorMessage = "Email không hợp lệ")]
        [Display(Name = "Email")]
        public string Email { get; set; } = string.Empty;

        [Required(ErrorMessage = "Vui lòng nhập mật khẩu")]
        [MinLength(6, ErrorMessage = "Mật khẩu phải có ít nhất 6 ký tự")]
        [DataType(DataType.Password)]
        [Display(Name = "Mật khẩu")]
        public string Password { get; set; } = string.Empty;

        [Required(ErrorMessage = "Vui lòng xác nhận mật khẩu")]
        [DataType(DataType.Password)]
        [Compare("Password", ErrorMessage = "Mật khẩu xác nhận không khớp")]
        [Display(Name = "Xác nhận mật khẩu")]
        public string ConfirmPassword { get; set; } = string.Empty;
    }
}
```

## File: Properties/launchSettings.json
```json
{
  "profiles": {
    "LongManLoc": {
      "commandName": "Project",
      "launchBrowser": true,
      "environmentVariables": {
        "ASPNETCORE_ENVIRONMENT": "Development"
      },
      "applicationUrl": "https://localhost:65034;http://localhost:65035"
    }
  }
}
```

## File: Views/Account/Login.cshtml
```razor
@model LongManLoc.Models.LoginModel
@{
    ViewData["Title"] = "Đăng nhập";
    Layout = null;
}

<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>@ViewData["Title"] – e-Warranty</title>
    <meta name="description" content="Đăng nhập vào hệ thống quản lý bảo hành điện tử e-Warranty" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="~/css/auth.css" asp-append-version="true" />
</head>
<body class="auth-body">

<div class="auth-container">

    <!-- ============================================================
         CỘT TRÁI – Banner
         ============================================================ -->
    <div class="auth-banner">

        <!-- Header: Logo + Home link -->
        <div class="banner-header">
            <a href="/" class="banner-logo">
                <div class="banner-logo-icon">
                    <!-- Shield icon -->
                    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2L3 6v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V6l-9-4zm-1.06 13.54L7.4 12l1.41-1.41 2.12 2.12 4.24-4.24 1.41 1.41-5.64 5.66z"/>
                    </svg>
                </div>
                <div class="banner-logo-text">
                    <span>Hệ thống</span>
                    <span>e-Warranty</span>
                </div>
            </a>
            <a href="/" class="banner-home-link">
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
                </svg>
                Về trang chủ
            </a>
        </div>

        <!-- Phone mockup with QR scanner -->
        <div class="banner-mockup-area">

            <!-- Floating left badge -->
            <div class="qr-floating-badge">
                <div class="badge-icon">
                    <svg viewBox="0 0 24 24">
                        <path d="M3 11h8V3H3v8zm2-6h4v4H5V5zM3 21h8v-8H3v8zm2-6h4v4H5v-4zM13 3v8h8V3h-8zm6 6h-4V5h4v4zM13 13h2v2h-2v-2zm2 2h2v2h-2v-2zm2-2h2v2h-2v-2zm-4 4h2v2h-2v-2zm2 2h2v2h-2v-2zm2-4h2v2h-2v-2zm2 4h-2v-2h2v2z"/>
                    </svg>
                </div>
                Tra cứu bảo hành chỉ 1 chạm qua QR
            </div>

            <div class="phone-mockup">
                <!-- Activated badge -->
                <div class="phone-badge">
                    <svg viewBox="0 0 24 24">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                    </svg>
                    Đã kích hoạt bảo hành
                </div>

                <div class="phone-notch"></div>

                <div class="phone-screen">
                    <div class="qr-label">QUÉT MÃ QR SẢN PHẨM</div>

                    <div class="qr-frame">
                        <!-- Simple QR-like pattern -->
                        <div class="qr-pattern">
                            <div class="qr-dot"></div><div class="qr-dot"></div><div class="qr-dot"></div><div class="qr-dot empty"></div><div class="qr-dot"></div><div class="qr-dot"></div><div class="qr-dot"></div>
                            <div class="qr-dot"></div><div class="qr-dot empty"></div><div class="qr-dot"></div><div class="qr-dot"></div><div class="qr-dot"></div><div class="qr-dot empty"></div><div class="qr-dot"></div>
                            <div class="qr-dot"></div><div class="qr-dot"></div><div class="qr-dot empty"></div><div class="qr-dot"></div><div class="qr-dot empty"></div><div class="qr-dot"></div><div class="qr-dot"></div>
                            <div class="qr-dot empty"></div><div class="qr-dot"></div><div class="qr-dot"></div><div class="qr-dot empty"></div><div class="qr-dot"></div><div class="qr-dot"></div><div class="qr-dot empty"></div>
                            <div class="qr-dot"></div><div class="qr-dot empty"></div><div class="qr-dot"></div><div class="qr-dot"></div><div class="qr-dot empty"></div><div class="qr-dot"></div><div class="qr-dot"></div>
                            <div class="qr-dot"></div><div class="qr-dot"></div><div class="qr-dot empty"></div><div class="qr-dot"></div><div class="qr-dot"></div><div class="qr-dot empty"></div><div class="qr-dot"></div>
                            <div class="qr-dot"></div><div class="qr-dot"></div><div class="qr-dot"></div><div class="qr-dot empty"></div><div class="qr-dot"></div><div class="qr-dot"></div><div class="qr-dot"></div>
                        </div>
                        <div class="qr-scan-line"></div>
                    </div>

                    <div class="qr-status">
                        <svg viewBox="0 0 24 24" fill="currentColor" width="10" height="10">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
                        </svg>
                        Đang quét...
                    </div>
                </div>
            </div>
        </div>

        <!-- Body text -->
        <div class="banner-body">
            <h2>Quản lý bảo hành sản phẩm dễ dàng hơn bao giờ hết</h2>
            <p>Kích hoạt, tra cứu và quản lý thẻ bảo hành điện tử ngay trên điện thoại của bạn chỉ với một lần quét QR.</p>
        </div>

        <!-- Footer: badge + dots -->
        <div class="banner-footer">
            <div class="activated-badge">
                <svg viewBox="0 0 24 24">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                </svg>
                Hơn 500.000+ sản phẩm đã được kích hoạt tại đây
            </div>
            <div class="dot-pagination">
                <span class="active"></span>
                <span></span>
                <span></span>
            </div>
        </div>

    </div><!-- /.auth-banner -->

    <!-- ============================================================
         CỘT PHẢI – Form đăng nhập
         ============================================================ -->
    <div class="auth-form-panel">

        <!-- Tab switcher -->
        <div class="auth-tabs">
            <a href="/Account/Login" class="auth-tab active" id="tab-login">Đăng nhập</a>
            <a href="/Account/Register" class="auth-tab" id="tab-register">Đăng ký</a>
        </div>

        <!-- Header -->
        <div class="form-header">
            <h1>Đăng nhập tài khoản</h1>
            <p>Chào mừng trở lại! Vui lòng nhập thông tin để tiếp tục.</p>
        </div>

        <!-- Validation summary -->
        @{
            var hasErrors = !ViewData.ModelState.IsValid && ViewData.ModelState.ErrorCount > 0;
        }
        @if (hasErrors)
        {
            <div class="auth-validation-summary" role="alert">
                <div asp-validation-summary="All"></div>
            </div>
        }

        <!-- Social login -->
        <div class="social-buttons">
            <a href="#" class="btn-social btn-google" id="btnGoogleLogin">
                <!-- Google icon -->
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Google
            </a>
            <a href="#" class="btn-social btn-facebook" id="btnFacebookLogin">
                <!-- Facebook icon -->
                <svg viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                Facebook
            </a>
        </div>

        <!-- Divider -->
        <div class="auth-divider">
            <span>HOẶC ĐĂNG NHẬP VỚI EMAIL / SĐT</span>
        </div>

        <!-- Login form -->
        <form id="loginForm" method="post" asp-action="Login" asp-controller="Account">
            @Html.AntiForgeryToken()

            <!-- Username / Email / Phone -->
            <div class="auth-form-group">
                <label for="Username">Email hoặc Số điện thoại</label>
                <div class="auth-input-wrap">
                    <span class="auth-input-icon">
                        <!-- Envelope icon -->
                        <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                            <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                        </svg>
                    </span>
                    <input asp-for="Username"
                           id="Username"
                           class="auth-input"
                           placeholder="name@example.com hoặc 09xxxxxxxx"
                           autocomplete="username"
                           autofocus />
                </div>
                <span asp-validation-for="Username" class="field-validation-error"></span>
            </div>

            <!-- Password -->
            <div class="auth-form-group">
                <label for="Password">Mật khẩu</label>
                <div class="auth-input-wrap">
                    <span class="auth-input-icon">
                        <!-- Lock icon -->
                        <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                            <path d="M18 8h-1V6A5 5 0 0 0 7 6v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2zm-6 9a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm3.1-9H8.9V6a3.1 3.1 0 0 1 6.2 0v2z"/>
                        </svg>
                    </span>
                    <input asp-for="Password"
                           id="Password"
                           type="password"
                           class="auth-input has-eye"
                           placeholder="Nhập mật khẩu của bạn"
                           autocomplete="current-password" />
                    <button type="button" class="eye-toggle" id="togglePassword" aria-label="Hiện/ẩn mật khẩu">
                        <!-- Eye icon (shown when hidden) -->
                        <svg id="eyeIcon" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                        </svg>
                    </button>
                </div>
                <span asp-validation-for="Password" class="field-validation-error"></span>
            </div>

            <!-- Remember + Forgot -->
            <div class="auth-meta-row">
                <label class="custom-check">
                    <input type="checkbox" id="rememberMe" name="RememberMe" value="true" />
                    Ghi nhớ đăng nhập
                </label>
                <a href="#" class="forgot-link" id="linkForgotPassword">Quên mật khẩu?</a>
            </div>

            <!-- Submit -->
            <button id="btnLogin" type="submit" class="btn-auth-submit">
                Đăng nhập
                <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                    <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8-8-8z"/>
                </svg>
            </button>

        </form>

        <!-- Switch to register -->
        <div class="auth-switch">
            Chưa có tài khoản bảo hành?
            <a href="/Account/Register" id="linkRegister">Đăng ký ngay</a>
        </div>

        <!-- Security note -->
        <div class="auth-security-footer">
            <svg viewBox="0 0 24 24">
                <path d="M12 2L3 6v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V6l-9-4zm-1.06 13.54L7.4 12l1.41-1.41 2.12 2.12 4.24-4.24 1.41 1.41-5.64 5.66z"/>
            </svg>
            Thông tin của bạn được mã hóa và bảo mật theo tiêu chuẩn SSL 256-bit
        </div>

    </div><!-- /.auth-form-panel -->

</div><!-- /.auth-container -->

<script>
    // Toggle show/hide password
    document.getElementById('togglePassword').addEventListener('click', function () {
        var pwd = document.getElementById('Password');
        var icon = document.getElementById('eyeIcon');
        if (pwd.type === 'password') {
            pwd.type = 'text';
            icon.innerHTML = '<path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>';
        } else {
            pwd.type = 'password';
            icon.innerHTML = '<path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>';
        }
    });
</script>

</body>
</html>
```

## File: Views/Account/Register.cshtml
```razor
@model LongManLoc.Models.RegisterModel
@{
    ViewData["Title"] = "Đăng ký";
    Layout = null;
}

<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>@ViewData["Title"] – e-Warranty</title>
    <meta name="description" content="Tạo tài khoản để nhận thẻ bảo hành điện tử e-Warranty miễn phí" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="~/css/auth.css" asp-append-version="true" />
</head>
<body class="auth-body">

<div class="auth-container">

    <!-- ============================================================
         CỘT TRÁI – Banner quy trình
         ============================================================ -->
    <div class="auth-banner">

        <!-- Header -->
        <div class="banner-header">
            <a href="/" class="banner-logo">
                <div class="banner-logo-icon">
                    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="white">
                        <path d="M12 2L3 6v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V6l-9-4zm-1.06 13.54L7.4 12l1.41-1.41 2.12 2.12 4.24-4.24 1.41 1.41-5.64 5.66z"/>
                    </svg>
                </div>
                <div class="banner-logo-text">
                    <span>Hệ thống</span>
                    <span>e-Warranty</span>
                </div>
            </a>
            <a href="/" class="banner-home-link">
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
                </svg>
                Về trang chủ
            </a>
        </div>

        <!-- Process steps -->
        <div class="banner-process">
            <!-- Badge top-right -->
            <div class="process-badge-top">
                <svg viewBox="0 0 24 24">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                </svg>
                Chính hãng 100%
            </div>

            <!-- Step 1 -->
            <div class="process-step">
                <div class="process-step-num">
                    <svg viewBox="0 0 24 24" fill="rgba(255,255,255,0.9)">
                        <path d="M12 2a5 5 0 1 1 0 10A5 5 0 0 1 12 2zm0 12c5.33 0 8 2.67 8 4v2H4v-2c0-1.33 2.67-4 8-4z"/>
                    </svg>
                </div>
                <div class="process-step-info">
                    <div class="step-order">01</div>
                    <div class="step-title">Đăng ký tài khoản</div>
                    <div class="step-desc">Tạo tài khoản miễn phí với email hoặc số điện thoại của bạn.</div>
                </div>
            </div>

            <div class="process-connector"></div>

            <!-- Step 2 -->
            <div class="process-step">
                <div class="process-step-num">
                    <svg viewBox="0 0 24 24" fill="rgba(255,255,255,0.9)">
                        <path d="M3 11h8V3H3v8zm2-6h4v4H5V5zM3 21h8v-8H3v8zm2-6h4v4H5v-4zM13 3v8h8V3h-8zm6 6h-4V5h4v4zM13 13h2v2h-2v-2zm2 2h2v2h-2v-2zm2-2h2v2h-2v-2zm-4 4h2v2h-2v-2zm2 2h2v2h-2v-2zm2-4h2v2h-2v-2zm2 4h-2v-2h2v2z"/>
                    </svg>
                </div>
                <div class="process-step-info">
                    <div class="step-order">02</div>
                    <div class="step-title">Quét mã QR sản phẩm</div>
                    <div class="step-desc">Dùng camera điện thoại quét mã QR trên hộp sản phẩm để kích hoạt.</div>
                </div>
            </div>

            <div class="process-connector"></div>

            <!-- Step 3 -->
            <div class="process-step">
                <div class="process-step-num">
                    <svg viewBox="0 0 24 24" fill="rgba(255,255,255,0.9)">
                        <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-9 5h2v2h-2V9zm0 4h2v4h-2v-4zm-4-4h2v6H7V9zm8 6h2v-2h-2v2zm0-4h2V9h-2v2z"/>
                    </svg>
                </div>
                <div class="process-step-info">
                    <div class="step-order">03</div>
                    <div class="step-title">Lưu thẻ bảo hành trọn đời</div>
                    <div class="step-desc">Thẻ bảo hành điện tử được lưu trên hệ thống, không lo mất giấy tờ.</div>
                </div>
            </div>
        </div>

        <!-- Banner body text -->
        <div class="banner-body">
            <h2>Tạo tài khoản nhận ngay thẻ bảo hành điện tử</h2>
            <p>Đăng ký một lần, quản lý bảo hành toàn bộ sản phẩm của bạn mọi lúc mọi nơi trên ứng dụng di động.</p>
        </div>

        <!-- Footer -->
        <div class="banner-footer">
            <div class="activated-badge">
                <svg viewBox="0 0 24 24">
                    <path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/>
                </svg>
                Miễn phí 100% cho người tiêu dùng
            </div>
            <div class="dot-pagination">
                <span></span>
                <span class="active"></span>
                <span></span>
            </div>
        </div>

    </div><!-- /.auth-banner -->

    <!-- ============================================================
         CỘT PHẢI – Form đăng ký
         ============================================================ -->
    <div class="auth-form-panel">

        <!-- Tab switcher -->
        <div class="auth-tabs">
            <a href="/Account/Login" class="auth-tab" id="tab-login">Đăng nhập</a>
            <a href="/Account/Register" class="auth-tab active" id="tab-register">Đăng ký</a>
        </div>

        <!-- Header -->
        <div class="form-header">
            <h1>Tạo tài khoản mới</h1>
            <p>Đăng ký để bắt đầu quản lý bảo hành sản phẩm của bạn.</p>
        </div>

        <!-- Validation summary -->
        @{
            var hasErrors = !ViewData.ModelState.IsValid && ViewData.ModelState.ErrorCount > 0;
        }
        @if (hasErrors)
        {
            <div class="auth-validation-summary" role="alert">
                <div asp-validation-summary="All"></div>
            </div>
        }

        <!-- Social login -->
        <div class="social-buttons">
            <a href="#" class="btn-social btn-google" id="btnGoogleRegister">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Google
            </a>
            <a href="#" class="btn-social btn-facebook" id="btnFacebookRegister">
                <svg viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                Facebook
            </a>
        </div>

        <!-- Divider -->
        <div class="auth-divider">
            <span>HOẶC ĐĂNG KÝ VỚI EMAIL / SĐT</span>
        </div>

        <!-- Register form -->
        <form id="registerForm" method="post" asp-action="Register" asp-controller="Account">
            @Html.AntiForgeryToken()

            <!-- Full Name -->
            <div class="auth-form-group">
                <label for="FullName">Họ và Tên</label>
                <div class="auth-input-wrap">
                    <span class="auth-input-icon">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2a5 5 0 1 1 0 10A5 5 0 0 1 12 2zm0 12c5.33 0 8 2.67 8 4v2H4v-2c0-1.33 2.67-4 8-4z"/>
                        </svg>
                    </span>
                    <input asp-for="FullName"
                           id="FullName"
                           class="auth-input"
                           placeholder="Nguyễn Văn A"
                           autocomplete="name"
                           autofocus />
                </div>
                <span asp-validation-for="FullName" class="field-validation-error"></span>
            </div>

            <!-- Phone -->
            <div class="auth-form-group">
                <label for="Phone">Số điện thoại</label>
                <div class="auth-input-wrap">
                    <span class="auth-input-icon">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                        </svg>
                    </span>
                    <input asp-for="Phone"
                           id="Phone"
                           class="auth-input"
                           placeholder="09xxxxxxxx"
                           autocomplete="tel" />
                </div>
                <span asp-validation-for="Phone" class="field-validation-error"></span>
            </div>

            <!-- Email -->
            <div class="auth-form-group">
                <label for="Email">Email</label>
                <div class="auth-input-wrap">
                    <span class="auth-input-icon">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                        </svg>
                    </span>
                    <input asp-for="Email"
                           id="Email"
                           type="email"
                           class="auth-input"
                           placeholder="name@example.com"
                           autocomplete="email" />
                </div>
                <span asp-validation-for="Email" class="field-validation-error"></span>
            </div>

            <!-- Password -->
            <div class="auth-form-group">
                <label for="Password">Mật khẩu</label>
                <div class="auth-input-wrap">
                    <span class="auth-input-icon">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M18 8h-1V6A5 5 0 0 0 7 6v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2zm-6 9a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm3.1-9H8.9V6a3.1 3.1 0 0 1 6.2 0v2z"/>
                        </svg>
                    </span>
                    <input asp-for="Password"
                           id="Password"
                           type="password"
                           class="auth-input has-eye"
                           placeholder="Tối thiểu 6 ký tự"
                           autocomplete="new-password" />
                    <button type="button" class="eye-toggle" id="togglePassword" aria-label="Hiện/ẩn mật khẩu">
                        <svg id="eyeIcon" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                        </svg>
                    </button>
                </div>
                <span asp-validation-for="Password" class="field-validation-error"></span>
            </div>

            <!-- Confirm Password -->
            <div class="auth-form-group">
                <label for="ConfirmPassword">Xác nhận mật khẩu</label>
                <div class="auth-input-wrap">
                    <span class="auth-input-icon">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2L3 6v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V6l-9-4zm-1.06 13.54L7.4 12l1.41-1.41 2.12 2.12 4.24-4.24 1.41 1.41-5.64 5.66z"/>
                        </svg>
                    </span>
                    <input asp-for="ConfirmPassword"
                           id="ConfirmPassword"
                           type="password"
                           class="auth-input has-eye"
                           placeholder="Nhập lại mật khẩu"
                           autocomplete="new-password" />
                    <button type="button" class="eye-toggle" id="toggleConfirmPassword" aria-label="Hiện/ẩn mật khẩu xác nhận">
                        <svg id="eyeIconConfirm" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                        </svg>
                    </button>
                </div>
                <span asp-validation-for="ConfirmPassword" class="field-validation-error"></span>
            </div>

            <!-- Terms checkbox -->
            <div class="terms-row">
                <input type="checkbox" id="agreeTerms" name="AgreeTerms" required />
                <label for="agreeTerms">
                    Tôi đã đọc và đồng ý với
                    <a href="#" id="linkTerms">Điều khoản dịch vụ</a>
                    &amp;
                    <a href="#" id="linkPrivacy">Chính sách bảo mật</a>
                    của e-Warranty.
                </label>
            </div>

            <!-- Submit -->
            <button id="btnRegister" type="submit" class="btn-auth-submit">
                Tạo tài khoản ngay
                <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                    <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8-8-8z"/>
                </svg>
            </button>

        </form>

        <!-- Switch to login -->
        <div class="auth-switch">
            Đã có tài khoản?
            <a href="/Account/Login" id="linkLogin">Đăng nhập ngay</a>
        </div>

        <!-- Security note -->
        <div class="auth-security-footer">
            <svg viewBox="0 0 24 24">
                <path d="M12 2L3 6v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V6l-9-4zm-1.06 13.54L7.4 12l1.41-1.41 2.12 2.12 4.24-4.24 1.41 1.41-5.64 5.66z"/>
            </svg>
            Thông tin của bạn được mã hóa và bảo mật theo tiêu chuẩn SSL 256-bit
        </div>

    </div><!-- /.auth-form-panel -->

</div><!-- /.auth-container -->

<script>
    function makeToggle(btnId, inputId, iconId) {
        document.getElementById(btnId).addEventListener('click', function () {
            var inp = document.getElementById(inputId);
            var icon = document.getElementById(iconId);
            if (inp.type === 'password') {
                inp.type = 'text';
                icon.innerHTML = '<path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>';
            } else {
                inp.type = 'password';
                icon.innerHTML = '<path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>';
            }
        });
    }
    makeToggle('togglePassword', 'Password', 'eyeIcon');
    makeToggle('toggleConfirmPassword', 'ConfirmPassword', 'eyeIconConfirm');
</script>

</body>
</html>
```

## File: Views/Home/Index.cshtml
```razor
@{
    ViewData["Title"] = "Trang chủ";
}

<div class="welcome-section">
    <div class="welcome-card">
        <div class="welcome-icon">
            <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0 1 12 2.944a11.955 11.955 0 0 1-8.618 3.04A12.02 12.02 0 0 0 3 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
            </svg>
        </div>
        <h2>Đăng nhập thành công!</h2>
        <p class="welcome-name">Xin chào, <strong>@User.Identity?.Name</strong> 👋</p>
        <p class="welcome-desc">Bạn đã đăng nhập vào hệ thống với vai trò <span class="role-badge">Admin</span>.</p>
        <p class="welcome-desc">Đây là trang chủ được bảo vệ bởi <code>[Authorize]</code>. Chỉ người dùng đã đăng nhập mới thấy được trang này.</p>

        <div class="info-grid">
            <div class="info-item">
                <span class="info-label">Tài khoản</span>
                <span class="info-value">@User.Identity?.Name</span>
            </div>
            <div class="info-item">
                <span class="info-label">Trạng thái</span>
                <span class="info-value status-online">● Đang hoạt động</span>
            </div>
            <div class="info-item">
                <span class="info-label">Phương thức xác thực</span>
                <span class="info-value">Cookie Authentication</span>
            </div>
            <div class="info-item">
                <span class="info-label">Thời hạn phiên</span>
                <span class="info-value">30 phút</span>
            </div>
        </div>
    </div>
</div>
```

## File: Views/Shared/_Layout.cshtml
```razor
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>@ViewData["Title"] – LongManLoc</title>
    <meta name="description" content="Hệ thống quản lý LongManLoc – ASP.NET Core MVC" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="~/css/site.css" asp-append-version="true" />
</head>
<body>
    <!-- Navbar -->
    <nav class="navbar" role="navigation" aria-label="Main navigation">
        <div class="navbar-container">
            <a class="navbar-brand" asp-controller="Home" asp-action="Index">
                <span class="brand-icon">
                    <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                        <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0 1 12 2.944a11.955 11.955 0 0 1-8.618 3.04A12.02 12.02 0 0 0 3 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                    </svg>
                </span>
                LongManLoc
            </a>

            <div class="navbar-right">
                @if (User.Identity != null && User.Identity.IsAuthenticated)
                {
                    <span class="user-greeting">
                        <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                            <path d="M12 2a5 5 0 1 1 0 10A5 5 0 0 1 12 2zm0 12c5.33 0 8 2.67 8 4v2H4v-2c0-1.33 2.67-4 8-4z"/>
                        </svg>
                        Xin chào, <strong>@User.Identity.Name</strong>
                    </span>
                    <form id="logoutForm"
                          asp-action="Logout"
                          asp-controller="Account"
                          method="post"
                          style="display:inline;">
                        @Html.AntiForgeryToken()
                        <button id="btnLogout" type="submit" class="btn-logout">
                            <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                                <path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/>
                            </svg>
                            Đăng xuất
                        </button>
                    </form>
                }
                else
                {
                    <a id="linkLogin" class="btn-nav-login" asp-action="Login" asp-controller="Account">
                        Đăng nhập
                    </a>
                }
            </div>
        </div>
    </nav>

    <!-- Main Content -->
    <main class="main-content" role="main">
        @RenderBody()
    </main>
</body>
</html>
```

## File: Views/_ViewImports.cshtml
```razor
@using LongManLoc
@using LongManLoc.Models
@addTagHelper *, Microsoft.AspNetCore.Mvc.TagHelpers
```

## File: Views/_ViewStart.cshtml
```razor
@{
    Layout = "_Layout";
}
```

## File: wwwroot/css/auth.css
```css
/* =========================================================
   auth.css – Dùng chung cho Login & Register (e-Warranty)
   ========================================================= */

/* ---- Reset & Base ---- */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body.auth-body {
    font-family: 'Inter', sans-serif;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f0f4f8;
    padding: 24px 12px;
}

/* ---- Outer wrapper ---- */
.auth-container {
    display: flex;
    width: 100%;
    max-width: 1080px;
    min-height: 680px;
    border-radius: 24px;
    overflow: hidden;
    box-shadow: 0 24px 80px rgba(15,41,66,.18), 0 4px 20px rgba(0,0,0,.08);
    border: 1px solid rgba(255,255,255,.6);
}

/* ================================================================
   BANNER COLUMN (Left)
   ================================================================ */
.auth-banner {
    flex: 1;
    position: relative;
    background: linear-gradient(135deg, #0f2942 0%, #0a4a3a 55%, #0a5c4a 100%);
    display: flex;
    flex-direction: column;
    padding: 32px 36px 36px;
    overflow: hidden;
    color: #fff;
}

/* decorative blobs */
.auth-banner::before {
    content: '';
    position: absolute;
    width: 320px; height: 320px;
    border-radius: 50%;
    background: rgba(255,255,255,.04);
    top: -80px; right: -80px;
    pointer-events: none;
}
.auth-banner::after {
    content: '';
    position: absolute;
    width: 200px; height: 200px;
    border-radius: 50%;
    background: rgba(255,255,255,.04);
    bottom: 60px; left: -60px;
    pointer-events: none;
}

/* ---- Banner header ---- */
.banner-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    position: relative;
    z-index: 2;
}

.banner-logo {
    display: flex;
    align-items: center;
    gap: 10px;
    text-decoration: none;
}

.banner-logo-icon {
    width: 42px; height: 42px;
    background: rgba(255,255,255,.15);
    border: 1.5px solid rgba(255,255,255,.3);
    border-radius: 12px;
    display: flex; align-items: center; justify-content: center;
    backdrop-filter: blur(8px);
}

.banner-logo-icon svg { width: 22px; height: 22px; fill: #ffffff; }

.banner-logo-text {
    display: flex; flex-direction: column;
    line-height: 1.15;
}

.banner-logo-text span:first-child {
    font-size: .7rem;
    font-weight: 600;
    letter-spacing: .12em;
    text-transform: uppercase;
    color: rgba(255,255,255,.6);
}
.banner-logo-text span:last-child {
    font-size: .95rem;
    font-weight: 700;
    color: #fff;
}

.banner-home-link {
    font-size: .8rem;
    color: rgba(255,255,255,.75);
    text-decoration: none;
    display: flex; align-items: center; gap: 4px;
    transition: color .2s;
}
.banner-home-link:hover { color: #fff; }
.banner-home-link svg { width: 14px; height: 14px; }

/* ---- Mockup area ---- */
.banner-mockup-area {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    z-index: 2;
    margin: 20px 0;
}

/* Phone mockup */
.phone-mockup {
    width: 160px;
    background: #fff;
    border-radius: 28px;
    padding: 14px 10px;
    box-shadow: 0 20px 60px rgba(0,0,0,.4), 0 4px 16px rgba(0,0,0,.2);
    position: relative;
    border: 2px solid rgba(255,255,255,.15);
}

.phone-notch {
    width: 50px; height: 8px;
    background: #1a1a2e;
    border-radius: 4px;
    margin: 0 auto 10px;
}

.phone-screen {
    background: #f8fafc;
    border-radius: 18px;
    padding: 14px 10px;
    overflow: hidden;
    min-height: 200px;
    display: flex; flex-direction: column; align-items: center; gap: 8px;
}

.qr-label {
    font-size: .5rem;
    font-weight: 600;
    color: #374151;
    text-align: center;
    letter-spacing: .04em;
}

.qr-frame {
    width: 100px; height: 100px;
    border: 2px solid #e5e7eb;
    border-radius: 10px;
    position: relative;
    display: flex; align-items: center; justify-content: center;
    background: #fff;
}

/* QR code dots pattern */
.qr-pattern {
    width: 70px; height: 70px;
    display: grid; grid-template-columns: repeat(7,1fr); gap: 2px;
}
.qr-dot {
    width: 100%; aspect-ratio: 1;
    background: #1a1a2e;
    border-radius: 1px;
}
.qr-dot.empty { background: transparent; }

/* scan line overlay */
.qr-scan-line {
    position: absolute;
    left: 6px; right: 6px; height: 2px;
    background: linear-gradient(90deg, transparent, #10b981, transparent);
    top: 30%;
    animation: scanMove 2s ease-in-out infinite;
    box-shadow: 0 0 8px rgba(16,185,129,.6);
}

@keyframes scanMove {
    0%, 100% { top: 15%; }
    50% { top: 75%; }
}

/* corner brackets */
.qr-frame::before, .qr-frame::after {
    content: '';
    position: absolute;
    width: 16px; height: 16px;
    border-color: #10b981;
    border-style: solid;
}
.qr-frame::before {
    top: 4px; left: 4px;
    border-width: 2px 0 0 2px;
    border-radius: 2px 0 0 0;
}
.qr-frame::after {
    bottom: 4px; right: 4px;
    border-width: 0 2px 2px 0;
    border-radius: 0 0 2px 0;
}

.qr-status {
    font-size: .5rem; font-weight: 600;
    color: #10b981;
    text-align: center;
    display: flex; align-items: center; gap: 3px;
}

/* activated badge floating */
.phone-badge {
    position: absolute;
    top: -14px; right: -20px;
    background: #10b981;
    color: #fff;
    border-radius: 20px;
    padding: 5px 9px;
    font-size: .48rem;
    font-weight: 700;
    display: flex; align-items: center; gap: 4px;
    box-shadow: 0 4px 12px rgba(16,185,129,.4);
    white-space: nowrap;
    border: 2px solid #fff;
    animation: float 3s ease-in-out infinite;
}
.phone-badge svg { width: 10px; height: 10px; fill: #fff; }

@keyframes float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-5px); }
}

/* QR badge floating left */
.qr-floating-badge {
    position: absolute;
    left: -18px;
    top: 50%;
    transform: translateY(-50%);
    background: rgba(255,255,255,.95);
    backdrop-filter: blur(10px);
    border-radius: 14px;
    padding: 8px 10px;
    font-size: .5rem;
    font-weight: 600;
    color: #0f2942;
    box-shadow: 0 8px 24px rgba(0,0,0,.2);
    max-width: 90px;
    text-align: center;
    line-height: 1.3;
    border: 1px solid rgba(255,255,255,.8);
    animation: float 3.5s ease-in-out infinite .5s;
    z-index: 3;
}
.qr-floating-badge .badge-icon {
    width: 22px; height: 22px;
    background: linear-gradient(135deg, #0f2942, #0a5c4a);
    border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    margin: 0 auto 4px;
}
.qr-floating-badge .badge-icon svg { width: 12px; height: 12px; fill: #fff; }

/* ---- Process steps (Register banner) ---- */
.banner-process {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 16px;
    position: relative;
    z-index: 2;
    padding: 20px 0;
}

.process-badge-top {
    position: absolute;
    top: 0; right: 0;
    background: linear-gradient(135deg, #f59e0b, #f97316);
    color: #fff;
    padding: 5px 12px;
    border-radius: 20px;
    font-size: .7rem;
    font-weight: 700;
    letter-spacing: .04em;
    display: flex; align-items: center; gap: 4px;
    box-shadow: 0 4px 14px rgba(249,115,22,.35);
}
.process-badge-top svg { width: 12px; height: 12px; fill: #fff; }

.process-step {
    display: flex;
    align-items: flex-start;
    gap: 14px;
}

.process-step-num {
    width: 44px; height: 44px;
    border-radius: 50%;
    background: rgba(255,255,255,.12);
    border: 1.5px solid rgba(255,255,255,.3);
    display: flex; align-items: center; justify-content: center;
    font-size: .7rem;
    font-weight: 800;
    color: #fff;
    flex-shrink: 0;
    position: relative;
    z-index: 1;
}

.process-step-num svg { width: 20px; height: 20px; fill: rgba(255,255,255,.9); }

.process-step-info { flex: 1; }
.process-step-info .step-order {
    font-size: .6rem;
    font-weight: 700;
    letter-spacing: .1em;
    color: #10b981;
    text-transform: uppercase;
    margin-bottom: 2px;
}
.process-step-info .step-title {
    font-size: .9rem;
    font-weight: 700;
    color: #fff;
    line-height: 1.3;
}
.process-step-info .step-desc {
    font-size: .75rem;
    color: rgba(255,255,255,.65);
    line-height: 1.45;
    margin-top: 2px;
}

.process-connector {
    width: 1px;
    height: 16px;
    background: rgba(255,255,255,.2);
    margin-left: 21px;
}

/* ---- Banner body text ---- */
.banner-body {
    position: relative;
    z-index: 2;
}

.banner-body h2 {
    font-size: 1.45rem;
    font-weight: 800;
    line-height: 1.3;
    color: #fff;
    margin-bottom: 10px;
    letter-spacing: -.3px;
}

.banner-body p {
    font-size: .85rem;
    color: rgba(255,255,255,.75);
    line-height: 1.6;
}

/* ---- Banner footer ---- */
.banner-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 24px;
    position: relative;
    z-index: 2;
}

.activated-badge {
    background: rgba(255,255,255,.1);
    border: 1px solid rgba(255,255,255,.2);
    border-radius: 20px;
    padding: 7px 12px;
    font-size: .72rem;
    font-weight: 600;
    color: rgba(255,255,255,.9);
    display: flex; align-items: center; gap: 6px;
    backdrop-filter: blur(8px);
}
.activated-badge svg { width: 14px; height: 14px; fill: #10b981; }

.dot-pagination {
    display: flex;
    align-items: center;
    gap: 5px;
}
.dot-pagination span {
    width: 7px; height: 7px;
    border-radius: 50%;
    background: rgba(255,255,255,.35);
    cursor: pointer;
    transition: all .2s;
}
.dot-pagination span.active {
    background: #fff;
    width: 18px;
    border-radius: 4px;
}

/* ================================================================
   FORM COLUMN (Right)
   ================================================================ */
.auth-form-panel {
    flex: 1;
    background: #ffffff;
    display: flex;
    flex-direction: column;
    padding: 32px 40px 28px;
    position: relative;
    overflow-y: auto;
    max-height: 100%;
}

/* ---- Tab switcher ---- */
.auth-tabs {
    position: absolute;
    top: 24px; right: 28px;
    display: flex;
    background: #f3f4f6;
    border-radius: 10px;
    padding: 3px;
    gap: 2px;
}

.auth-tab {
    padding: 6px 14px;
    border-radius: 8px;
    font-size: .78rem;
    font-weight: 600;
    color: #6b7280;
    text-decoration: none;
    transition: all .2s;
}
.auth-tab:hover { color: #374151; }
.auth-tab.active {
    background: #fff;
    color: #0a5c4a;
    box-shadow: 0 1px 4px rgba(0,0,0,.1);
}

/* ---- Form header ---- */
.form-header {
    margin-top: 16px;
    margin-bottom: 24px;
}

.form-header h1 {
    font-size: 1.7rem;
    font-weight: 800;
    color: #111827;
    letter-spacing: -.4px;
    line-height: 1.2;
}

.form-header p {
    font-size: .875rem;
    color: #6b7280;
    margin-top: 6px;
    line-height: 1.5;
}

/* ---- Social buttons ---- */
.social-buttons {
    display: flex;
    gap: 10px;
    margin-bottom: 20px;
}

.btn-social {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 10px 12px;
    border-radius: 10px;
    font-size: .82rem;
    font-weight: 600;
    cursor: pointer;
    text-decoration: none;
    transition: all .2s;
    font-family: 'Inter', sans-serif;
    border: 1.5px solid transparent;
}

.btn-google {
    background: #fff;
    border-color: #d1d5db;
    color: #374151;
}
.btn-google:hover {
    border-color: #9ca3af;
    background: #f9fafb;
    box-shadow: 0 2px 8px rgba(0,0,0,.08);
}

.btn-facebook {
    background: #1877F2;
    color: #fff;
}
.btn-facebook:hover {
    background: #166fe5;
    box-shadow: 0 2px 8px rgba(24,119,242,.35);
}

.btn-social svg { width: 18px; height: 18px; flex-shrink: 0; }

/* ---- Divider ---- */
.auth-divider {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 20px;
}
.auth-divider::before, .auth-divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background: #e5e7eb;
}
.auth-divider span {
    font-size: .68rem;
    font-weight: 600;
    color: #9ca3af;
    letter-spacing: .07em;
    white-space: nowrap;
}

/* ---- Form groups ---- */
.auth-form-group {
    margin-bottom: 16px;
}

.auth-form-group label {
    display: block;
    font-size: .825rem;
    font-weight: 600;
    color: #374151;
    margin-bottom: 6px;
}

.auth-input-wrap {
    position: relative;
}

.auth-input-icon {
    position: absolute;
    left: 13px;
    top: 50%;
    transform: translateY(-50%);
    color: #9ca3af;
    display: flex; align-items: center;
    pointer-events: none;
    transition: color .2s;
}
.auth-input-icon svg { width: 17px; height: 17px; }

.auth-input-wrap:focus-within .auth-input-icon { color: #0a5c4a; }

.auth-input {
    width: 100%;
    padding: 11px 14px 11px 42px;
    border: 1.5px solid #e5e7eb;
    border-radius: 10px;
    font-size: .9rem;
    font-family: 'Inter', sans-serif;
    color: #111827;
    background: #f9fafb;
    outline: none;
    transition: all .2s;
}

.auth-input:focus {
    border-color: #0a5c4a;
    background: #fff;
    box-shadow: 0 0 0 3px rgba(10,92,74,.1);
}

.auth-input.input-validation-error {
    border-color: #f87171;
    background: #fff5f5;
}

/* password with eye toggle */
.auth-input.has-eye { padding-right: 44px; }

.eye-toggle {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    cursor: pointer;
    color: #9ca3af;
    padding: 2px;
    display: flex; align-items: center;
    transition: color .2s;
}
.eye-toggle:hover { color: #374151; }
.eye-toggle svg { width: 17px; height: 17px; }

/* validation */
.field-validation-error {
    display: block;
    font-size: .76rem;
    color: #dc2626;
    margin-top: 4px;
}

.auth-validation-summary {
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 10px;
    padding: 10px 14px;
    margin-bottom: 16px;
    color: #dc2626;
    font-size: .82rem;
}
.auth-validation-summary ul { padding-left: 16px; margin: 0; }

/* ---- Remember / Forgot row ---- */
.auth-meta-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
}

.custom-check {
    display: flex;
    align-items: center;
    gap: 7px;
    cursor: pointer;
    font-size: .82rem;
    color: #374151;
    user-select: none;
}
.custom-check input[type="checkbox"] {
    width: 16px; height: 16px;
    border: 1.5px solid #d1d5db;
    border-radius: 4px;
    appearance: none;
    cursor: pointer;
    background: #fff;
    flex-shrink: 0;
    transition: all .2s;
    position: relative;
}
.custom-check input[type="checkbox"]:checked {
    background: #0a5c4a;
    border-color: #0a5c4a;
}
.custom-check input[type="checkbox"]:checked::after {
    content: '';
    position: absolute;
    left: 4px; top: 1px;
    width: 5px; height: 9px;
    border: 2px solid #fff;
    border-top: none; border-left: none;
    transform: rotate(45deg);
}

.forgot-link {
    font-size: .82rem;
    color: #0a5c4a;
    text-decoration: none;
    font-weight: 600;
    transition: color .2s;
}
.forgot-link:hover { color: #064e3b; text-decoration: underline; }

/* terms checkbox row */
.terms-row {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin-bottom: 20px;
}
.terms-row input[type="checkbox"] {
    width: 16px; height: 16px;
    border: 1.5px solid #d1d5db;
    border-radius: 4px;
    appearance: none;
    cursor: pointer;
    background: #fff;
    flex-shrink: 0;
    margin-top: 2px;
    transition: all .2s;
    position: relative;
}
.terms-row input[type="checkbox"]:checked {
    background: #0a5c4a;
    border-color: #0a5c4a;
}
.terms-row input[type="checkbox"]:checked::after {
    content: '';
    position: absolute;
    left: 4px; top: 1px;
    width: 5px; height: 9px;
    border: 2px solid #fff;
    border-top: none; border-left: none;
    transform: rotate(45deg);
}
.terms-row label {
    font-size: .82rem;
    color: #374151;
    line-height: 1.45;
    cursor: pointer;
}
.terms-row a {
    color: #0a5c4a;
    font-weight: 600;
    text-decoration: none;
}
.terms-row a:hover { text-decoration: underline; }

/* ---- Submit button ---- */
.btn-auth-submit {
    width: 100%;
    padding: 13px;
    background: linear-gradient(135deg, #0f2942 0%, #0a5c4a 100%);
    color: #fff;
    border: none;
    border-radius: 12px;
    font-size: 1rem;
    font-weight: 700;
    font-family: 'Inter', sans-serif;
    cursor: pointer;
    letter-spacing: .3px;
    transition: all .25s;
    box-shadow: 0 4px 18px rgba(10,92,74,.35);
    display: flex; align-items: center; justify-content: center; gap: 6px;
    margin-bottom: 18px;
}
.btn-auth-submit:hover {
    background: linear-gradient(135deg, #0d2238 0%, #085048 100%);
    box-shadow: 0 6px 24px rgba(10,92,74,.45);
    transform: translateY(-1px);
}
.btn-auth-submit:active {
    transform: translateY(0);
    box-shadow: 0 2px 10px rgba(10,92,74,.3);
}

/* ---- Switch link ---- */
.auth-switch {
    text-align: center;
    font-size: .84rem;
    color: #6b7280;
    margin-bottom: 16px;
}
.auth-switch a {
    color: #0a5c4a;
    font-weight: 700;
    text-decoration: none;
}
.auth-switch a:hover { text-decoration: underline; }

/* ---- Security footer ---- */
.auth-security-footer {
    margin-top: auto;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-size: .72rem;
    color: #9ca3af;
    padding-top: 16px;
    border-top: 1px solid #f3f4f6;
    text-align: center;
    line-height: 1.5;
}
.auth-security-footer svg {
    width: 14px; height: 14px;
    fill: #9ca3af;
    flex-shrink: 0;
}

/* ================================================================
   RESPONSIVE
   ================================================================ */
@media (max-width: 768px) {
    body.auth-body { padding: 0; align-items: stretch; }

    .auth-container {
        flex-direction: column;
        border-radius: 0;
        min-height: 100vh;
        box-shadow: none;
        border: none;
    }

    .auth-banner { display: none; }

    .auth-form-panel {
        padding: 28px 24px 24px;
        flex: 1;
        max-height: unset;
    }

    .auth-tabs {
        top: 20px; right: 20px;
    }

    .form-header h1 { font-size: 1.45rem; }

    .social-buttons { flex-direction: column; }
}

@media (max-width: 480px) {
    .auth-form-panel { padding: 24px 16px 20px; }
    .form-header h1 { font-size: 1.25rem; }
}

/* ---- Animations ---- */
@keyframes slideInRight {
    from { opacity: 0; transform: translateX(20px); }
    to   { opacity: 1; transform: translateX(0); }
}

.auth-form-panel {
    animation: slideInRight .4s cubic-bezier(.22,1,.36,1) both;
}

/* ---- Two-column form row ---- */
.auth-form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
}

@media (max-width: 480px) {
    .auth-form-row { grid-template-columns: 1fr; }
}
```

## File: wwwroot/css/site.css
```css
/* =========================================================
   site.css – LoginDemo Global Stylesheet
   Font: Inter (Google Fonts)
   Primary: #006b5b | Accent: #00897b
   ========================================================= */

*, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}

html, body {
    height: 100%;
    font-family: 'Inter', sans-serif;
    font-size: 16px;
    color: #1f2937;
    background-color: #f3f4f6;
}

/* ---- Navbar ---- */
.navbar {
    position: sticky;
    top: 0;
    z-index: 100;
    background: #ffffff;
    border-bottom: 1px solid #e5e7eb;
    box-shadow: 0 1px 8px rgba(0, 0, 0, 0.06);
}

.navbar-container {
    max-width: 1100px;
    margin: 0 auto;
    padding: 0 24px;
    height: 60px;
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.navbar-brand {
    display: flex;
    align-items: center;
    gap: 10px;
    text-decoration: none;
    font-size: 1.1rem;
    font-weight: 700;
    color: #006b5b;
    letter-spacing: -0.3px;
}

.brand-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    background: linear-gradient(135deg, #006b5b, #00897b);
    border-radius: 9px;
}

.brand-icon svg {
    width: 20px;
    height: 20px;
    fill: #ffffff;
}

.navbar-right {
    display: flex;
    align-items: center;
    gap: 14px;
}

.user-greeting {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.875rem;
    color: #4b5563;
}

.btn-logout {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 16px;
    background: transparent;
    border: 1.5px solid #006b5b;
    border-radius: 8px;
    color: #006b5b;
    font-size: 0.875rem;
    font-weight: 500;
    font-family: 'Inter', sans-serif;
    cursor: pointer;
    transition: background 0.2s, color 0.2s;
}

.btn-logout:hover {
    background: #006b5b;
    color: #ffffff;
}

.btn-nav-login {
    display: inline-block;
    padding: 7px 18px;
    background: linear-gradient(135deg, #006b5b, #00897b);
    color: #ffffff;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 600;
    text-decoration: none;
    transition: opacity 0.2s;
}

.btn-nav-login:hover { opacity: 0.88; }

/* ---- Main Content ---- */
.main-content {
    max-width: 1100px;
    margin: 0 auto;
    padding: 40px 24px;
}

/* ---- Welcome Section (Home/Index) ---- */
.welcome-section {
    display: flex;
    justify-content: center;
    padding: 20px 0;
}

.welcome-card {
    background: #ffffff;
    border-radius: 20px;
    padding: 40px 36px;
    max-width: 580px;
    width: 100%;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
    text-align: center;
    animation: fadeIn 0.4s ease both;
}

@keyframes fadeIn {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
}

.welcome-icon {
    width: 64px;
    height: 64px;
    background: linear-gradient(135deg, #006b5b, #00897b);
    border-radius: 18px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 20px;
}

.welcome-icon svg {
    width: 34px;
    height: 34px;
    fill: #ffffff;
}

.welcome-card h2 {
    font-size: 1.6rem;
    font-weight: 700;
    color: #111827;
    margin-bottom: 8px;
}

.welcome-name {
    font-size: 1rem;
    color: #374151;
    margin-bottom: 8px;
}

.welcome-desc {
    font-size: 0.9rem;
    color: #6b7280;
    margin-bottom: 6px;
    line-height: 1.6;
}

.welcome-desc code {
    background: #f0fdf4;
    color: #065f46;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.85rem;
}

.info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-top: 28px;
    text-align: left;
}

.info-item {
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    padding: 14px 16px;
}

.info-label {
    display: block;
    font-size: 0.75rem;
    font-weight: 500;
    color: #9ca3af;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 4px;
}

.info-value {
    display: block;
    font-size: 0.9rem;
    font-weight: 600;
    color: #1f2937;
}

.status-online { color: #16a34a; }

.role-badge {
    display: inline-block;
    padding: 2px 10px;
    background: #d1fae5;
    color: #065f46;
    border-radius: 20px;
    font-size: 0.8rem;
    font-weight: 600;
}
```

## File: .gitignore
```
## Ignore Visual Studio temporary files, build results, and
## files generated by popular Visual Studio add-ons.
##
## Get latest from `dotnet new gitignore`

# dotenv files
.env

# User-specific files
*.rsuser
*.suo
*.user
*.userosscache
*.sln.docstates

# User-specific files (MonoDevelop/Xamarin Studio)
*.userprefs

# Mono auto generated files
mono_crash.*

# Build results
[Dd]ebug/
[Dd]ebugPublic/
[Rr]elease/
[Rr]eleases/
x64/
x86/
[Ww][Ii][Nn]32/
[Aa][Rr][Mm]/
[Aa][Rr][Mm]64/
bld/
[Bb]in/
[Oo]bj/
[Ll]og/
[Ll]ogs/

# Visual Studio 2015/2017 cache/options directory
.vs/
# Uncomment if you have tasks that create the project's static files in wwwroot
#wwwroot/

# Visual Studio 2017 auto generated files
Generated\ Files/

# MSTest test Results
[Tt]est[Rr]esult*/
[Bb]uild[Ll]og.*

# NUnit
*.VisualState.xml
TestResult.xml
nunit-*.xml

# Build Results of an ATL Project
[Dd]ebugPS/
[Rr]eleasePS/
dlldata.c

# Benchmark Results
BenchmarkDotNet.Artifacts/

# .NET
project.lock.json
project.fragment.lock.json
artifacts/

# Tye
.tye/

# ASP.NET Scaffolding
ScaffoldingReadMe.txt

# StyleCop
StyleCopReport.xml

# Files built by Visual Studio
*_i.c
*_p.c
*_h.h
*.ilk
*.meta
*.obj
*.iobj
*.pch
*.pdb
*.ipdb
*.pgc
*.pgd
*.rsp
*.sbr
*.tlb
*.tli
*.tlh
*.tmp
*.tmp_proj
*_wpftmp.csproj
*.log
*.tlog
*.vspscc
*.vssscc
.builds
*.pidb
*.svclog
*.scc

# Chutzpah Test files
_Chutzpah*

# Visual C++ cache files
ipch/
*.aps
*.ncb
*.opendb
*.opensdf
*.sdf
*.cachefile
*.VC.db
*.VC.VC.opendb

# Visual Studio profiler
*.psess
*.vsp
*.vspx
*.sap

# Visual Studio Trace Files
*.e2e

# TFS 2012 Local Workspace
$tf/

# Guidance Automation Toolkit
*.gpState

# ReSharper is a .NET coding add-in
_ReSharper*/
*.[Rr]e[Ss]harper
*.DotSettings.user

# TeamCity is a build add-in
_TeamCity*

# DotCover is a Code Coverage Tool
*.dotCover

# AxoCover is a Code Coverage Tool
.axoCover/*
!.axoCover/settings.json

# Coverlet is a free, cross platform Code Coverage Tool
coverage*.json
coverage*.xml
coverage*.info

# Visual Studio code coverage results
*.coverage
*.coveragexml

# NCrunch
_NCrunch_*
.*crunch*.local.xml
nCrunchTemp_*

# MightyMoose
*.mm.*
AutoTest.Net/

# Web workbench (sass)
.sass-cache/

# Installshield output folder
[Ee]xpress/

# DocProject is a documentation generator add-in
DocProject/buildhelp/
DocProject/Help/*.HxT
DocProject/Help/*.HxC
DocProject/Help/*.hhc
DocProject/Help/*.hhk
DocProject/Help/*.hhp
DocProject/Help/Html2
DocProject/Help/html

# Click-Once directory
publish/

# Publish Web Output
*.[Pp]ublish.xml
*.azurePubxml
# Note: Comment the next line if you want to checkin your web deploy settings,
# but database connection strings (with potential passwords) will be unencrypted
*.pubxml
*.publishproj

# Microsoft Azure Web App publish settings. Comment the next line if you want to
# checkin your Azure Web App publish settings, but sensitive information contained
# in these scripts will be unencrypted
PublishScripts/

# NuGet Packages
*.nupkg
# NuGet Symbol Packages
*.snupkg
# The packages folder can be ignored because of Package Restore
**/[Pp]ackages/*
# except build/, which is used as an MSBuild target.
!**/[Pp]ackages/build/
# Uncomment if necessary however generally it will be regenerated when needed
#!**/[Pp]ackages/repositories.config
# NuGet v3's project.json files produces more ignorable files
*.nuget.props
*.nuget.targets

# Microsoft Azure Build Output
csx/
*.build.csdef

# Microsoft Azure Emulator
ecf/
rcf/

# Windows Store app package directories and files
AppPackages/
BundleArtifacts/
Package.StoreAssociation.xml
_pkginfo.txt
*.appx
*.appxbundle
*.appxupload

# Visual Studio cache files
# files ending in .cache can be ignored
*.[Cc]ache
# but keep track of directories ending in .cache
!?*.[Cc]ache/

# Others
ClientBin/
~$*
*~
*.dbmdl
*.dbproj.schemaview
*.jfm
*.pfx
*.publishsettings
orleans.codegen.cs

# Including strong name files can present a security risk
# (https://github.com/github/gitignore/pull/2483#issue-259490424)
#*.snk

# Since there are multiple workflows, uncomment next line to ignore bower_components
# (https://github.com/github/gitignore/pull/1529#issuecomment-104372622)
#bower_components/

# RIA/Silverlight projects
Generated_Code/

# Backup & report files from converting an old project file
# to a newer Visual Studio version. Backup files are not needed,
# because we have git ;-)
_UpgradeReport_Files/
Backup*/
UpgradeLog*.XML
UpgradeLog*.htm
ServiceFabricBackup/
*.rptproj.bak

# SQL Server files
*.mdf
*.ldf
*.ndf

# Business Intelligence projects
*.rdl.data
*.bim.layout
*.bim_*.settings
*.rptproj.rsuser
*- [Bb]ackup.rdl
*- [Bb]ackup ([0-9]).rdl
*- [Bb]ackup ([0-9][0-9]).rdl

# Microsoft Fakes
FakesAssemblies/

# GhostDoc plugin setting file
*.GhostDoc.xml

# Node.js Tools for Visual Studio
.ntvs_analysis.dat
node_modules/

# Visual Studio 6 build log
*.plg

# Visual Studio 6 workspace options file
*.opt

# Visual Studio 6 auto-generated workspace file (contains which files were open etc.)
*.vbw

# Visual Studio 6 auto-generated project file (contains which files were open etc.)
*.vbp

# Visual Studio 6 workspace and project file (working project files containing files to include in project)
*.dsw
*.dsp

# Visual Studio 6 technical files
*.ncb
*.aps

# Visual Studio LightSwitch build output
**/*.HTMLClient/GeneratedArtifacts
**/*.DesktopClient/GeneratedArtifacts
**/*.DesktopClient/ModelManifest.xml
**/*.Server/GeneratedArtifacts
**/*.Server/ModelManifest.xml
_Pvt_Extensions

# Paket dependency manager
.paket/paket.exe
paket-files/

# FAKE - F# Make
.fake/

# CodeRush personal settings
.cr/personal

# Python Tools for Visual Studio (PTVS)
__pycache__/
*.pyc

# Cake - Uncomment if you are using it
# tools/**
# !tools/packages.config

# Tabs Studio
*.tss

# Telerik's JustMock configuration file
*.jmconfig

# BizTalk build output
*.btp.cs
*.btm.cs
*.odx.cs
*.xsd.cs

# OpenCover UI analysis results
OpenCover/

# Azure Stream Analytics local run output
ASALocalRun/

# MSBuild Binary and Structured Log
*.binlog

# NVidia Nsight GPU debugger configuration file
*.nvuser

# MFractors (Xamarin productivity tool) working folder
.mfractor/

# Local History for Visual Studio
.localhistory/

# Visual Studio History (VSHistory) files
.vshistory/

# BeatPulse healthcheck temp database
healthchecksdb

# Backup folder for Package Reference Convert tool in Visual Studio 2017
MigrationBackup/

# Ionide (cross platform F# VS Code tools) working folder
.ionide/

# Fody - auto-generated XML schema
FodyWeavers.xsd

# VS Code files for those working on multiple tools
.vscode/*
!.vscode/settings.json
!.vscode/tasks.json
!.vscode/launch.json
!.vscode/extensions.json
*.code-workspace

# Local History for Visual Studio Code
.history/

# Windows Installer files from build outputs
*.cab
*.msi
*.msix
*.msm
*.msp

# JetBrains Rider
*.sln.iml
.idea/

##
## Visual studio for Mac
##


# globs
Makefile.in
*.userprefs
*.usertasks
config.make
config.status
aclocal.m4
install-sh
autom4te.cache/
*.tar.gz
tarballs/
test-results/

# Mac bundle stuff
*.dmg
*.app

# content below from: https://github.com/github/gitignore/blob/main/Global/macOS.gitignore
# General
.DS_Store
.AppleDouble
.LSOverride

# Icon must end with two \r
Icon


# Thumbnails
._*

# Files that might appear in the root of a volume
.DocumentRevisions-V100
.fseventsd
.Spotlight-V100
.TemporaryItems
.Trashes
.VolumeIcon.icns
.com.apple.timemachine.donotpresent

# Directories potentially created on remote AFP share
.AppleDB
.AppleDesktop
Network Trash Folder
Temporary Items
.apdisk

# content below from: https://github.com/github/gitignore/blob/main/Global/Windows.gitignore
# Windows thumbnail cache files
Thumbs.db
ehthumbs.db
ehthumbs_vista.db

# Dump file
*.stackdump

# Folder config file
[Dd]esktop.ini

# Recycle Bin used on file shares
$RECYCLE.BIN/

# Windows Installer files
*.cab
*.msi
*.msix
*.msm
*.msp

# Windows shortcuts
*.lnk

# Vim temporary swap files
*.swp
```

## File: appsettings.json
```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "*"
}
```

## File: LongManLoc.csproj
```
<Project Sdk="Microsoft.NET.Sdk.Web">

  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <RootNamespace>LongManLoc</RootNamespace>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="Microsoft.AspNetCore.Authentication.Cookies" Version="2.2.0" />
  </ItemGroup>

</Project>
```

## File: Program.cs
```csharp
using Microsoft.AspNetCore.Authentication.Cookies;

var builder = WebApplication.CreateBuilder(args);

// Thêm dịch vụ MVC
builder.Services.AddControllersWithViews();

// Cấu hình Cookie Authentication
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.LoginPath = "/Account/Login";         // Trang đăng nhập
        options.LogoutPath = "/Account/Logout";       // Trang đăng xuất
        options.AccessDeniedPath = "/Account/AccessDenied";
        options.ExpireTimeSpan = TimeSpan.FromMinutes(30);
    });

var app = builder.Build();

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseRouting();

app.UseAuthentication(); // Bắt buộc phải có trước UseAuthorization
app.UseAuthorization();

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Account}/{action=Login}/{id?}");

app.Run();
```
