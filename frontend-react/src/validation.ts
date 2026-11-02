/* Kiểm tra ô nhập phía khách, cùng quy tắc với PhoneNumber/EmailAddress/PasswordPolicy ở backend, để báo lỗi ngay khi gõ. */

export const normalizePhone = (raw: string) => {
  const digits = raw.replace(/[^0-9+]/g, "");
  return (digits.startsWith("+84") ? "0" + digits.slice(3) : digits).replace(/\+/g, "");
};

export function phoneError(raw: string): string | undefined {
  if (!raw.trim()) return "Vui lòng nhập số điện thoại.";
  if (/[^0-9+\s.-]/.test(raw)) return "Số điện thoại chỉ gồm chữ số (có thể có dấu cách, dấu chấm hoặc +84).";
  const phone = normalizePhone(raw);
  if (!phone.startsWith("0")) return "Số điện thoại phải bắt đầu bằng 0 (hoặc +84).";
  if (phone.length < 10) return `Số điện thoại mới có ${phone.length} chữ số — cần 10 hoặc 11 chữ số.`;
  if (phone.length > 11) return `Số điện thoại có ${phone.length} chữ số — tối đa 11 chữ số.`;
  return undefined;
}

export function emailError(raw: string): string | undefined {
  const email = raw.trim();
  if (!email) return "Vui lòng nhập email.";
  if (/\s/.test(email)) return "Email không được chứa dấu cách.";
  const at = email.indexOf("@");
  if (at < 0) return "Email thiếu ký tự @ (ví dụ ten@gmail.com).";
  if (email.indexOf("@", at + 1) >= 0) return "Email chỉ được có một ký tự @.";
  if (at === 0) return "Thiếu phần tên trước @ (ví dụ ten@gmail.com).";
  const domain = email.slice(at + 1);
  if (!domain) return "Thiếu tên miền sau @ (ví dụ @gmail.com).";
  if (!/^[^.]+(\.[^.]+)+$/.test(domain)) return `Tên miền "${domain}" chưa đầy đủ — ví dụ gmail.com.`;
  if (email.length > 100) return "Email quá dài — tối đa 100 ký tự.";
  return undefined;
}

const COMMON_DOMAINS = ["gmail.com", "yahoo.com", "yahoo.com.vn", "outlook.com", "hotmail.com", "icloud.com", "live.com"];

function distance(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const current = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = current;
    }
  }
  return row[b.length];
}

/** Tên miền gần giống email phổ biến (mail.com, gmial.com, gmail.con…) → địa chỉ gợi ý; không chặn gửi. */
export function emailSuggestion(raw: string): string | undefined {
  const email = raw.trim().toLowerCase();
  const at = email.lastIndexOf("@");
  if (at <= 0 || emailError(email)) return undefined;
  const domain = email.slice(at + 1);
  if (COMMON_DOMAINS.includes(domain)) return undefined;
  const match = COMMON_DOMAINS.map((candidate) => ({ candidate, score: distance(domain, candidate) }))
    .filter(({ score }) => score > 0 && score <= 2)
    .sort((x, y) => x.score - y.score)[0];
  return match ? email.slice(0, at + 1) + match.candidate : undefined;
}

/** Từng điều kiện mật khẩu để hiện danh sách ✓/✗ khi gõ. */
export function passwordRules(password: string, login: string) {
  const phone = normalizePhone(login);
  return [
    { label: "Tối thiểu 10 ký tự", ok: password.length >= 10 },
    { label: "Có ít nhất một chữ cái", ok: /\p{L}/u.test(password) },
    { label: "Có ít nhất một chữ số", ok: /[0-9]/.test(password) },
    { label: "Không chứa số điện thoại", ok: !password || !phone || !password.toLowerCase().includes(phone) },
  ];
}

export function passwordError(password: string, login: string): string | undefined {
  if (!password) return "Vui lòng nhập mật khẩu.";
  if (password.length < 10) return `Mật khẩu mới có ${password.length} ký tự — cần tối thiểu 10 ký tự.`;
  if (!/\p{L}/u.test(password)) return "Mật khẩu cần có ít nhất một chữ cái.";
  if (!/[0-9]/.test(password)) return "Mật khẩu cần có ít nhất một chữ số.";
  const phone = normalizePhone(login);
  if (phone && password.toLowerCase().includes(phone)) return "Mật khẩu không được chứa số điện thoại (tên đăng nhập).";
  return undefined;
}
